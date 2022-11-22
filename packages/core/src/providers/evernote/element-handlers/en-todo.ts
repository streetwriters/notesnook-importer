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

import { BaseHandler } from "./base";
import { Element, ParentNode, isTag } from "domhandler";
import { getAttributeValue } from "domutils";

export class ENTodo extends BaseHandler {
  async process(element: Element): Promise<string | undefined> {
    const isChecked = getAttributeValue(element, "checked") === "true";

    const parentListItem = closest(element, "li");
    if (!parentListItem) return;

    if (isChecked) addClass(parentListItem, "checked");

    const parentList = closest(element, "ul");
    if (!parentList) return;

    addClass(parentList, "checklist");
    return;
  }
}

function closest(element: Element, tagName: string) {
  let parent: ParentNode | null = element;
  while ((parent = parent.parent)) {
    if (isTag(parent) && parent.tagName === tagName) break;
  }
  return parent as Element;
}

function addClass(element: Element, className: string) {
  element.attribs.class = element.attribs.class || "";
  if (element.attribs.class.includes(className)) return;
  if (!element.attribs.class) element.attribs.class = className;
  else element.attribs.class += ` ${className}`;
}
