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

import { IStorage } from "./index";
import { existsSync, mkdir, readdir, readFile, rm, writeFile } from "fs";
import path from "path";
import { promisify } from "util";

const mkdirAsync = promisify(mkdir);
const readdirAsync = promisify(readdir);
const readFileAsync = promisify(readFile);
const writeFileAsync = promisify(writeFile);
const rmAsync = promisify(rm);

export class NodeStorage<T> implements IStorage<T> {
  constructor(private readonly directoryName: string) {}
  count = 0;
  async clear(): Promise<void> {
    await rmAsync(this.directoryName, { recursive: true, force: true });
  }

  async write(data: T): Promise<void> {
    if (!existsSync(this.directoryName))
      await mkdirAsync(this.directoryName, { recursive: true });
    await writeFileAsync(this.getFilePath(), JSON.stringify(data));
  }

  async *iterate() {
    const keys = await readdirAsync(this.directoryName, {
      withFileTypes: true
    });
    for (const key of keys) {
      const data = await readFileAsync(this.getFilePath(key.name), "utf-8");
      yield JSON.parse(data);
    }
    return null;
  }

  async get(from: number, length: number) {
    const items = [];
    for (let i = from; i < from + length; ++i) {
      const data = await readFileAsync(this.getFilePath(i.toString()), "utf-8");
      const item = JSON.parse(data);
      if (!item) continue;
      items.push(item);
    }
    return items;
  }

  private getFilePath(name?: string) {
    return path.join(this.directoryName, name || this.getId());
  }

  private getId() {
    return (this.count++).toFixed();
  }
}
