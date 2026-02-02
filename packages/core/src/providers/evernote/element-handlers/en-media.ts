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
import { Element } from "domhandler";
import { parseAttributeValue } from "../../../utils/dom-utils";
import { getAttributeValue } from "domutils";
import { detectFileType } from "../../../utils/file-type";

export class ENMedia extends BaseHandler {
  async process(element: Element): Promise<string | undefined> {
    if (!this.enNote.resources) return;

    const hash = getAttributeValue(element, "hash");
    if (!hash) return;

    const resource = this.enNote.resources?.find((res) => res?.hash == hash);
    if (!resource || !resource.data) return;

    const dataHash = await this.hasher.hash(resource.data);

    const width = parseAttributeValue<number>(
      getAttributeValue(element, "width"),
      "number"
    );
    const height = parseAttributeValue<number>(
      getAttributeValue(element, "height"),
      "number"
    );
    const naturalWidth = parseAttributeValue<number>(
      getAttributeValue(element, "naturalWidth"),
      "number"
    );
    const naturalHeight = parseAttributeValue<number>(
      getAttributeValue(element, "naturalHeight"),
      "number"
    );
    const { width: finalWidth, height: finalHeight } =
      calculateMissingDimension(width, height, naturalWidth, naturalHeight);

    const attachment: Attachment = {
      data: resource.data,
      filename: resource?.filename || dataHash,
      size: resource.data.length,
      hash: dataHash,
      hashType: this.hasher.type,
      mime:
        resource.mime ||
        detectFileType(resource.data)?.mime ||
        "application/octet-stream",
      width: finalWidth,
      height: finalHeight
    };
    this.note.attachments?.push(attachment);
    return attachmentToHTML(attachment);
  }
}

function calculateMissingDimension(
  width: number | undefined,
  height: number | undefined,
  naturalWidth: number | undefined,
  naturalHeight: number | undefined
): { width?: number; height?: number } {
  if ((width && height) || (!width && !height)) {
    return { width, height };
  }
  if (!naturalWidth || !naturalHeight) {
    return { width, height };
  }

  const aspectRatio = naturalWidth / naturalHeight;

  if (width && !height) {
    return { width, height: Math.round(width / aspectRatio) };
  }
  if (height && !width) {
    return { width: Math.round(height * aspectRatio), height };
  }

  return { width, height };
}
