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
import { getAttribute } from "../../../utils/dom-utils";

export class ZNResource extends BaseHandler {
  async process(element: HTMLElement): Promise<string | undefined> {
    const relativePath = element.getAttribute("relative-path");
    if (!relativePath) return;

    const file = this.files.find((file) => file.path?.includes(relativePath));
    if (!file) return;

    const data = file.bytes;
    const hash = await this.hasher.hash(data);
    const type = element.getAttribute("type");

    const attachment: Attachment = {
      data,
      filename: relativePath || hash,
      size: data.length,
      hash,
      hashType: this.hasher.type,
      mime: type || "application/octet-stream",
      width: getAttribute(element, "width", "number"),
      height: getAttribute(element, "height", "number")
    };
    this.note.attachments?.push(attachment);
    return attachmentToHTML(attachment);
  }
}
