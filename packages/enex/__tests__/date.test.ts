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

import { test, expect } from "vitest";
import { ISO8601DateTime } from "../src/iso8601-date-time";

test("input less than 16 characters should return null", async () => {
  expect(ISO8601DateTime.toDate("hello")).toBeNull();
});

test("input of 16 characters but with an invalid date should return null", async () => {
  expect(ISO8601DateTime.toDate("01234567891011126")).toBeNull();
});
