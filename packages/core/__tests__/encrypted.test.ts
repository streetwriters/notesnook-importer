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

import "./globals";
import { test, expect } from "vitest";
import { Note } from "../src/models";
import { File } from "../src/utils/file";
import { getFiles, hasher } from "./utils";
import { ProviderFactory } from "../src/providers/provider-factory";

async function importNotes(getPassword: (title: string) => string | undefined) {
  const provider: any = ProviderFactory.getProvider("applenotes");
  const files = getFiles("applenotes").map((f) => new File(f));
  const dbFile = files.find((f) => provider.filter(f))!;
  const notes: Note[] = [];
  const settings = {
    hasher,
    clientType: "node" as const,
    reporter() {},
    storage: { write: async () => {} },
    options: { applenotes: { getPassword } }
  };
  for await (const m of provider.process(dbFile, settings, files)) {
    if (m.type === "error") throw m.error;
    if (m.type === "note") notes.push(m.note);
  }
  return notes;
}

test("decrypts a note with the key in ZCRYPTOWRAPPEDKEY", async () => {
  const notes = await importNotes((title) =>
    title === "Secret encrypted" ? "hunter2" : undefined
  );
  const note = notes.find((n) => n.title === "Secret encrypted");
  expect(note).toBeDefined();
  expect(note!.content?.data).toContain(
    "This content is encrypted with a password."
  );
});

test("decrypts a verifier-only note via the CloudKit record", async () => {
  const notes = await importNotes((title) =>
    title === "Verifier encrypted" ? "correct horse" : undefined
  );
  const note = notes.find((n) => n.title === "Verifier encrypted");
  expect(note).toBeDefined();
  expect(note!.content?.data).toContain(
    "This note&apos;s key is stored in the CloudKit record."
  );
});

test("skips encrypted notes without a password", async () => {
  const notes = await importNotes(() => undefined);
  expect(notes.find((n) => n.title === "Secret encrypted")).toBeUndefined();
  expect(notes.find((n) => n.title === "Verifier encrypted")).toBeUndefined();
});
