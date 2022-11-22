/*
This file is part of the Notesnook project (https://notesnook.com/)

Copyright (C) 2022 Streetwriters (Private) Limited

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

import { Attachment, attachmentToHTML } from "../../../models/attachment";
import { BaseHandler } from "./base";
import type { HTMLElement } from "node-html-parser";
import { parseAttributeValue } from "../../../utils/dom-utils";
import { toByteArray } from "base64-js";

export class AttachmentHandler extends BaseHandler {
  async process(element: HTMLElement): Promise<string | undefined> {
    const base64data = element.getAttribute("data");
    if (!base64data) return;

    const type = getAttributeValue(element, [
      "data-fullres-src-type",
      "data-src-type",
      "type"
    ]);
    const name = getAttributeValue(element, ["data-attachment"]);

    const data = toByteArray(base64data);
    const dataHash = await this.hasher.hash(data);
    const attachment: Attachment = {
      data,
      size: data.length,
      hash: dataHash,
      filename: name ?? dataHash,
      hashType: this.hasher.type,
      mime: type ?? "application/octet-stream",
      width: parseAttributeValue(element.getAttribute("width"), "number"),
      height: parseAttributeValue(element.getAttribute("height"), "number")
    };
    this.note.attachments?.push(attachment);
    return attachmentToHTML(attachment);
  }
}

function getAttributeValue(
  element: HTMLElement,
  attributes: string[]
): string | null {
  return attributes.reduce((prev: string | null, curr) => {
    if (prev) return prev;

    const value = element.getAttribute(curr);
    if (value) return value;

    return prev;
  }, null);
}
