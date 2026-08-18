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

import { describe, expect, it } from "vitest";
import fs from "fs";
import path from "path";
import { OneStore } from "../src/onestore";
import { ObjectSpaceStore } from "../src/onestore/object-space";

const DATA_DIR = path.join(__dirname, "data");

describe("object space store", () => {
  it.each(["Sample1.one", "testOneNote1.one"])(
    "should parse %s",
    (name) => {
      const buffer = new Uint8Array(fs.readFileSync(path.join(DATA_DIR, name)));
      const store = new OneStore(buffer);
      const spaceStore = ObjectSpaceStore.parse(store);
      expect(spaceStore.rootObjectSpaceId).toBeTruthy();
      expect(spaceStore.dataRoot).toBeTruthy();
      expect(spaceStore.dataRoot.contentRoot()).toBeTruthy();
      const contentRoot = spaceStore.dataRoot.contentRoot()!;
      const object = spaceStore.dataRoot.getObject(contentRoot);
      expect(object).toBeTruthy();
    }
  );
});
