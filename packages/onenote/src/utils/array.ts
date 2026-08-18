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

export function getFromArray<T extends { id: number | string }>(
  array: T[],
  id: number | string,
  def: T
): T {
  const element = array.find((e) => e.id === id);
  if (!element) array.push(def);
  return element || def;
}

export function reverse<T>(
  from: number,
  to: number,
  buffer: Array<T> | Uint8Array
) {
  let total = from + to;
  for (let i = from; i < Math.floor(total / 2); i++) {
    const temp = buffer[i];
    buffer[i] = buffer[total - 1 - i];
    buffer[total - 1 - i] = temp;
  }
}
