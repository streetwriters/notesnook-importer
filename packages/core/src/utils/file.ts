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

export interface IFile {
  data: Blob;
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

  text(): Promise<string> {
    return this.file.data.text();
  }

  get stream(): ReadableStream<Uint8Array> {
    return this.file.data.stream();
  }

  async bytes(): Promise<Uint8Array | null> {
    return new Uint8Array(await this.file.data.arrayBuffer());
  }

  get extension(): string {
    return path.extname(this.path || this.name).toLowerCase();
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

  toJSON() {
    return {
      name: this.name,
      path: this.path,
      createdAt: this.createdAt,
      modifiedAt: this.modifiedAt
    };
  }
}
