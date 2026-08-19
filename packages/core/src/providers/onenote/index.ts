/*
This file is part of the Notesnook project (https://notesnook.com/)

Copyright (C) 2023 Streetwriters (Private) Limited

This program is free software: you can redistribute it and/or modify
it under the terms of the GNU General Public License as published by
the Free Software Foundation, either version 3 of the License, or
(at your option) any later version.

This program is distributed in the hope that it will be useful,
but WITHOUT ANY WARRANTY; without even the implied warranty of
MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
GNU General Public License for more details.

You should have received a copy of the GNU General Public License
along with this program.  If not, see <http://www.gnu.org/licenses/>.
*/

import {
  extractOnepkg,
  isOnepkg,
  parseOneNoteNotebookToc,
  parseOneNoteSection,
  renderPage,
  sniffOneNoteFileType,
  OneNoteEncryptedError
} from "@notesnook-importer/onenote";
import type { Page, Section } from "@notesnook-importer/onenote";
import { ContentType, Note, Notebook } from "../../models/note";
import { Attachment, attachmentToHTML } from "../../models/attachment";
import { File } from "../../utils/file";
import { detectFileType, mimeFromExtension } from "../../utils/file-type";
import { IHasher } from "../../utils/hasher";
import {
  IFileProvider,
  ProviderMessage,
  ProviderSettings,
  error,
  log
} from "../provider";
import { Providers } from "../provider-factory";

function isOneNoteEncryptedError(e: unknown): e is typeof OneNoteEncryptedError["prototype"] {
  return e instanceof OneNoteEncryptedError;
}

const ONENOTE_EXTENSIONS = [".one", ".onetoc2", ".onepkg"];

type VirtualFile = {
  path: string;
  name: string;
  data: Uint8Array;
};

type NotebookContext = {
  /** Virtual files extracted from .onepkg files, keyed by the onepkg path. */
  onepkgFiles: Map<string, VirtualFile[]>;
  /** All files grouped by their parent directory. */
  directories: Map<string, { path: string; file: File }[]>;
  /** Paths of .one files owned by a .onetoc2 in the same directory. */
  ownedSections: Set<string>;
};

type ResolveFile = (
  name: string,
  baseDirectory: string
) => Promise<Uint8Array | undefined>;
type ResolveToc = (
  name: string,
  baseDirectory: string
) => Promise<{ toc: Uint8Array; baseDirectory: string } | undefined>;

function normalizeWindowsPath(path: string): string {
  return path.replace(/\\/g, "/");
}

function pathDirectory(path: string): string {
  const normalized = normalizeWindowsPath(path);
  const index = normalized.lastIndexOf("/");
  return index === -1 ? "" : normalized.slice(0, index);
}

function pathBasename(path: string): string {
  const normalized = normalizeWindowsPath(path);
  const index = normalized.lastIndexOf("/");
  return index === -1 ? normalized : normalized.slice(index + 1);
}

function sanitizeEntryName(name: string): string {
  // Section names in a .onetoc2 are attacker-controlled; sanitize them
  // before using them as file paths.
  const normalized = normalizeWindowsPath(name);
  return normalized
    .split("/")
    .map((part) => part.replace(/[\0\r\n]/g, ""))
    .filter((part) => part.length > 0 && part !== "." && part !== "..")
    .join("/");
}

export class OneNote implements IFileProvider<NotebookContext> {
  id: Providers = "onenote";
  type = "file" as const;
  supportedExtensions = ONENOTE_EXTENSIONS;
  examples = ["Open Notebook.onetoc2", "My Section.one", "Notebook.onepkg"];
  version = "1.0.0";
  name = "Microsoft OneNote";
  helpLink =
    "https://help.notesnook.com/importing-notes/import-notes-from-onenote";

  filter(file: File) {
    if (!ONENOTE_EXTENSIONS.includes(file.extension)) return false;
    const path = file.path ? normalizeWindowsPath(file.path) : file.name;
    return !path.toLowerCase().includes("onenote_recyclebin");
  }

