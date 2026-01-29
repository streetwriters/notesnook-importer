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

import { JSONParser } from "@streamparser/json";
import { ContentType, Note, Reminder } from "../../models/note";
import { File } from "../../utils/file";
import { textToHTML } from "../../utils/to-html";
import {
  IFileProvider,
  ProviderErrorMessage,
  ProviderMessage,
  error
} from "../provider";
import { Providers } from "../provider-factory";
import {
  ColornoteFolderData,
  ColornoteFormat,
  ColornoteNote,
  ColornoteNoteExt
} from "./types";

type ColorNotePreprocessData = {
  folderMap: Map<number, string>;
};

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

export class ColorNote implements IFileProvider<ColorNotePreprocessData> {
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

  async preprocess(files: File[]) {
    const folderMap = new Map<number, string>();

    for (const file of files) {
      if (!this.supportedExtensions.includes(file.extension)) continue;

      try {
        const text = await file.text();
        const items = JSON.parse(text) as ColornoteNote[];

        for (const item of items) {
          // item.type === 128 is a folder
          if (item.type === 128 && item.note) {
            try {
              const folderData = JSON.parse(item.note) as ColornoteFolderData;
              if (folderData.folder_id && item.title) {
                folderMap.set(folderData.folder_id, item.title);
              }
            } catch {}
          }
        }
      } catch {}
    }

    return {
      folderMap
    };
  }

  async *process(
    file: File,
    _settings: unknown,
    _files: File[],
    preprocessData?: ColorNotePreprocessData
  ): AsyncGenerator<ProviderMessage, void, unknown> {
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

      // skip non-note types (settings = 256, folders = 128)
      if (colornote.type === 256 || colornote.type === 128) {
        return;
      }
      // skip encrypted notes
      if (colornote.encrypted !== 0) {
        return;
      }
      // skip deleted and trashed notes
      if (colornote.active_state === 32 || colornote.active_state === 16) {
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

      const content = colornote.note_ext
        ? applyFormatting(colornote.note || "", colornote.note_ext)
        : textToHTML(colornote.note || "");
      const note: Note = {
        title: colornote.title || "Untitled note",
        dateCreated: colornote.created_date,
        dateEdited: colornote.modified_date,
        content: {
          type: ContentType.HTML,
          data: content
        }
      };

      const color = COLOR_INDEX_MAP[colornote.color_index];
      if (color) {
        note.color = color;
      }

      // set archived if space === 16
      if (colornote.space === 16) {
        note.archived = true;
      }

      const reminder = parseReminder(colornote);
      if (reminder) {
        note.reminder = reminder;
      }

      const folderName = preprocessData?.folderMap?.get(colornote.folder_id);
      if (folderName) {
        note.notebooks = [{ title: folderName, children: [] }];
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

const formatOrder = [
  "headline1",
  "headline2",
  "bold",
  "italic",
  "underline",
  "strike",
  "bg_color",
  "url"
];

function applyFormatting(text: string, noteExtJson: string) {
  let noteExt: ColornoteNoteExt;
  try {
    noteExt = JSON.parse(noteExtJson) as ColornoteNoteExt;
  } catch {
    return textToHTML(text);
  }

  const formatList = noteExt.format_list;
  if (!formatList || formatList.length === 0) {
    return textToHTML(text);
  }

  const boundaries = new Set<number>();
  boundaries.add(0);
  boundaries.add(text.length);

  for (const format of formatList) {
    if (format.start >= 0 && format.start <= text.length) {
      boundaries.add(format.start);
    }
    if (format.end >= 0 && format.end <= text.length) {
      boundaries.add(format.end);
    }
  }

  const sortedBoundaries = Array.from(boundaries).sort((a, b) => a - b);
  const segments: { start: number; end: number; formats: ColornoteFormat[] }[] =
    [];

  for (let i = 0; i < sortedBoundaries.length - 1; i++) {
    const start = sortedBoundaries[i];
    const end = sortedBoundaries[i + 1];
    const activeFormats = formatList.filter(
      (format) => format.start <= start && format.end >= end
    );
    segments.push({ start, end, formats: activeFormats });
  }

  let html = "";
  let inParagraph = false;
  let inHeadline: "h1" | "h2" | null = null;
  let headlineContent = "";

  for (const segment of segments) {
    const segmentText = text.slice(segment.start, segment.end);
    const headlineFormat = segment.formats.find(
      (f) => f.format === "headline1" || f.format === "headline2"
    );
    const currentHeadlineTag = headlineFormat
      ? headlineFormat.format === "headline1"
        ? "h1"
        : "h2"
      : null;

    const lines = segmentText.split("\n");

    for (let lineIndex = 0; lineIndex < lines.length; lineIndex++) {
      const line = lines[lineIndex];

      if (lineIndex > 0) {
        if (inHeadline) {
          html += `<${inHeadline}>${headlineContent}</${inHeadline}>`;
          headlineContent = "";
          inHeadline = null;
        }
        if (inParagraph) {
          html += "</p>";
          inParagraph = false;
        }
      }

      if (line.length === 0) {
        continue;
      }

      // all formats are treated as inline format except for headlines
      // and they are sorted so that formats are applied "inside-out"
      const inlineFormats = segment.formats
        .filter((f) => f.format !== "headline1" && f.format !== "headline2")
        .sort(
          (a, b) =>
            formatOrder.indexOf(a.format) - formatOrder.indexOf(b.format)
        );
      let formattedLine = line;

      for (const format of inlineFormats.reverse()) {
        formattedLine = wrapWithInlineFormat(formattedLine, format);
      }

      if (currentHeadlineTag) {
        if (inParagraph) {
          html += "</p>";
          inParagraph = false;
        }

        if (inHeadline && inHeadline !== currentHeadlineTag) {
          html += `<${inHeadline}>${headlineContent}</${inHeadline}>`;
          headlineContent = "";
        }

        inHeadline = currentHeadlineTag;
        headlineContent += formattedLine;
      } else {
        if (inHeadline) {
          html += `<${inHeadline}>${headlineContent}</${inHeadline}>`;
          headlineContent = "";
          inHeadline = null;
        }

        if (!inParagraph) {
          html += "<p>";
          inParagraph = true;
        }

        html += formattedLine;
      }
    }
  }

  if (inHeadline) {
    html += `<${inHeadline}>${headlineContent}</${inHeadline}>`;
  }

  if (inParagraph) {
    html += "</p>";
  }

  return html || "<p></p>";
}

function wrapWithInlineFormat(content: string, fmt: ColornoteFormat) {
  switch (fmt.format) {
    case "bold":
      return `<strong>${content}</strong>`;
    case "italic":
      return `<em>${content}</em>`;
    case "underline":
      return `<u>${content}</u>`;
    case "strike":
      return `<s>${content}</s>`;
    case "url":
      if (fmt.attribute) {
        return `<a href="${fmt.attribute}">${content}</a>`;
      }
      return content;
    case "bg_color":
      if (fmt.attribute) {
        const cssColor = highlighToColor(fmt.attribute);
        return `<span style="background-color: ${cssColor}">${content}</span>`;
      }
      return content;
    default:
      return content;
  }
}

const HIGHLIGHT_COLOR_MAP: Record<string, string> = {
  highlight_purple: "purple"
};

function highlighToColor(highlight: string) {
  return HIGHLIGHT_COLOR_MAP[highlight] || highlight;
}
