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

import { ENTaskGroup } from "./en-task-group";
import type { Note as ENNote, IElementHandler } from "@notesnook-importer/enex";
import { Element } from "domhandler";
import { Note } from "../../../models/note";
import { ENMedia } from "./en-media";
import { IMGDataurl } from "./img-dataurl";
import { IHasher } from "../../../utils/hasher";
import { ENTodo } from "./en-todo";
import { ENCodeblock } from "./en-codeblock";

const elementMap = {
  "en-media": ENMedia,
  "img-dataurl": IMGDataurl,
  "en-task-group": ENTaskGroup,
  "en-todo": ENTodo,
  "en-codeblock": ENCodeblock
};
type Keys = keyof typeof elementMap;

export class ElementHandler implements IElementHandler {
  constructor(
    private readonly note: Note,
    private readonly enNote: ENNote,
    private readonly hasher: IHasher
  ) {}

  async process(
    elementType: Keys,
    element: Element
  ): Promise<string | undefined> {
    const elementHandler = elementMap[elementType];
    if (!elementHandler) return;

    return new elementHandler(this.note, this.enNote, this.hasher).process(
      element
    );
  }
}
