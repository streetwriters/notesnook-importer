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

import { parse, processContent } from "@notesnook-importer/enex";
import {
  IFileProvider,
  ProviderMessage,
  ProviderSettings,
  error,
  log
} from "../provider";
import { ContentType, Note, Notebook } from "../../models/note";
import { ElementHandler } from "./element-handlers";
import { File } from "../../utils/file";
import { Providers } from "../provider-factory";

export class Evernote implements IFileProvider {
  id: Providers = "evernote";
  type = "file" as const;
  supportedExtensions = [".enex"];
  examples = ["First Notebook.enex", "checklist.enex"];
  version = "1.0.0";
  name = "Evernote";
  helpLink =
    "https://help.notesnook.com/importing-notes/import-notes-from-evernote";
  private ids: Record<string, string> = {};

  filter(file: File) {
    return this.supportedExtensions.includes(file.extension);
  }

  async *process(
    file: File,
    settings: ProviderSettings
  ): AsyncGenerator<ProviderMessage, void, unknown> {
    const notebook: Notebook = {
      title: file.nameWithoutExtension,
      children: []
    };

    const bytes = await file.bytes();
    if (!bytes) throw new Error("Could not read file");

    const encoding = detectEnexEncoding(bytes);
    const decoder = new TextDecoder(encoding);
    const content = decoder.decode(bytes);

    for await (const chunk of parse(content)) {
      for (const enNote of chunk) {
        yield log(`Found ${enNote.title}...`);

        const note: Note = {
          id: this.ids[enNote.title || ""],
          title: enNote.title || "",
          tags: enNote.tags,
          dateCreated: enNote.created?.getTime(),
          dateEdited: enNote.updated?.getTime(),
          sourceURL: enNote.sourceURL,
          attachments: [],
          notebooks: [notebook]
        };
        if (enNote.content) {
          const elementHandler = new ElementHandler(
            note,
            enNote,
            settings.hasher,
            this.ids
          );

          try {
            const html = await processContent(
              enNote.content,
              elementHandler,
              enNote
            );
            let content = html.trim();
            if (enNote.sourceURL) {
              content += `\n<hr>\n<p><em>Source: <a href="${enNote.sourceURL}">${enNote.sourceURL}</a></em></p>`;
            }
            note.content = {
              data: content,
              type: ContentType.HTML
            };
          } catch (e) {
            yield error(e, { note });
          }
        }

        yield { type: "note", note };
      }
    }
  }
}

const ENCODING_DECLARATION_REGEX =
  /<\?xml[^?]*encoding\s*=\s*["']([^"']+)["']/i;
const ENEX_ENCODING_MAP: Record<string, string> = {
  "utf-8": "utf-8",
  "utf8": "utf-8",
  "iso-8859-1": "iso-8859-1",
  "iso8859-1": "iso-8859-1",
  "latin1": "iso-8859-1",
  "windows-1252": "windows-1252",
  "cp1252": "windows-1252"
};

/**
 * Detects the XML encoding declared in an ENEX file's XML declaration.
 * Falls back to "utf-8" if no encoding is declared or if the encoding
 * is not recognized.
 *
 * The first ~512 bytes are decoded as ASCII (which is a superset of
 * the bytes used in XML declarations) to extract the encoding attribute
 * without needing the correct decoder upfront.
 */
function detectEnexEncoding(bytes: Uint8Array): string {
  const head = new TextDecoder("ascii").decode(bytes.slice(0, 512));
  const match = ENCODING_DECLARATION_REGEX.exec(head);
  if (!match) return "utf-8";

  const declared = match[1].trim().toLowerCase();
  return ENEX_ENCODING_MAP[declared] ?? "utf-8";
}
