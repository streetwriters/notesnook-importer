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

import { path } from "./path";
import { toAsyncIterator } from "./stream";

export interface IFile {
  data: ReadableStream<Uint8Array>;
  size: number;
  name: string;
  path?: string;
  createdAt?: number;
  modifiedAt?: number;
  parent?: IFile;
}

export class File {
  constructor(private readonly file: IFile) {}

  get parent(): IFile | undefined {
    return this.file.parent;
  }

  get name(): string {
    return this.file.name;
  }

  get nameWithoutExtension(): string {
    return path.basename(this.file.name, path.extname(this.file.name));
  }

  get directory(): string | undefined {
    if (!this.path) return;
    return path.dirname(this.path);
  }

  async text(): Promise<string> {
    const stream = this.stream.pipeThrough(new TextDecoderStream());
    let string = "";
    for await (const s of toAsyncIterator(stream)) {
      string += s;
    }
    return string;
  }

  get stream(): ReadableStream<Uint8Array> {
    return this.file.data;
  }

  async bytes(): Promise<Uint8Array | null> {
    if (this.file.size) {
      const data = new Uint8Array(this.file.size);
      let read = 0;
      for await (const chunk of toAsyncIterator(this.file.data)) {
        data.set(chunk, read);
        read += chunk.byteLength;
      }
      return data;
    } else {
      let data: Uint8Array | null = null;
      for await (const chunk of toAsyncIterator(this.file.data)) {
        if (!data) data = chunk;
        else data = concatTypedArrays(data, chunk);
      }
      return data;
    }
  }

  get extension(): string {
    return (
      this.path ? path.extname(this.path) : path.extname(this.name)
    ).toLowerCase();
  }

  get path(): string | undefined {
    return this.file.path;
  }

  get createdAt(): number | undefined {
    return this.file.createdAt;
  }

  get modifiedAt(): number | undefined {
    return this.file.modifiedAt;
  }

  toJSON(): any {
    return {
      name: this.name,
      path: this.path,
      createdAt: this.createdAt,
      modifiedAt: this.modifiedAt
    };
  }
}

function concatTypedArrays(a: Uint8Array, b: Uint8Array) {
  // a, b TypedArray of same type
  const c = new Uint8Array(a.length + b.length);
  c.set(a, 0);
  c.set(b, a.length);
  return c;
}