  async preprocess(files: File[]): Promise<NotebookContext> {
    const onepkgFiles = new Map<string, VirtualFile[]>();
    const directories = new Map<string, { path: string; file: File }[]>();
    const ownedSections = new Set<string>();

    for (const file of files) {
      const path = file.path ? normalizeWindowsPath(file.path) : file.name;
      const directory = pathDirectory(path);

      if (file.extension === ".onepkg") {
        const bytes = await file.bytes();
        if (bytes && isOnepkg(bytes)) {
          try {
            const extracted = await extractOnepkg(bytes);
            onepkgFiles.set(
              path,
              extracted.map((entry) => ({
                path: entry.name,
                name: pathBasename(entry.name),
                data: entry.data
              }))
            );
          } catch (e) {
            console.error(`Failed to extract ${file.name}:`, e);
          }
        }
      }

      const directoryFiles = directories.get(directory) ?? [];
      directoryFiles.push({ path, file });
      directories.set(directory, directoryFiles);
    }

    // .one files in a directory containing a .onetoc2 are part of that
    // notebook and must not be imported standalone.
    for (const [, directoryFiles] of directories) {
      const hasToc = directoryFiles.some(({ path }) =>
        path.toLowerCase().endsWith(".onetoc2")
      );
      if (!hasToc) continue;
      for (const { path } of directoryFiles) {
        if (path.toLowerCase().endsWith(".one")) ownedSections.add(path);
      }
    }

    return { onepkgFiles, directories, ownedSections };
  }

  async *process(
    file: File,
    settings: ProviderSettings,
    _files: File[],
    context?: NotebookContext
  ): AsyncGenerator<ProviderMessage, void, unknown> {
    const path = file.path ? normalizeWindowsPath(file.path) : file.name;

    if (file.extension === ".onepkg") {
      const extracted = context?.onepkgFiles.get(path);
      if (!extracted) {
        yield log(`Skipping ${file.name}: could not be extracted.`);
        return;
      }

      // The root table of contents is the one at the top of the archive.
      const rootToc = extracted.find(
        (entry) =>
          entry.name.toLowerCase().endsWith(".onetoc2") &&
          !entry.path.includes("/") &&
          !entry.path.includes("\\")
      );
      if (!rootToc) {
        yield log(`No notebook table of contents found in ${file.name}.`);
        return;
      }

      yield* this.importNotebook(
        rootToc.data,
        "",
        resolveFromVirtualFiles(extracted),
        (name, baseDirectory) =>
          resolveVirtualToc(name, baseDirectory, extracted),
        settings
      );
      return;
    }

    if (file.extension === ".onetoc2") {
      const bytes = await file.bytes();
      if (!bytes) return;
      if (sniffOneNoteFileType(bytes) !== "notebook") {
        yield log(`Skipping ${file.name}: not a OneNote notebook file.`);
        return;
      }

      const directory = pathDirectory(path);
      const directoryFiles = context?.directories.get(directory) ?? [];
      yield* this.importNotebook(
        bytes,
        directory,
        (name, baseDirectory) =>
          resolveFromFileList(directoryFiles)(name, baseDirectory),
        (name, baseDirectory) =>
          resolveTocFromFileList(name, baseDirectory, directoryFiles),
        settings
      );
      return;
    }

    // Standalone .one section.
    if (context?.ownedSections.has(path)) {
      yield log(`Skipping ${file.name}: part of a notebook.`);
      return;
    }

    const bytes = await file.bytes();
    if (!bytes) return;
    if (sniffOneNoteFileType(bytes) !== "section") {
      yield log(`Skipping ${file.name}: not a OneNote section file.`);
      return;
    }

    try {
      const password = settings.options?.onenote?.getPassword
        ? await settings.options.onenote.getPassword(file.nameWithoutExtension)
        : undefined;
      const section = await parseOneNoteSection(
        bytes,
        file.nameWithoutExtension,
        password
      );
      yield log(`Importing section ${section.displayName}...`);
      yield* this.importSectionNotes(
        section,
        [section.displayName],
        settings
      );
    } catch (e) {
      if (isOneNoteEncryptedError(e)) {
        yield log(
          `Skipping ${file.name}: section is password-protected and no password was provided.`
        );
        return;
      }
      yield error(e, { file });
    }
  }

