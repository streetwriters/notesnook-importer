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

/** Converts half-inch units to pixels (48px per inch). */
export function px(inches: number): string {
  return `${Math.round(inches * 48.0)}px`;
}

export class StyleSet {
  private readonly styles = new Map<string, string>();

  set(prop: string, value: string) {
    this.styles.set(prop, value);
    return this;
  }

  extend(other: StyleSet) {
    for (const [key, value] of other.styles) this.styles.set(key, value);
  }

  get length() {
    return this.styles.size;
  }

  toString(): string {
    return [...this.styles.entries()]
      .sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0))
      .map(([attr, value]) => `${attr}: ${value};`)
      .join(" ");
  }
}

export class AttributeSet {
  private readonly attributes = new Map<string, string>();

  set(attribute: string, value: string) {
    this.attributes.set(attribute, value);
    return this;
  }

  toString(): string {
    return [...this.attributes.entries()]
      .sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0))
      .map(([attr, value]) => `${attr}="${value}"`)
      .join(" ");
  }
}
