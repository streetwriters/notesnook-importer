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

import fs from "fs";
import path from "path";
import { IFile } from "../src/utils/file";
import { fdir } from "fdir";
import { IHasher } from "../src/utils/hasher";
import { xxh64 } from "@node-rs/xxhash";

export function getFiles(dir: string): IFile[] {
  const output = new fdir()
    .withFullPaths()
    .withSymlinks()
    .crawl(path.join(__dirname, `data`, dir))
    .sync() as string[];
  return output.map(pathToFile);
}

export function pathToFile(filePath: string): IFile {
  const data = fs.readFileSync(filePath);

  return {
    data: data,
    name: path.basename(filePath),
    path: filePath,
  };
}

export const hasher: IHasher = {
  hash: async (data) => {
    if (data instanceof Uint8Array)
      return xxh64(Buffer.from(data.buffer)).toString(16);
    return xxh64(data).toString(16);
  },
  type: "xxh64",
};
