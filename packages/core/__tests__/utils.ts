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

import fs from "fs";
import path from "path";
import { IFile } from "../src/utils/file";
import { fdir } from "fdir";
import { IHasher } from "../src/utils/hasher";
import { xxh64 } from "@node-rs/xxhash";
import { existsSync } from "node:fs";
import { readFile, writeFile } from "node:fs/promises";
import assertNoDiff from "assert-no-diff";
import { unified } from "disparity";
import { Note } from "../src/models";
import format from "html-format";

const UPDATE_SNAPSHOTS = true;

export function getFiles(dir: string): IFile[] {
  const output = new fdir()
    .withFullPaths()
    .withSymlinks()
    .crawl(path.join(__dirname, `data`, dir))
    .sync() as string[];
  return output.map(pathToFile).sort((a, b) => a.name.localeCompare(b.name));
}

export function pathToFile(filePath: string): IFile {
  const data = fs.readFileSync(filePath);

  return {
    data: new Blob([data]),
    size: fs.statSync(filePath).size,
    name: path.basename(filePath),
    path: filePath
  };
}

export const hasher: IHasher = {
  hash: async (data) => {
    if (data instanceof Uint8Array)
      return xxh64(Buffer.from(data.buffer)).toString(16);
    return xxh64(data).toString(16);
  },
  type: "xxh64"
};

export async function matchArraySnapshot(filename: string, actual: string[]) {
  const snapshotPath = path.join(__dirname, "__snapshots__", filename);
  if (UPDATE_SNAPSHOTS) {
    await writeFile(snapshotPath, JSON.stringify(actual, undefined, 2));
    return true;
  }

  if (!existsSync(snapshotPath))
    throw new Error(`Could not find a snapshot at ${snapshotPath}.`);

  const expected = JSON.parse(
    await readFile(snapshotPath, "utf-8")
  ) as string[];
  if (!Array.isArray(expected))
    throw new Error("Snapshot is not an array of notes.");

  if (expected.length !== actual.length)
    throw new Error(
      `Expected ${expected.length} notes but got ${actual.length} notes. Did you forget to update the snapshot?`
    );

  for (const str of expected) {
    if (actual.includes(str)) continue;
    throw new Error(`Could not find "${str}".`);
  }
  return true;
}

export async function matchNotesSnapshot(filename: string, actual: Note[]) {
  actual = actual.map((n) => {
    if (n.content) n.content.data = format(n.content.data, " ", 60);
    return n;
  });

  const snapshotPath = path.join(__dirname, "__snapshots__", filename);
  if (UPDATE_SNAPSHOTS) {
    await writeFile(snapshotPath, JSON.stringify(actual, undefined, 2));
    return true;
  }

  if (!existsSync(snapshotPath))
    throw new Error(`Could not find a snapshot at ${snapshotPath}.`);

  const expected = JSON.parse(await readFile(snapshotPath, "utf-8")) as Note[];
  if (!Array.isArray(expected))
    throw new Error("Snapshot is not an array of notes.");

  if (expected.length !== actual.length)
    throw new Error(
      `Expected ${expected.length} notes but got ${actual.length} notes. Did you forget to update the snapshot?`
    );

  for (let i = 0; i < expected.length; ++i) {
    const actualNote = actual[i];
    const expectedNote = expected[i];

    assertNoDiff.json(
      { ...actualNote, content: undefined },
      { ...expectedNote, content: undefined },
      `> Difference found: ${actualNote.title} (${filename})`
    );

    if (!actualNote.content && !expectedNote.content) continue;

    const contentDiff = unified(
      expectedNote.content?.data || "",
      actualNote.content?.data || "",
      { context: 2, paths: ["expected", "actual"] }
    );
    if (contentDiff) {
      process.stderr.write(
        `> Difference found: ${actualNote.title} (${filename})\n`
      );
      process.stderr.write(contentDiff);
      process.stderr.write("\n");
    }
  }

  return true;
}

const CHUNKER_REGEX = /.{1,60}/gs;
// we have to chunk the output for better debugging
function chunker(str: string) {
  return str.match(CHUNKER_REGEX)?.join("\n") || str;
}
