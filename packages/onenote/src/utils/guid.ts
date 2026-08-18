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

import { reverse } from "./array";
import { fromHex, toHex } from "./reader";

const GUID_REGEX = /-/g;
export class GUID {
  private static NIL_GUID = new GUID(new Uint8Array(16).fill(0));
  constructor(private readonly bytes: Uint8Array) {}

  get isNil() {
    return this.equals(GUID.NIL_GUID);
  }

  static fromBytes(bytes: number[]) {
    reverse(0, 4, bytes);
    reverse(4, 6, bytes);
    reverse(6, 8, bytes);
    return new GUID(Uint8Array.from(bytes));
  }

  static fromBuffer(buffer: Uint8Array) {
    // Copy the bytes since reverse() mutates the input in place and the
    // input may be a view into a shared buffer.
    const bytes = Uint8Array.from(buffer);
    reverse(0, 4, bytes);
    reverse(4, 6, bytes);
    reverse(6, 8, bytes);
    return new GUID(bytes);
  }

  static parse(guid: string) {
    return new GUID(fromHex(guid.replace(GUID_REGEX, "")));
  }

  static nil() {
    return GUID.NIL_GUID;
  }

  equals(b: GUID) {
    for (let i = 0; i < this.bytes.length; ++i) {
      if (b.bytes[i] !== this.bytes[i]) return false;
    }
    return true;
  }

  toJSON(): string {
    return this.toString();
  }

  toString(): string {
    const guid = toHex(this.bytes).toUpperCase();
    const parts = [];
    parts.push(guid.slice(0, 8));
    parts.push(guid.slice(8, 12));
    parts.push(guid.slice(12, 16));
    parts.push(guid.slice(16, 20));
    parts.push(guid.slice(20, 32));
    return parts.join("-");
  }
}

export class ExtendedGUID {
  constructor(private readonly guid: GUID, private readonly n: number) {}

  static nil(): ExtendedGUID {
    return new ExtendedGUID(GUID.nil(), 0);
  }

  get isNil() {
    return this.n === 0 && this.guid.isNil;
  }

  equals(other: ExtendedGUID) {
    return this.n === other.n && this.guid.equals(other.guid);
  }

  toString(): string {
    return `${this.guid.toString()} [${this.n}]`;
  }
}