  private async *importNotebook(
    tocData: Uint8Array,
    baseDirectory: string,
    resolveFile: ResolveFile,
    resolveToc: ResolveToc,
    settings: ProviderSettings,
    notebookPath: string[] = []
  ): AsyncGenerator<ProviderMessage, void, unknown> {
    let toc;
    try {
      toc = parseOneNoteNotebookToc(tocData);
    } catch (e) {
      yield error(e);
      return;
    }

    for (const entry of toc.entries) {
      const sanitized = sanitizeEntryName(entry);

      if (sanitized.toLowerCase().endsWith(".one")) {
        const sectionData = await resolveFile(sanitized, baseDirectory);
        if (!sectionData) {
          yield log(`Skipping section ${sanitized}: file not found.`);
          continue;
        }
        try {
          const section = await parseOneNoteSection(
            sectionData,
            pathBasename(sanitized).replace(/\.one$/i, "")
          );
          yield log(`Importing section ${section.displayName}...`);
          yield* this.importSectionNotes(
            section,
            [...notebookPath, section.displayName],
            settings
          );
        } catch (e) {
          yield error(e, { note: { title: sanitized } });
        }
      } else {
        const group = await resolveToc(sanitized, baseDirectory);
        if (!group) {
          yield log(`Skipping section group ${sanitized}: not found.`);
          continue;
        }
        yield* this.importNotebook(
          group.toc,
          group.baseDirectory,
          resolveFile,
          resolveToc,
          settings,
          [...notebookPath, sanitized]
        );
      }
    }
  }

  private async *importSectionNotes(
    section: Section,
    notebookPath: string[],
    settings: ProviderSettings
  ): AsyncGenerator<ProviderMessage, void, unknown> {
    const pages = section.pageSeries.flatMap((series) => series.pages);
    let fallbackTitleIndex = 0;

    for (const page of pages) {
      try {
        const note = await this.convertPage(page, notebookPath, settings.hasher, () => {
          fallbackTitleIndex += 1;
          return `Untitled Page ${fallbackTitleIndex}`;
        });
        if (note) yield { type: "note", note };
      } catch (e) {
        yield error(e, { note: { title: page.titleText || "Untitled Page" } });
      }
    }
  }

  private async convertPage(
    page: Page,
    notebookPath: string[],
    hasher: IHasher,
    fallbackTitle: () => string
  ): Promise<Note | undefined> {
    const title = page.titleText || fallbackTitle();

    const attachments: Attachment[] = [];
    const result = await renderPage(page, {
      resolveResource: async (data, filename, extension, meta) => {
        const dataHash = await hasher.hash(data);
        const detected = detectFileType(data);
        const extMime = extension
          ? mimeFromExtension(extension)
          : undefined;
        const mime =
          extMime || detected?.mime || "application/octet-stream";
        const attachment: Attachment = {
          data,
          filename: filename || dataHash,
          size: data.byteLength,
          hash: dataHash,
          hashType: hasher.type,
          mime,
          width: meta?.width,
          height: meta?.height
        };
        attachments.push(attachment);
        return attachmentToHTML(attachment);
      }
    });

    let content = result.html;

    // Attach the SVG snapshot as a read-only visual reference in a callout.
    if (result.svgSnapshot) {
      const svgData = new TextEncoder().encode(result.svgSnapshot);
      const svgHash = await hasher.hash(svgData);
      const svgAttachment: Attachment = {
        data: svgData,
        filename: `${svgHash}.svg`,
        size: svgData.byteLength,
        hash: svgHash,
        hashType: hasher.type,
        mime: "image/svg+xml"
      };
      attachments.push(svgAttachment);
      const svgRef = attachmentToHTML(svgAttachment);
      content = content.replace(
        "</body>",
        `<div class="callout" data-callout-type="info"><h3>Original layout (view only)</h3>${svgRef}</div>\n</body>`
      );
    }

    const text = stripHtml(content);
    if (!text && attachments.length === 0) return undefined;

    const notebooks: Notebook[] = notebookPath.length
      ? [
          {
            title: notebookPath[0],
            children: buildNotebookTree(notebookPath.slice(1))
          }
        ]
      : [];

    return {
      title,
      dateCreated: page.createdAt,
      dateEdited: page.updatedAt,
      content: { type: ContentType.HTML, data: content },
      notebooks,
      attachments
    };
  }
}

