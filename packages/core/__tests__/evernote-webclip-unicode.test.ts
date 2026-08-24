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
import path from "path";
import { expect, test } from "vitest";
import { Evernote } from "../src/providers/evernote";
import { File } from "../src/utils/file";
import { hasher, pathToFile } from "./utils";
import type { Note as ImporterNote } from "../src/models";

async function importEnex(file: File): Promise<ImporterNote[]> {
  const notes: ImporterNote[] = [];
  for await (const message of new Evernote().process(file, {
    hasher,
    mimeType: ""
  } as any)) {
    if ((message as any).type !== "note") continue;
    notes.push((message as any).note);
  }
  return notes;
}

test("web clip attachments are unicode-safe documents", async () => {
  const notes = await importEnex(
    new File(
      pathToFile(
        path.resolve(
          __dirname,
          "data/evernote/test-webclip-fullpage-unicode.enex"
        )
      )
    )
  );
  expect(notes.length).toBe(1);
  const [note] = notes;
  const content = note.content?.data || "";

  expect(content).toContain('<iframe class="web-clip"');
  expect(content.includes("â€™")).toBe(false);

  const clip = note.attachments?.find((a) =>
    a.mime?.includes("vnd.notesnook.web-clip")
  );
  expect(clip).toBeDefined();

  // the .clip attachment must be a standalone document that declares
  // its encoding; without it consumers falling back to legacy encodings
  // (e.g. windows-1252) display UTF-8 sequences like ’ as â€™.
  const clipHTML = Buffer.from(clip!.data!).toString("utf-8");
  expect(clipHTML.startsWith("<!DOCTYPE html>")).toBe(true);
  expect(clipHTML).toContain('<meta charset="utf-8">');
  expect(clipHTML).toContain("Here’s the truth about burnout");
  expect(clipHTML).toContain(
    "don’t burnout — that’s where the right framework comes in."
  );
  expect(clipHTML).toContain(
    "Let’s go: promoted faster — with the financial rewards to match. It’s “easy” when you know how… really."
  );
  expect(clipHTML.includes("â€™")).toBe(false);
});

test("web.clip7 notes without clipping markers produce unicode-safe clips", async () => {
  const notes = await importEnex(
    new File(
      pathToFile(
        path.resolve(
          __dirname,
          "data/evernote/test-webclip-source-only-unicode.enex"
        )
      )
    )
  );
  expect(notes.length).toBe(1);
  const [note] = notes;
  const content = note.content?.data || "";

  expect(content).toContain('<iframe class="web-clip"');
  expect(content.includes("â€™")).toBe(false);

  const clip = note.attachments?.find((a) =>
    a.mime?.includes("vnd.notesnook.web-clip")
  );
  expect(clip).toBeDefined();

  const clipHTML = Buffer.from(clip!.data!).toString("utf-8");
  expect(clipHTML.startsWith("<!DOCTYPE html>")).toBe(true);
  expect(clipHTML).toContain('<meta charset="utf-8">');
  expect(clipHTML).toContain("The old article’s heading</h1>");
  expect(clipHTML).toContain(
    "This old clip doesn’t have any --en-clipped-content markers"
  );
  expect(clipHTML).toContain("Unicode check: don’t — “quoted” — … done.");
  expect(clipHTML.includes("â€™")).toBe(false);
});
