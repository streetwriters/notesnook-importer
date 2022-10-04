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

export class ENMedia extends BaseHandler {
  async process(element: HTMLElement): Promise<string | undefined> {
    if (!this.enNote.resources) return;

    const hash = element.getAttribute("hash");
    if (!hash) return;

    const resource = this.enNote.resources?.find(
      (res) => res.attributes?.hash == hash
    );
    if (!resource) return;

    const data = new Uint8Array(Buffer.from(resource.data, "base64"));
    const dataHash = await this.hasher.hash(data);
    const attachment: Attachment = {
      data,
      filename: resource.attributes?.filename || dataHash,
      size: data.length,
      hash: dataHash,
      hashType: this.hasher.type,
      mime: resource.mime,
      width: getAttribute(element, "width", "number"),
      height: getAttribute(element, "height", "number")
    };
    this.note.attachments?.push(attachment);
    return attachmentToHTML(attachment);
  }
}
