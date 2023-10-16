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

import { ISO8601DateTime } from "./src/iso8601-date-time";
import { Note } from "./src/note";
import { Parser as HTMLParser2 } from "htmlparser2";
import { MimeTypes, Resource } from "./src/resource";
import { toByteArray } from "base64-js";
import SparkMD5 from "spark-md5";
import { Task } from "./src/task";

class Parser extends HTMLParser2 {
  public notes: Note[] = [];
}

export type ParsedEnex = {
  exportDate: Date;
  application: string;
  version: string;
  notes: Note[];
  isNotebook: boolean;
};

const VALID_TAGS = [
  // note
  "title",
  "created",
  "updated",
  "tag",
  "content",
  "source-application",

  // resource
  "data",
  "mime",
  "width",
  "height",
  "file-name",
  "source-url",

  // tasks
  "taskGroupNoteLevelID",
  "taskStatus"
];

const WHITESPACE_REGEX = /\s+/gm;
export async function* parse(enex: ReadableStream<string> | string) {
  // const notes = [];
  const state: ParseState = { attributes: {}, text: "", ignore: true };
  const parser = new Parser(
    {
      onopentagname(name) {
        reset(state);

        if (name === "note")
          state.note = { tags: [], resources: [], tasks: [] };
        if (name === "resource") state.resource = {};
        if (name === "task") state.task = {};
        if (VALID_TAGS.includes(name)) state.ignore = false;
      },
      onclosetag(name) {
        if (state.note) {
          if (name === "title" && !state.task) state.note.title = state.text;
          if (name === "created")
            state.note.created = ISO8601DateTime.toDate(state.text);
          if (name === "updated")
            state.note.updated = ISO8601DateTime.toDate(state.text);
          if (name === "tag") state.note.tags.push(state.text);
          if (name === "content") state.note.content = state.text;
          if (name === "resource" && state.resource) {
            state.note.resources.push(state.resource);
            state.resource = undefined;
          }
          if (name === "source-url" && !state.resource)
            state.note.sourceURL = state.text;
          if (name === "source-application" && !state.resource)
            state.note.sourceApplication = state.text;
          if (name === "task" && state.task) {
            state.note.tasks.push(state.task);
            state.task = undefined;
          }
        }

        if (state.task) {
          if (name === "title") state.task.title = state.text;
          if (name === "taskGroupNoteLevelID")
            state.task.taskGroupNoteLevelID = state.text;
          if (name === "taskStatus")
            state.task.taskStatus = state.text as "open" | "completed";
        }

        if (state.resource) {
          if (name === "data") {
            const data = toByteArray(state.text.replace(WHITESPACE_REGEX, ""));
            state.resource.data = data;
            state.resource.hash = SparkMD5.ArrayBuffer.hash(data);
          }
          if (name === "mime") state.resource.mime = state.text as MimeTypes;
          if (name === "file-name") state.resource.filename = state.text;
          if (name === "source-url") state.resource.sourceURL = state.text;
          if (name === "width") state.resource.width = parseInt(state.text);
          if (name === "height") state.resource.height = parseInt(state.text);
        }

        if (name === "note" && state.note) {
          parser.notes.push(state.note);
        }
      },
      ontext(data) {
        if (state.ignore) return;
        state.text += data;
      }
    },
    {
      xmlMode: false,
      lowerCaseTags: false,
      lowerCaseAttributeNames: false,
      recognizeSelfClosing: true,
      recognizeCDATA: true,
      decodeEntities: true
    }
  );

  if (typeof enex === "string") {
    parser.end(enex);
    yield parser.notes;
  } else {
    const reader = enex.getReader();
    let chunk: ReadableStreamReadResult<string> | undefined;
    while ((chunk = await reader.read())) {
      if (chunk.done) break;
      if (!chunk.value) continue;
      parser.notes.length = 0;
      parser.write(chunk.value);
      yield parser.notes;
    }
    parser.notes.length = 0;
    parser.end();
    yield parser.notes;
  }
}

export * from "./src/note";
export * from "./src/reminder";
export * from "./src/resource";
export * from "./src/content";
export * from "./src/task";
export * from "./src/types";

type ParseState = {
  note?: Note;
  resource?: Resource;
  task?: Task;
  ignore: boolean;
  text: string;
  attributes: Record<string, string>;
};

function reset(state: ParseState) {
  state.text = "";
  state.attributes = {};
  state.ignore = true;
}

// function parseChunk(state: ParseState, chunk: string): Note[] {
//   const notes: Note[] = [];

//   parser.write(chunk);
//   parser.reset();
//   return notes;
// }
// function closeTag(state: ParseState) {
//   if (state.isTagOpen) {
//     state.note += ">";
//     state.isTagOpen = false;
//   }
// }

// const state: ParseState = {
//   note: "",
//   isTagOpen: false,
//   write: false
// };

// const parser = new Parser(
//   {
//     onopentagname(name) {
//       closeTag(state);
//       if (name === "note") state.write = true;
//       if (state.write) {
//         state.note += `<${name}`;
//         state.isTagOpen = true;
//       }
//     },
//     onattribute(name, value, quote) {
//       if (!state.write) return;

//       state.note += " ";
//       state.note += name;
//       if (!quote) return;
//       const actualQuote = quote === null ? "" : `${quote}`;
//       state.note += `=${actualQuote}${value}${actualQuote}`;
//     },
//     onclosetag(name, isImplied) {
//       if (!state.write) return;

//       if (!isImplied) closeTag(state);
//       state.note += isImplied ? "/>" : `</${name}>`;
//       state.isTagOpen = false;

//       if (name === "note") {
//         onNote(toNote(state.note));
//         state.note = "";
//         state.write = false;
//         state.isTagOpen = false;
//       }
//     },
//     ontext(data) {
//       if (!state.write) return;

//       closeTag(state);
//       state.note += data;
//     },
//     oncdatastart() {
//       if (!state.write) return;

//       state.note += "<![CDATA[";
//     },
//     oncdataend() {
//       if (!state.write) return;

//       state.note += "]]>";
//     },
//     onprocessinginstruction(name, data) {
//       if (!state.write) return;
//       state.note += `<${data}>`;
//     }
//   },
//   { recognizeCDATA: true, recognizeSelfClosing: true, xmlMode: true }
// );

// const parser = createDomStream(
//   () => {},
//   { recognizeCDATA: true, recognizeSelfClosing: true, xmlMode: true },
//   (elem) => {
//     if (elem.tagName === "en-export") {
//       const exportDate = elem.attribs["export-date"];
//       if (!exportDate)
//         throw new Error("Invalid enex. export-date attribute is required.");
//       const date = ISO8601DateTime.toDate(exportDate);
//       if (!date) throw new Error("export-date value is not a valid date.");

//       const application = elem.attribs["application"];
//       if (!application)
//         throw new Error("Invalid enex. application attribute is required.");

//       const version = elem.attribs["version"];
//       if (!version)
//         throw new Error("Invalid enex. version attribute is required.");
//     } else if (elem.tagName === "note") {
//       notes.push(toNote(elem));
//     }
//   }
// );
