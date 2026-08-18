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

import { test, expect } from "vitest";
import { decodeBplist, extractStringsFromBplist } from "../src/utils/bplist";

// A binary plist generated with Python's plistlib containing:
// { text: "Journal entry body text", count: 42,
//   nested: { a: [1, 2, 3], b: true }, data: b"\x89PNG\r\n" }
const BPLIST_HEX =
  "62706c6973743030d4010203040506070f55636f756e745464617461566e65737465645474657874102a4689504e470d0ad208090a0e51615162a30b0c0d100110021003095f10174a6f75726e616c20656e74727920626f647920746578740811171c23282a3136383a3e40424445000000000000010100000000000000100000000000000000000000000000005f";

function hexToBytes(hex: string): Uint8Array {
  const bytes = new Uint8Array(hex.length / 2);
  for (let i = 0; i < bytes.length; i++) {
    bytes[i] = parseInt(hex.substr(i * 2, 2), 16);
  }
  return bytes;
}

test("decodes a binary plist dictionary", () => {
  const decoded = decodeBplist(hexToBytes(BPLIST_HEX));
  expect(decoded).toEqual({
    count: 42,
    data: new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a]),
    nested: { a: [1, 2, 3], b: true },
    text: "Journal entry body text"
  });
});

test("extracts strings from a binary plist", () => {
  const strings = extractStringsFromBplist(hexToBytes(BPLIST_HEX));
  expect(strings).toContain("Journal entry body text");
});

test("returns undefined for invalid input", () => {
  expect(decodeBplist(new Uint8Array([1, 2, 3]))).toBeUndefined();
  expect(extractStringsFromBplist(new Uint8Array([1, 2, 3]))).toEqual([]);
});
