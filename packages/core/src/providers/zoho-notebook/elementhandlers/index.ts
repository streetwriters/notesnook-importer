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

import type { IElementHandler } from "@notesnook-importer/znel";
import { ZNResource } from "./znresource";
import { IHasher } from "../../../utils/hasher";
import { ZNChecklist } from "./znchecklist";
import { File } from "../../../utils/file";
import { Note } from "../../../models/note";
import { Element } from "domhandler";

const elementMap = {
  znresource: ZNResource,
  znchecklist: ZNChecklist
};
type Keys = keyof typeof elementMap;

export class ElementHandler implements IElementHandler {
  constructor(
    private readonly note: Note,
    private readonly files: File[],
    private readonly hasher: IHasher
  ) {}

  async process(
    elementType: Keys,
    element: Element
  ): Promise<string | undefined> {
    const elementHandler = elementMap[elementType];
    if (!elementHandler) return;

    return new elementHandler(this.note, this.files, this.hasher).process(
      element
    );
  }
}
