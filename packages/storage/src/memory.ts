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

export class MemoryStorage<T> implements IStorage<T> {
  storage: Record<string, T> = {};
  count = 0;

  async clear(): Promise<void> {
    this.storage = {};
  }

  async write(data: T): Promise<void> {
    this.storage[this.getId()] = data;
  }

  async *iterate() {
    for (const key in this.storage) {
      const item = this.storage[key];
      if (!item) continue;
      yield item;
    }
    return null;
  }

  async get(from: number, length: number) {
    const items = [];
    for (let i = from; i < from + length; ++i) {
      const item = this.storage[i.toString()];
      if (!item) continue;
      items.push(item);
    }
    return items;
  }

  private getId() {
    return (this.count++).toFixed();
  }
}
