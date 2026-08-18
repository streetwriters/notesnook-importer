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
import {
  parseOneNoteSection,
  parseOneNoteNotebook,
  sniffOneNoteFileType
} from "../src/onenote";
import { extractOnepkg, isOnepkg } from "../src/vendor/cabinet";

const DATA_DIR = path.join(__dirname, "data");

describe("onenote parser", () => {
  it.each(["Sample1.one", "testOneNote1.one"])(
    "should parse section %s",
    (name) => {
      const buffer = new Uint8Array(
        fs.readFileSync(path.join(DATA_DIR, name))
      );
      expect(sniffOneNoteFileType(buffer)).toBe("section");
      const section = parseOneNoteSection(buffer, name);
      expect(section.displayName).toBeTruthy();
      const pages = section.pageSeries.flatMap((series) => series.pages);
      expect(pages.length).toBeGreaterThan(0);
      for (const page of pages) {
        expect(page.titleText).toBeTruthy();
        expect(page.contents.length).toBeGreaterThan(0);
      }
    }
  );

  it("should extract a .onepkg file", async () => {
    const buffer = new Uint8Array(
      fs.readFileSync(path.join(DATA_DIR, "onepkg-sample.onepkg"))
    );
    expect(isOnepkg(buffer)).toBe(true);
    const files = await extractOnepkg(buffer);
    expect(files.length).toBeGreaterThan(0);
    const toc = files.find(
      (file) => file.name.endsWith(".onetoc2") && !file.name.includes("\\")
    );
    expect(toc).toBeTruthy();
    expect(sniffOneNoteFileType(toc!.data)).toBe("notebook");
    const notebook = parseOneNoteNotebook(toc!.data, (name) => {
      // The file names in the notebook TOC are Windows paths; resolve both
      // flat and nested entries.
      return files.find(
        (file) =>
          file.name === name ||
          file.name.endsWith(`\\${name}`) ||
          file.name.endsWith(`/${name}`)
      )?.data;
    });
    expect(notebook.entries.length).toBeGreaterThan(0);
  });
});
