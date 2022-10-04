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

import { Reminder } from "./reminder";
import { DateUIOption, IEnexElement } from "./types";
import {
  getAsBoolean,
  getAsDate,
  getAsDateRequired,
  getAsString,
  getAsStringRequired,
} from "./utils";
import { HTMLElement } from "node-html-parser";

export enum TaskStatus {
  OPEN = "open",
  COMPLETED = "completed",
}

export class Task implements IEnexElement {
  #taskElement: HTMLElement;
  constructor(taskElement: HTMLElement) {
    this.#taskElement = taskElement;
  }

  get title(): string {
    return getAsStringRequired(this.#taskElement, "title");
  }

  get created(): Date {
    return getAsDateRequired(this.#taskElement, "created");
  }

  get updated(): Date {
    return getAsDateRequired(this.#taskElement, "updated");
  }

  get taskStatus(): TaskStatus {
    return <TaskStatus>getAsStringRequired(this.#taskElement, "taskStatus");
  }

  get inNote(): boolean {
    return getAsBoolean(this.#taskElement, "inNote");
  }

  get taskFlag(): string {
    return getAsStringRequired(this.#taskElement, "taskFlag");
  }

  get sortWeight(): string {
    return getAsStringRequired(this.#taskElement, "sortWeight");
  }

  get noteLevelID(): string {
    return getAsStringRequired(this.#taskElement, "noteLevelID");
  }

  get taskGroupNoteLevelID(): string {
    return getAsStringRequired(this.#taskElement, "taskGroupNoteLevelID");
  }

  get dueDate(): Date | null {
    return getAsDate(this.#taskElement, "dueDate");
  }

  get dueDateUIOption(): DateUIOption | null {
    return <DateUIOption | null>(
      getAsString(this.#taskElement, "dueDateUIOption")
    );
  }

  get timeZone(): string | null {
    return getAsString(this.#taskElement, "timeZone");
  }

  get statusUpdated(): Date | null {
    return getAsDate(this.#taskElement, "statusUpdated");
  }

  get creator(): string | null {
    return getAsString(this.#taskElement, "creator");
  }

  get lastEditor(): string | null {
    return getAsString(this.#taskElement, "lastEditor");
  }

  get reminder(): Reminder | null {
    const reminderElement = this.#taskElement.querySelector("reminder");
    if (!reminderElement) return null;

    return new Reminder(reminderElement);
  }

  validate() {
    this.title &&
      this.created &&
      this.updated &&
      this.inNote &&
      this.taskFlag &&
      this.sortWeight &&
      this.noteLevelID &&
      this.taskGroupNoteLevelID;
  }
}
