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
import { fdir } from "fdir";
import fs from "fs";
import path from "path";
import { OneStore } from "../src/onestore";
import { OneStoreFileType } from "../src/onestore/header";

const DATA_DIR = path.join(__dirname, "data");

function getSamples(): string[] {
  return new fdir()
    .withFullPaths()
    .filter((p) => p.endsWith(".one"))
    .crawl(DATA_DIR)
    .sync() as string[];
}

describe("onestore", () => {
  it.each(getSamples())("should parse %s", (file) => {
    const buffer = new Uint8Array(fs.readFileSync(file));
    const store = new OneStore(buffer);
    expect(store.header.fileType).toBe(OneStoreFileType.STORE);
    expect(store.fileNodeList.fragments.length).toBeGreaterThan(0);
  });
});
