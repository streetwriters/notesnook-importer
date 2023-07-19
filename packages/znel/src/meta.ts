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

import { ZLocation } from "./location";
import { IZnelElement } from "./types";
import {
  getAsDate,
  getAsString,
  getAsStringRequired,
  getElementByTagName
} from "./utils";
import { Element } from "domhandler";

export type ZNoteType =
  | "note/image"
  | "note/sketch"
  | "note/checklist"
  | "note/mixed"
  | "note/file";

export class ZMeta implements IZnelElement {
  #metaElement: Element;
  constructor(metaElement: Element) {
    this.#metaElement = metaElement;
    this.validate();
  }

  get title(): string {
    return getAsStringRequired(this.#metaElement, "ZTitle");
  }

  get createdDate(): Date | null {
    return getAsDate(this.#metaElement, "ZCreatedDate");
  }

  get modifiedDate(): Date | null {
    return getAsDate(this.#metaElement, "ZModifiedDate");
  }

  get location(): ZLocation | null {
    const locationElement = getElementByTagName(this.#metaElement, "ZLocation");
    if (!locationElement) return null;

    return new ZLocation(locationElement);
  }

  get noteColor(): string | null {
    return getAsString(this.#metaElement, "ZNoteColor");
  }

  get noteType(): ZNoteType {
    return <ZNoteType>getAsStringRequired(this.#metaElement, "ZNoteType");
  }

  validate() {
    this.title && this.noteType;
  }
}
