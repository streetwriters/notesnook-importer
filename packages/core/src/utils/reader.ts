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

export class Reader {
  private _offset = 0;
  private currentClamp = 0;
  private textDecoder = new TextDecoder();

  public constructor(private readonly array: Uint8Array) {}

  public get offset(): number {
    return this._offset;
  }

  public skip(amount: number): this {
    this._offset += amount;
    return this;
  }

  public clamp(): void {
    this.currentClamp = this._offset;
  }

  public unclamp(): void {
    this.currentClamp = 0;
  }

  public jump(offset: number): this {
    this._offset = offset + this.currentClamp;
    return this;
  }

  public eof(): boolean {
    return this.offset >= this.array.length;
  }

  public peek(amount: number): Uint8Array;
  public peek(amount: number, encoding: "utf8"): string;
  public peek(amount: number, encoding?: "utf8"): Uint8Array | string {
    if (this.eof()) {
      throw new Error("EOF");
    }
    const data = this.array.slice(this.offset, this.offset + amount);
    // There may be nil bytes used as padding which we'll remove.
    return encoding
      ? this.textDecoder.decode(data.filter((byte) => byte !== 0x00))
      : data;
  }

  public read(amount: number): Uint8Array;
  public read(amount: number, encoding: "utf8"): string;
  public read(amount: number, encoding?: "utf8"): Uint8Array | string {
    const data = this.peek(amount, encoding as any); // eslint-disable-line @typescript-eslint/no-explicit-any
    this._offset += amount;
    return data;
  }
}
