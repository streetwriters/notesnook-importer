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
import { expect, test } from "vitest";
import { convertBrToSingleSpacedParagraphs } from "../src/utils/br-to-p";
import render from "dom-serializer";

const cases = [
  {
    test: `<div class="shine-editor">Third
    paragraph<br /><br /><br />Links test:<br /><a
      href="https://google.com"
      class="shine-break-all"
      spellcheck="false"
      >https://google.com</a
    ><br /></div>`
  },
  {
    test: `<div><br />Mixed formatting:<br />This line
    has **bold**, *italic*, emoji 😀, link
    <a href="https://example.com" class="shine-break-all" spellcheck="false"
      >https://example.com</a
    >
    and normal text.<br /></div>`
  }
];
test("convert br tags to paragraphs", (t) => {
  for (const { test } of cases) {
    const document = parseDocument(test);
    convertBrToSingleSpacedParagraphs(document);
    expect(render(document.childNodes)).toMatchSnapshot();
  }
});
