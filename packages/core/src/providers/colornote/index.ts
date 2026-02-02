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
import { File } from "../../utils/file";
import { textToHTML } from "../../utils/to-html";
import {
  IFileProvider,
  ProviderErrorMessage,
  ProviderMessage,
  ProviderSettings,
  error
} from "../provider";
import { Providers } from "../provider-factory";
import { decryptBackup } from "./decrypt-backup";
import {
  ColornoteFolderData,
  ColornoteFormat,
  ColornoteNote,
  ColornoteNoteExt
} from "./types";

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

const HIGHLIGHT_COLOR_MAP: Record<string, string> = {
  highlight_purple: "purple"
};

export class ColorNote implements IFileProvider {
  id: Providers = "colornote";
  type = "file" as const;
  supportedExtensions = [".backup", ".db", ".dat"];
  version = "1.0.0";
  name = "ColorNote";
  examples = ["colornote.backup"];
  helpLink =
    "https://help.notesnook.com/importing-notes/import-notes-from-colornote";

  filter(file: File) {
    return this.supportedExtensions.includes(file.extension);
  }

  async *process(
    file: File,
    settings: ProviderSettings,
    _files: File[]
  ): AsyncGenerator<ProviderMessage, void, unknown> {
    const rawBytes = await file.bytes();
    if (!rawBytes) {
      yield error(new Error("Failed to read backup file"), { file });
      return;
    }

    let items: ColornoteNote[];
    try {
      items = await decryptBackup(
        new Uint8Array(rawBytes),
        settings?.options?.colornote?.password
      );
    } catch (e) {
      yield error(e instanceof Error ? e : new Error("Decryption failed"), {
        file
      });
      return;
    }

    const folderMap = new Map<number, string>();
    for (const item of items) {
      if (item.type === 128 && item.note) {
        try {
          const folderData = JSON.parse(item.note) as ColornoteFolderData;
          if (folderData.folder_id && item.title) {
            folderMap.set(folderData.folder_id, item.title);
          }
        } catch {}
      }
    }

    for (const colornote of items) {
      if (!colornote.created_date || !colornote.modified_date) {
        yield error(
          new Error(
            "Invalid note. created_date & modified_date properties are required."
          ),
          { file }
        );
      }

      const result = this.processNote(colornote, folderMap);
      if (result) {
        if ("type" in result && result.type === "error") {
          yield result;
        } else {
          yield { type: "note", note: result as Note };
        }
      }
    }
  }

  private processNote(
    colornote: ColornoteNote,
    folderMap: Map<number, string>
  ): Note | ProviderErrorMessage | null {
    // skip non-note types (settings = 256, folders = 128)
    if (colornote.type === 256 || colornote.type === 128) {
      return null;
    }
    // skip encrypted notes
    if (colornote.encrypted !== 0) {
      return null;
    }
    // skip deleted (active_state = 32) and trashed notes (active_state = 16)
    if (colornote.active_state === 32 || colornote.active_state === 16) {
      return null;
    }

    let content: string;
    // checklist note
    if (colornote.type === 16) {
      content = checklistToHTML(colornote.note || "");
    } else if (colornote.note_ext) {
      content = applyFormatting(colornote.note || "", colornote.note_ext);
    } else {
      content = textToHTML(colornote.note || "");
    }

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

    // set archived if space = 16
    if (colornote.space === 16) {
      note.archived = true;
    }

    const reminder = parseReminder(colornote);
    if (reminder) {
      note.reminder = reminder;
    }

    const folderName = folderMap.get(colornote.folder_id);
    if (folderName) {
      note.notebooks = [{ title: folderName, children: [] }];
    }

    return note;
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

function wrapWithInlineFormat(content: string, format: ColornoteFormat) {
  switch (format.format) {
    case "bold":
      return `<strong>${content}</strong>`;
    case "italic":
      return `<em>${content}</em>`;
    case "underline":
      return `<u>${content}</u>`;
    case "strike":
      return `<s>${content}</s>`;
    case "url":
      if (format.attribute) {
        return `<a href="${format.attribute}">${content}</a>`;
      }
      return content;
    case "bg_color":
      if (format.attribute) {
        const cssColor =
          HIGHLIGHT_COLOR_MAP[format.attribute] || format.attribute;
        return `<span style="background-color: ${cssColor}">${content}</span>`;
      }
      return content;
    default:
      return content;
  }
}

function checklistToHTML(text: string): string {
  const lines = text.split(/\r?\n/);
  const items: string[] = [];

  for (const line of lines) {
    // Match [V] for checked or [ ] for unchecked
    const checkedMatch = line.match(/^\[V\]\s*(.*)/);
    const uncheckedMatch = line.match(/^\[ \]\s*(.*)/);

    if (checkedMatch) {
      items.push(
        `<li class="simple-checklist--item checked">${checkedMatch[1]}</li>`
      );
    } else if (uncheckedMatch) {
      items.push(
        `<li class="simple-checklist--item">${uncheckedMatch[1]}</li>`
      );
    }
  }

  if (items.length === 0) {
    return "<p></p>";
  }

  return `<ul class="simple-checklist">${items.join("")}</ul>`;
}
