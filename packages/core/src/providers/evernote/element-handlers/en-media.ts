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
import { Element } from "domhandler";
import { parseAttributeValue } from "../../../utils/dom-utils";
import { getAttributeValue } from "domutils";

export class ENMedia extends BaseHandler {
  async process(element: Element): Promise<string | undefined> {
    if (!this.enNote.resources) return;

    const hash = getAttributeValue(element, "hash");
    if (!hash) return;

    const resource = this.enNote.resources?.find((res) => res?.hash == hash);
    if (!resource || !resource.data) return;

    const dataHash = await this.hasher.hash(resource.data);
    const attachment: Attachment = {
      data: resource.data,
      filename: resource?.filename || dataHash,
      size: resource.data.length,
      hash: dataHash,
      hashType: this.hasher.type,
      mime: resource.mime || "application/octet-stream",
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
