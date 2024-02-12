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

import { Attachment, attachmentToHTML } from "../../../models/attachment";
import { BaseHandler } from "./base";
import { parseAttributeValue } from "../../../utils/dom-utils";
import { Element } from "domhandler";
import { getAttributeValue } from "domutils";
import { detectFileType } from "../../../utils/file-type";

export class ZNResource extends BaseHandler {
  async process(element: Element): Promise<string | undefined> {
    const relativePath = getAttributeValue(element, "relative-path");
    if (!relativePath) return;

    const file = this.files.find((file) => file.path?.includes(relativePath));
    if (!file) return;

    const data = await file.bytes();
    if (!data) return;

    const hash = await this.hasher.hash(data);
    const mimeType =
      getAttributeValue(element, "type") ||
      detectFileType(data)?.mime ||
      "application/octet-stream";

    const attachment: Attachment = {
      data,
      filename: relativePath || hash,
      size: data.length,
      hash,
      hashType: this.hasher.type,
      mime: mimeType,
      width: parseAttributeValue(getAttributeValue(element, "width"), "number"),
      height: parseAttributeValue(
        getAttributeValue(element, "height"),
        "number"
      )
    };
    this.note.attachments?.push(attachment);
    return attachmentToHTML(attachment);
  }
}
