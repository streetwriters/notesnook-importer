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

import { ContentType, Note } from "../../models/note";
import { File } from "../../utils/file";
import {
  IFileProvider,
  ProviderMessage,
  ProviderSettings,
  error
} from "../provider";
import { parseDocument } from "htmlparser2";
import {
  textContent,
  findOne,
  findAll,
  removeElement,
  replaceElement,
  getAttributeValue,
  getElementsByTagName
} from "domutils";
import { render } from "dom-serializer";
import { Document, Element } from "domhandler";
import { IHasher } from "../../utils/hasher";
import { Attachment, attachmentToHTML } from "../../models";
import { path } from "../../utils/path";
import { appendExtension } from "../../utils/filename";
import { detectFileType } from "../../utils/file-type";

type ResourceHandler = (resource: Element) => Promise<File | undefined>;

const RESOURCE_TAGS = ["img", "video", "audio", "a"];
export class HTML implements IFileProvider {
  public type = "file" as const;
  public supportedExtensions = [".html", ".htm"];
  public examples = ["Import.html"];
  public version = "1.0.0";
  public name = "HTML";
  public helpLink =
    "https://help.notesnook.com/importing-notes/import-notes-from-html-files";

  filter(file: File) {
    return this.supportedExtensions.includes(file.extension);
  }

  async *process(
    file: File,
    settings: ProviderSettings,
    files: File[]
  ): AsyncGenerator<ProviderMessage, void, unknown> {
    const data = await file.text();
    try {
      yield {
        type: "note",
        note: await HTML.processHTML(file, files, settings.hasher, data)
      };
    } catch (e) {
      yield error(e, { file });
    }
  }

  static async processHTML(
    file: File,
    files: File[],
    hasher: IHasher,
    html: string,
    processResource?: ResourceHandler
  ): Promise<Note> {
    const document = parseDocument(html);

    const body = findOne(
      (e) => e.tagName === "body",
      document.childNodes,
      true
    );

    const titleElement = findOne(
      (e) => ["title", "h1", "h2"].includes(e.tagName),
      document.childNodes,
      true
    );
    if (titleElement) removeElement(titleElement);

    const title = titleElement
      ? textContent(titleElement)
      : file.nameWithoutExtension;

    const resources = await HTML.extractResources(
      document,
      file,
      files,
      hasher,
      processResource
    );

    const note: Note = {
      title: title,
      dateCreated: file.createdAt,
      dateEdited: file.modifiedAt,
      attachments: [...resources],
      content: {
        type: ContentType.HTML,
        data: body ? render(body.childNodes) : render(document.childNodes)
      }
    };
    HTML.setNoteMetadata(note, document);

    return note;
  }

  private static setNoteMetadata(note: Note, document: Document) {
    const metaTags = getElementsByTagName("meta", document, true);
    for (const tag of metaTags) {
      const name = getAttributeValue(tag, "name");
      if (!name) continue;

      const content = getAttributeValue(tag, "content");
      if (!content) continue;

      switch (name) {
        case "created-on":
        case "created-at":
        case "created":
          note.dateCreated = new Date(content).getTime();
          break;
        case "last-edited-on":
        case "edited-at":
        case "edited":
        case "updated-at":
        case "updated":
          note.dateEdited = new Date(content).getTime();
          break;
        case "pinned":
          note.pinned = content === "true";
          break;
        case "favorite":
          note.favorite = content === "true";
          break;
        case "color":
          note.color = content;
          break;
      }
    }
  }

  private static async extractResources(
    document: Document,
    file: File,
    files: File[],
    hasher: IHasher,
    processResource?: ResourceHandler
  ) {
    const resources = findAll(
      (elem) => RESOURCE_TAGS.includes(elem.tagName.toLowerCase()),
      document.childNodes
    );

    const attachments: Attachment[] = [];
    for (const resource of resources) {
      const resourceFile =
        (await processResource?.(resource)?.catch(() => undefined)) ||
        (await defaultResourceHandler(resource, file, files));
      if (!resourceFile) continue;

      const data = await resourceFile.bytes();
      if (!data) continue;

      const dataHash = await hasher.hash(data);
      const mimeType = detectFileType(data);
      const filename =
        resource.attribs.title ||
        resource.attribs.filename ||
        resourceFile.name ||
        dataHash;

      const attachment: Attachment = {
        data,
        size: data.byteLength,
        hash: dataHash,
        filename: appendExtension(filename, mimeType?.ext),
        hashType: hasher.type,
        mime:
          mimeType?.mime ||
          resource.attribs.mime ||
          EXTENSION_TO_MIMETYPE[resourceFile.extension] ||
          `application/octet-stream`
      };
      attachments.push(attachment);

      replaceElement(resource, parseDocument(attachmentToHTML(attachment)));
    }
    return attachments;
  }
}

async function defaultResourceHandler(
  resource: Element,
  file: File,
  files: File[]
) {
  const src =
    getAttributeValue(resource, "src") || getAttributeValue(resource, "href");
  const fullPath =
    src &&
    file?.path &&
    decodeURIComponent(path.join(path.dirname(file.path), src));
  if (!fullPath) return;

  return files.find((file) => file.path === fullPath);
}

const EXTENSION_TO_MIMETYPE: Record<string, string> = {
  ".jpg": "image/jpg",
  ".jpeg": "image/jpeg",
  ".png": "image/png",
  ".webp": "image/webp",
  ".gif": "image/gif",
  ".bmp": "image/bmp",
  ".ico": "image/vnd.microsoft.icon",
  ".tiff": "image/tiff",
  ".tif": "image/tiff",
  ".svg": "image/svg+xml",
  ".svgz": "image/svg+xml",
  ".pdf": "application/pdf"
};

// const META_TO_METADATA: Record<string, keyof Note> = {
// "created-on": "dateCreated",
// "created-at": "dateCreated",
// created: "dateCreated",
// "last-edited-on": "dateEdited",
// "edited-at": "dateEdited",
// edited: "dateEdited",
// "updated-at": "dateEdited",
// updated: "dateEdited",

//   favorite: "favorite",
//   pinned: "pinned",
//   color: "color"
// };
