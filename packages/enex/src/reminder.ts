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

import { DateUIOption, IEnexElement } from "./types";
import {
  getAsDate,
  getAsDateRequired,
  getAsNumber,
  getAsString,
  getAsStringRequired,
} from "./utils";
import { HTMLElement } from "node-html-parser";

enum ReminderStatus {
  ACTIVE = "active",
  MUTED = "muted",
}

export class Reminder implements IEnexElement {
  #reminderElement: HTMLElement;
  constructor(reminderElement: HTMLElement) {
    this.#reminderElement = reminderElement;
  }

  get created(): Date {
    return getAsDateRequired(this.#reminderElement, "created");
  }

  get updated(): Date {
    return getAsDateRequired(this.#reminderElement, "updated");
  }

  get noteLevelID(): string {
    return getAsStringRequired(this.#reminderElement, "noteLevelID");
  }

  get reminderDate(): Date | null {
    return getAsDate(this.#reminderElement, "reminderDate");
  }

  get reminderDateUIOption(): DateUIOption | null {
    return <DateUIOption | null>(
      getAsString(this.#reminderElement, "reminderDateUIOption")
    );
  }

  get dueDateOffset(): number | null {
    return getAsNumber(this.#reminderElement, "dueDateOffset");
  }

  get reminderStatus(): ReminderStatus | null {
    return <ReminderStatus | null>(
      getAsString(this.#reminderElement, "reminderStatus")
    );
  }

  validate() {
    this.created && this.updated && this.noteLevelID;
  }
}
