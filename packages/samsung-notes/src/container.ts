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

import { unzipSync } from "fflate";

export interface SamsungContainer {
  note: Uint8Array;
  pages: { name: string; id: string; data: Uint8Array }[];
  pageIds: Uint8Array | null;
  endTag: Uint8Array | null;
  mediaInfo: Uint8Array | null;
  media: Map<string, Uint8Array>;
}

export function parseContainer(data: Uint8Array): SamsungContainer {
  const files = unzipSync(data);
  const entries: [string, Uint8Array][] = [];
  for (const name in files) {
    entries.push([name, files[name]]);
  }

  const note = entries.find(([name]) =>
    name.toLowerCase().endsWith("note.note")
  );
  if (!note) throw new Error("Invalid .sdocx file: note.note was not found.");

  const root = note[0].replace(/note\.note$/i, "");

  const find = (suffix: string) => {
    const entry = entries.find(([name]) =>
      name.toLowerCase().endsWith(suffix.toLowerCase())
    );
    return entry?.[1] ?? null;
  };

  const pages = entries
    .filter(([name]) => name.toLowerCase().endsWith(".page"))
    .map(([name, bytes]) => ({
      name: name.slice(root.length),
      id: name
        .slice(root.length)
        .replace(/\.page$/i, "")
        .toLowerCase(),
      data: bytes
    }));

  return {
    note: note[1],
    pages,
    pageIds: find("pageIdInfo.dat"),
    endTag: find("end_tag.bin"),
    mediaInfo: find(`${root}media/mediaInfo.dat`),
    media: new Map(
      entries
        .filter(([name]) =>
          name.toLowerCase().startsWith(`${root}media/`.toLowerCase())
        )
        .filter(([name]) => !name.toLowerCase().endsWith("mediainfo.dat"))
        .map(([name, bytes]) => [name.slice(root.length), bytes])
    )
  };
}
