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

import tap from "tap";
import { parse, Note } from "../index";
import fs from "fs";
import path from "path";
import { fdir } from "fdir";
import { fromByteArray } from "base64-js";

tap.test("enex should be parsed correctly", async () => {
  const dataDirectoryPath = path.join(__dirname, "data");
  const enexFiles = await new fdir()
    .withFullPaths()
    .filter((p) => p.endsWith(".enex"))
    .crawl(dataDirectoryPath)
    .withPromise();
  for (const filePath of <string[]>enexFiles) {
    const enexFile = fs.readFileSync(filePath, "utf-8");
    const notes: Note[] = [];
    for await (const note of parse(enexFile)) notes.push(...note);

    notes.forEach((note) => {
      note.resources?.forEach((res) => {
        tap.ok(res.hash);
        tap.ok(note.content!.indexOf(res.hash!) > -1);
        if (res.data) (res.data as any) = fromByteArray(res.data);
      });
    });

    tap.matchSnapshot(notes, path.basename(filePath));
  }
});
