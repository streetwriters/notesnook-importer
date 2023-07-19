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

import { ZMeta } from "./src/meta";
import { IZnelElement } from "./src/types";
import { parseDocument } from "htmlparser2";
import { ZReminder } from "./src/reminder";
import { ZContent } from "./src/content";
import { getAttributeValue, findAll, textContent } from "domutils";
import { Element } from "domhandler";
import { getElementByTagName } from "./src/utils";

export class Znel implements IZnelElement {
  #znoteElement: Element;
  constructor(znel: string) {
    const document = parseDocument(znel, {
      recognizeCDATA: true,
      xmlMode: true
    });

    const element = getElementByTagName(document, "ZNote");
    if (!element)
      throw new Error("Invalid znel file. Must contain ZNote element.");
    this.#znoteElement = element;

    this.validate();
  }

  get version(): string {
    const version = getAttributeValue(this.#znoteElement, "znelVersion");
    if (!version)
      throw new Error("Invalid znel. znelVersion attribute is required.");
    return version;
  }

  get metadata(): ZMeta {
    const metadataElement = getElementByTagName(this.#znoteElement, "ZMeta");
    if (!metadataElement)
      throw new Error("Invalid znel. No ZMeta element found");
    return new ZMeta(metadataElement);
  }

  get tags(): string[] {
    const tags: string[] = [];
    const tagElements = findAll(
      (e) => e.name === "ZTag",
      this.#znoteElement.childNodes
    );
    for (const element of tagElements) {
      tags.push(textContent(element));
    }
    return tags;
  }

  get reminders(): ZReminder[] {
    const reminders: ZReminder[] = [];
    const reminderElements = findAll(
      (e) => e.name === "ZReminder",
      this.#znoteElement.childNodes
    );
    for (const element of reminderElements) {
      reminders.push(new ZReminder(element));
    }
    return reminders;
  }

  get content(): ZContent {
    const zcontentElement = getElementByTagName(this.#znoteElement, "ZContent");
    if (!zcontentElement)
      throw new Error("Invalid znel. No ZContent element found");
    return new ZContent(zcontentElement, this.metadata.noteType);
  }

  validate() {
    this.version && this.content;
  }
}

export * from "./src/content";
