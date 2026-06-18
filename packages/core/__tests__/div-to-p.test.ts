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

import { parseDocument } from "htmlparser2";
import { test } from "vitest";
import { convertDivsToParagraphs } from "../src/utils/div-to-p";
import { convertBrToSingleSpacedParagraphs } from "../src/utils/br-to-p";
import render from "dom-serializer";
import { expect } from "vitest";

const cases = [
  {
    label: "pure inline content — div becomes p",
    test: `<div>Hello <b>world</b></div>`
  },
  {
    label: "alignment style is preserved",
    test: `<div style="text-align: center;"><span class="shine-highlight-pink">centered text</span></div>`
  },
  {
    label: "empty div becomes empty p",
    test: `<div style="text-align: center;"><br></div>`
  },
  {
    label: "mixed content — hr splits inline runs into separate paragraphs",
    test: `<div style="text-align: center;"><hr><br><span class="shine-highlight-pink">text after hr</span><br></div>`
  },
  {
    label: "div with only block children — not converted",
    test: `<div><ul><li>item</li></ul></div>`
  },
  {
    label: "nested divs — inner converted first",
    test: `<div><div style="text-align: left;"><span>inner</span></div></div>`
  },
  {
    label: "full pipeline: div-to-p then br-to-p",
    test: `<div style="text-align: center;"><hr><br><span class="shine-highlight-pink">text</span><br></div>`
  }
];

test("convert divs to paragraphs", () => {
  for (const { label, test: html } of cases) {
    const document = parseDocument(html);
    convertDivsToParagraphs(document);
    if (label.includes("full pipeline")) {
      convertBrToSingleSpacedParagraphs(document);
    }
    expect(render(document.childNodes), label).toMatchSnapshot();
  }
});
