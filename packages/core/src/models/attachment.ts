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

export type Attachment = {
  hash: string;
  hashType: string;
  filename: string;
  size: number;
  mime: string;
  data?: Uint8Array;
  width?: number;
  height?: number;
};

type Attribute = {
  key: string;
  value: (value: string) => string;
};

const attributeMap: Record<string, Attribute> = {
  filename: {
    key: "data-filename",
    value: (value) => value
  },
  size: {
    key: "data-size",
    value: (value) => {
      const bytes = parseInt(value);
      return !isNaN(bytes) ? value : "0";
    }
  },
  hash: {
    key: "data-hash",
    value: (value) => value
  },
  mime: {
    key: "data-mime",
    value: (value) => value
  },
  width: {
    key: "width",
    value: (value) => value
  },
  height: {
    key: "height",
    value: (value) => value
  }
};

export function attachmentToHTML(attachment: Attachment): string {
  const tag: "img" | "span" = attachment.mime.startsWith("image/")
    ? "img"
    : "span";

  const attributes: string[] = [`class="attachment"`];
  for (const attr in attributeMap) {
    const value = (<any>attachment)[attr];
    if (!value) continue;
    const attribute = attributeMap[attr];
    attributes.push(`${attribute.key}="${attribute.value(value)}"`);
  }

  switch (tag) {
    case "img":
      return `<img ${attributes.join(" ")} alt="${attachment.filename}" />`;
    case "span":
      return `<span ${attributes.join(" ")} contenteditable="false" title="${
        attachment.filename
      }">
      <em>&nbsp;</em>
      <span class="filename">${attachment.filename}</span>
    </span>`;
  }
}
