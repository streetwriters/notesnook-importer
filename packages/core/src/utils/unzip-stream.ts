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

import { Unzip, UnzipFile, UnzipInflate } from "fflate";
import { IFile } from "./file";
import { path } from "./path";
import { toAsyncIterator } from "./stream";

export class UnzipStream extends TransformStream<Uint8Array, IFile> {
  constructor(parent?: IFile) {
    const unzipper = new Unzip();
    unzipper.register(UnzipInflate);

    super({
      start(controller) {
        unzipper.onfile = (file) => {
          controller.enqueue({
            data: unzipFileToStream(file),
            name: path.basename(file.name),
            path: file.name,
            parent,
            size: file.originalSize || file.size || 0
          });
        };
      },
      transform(chunk) {
        unzipper.push(chunk);
      },
      flush() {}
    });
  }
}

function unzipFileToStream(file: UnzipFile) {
  return new ReadableStream<Uint8Array>({
    start(controller) {
      file.ondata = (err, data, final) => {
        if (err) controller.error(err);
        else controller.enqueue(data);
        if (final) controller.close();
      };
      file.start();
    },
    cancel() {
      file.terminate();
    }
  });
}

export async function unzip(file: IFile): Promise<IFile[]> {
  const extracted: IFile[] = [];
  const reader = file.data.pipeThrough(new UnzipStream(file));

  for await (const entry of toAsyncIterator(reader)) {
    extracted.push(entry);
  }
  return extracted;
}
