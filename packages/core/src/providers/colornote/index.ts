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

import { ContentType, Note, Reminder } from "../../models/note";
import { ColornoteNote } from "./types";
import {
  IFileProvider,
  ProviderErrorMessage,
  ProviderMessage,
  error
} from "../provider";
import { File } from "../../utils/file";
import { textToHTML } from "../../utils/to-html";
import { JSONParser } from "@streamparser/json";
import { Providers } from "../provider-factory";

const COLOR_INDEX_MAP: Record<number, string> = {
  1: "red",
  2: "orange",
  3: "yellow",
  4: "green",
  5: "blue",
  6: "purple",
  7: "black",
  8: "gray",
  9: "white"
};

export class ColorNote implements IFileProvider {
  id: Providers = "colornote";
  type = "file" as const;
  supportedExtensions = [".json"];
  version = "1.0.0";
  name = "ColorNote";
  examples = ["notes.json"];
  helpLink =
    "https://help.notesnook.com/importing-notes/import-notes-from-colornote";

  filter(file: File) {
    return this.supportedExtensions.includes(file.extension);
  }

  async *process(file: File): AsyncGenerator<ProviderMessage, void, unknown> {
    const parser = new JSONParser({
      stringBufferSize: undefined
    });

    const notes: Note[] = [];
    const errors: ProviderErrorMessage[] = [];

    parser.onValue = (value, key, parent, stack) => {
      if (stack.length !== 1) return;
      // By default, the parser keeps all the child elements in memory until the root parent is emitted.
      // Let's delete the objects after processing them in order to optimize memory.
      if (parent && key !== undefined)
        delete (parent as Record<string | number, unknown>)[key];

      const colornote = value as ColornoteNote;

      // skip encrypted notes
      if (colornote.encrypted !== 0) {
        return;
      }
      // skip deleted notes
      if (colornote.active_state === 32) {
        return;
      }

      if (!colornote.created_date || !colornote.modified_date) {
        errors.push(
          error(
            new Error(
              `Invalid note. created_date & modified_date properties are required.`
            ),
            { file }
          )
        );
        return;
      }

      const content = textToHTML(colornote.note || "");
      const color = COLOR_INDEX_MAP[colornote.color_index];
      const note: Note = {
        title: colornote.title || "Untitled note",
        dateCreated: colornote.created_date,
        dateEdited: colornote.modified_date,
        content: {
          type: ContentType.HTML,
          data: content
        }
      };

      if (color) {
        note.color = color;
      }

      // set archived if space === 16
      if (colornote.space === 16) {
        note.archived = true;
      }

      // set trashed if active_state === 16
      if (colornote.active_state === 16) {
        note.trashed = true;
      }

      const reminder = parseReminder(colornote);
      if (reminder) {
        note.reminder = reminder;
      }

      notes.push(note);
    };

    const reader = file.stream.pipeThrough(new TextDecoderStream()).getReader();
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;

      parser.write(value);

      for (const err of errors) {
        yield err;
      }

      for (const note of notes) {
        yield { type: "note", note };
      }

      errors.length = 0;
      notes.length = 0;
    }
  }
}

function parseReminder(colornote: ColornoteNote): Reminder | undefined {
  const reminderBase = colornote.reminder_base || colornote.reminder_date || 0;
  if (!reminderBase) {
    return undefined;
  }

  const baseDate = new Date(reminderBase);
  const reminderRepeat = colornote.reminder_repeat || 0;

  // one-time reminder
  if (reminderRepeat === 0) {
    return {
      title: colornote.title || "Reminder",
      description: textToHTML(colornote.note || ""),
      date: reminderBase,
      mode: "once"
    };
  }

  // daily reminder
  if (reminderRepeat === 16) {
    return {
      title: colornote.title || "Reminder",
      description: textToHTML(colornote.note || ""),
      date: reminderBase,
      mode: "repeat",
      recurringMode: "day"
    };
  }

  // weekly reminder (every weekday)
  if (reminderRepeat === 32) {
    return {
      title: colornote.title || "Reminder",
      description: textToHTML(colornote.note || ""),
      date: reminderBase,
      mode: "repeat",
      recurringMode: "week",
      selectedDays: [1, 2, 3, 4, 5]
    };
  }

  // weekly reminder (calculate weekday from reminder_base)
  if (reminderRepeat === 48) {
    const dayOfWeek = baseDate.getDay();
    return {
      title: colornote.title || "Reminder",
      description: textToHTML(colornote.note || ""),
      date: reminderBase,
      mode: "repeat",
      recurringMode: "week",
      selectedDays: [dayOfWeek]
    };
  }

  // monthly reminder (specific day of month)
  if (reminderRepeat === 80 || reminderRepeat === 96) {
    const dayOfMonth = baseDate.getDate();
    return {
      title: colornote.title || "Reminder",
      description: textToHTML(colornote.note || ""),
      date: reminderBase,
      mode: "repeat",
      recurringMode: "month",
      selectedDays: [dayOfMonth]
    };
  }

  // yearly reminder
  if (reminderRepeat === 112) {
    return {
      title: colornote.title || "Reminder",
      description: textToHTML(colornote.note || ""),
      date: reminderBase,
      mode: "repeat",
      recurringMode: "year"
    };
  }

  // unknown reminder type
  return {
    title: colornote.title || "Reminder",
    description: textToHTML(colornote.note || ""),
    date: reminderBase,
    mode: "once"
  };
}
