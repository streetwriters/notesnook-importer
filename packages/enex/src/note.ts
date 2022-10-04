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

import { Resource } from "./resource";
import { Task } from "./task";
import { IEnexElement } from "./types";
import {
  getAsDate,
  getAsNumber,
  getAsString,
  getAsStringRequired,
} from "./utils";
import { HTMLElement } from "node-html-parser";
import { Content } from "./content";

export class Note implements IEnexElement {
  #noteElement: HTMLElement;
  constructor(noteElement: HTMLElement) {
    this.#noteElement = noteElement;
    this.validate();
  }

  get title(): string {
    return getAsStringRequired(this.#noteElement, "title");
  }

  get content(): Content {
    const tag = this.#noteElement.querySelector("content");
    if (!tag) throw new Error(`content is required.`);
    return new Content(tag);
  }

  get created(): Date | null {
    return getAsDate(this.#noteElement, "created");
  }

  get updated(): Date | null {
    return getAsDate(this.#noteElement, "updated");
  }

  get tags(): string[] | undefined {
    const tagElements = this.#noteElement.getElementsByTagName("tag");
    if (!tagElements.length) return;
    const tags: string[] = [];
    for (const element of tagElements) {
      if (!element.textContent) continue;
      tags.push(element.textContent);
    }
    return tags;
  }

  get attributes(): NoteAttributes | null {
    const noteAttributeElement =
      this.#noteElement.querySelector("note-attributes");
    if (!noteAttributeElement) return null;
    return new NoteAttributes(noteAttributeElement);
  }

  get resources(): Resource[] | undefined {
    const resourceElements = this.#noteElement.querySelectorAll("resource");
    if (!resourceElements.length) return;
    const resources: Resource[] = [];
    for (const element of resourceElements) {
      resources.push(new Resource(element));
    }
    return resources;
  }

  get tasks(): Task[] | undefined {
    const taskElements = this.#noteElement.querySelectorAll("task");
    if (!taskElements.length) return;
    const tasks: Task[] = [];
    for (const element of taskElements) {
      tasks.push(new Task(element));
    }
    return tasks;
  }

  validate() {
    this.title && this.content;
  }
}

class NoteAttributes {
  #noteAttributesElement: HTMLElement;
  constructor(noteAttributesElement: HTMLElement) {
    this.#noteAttributesElement = noteAttributesElement;
  }

  get author(): string | null {
    return getAsString(this.#noteAttributesElement, "author");
  }

  get subjectDate(): string | null {
    return getAsString(this.#noteAttributesElement, "subject-date");
  }

  get latitude(): number | null {
    return getAsNumber(this.#noteAttributesElement, "latitude");
  }

  get longitude(): number | null {
    return getAsNumber(this.#noteAttributesElement, "longitude");
  }

  get altitude(): number | null {
    return getAsNumber(this.#noteAttributesElement, "altitude");
  }

  get source(): string | null {
    return getAsString(this.#noteAttributesElement, "source");
  }

  get sourceUrl(): string | null {
    return getAsString(this.#noteAttributesElement, "source-url");
  }

  get sourceApplication(): string | null {
    return getAsString(this.#noteAttributesElement, "source-application");
  }

  get reminderOrder(): number | null {
    return getAsNumber(this.#noteAttributesElement, "reminder-order");
  }

  get reminderTime(): Date | null {
    return getAsDate(this.#noteAttributesElement, "reminder-time");
  }

  get reminderDoneTime(): Date | null {
    return getAsDate(this.#noteAttributesElement, "reminder-done-time");
  }

  get placeName(): string | null {
    return getAsString(this.#noteAttributesElement, "place-name");
  }

  get contentClass(): string | null {
    return getAsString(this.#noteAttributesElement, "content-class");
  }
}
