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
import { IFileProvider, ProviderSettings } from "../provider";
import { parseDocument } from "htmlparser2";
import {
  textContent,
  findOne,
  findAll,
  removeElement,
  replaceElement,
  getAttributeValue
} from "domutils";
import { render } from "dom-serializer";
import { Document } from "domhandler";
import { IHasher } from "../../utils/hasher";
import { Attachment, attachmentToHTML } from "../../models";
import { path } from "../../utils/path";

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

  async *process(file: File, settings: ProviderSettings, files: File[]) {
    const data = await file.text();
    yield await HTML.processHTML(file, files, settings.hasher, data);
  }

  static async processHTML(
    file: File,
    files: File[],
    hasher: IHasher,
    html: string
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
      hasher
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

    return note;
  }

  private static async extractResources(
    document: Document,
    file: File,
    files: File[],
    hasher: IHasher
  ) {
    const resources = findAll(
      (elem) => RESOURCE_TAGS.includes(elem.tagName.toLowerCase()),
      document.childNodes
    );

    const attachments: Attachment[] = [];
    for (const resource of resources) {
      const src =
        getAttributeValue(resource, "src") ||
        getAttributeValue(resource, "href");
      const fullPath =
        src &&
        file?.path &&
        decodeURIComponent(path.join(path.dirname(file.path), src));
      if (!fullPath) continue;

      const resourceFile = files.find((file) => file.path === fullPath);
      if (!resourceFile) continue;

      const data = await resourceFile.bytes();
      if (!data) continue;

      const dataHash = await hasher.hash(data);
      const attachment: Attachment = {
        data,
        size: data.byteLength,
        hash: dataHash,
        filename:
          resource.attribs.title ||
          resource.attribs.filename ||
          resourceFile.name ||
          dataHash,
        hashType: hasher.type,
        mime:
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
