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

import { HTMLElement, parse } from "node-html-parser";

export type Row = {
  cells: Cell[];
};
export type Cell = {
  type: "td" | "th";
  value: string;
};

export function getAttribute<T>(
  element: HTMLElement,
  key: string,
  type: "number" | "string" = "string"
): T | undefined {
  const value = element.getAttribute(key);
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
  const document = parse(`<table><tbody></tbody></table>`);
  const tbody = <HTMLElement>document.querySelector("tbody")!;

  for (const row of rows) {
    const rowElement = document.createElement("tr");
    for (const cell of row.cells) {
      const cellElement = document.createElement(cell.type);
      cellElement.innerHTML = cell.value;
      rowElement.appendChild(cellElement);
    }
    tbody.appendChild(rowElement);
  }

  return document.outerHTML;
}

export function buildCodeblock(code: string, language: string) {
  const document = parse(`<pre></pre>`);
  const pre = <HTMLElement>document.firstChild;
  pre.classList.add("hljs");
  pre.classList.add(`language-${language}`);
  pre.innerHTML = code;
  return document.outerHTML;
}
