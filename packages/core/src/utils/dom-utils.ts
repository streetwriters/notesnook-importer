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

import { encodeHTML5 } from "entities";

export type Row = {
  cells: Cell[];
};
export type Cell = {
  type: "td" | "th";
  value: string;
};

export function parseAttributeValue<T>(
  value: string | undefined,
  type: "number" | "string" = "string"
): T | undefined {
  if (!value) return;

  switch (type) {
    case "number": {
      const int = parseInt(value);
      if (isNaN(int)) return;
      return <T>(<unknown>int);
    }
    default:
      return <T>(<unknown>value);
  }
}

export function buildTable(rows: Row[]): string {
  const table = [`<table>`, `<tbody>`];

  for (const row of rows) {
    const rowElement = [`<tr>`];
    for (const cell of row.cells) {
      const cellElement = [`<${cell.type}>`, cell.value, `</${cell.type}>`];
      rowElement.push(...cellElement);
    }
    table.push(...rowElement);
  }

  table.push(`</tbody>`, `</table>`);
  return table.join("");
}

export function buildCodeblock(code: string, language: string) {
  const pre = [
    `<pre class="language-${language}">`,
    encodeHTML5(code),
    "</pre>"
  ];
  return pre.join("");
}
