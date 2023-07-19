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

import { findOne, textContent } from "domutils";
import { Element, Document } from "domhandler";

export function getAsString(element: Element, tagName: string): string | null {
  const tag = getElementByTagName(element, tagName);
  if (!tag) return null;
  return textContent(tag).trim();
}

export function getAsStringRequired(element: Element, tagName: string): string {
  const tag = getElementByTagName(element, tagName);
  if (!tag || !textContent(tag)) throw new Error(`${tagName} is required.`);
  return textContent(tag).trim();
}

export function getAsNumber(element: Element, tagName: string): number | null {
  const tag = parseFloat(getAsString(element, tagName) || "");
  if (isNaN(tag)) return null;
  return tag;
}

export function getAsNumberRequired(element: Element, tagName: string): number {
  const tag = parseFloat(getAsStringRequired(element, tagName));
  if (isNaN(tag)) throw new Error(`${tagName} value is an invalid number.`);
  return tag;
}

export function getAsBoolean(element: Element, tagName: string): boolean {
  const tag = getAsString(element, tagName);
  return tag === "true";
}

export function getAsDate(element: Element, tagName: string): Date | null {
  const time = getAsString(element, tagName);
  if (!time) return null;
  return new Date(time);
}

export function getAsDateRequired(element: Element, tagName: string): Date {
  const time = getAsStringRequired(element, tagName);
  const date = new Date(time);
  if (!date) throw new Error(`${tagName} value is an invalid date.`);
  return date;
}
export function getElementByTagName(
  element: Element | Document,
  tagName: string
): Element | null {
  return findOne((e) => e.tagName === tagName, element.childNodes);
}
