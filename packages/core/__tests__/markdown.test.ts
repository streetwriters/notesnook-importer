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

import { test } from "vitest";
import { markdowntoHTML } from "../src/utils/to-html";

test("parse wikiLinkFile", (t) => {
  t.expect(markdowntoHTML("![[image.jpg]]")).toBe(
    `<p><a href="image.jpg" /></p>`
  );
});

test("parse wikiLinkFile with width", (t) => {
  t.expect(markdowntoHTML("![[image.jpg|100]]")).toBe(
    `<p><a href="image.jpg" width="100" /></p>`
  );
});

test("parse wikiLinkFile with width and height", (t) => {
  t.expect(markdowntoHTML("![[image.jpg|100x100]]")).toBe(
    `<p><a href="image.jpg" width="100" height="100" /></p>`
  );
});

test("parse wikiLinkFile inline", (t) => {
  t.expect(markdowntoHTML("HELLO WORLD ![[image.jpg|100x100]]")).toBe(
    `<p>HELLO WORLD <a href="image.jpg" width="100" height="100" /></p>`
  );
});

test("parse wikiLinkFile with hash", (t) => {
  t.expect(markdowntoHTML("![[image.pdf#hello]]")).toBe(
    `<p><a href="image.pdf" /></p>`
  );
});