function buildNotebookTree(path: string[]): Notebook[] {
  if (path.length === 0) return [];
  return [{ title: path[0], children: buildNotebookTree(path.slice(1)) }];
}

function stripHtml(html: string): string {
  return html
    .replace(/<style[\s\S]*?<\/style>/g, "")
    .replace(/<script[\s\S]*?<\/script>/g, "")
    .replace(/<[^>]+>/g, "")
    .replace(/&nbsp;/g, " ")
    .trim();
}

function resolveFromVirtualFiles(
  extracted: VirtualFile[]
): ResolveFile {
  return async (name, baseDirectory) => {
    const base = baseDirectory ? `${normalizeWindowsPath(baseDirectory)}/` : "";
    const target = `${base}${normalizeWindowsPath(name)}`.toLowerCase();
    return extracted.find(
      (entry) => normalizeWindowsPath(entry.name).toLowerCase() === target
    )?.data;
  };
}

async function resolveVirtualToc(
  entryName: string,
  baseDirectory: string,
  extracted: VirtualFile[]
): Promise<{ toc: Uint8Array; baseDirectory: string } | undefined> {
  const base = baseDirectory ? `${normalizeWindowsPath(baseDirectory)}/` : "";
  const tocPath = `${base}${normalizeWindowsPath(entryName)}/Open Notebook.onetoc2`;
  const tocName = tocPath.toLowerCase();
  const found = extracted.find(
    (entry) => normalizeWindowsPath(entry.name).toLowerCase() === tocName
  );
  if (!found) return undefined;
  return { toc: found.data, baseDirectory: pathDirectory(tocPath) };
}

function resolveFromFileList(
  directoryFiles: { path: string; file: File }[]
): ResolveFile {
  return async (name, baseDirectory) => {
    const base = baseDirectory ? `${normalizeWindowsPath(baseDirectory)}/` : "";
    const target = `${base}${normalizeWindowsPath(name)}`.toLowerCase();
    const found = directoryFiles.find(
      ({ path }) => normalizeWindowsPath(path).toLowerCase() === target
    );
    if (!found) return undefined;
    return (await found.file.bytes()) ?? undefined;
  };
}

async function resolveTocFromFileList(
  entryName: string,
  baseDirectory: string,
  directoryFiles: { path: string; file: File }[]
): Promise<{ toc: Uint8Array; baseDirectory: string } | undefined> {
  const base = baseDirectory ? `${normalizeWindowsPath(baseDirectory)}/` : "";
  const tocPath = `${base}${normalizeWindowsPath(entryName)}/Open Notebook.onetoc2`;
  const tocName = tocPath.toLowerCase();
  const found = directoryFiles.find(
    ({ path }) => normalizeWindowsPath(path).toLowerCase() === tocName
  );
  if (!found) return undefined;
  const bytes = await found.file.bytes();
  if (!bytes) return undefined;
  return { toc: bytes, baseDirectory: pathDirectory(tocPath) };
}
