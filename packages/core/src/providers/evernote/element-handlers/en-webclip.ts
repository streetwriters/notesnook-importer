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

export class ENWebClip extends BaseHandler {
  async process(element: Element): Promise<string | undefined> {
    const {
      ["clipped-content"]: clipType,
      ["clipped-source-url"]: clipSourceUrl,
      ["clipped-source-title"]: clipSourceTitle
    } = element.attribs;

    const clipFooter = `<hr></hr><p>Clipped from: <a href="${clipSourceUrl}">${clipSourceTitle}</a></p>`;

    switch (clipType) {
      case "simplified":
        return `${render(element.childNodes)}${clipFooter}`;
      case "bookmark":
        return `<p>${clipSourceTitle}</p><p><a href="${clipSourceUrl}">${clipSourceUrl}</a></p>`;
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
          this.hasher
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

          resourceElement.tagName = "img";
          resourceElement.attribs.src = `data:${type};base64,${Buffer.from(
            resource.data.buffer
          ).toString("base64")}`;
        }

        const data = new TextEncoder().encode(render(element.childNodes));
        const dataHash = await this.hasher.hash(data);
        const attachment: Attachment = {
          data: data,
          filename: `${sanitizeFilename(clipSourceUrl, {
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
          clipSourceTitle
        )}${clipFooter}`;
      }
    }
    return;
  }
}
