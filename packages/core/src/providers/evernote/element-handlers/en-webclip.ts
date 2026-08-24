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

import render from "dom-serializer";
import { BaseHandler } from "./base";
import { Element } from "domhandler";
import { findAll, findOne } from "domutils";
import { ENMedia } from "./en-media";
import { Attachment, attachmentToHTML } from "../../../models";
import { sanitizeFilename } from "../../../utils/filename";
import { getAttributeValue } from "domutils";
import { encodeHTML5 } from "entities";

export class ENWebClip extends BaseHandler {
  static buildFooter(url?: string, title?: string): string {
    if (!url && !title) return "";

    return `<hr></hr><p>Clipped from: <a href="${url}">${title || url}</a></p>`;
  }

  /**
   * Builds a standalone HTML document for the .clip attachment.
   *
   * The document explicitly declares its encoding via <meta charset>.
   * Without it, any consumer that renders the clip in a context where
   * the character encoding is not already known (file:// pages on
   * Windows, data: URLs or responses without charset information)
   * falls back to legacy encodings such as windows-1252 and UTF-8
   * sequences like U+2019 (’) get displayed as mojibake (â€™).
   */
  static buildClipDocument(html: string, title?: string): string {
    return `<!DOCTYPE html><html><head><meta charset="utf-8"><title>${encodeHTML5(
      title || ""
    )}</title></head><body>${html}</body></html>`;
  }

  async process(element: Element): Promise<string | undefined> {
    const {
      ["clipped-content"]: clipType = "unknown",
      ["clipped-source-url"]: clipSourceUrl = this.enNote.sourceURL,
      ["clipped-source-title"]: clipSourceTitle
    } = element.attribs;

    const clipFooter = ENWebClip.buildFooter(clipSourceUrl, clipSourceTitle);

    switch (clipType) {
      case "simplified":
        return `${render(element.childNodes)}${clipFooter}`;
      case "bookmark":
        return `<p>${clipSourceTitle}</p><p><a href="${clipSourceUrl}">${clipSourceUrl}</a></p>`;
      case "contextMenuImage":
      case "screenshot": {
        const enMedia = findOne(
          (e) => e.tagName === "en-media",
          element.childNodes,
          true
        );
        if (!enMedia) return;
        const result = await new ENMedia(
          this.note,
          this.enNote,
          this.hasher,
          this.ids
        ).process(enMedia);
        if (!result) return;
        return `${result}${clipFooter}`;
      }
      case "article":
      case "fullPage": {
        const resources = findAll(
          (e) => e.tagName === "en-media",
          element.childNodes
        );
        for (const resourceElement of resources) {
          const type = getAttributeValue(resourceElement, "type");
          const hash = getAttributeValue(resourceElement, "hash");
          const resource = this.enNote.resources?.find(
            (res) => res?.hash == hash
          );
          if (
            !resource ||
            !resource.data ||
            !hash ||
            !type ||
            !type.startsWith("image/")
          )
            continue;

          // find and remove attachment if we already extracted it
          // because in full page clips everything is embedded.
          // This is redundant work, but there's no alternative.
          const xxh64Hash = await this.hasher.hash(resource.data);
          const attachmentIndex = this.note.attachments?.findIndex(
            (a) => a.hash === xxh64Hash
          );
          if (attachmentIndex && attachmentIndex > -1) {
            this.note.attachments?.splice(attachmentIndex, 1);
          }

          resourceElement.tagName = "img";
          resourceElement.attribs.src = `data:${type};base64,${Buffer.from(
            resource.data.buffer
          ).toString("base64")}`;
        }

        const data = new TextEncoder().encode(
          ENWebClip.buildClipDocument(
            render(element.childNodes, {
              xmlMode: false,
              decodeEntities: true,
              encodeEntities: false,
              selfClosingTags: true
            }),
            clipSourceTitle || clipSourceUrl
          )
        );
        const dataHash = await this.hasher.hash(data);
        const title = clipSourceTitle || clipSourceUrl || dataHash;
        const attachment: Attachment = {
          data,
          filename: `${sanitizeFilename(title, {
            replacement: "-"
          })}.clip`,
          size: data.length,
          hash: dataHash,
          hashType: this.hasher.type,
          mime: "application/vnd.notesnook.web-clip"
        };
        this.note.attachments?.push(attachment);
        return `${attachmentToHTML(
          attachment,
          clipSourceUrl,
          title
        )}${clipFooter}`;
      }
    }
    return;
  }
}
