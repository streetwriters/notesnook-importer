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

import type { IElementHandler } from "@notesnook-importer/enex";
import type { HTMLElement } from "node-html-parser";
import { Note } from "../../../models/note";
import { AttachmentHandler } from "./attachment";
import { IHasher } from "../../../utils/hasher";

const elementMap = {
  img: AttachmentHandler,
  obj: AttachmentHandler
};
type Keys = keyof typeof elementMap;

export class ElementHandler implements IElementHandler {
  constructor(private readonly note: Note, private readonly hasher: IHasher) {}

  async process(
    elementType: Keys,
    element: HTMLElement
  ): Promise<string | undefined> {
    const elementHandler = elementMap[elementType];
    if (!elementHandler) return;

    return new elementHandler(this.note, this.hasher).process(element);
  }
}
