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
import { textToHTML } from "../src/utils/to-html";

test("parse text with empty lines", (t) => {
  t.expect(
    textToHTML(`Hello
World

What are you doing



Another.`)
  ).toBe(
    `<p data-spacing="single">Hello</p><p data-spacing="single">World</p><p data-spacing="single"></p><p data-spacing="single">What are you doing</p><p data-spacing="single"></p><p data-spacing="single"></p><p data-spacing="single"></p><p data-spacing="single">Another.</p>`
  );
});

test("parse text with whitespace in between.", (t) => {
  t.expect(textToHTML(`Hello      whitespace`)).toBe(
    `<p data-spacing="single">Hello&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;whitespace</p>`
  );
});

test("parse text with whitespace in the start.", (t) => {
  t.expect(
    textToHTML(`Hello
    whitespace`)
  ).toBe(
    `<p data-spacing="single">Hello</p><p data-spacing="single">&nbsp;&nbsp;&nbsp;&nbsp;whitespace</p>`
  );
});
