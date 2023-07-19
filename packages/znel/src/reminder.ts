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

import { IZnelElement } from "./types";
import { getAsDateRequired } from "./utils";
import { Element } from "domhandler";
import { getAttributeValue } from "domutils";

export class ZReminder implements IZnelElement {
  #reminderElement: Element;
  constructor(reminderElement: Element) {
    this.#reminderElement = reminderElement;
  }

  get createdTime(): Date {
    const time = getAttributeValue(this.#reminderElement, "created-time");
    if (!time)
      throw new Error("Reminder does not have created-time attribute.");
    return new Date(time);
  }

  get modifiedTime(): Date {
    const time = getAttributeValue(this.#reminderElement, "modified-time");
    if (!time)
      throw new Error("Reminder does not have modified-time attribute.");
    return new Date(time);
  }

  get isCompleted(): boolean {
    const isCompleted = getAttributeValue(
      this.#reminderElement,
      "is-completed"
    );
    if (!isCompleted)
      throw new Error("Reminder does not have is-completed attribute.");
    return Number(isCompleted) !== 0;
  }

  get isRead(): boolean {
    const isRead = getAttributeValue(this.#reminderElement, "is-read");
    if (!isRead) throw new Error("Reminder does not have is-read attribute.");
    return Number(isRead) !== 0;
  }

  get type(): string | null {
    const type = getAttributeValue(this.#reminderElement, "type");
    if (!type) throw new Error("Reminder does not have type attribute.");
    return type;
  }

  get reminderTime(): Date {
    return getAsDateRequired(this.#reminderElement, "ZReminderTime");
  }

  validate() {
    this.createdTime &&
      this.modifiedTime &&
      this.type &&
      this.isRead &&
      this.isCompleted &&
      this.reminderTime;
  }
}
