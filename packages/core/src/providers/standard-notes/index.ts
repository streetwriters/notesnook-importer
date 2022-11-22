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

import { Content, ContentType, Note } from "../../models/note";
import { File } from "../../utils/file";
import { IFileProvider, ProviderSettings } from "../provider";
import {
  SNNote,
  SNComponent,
  SNTag,
  SNBackup,
  ProtocolVersion,
  ContentType as SNItemType,
  DefaultAppDomain,
  ComponentDataDomain,
  ComponentArea,
  EditorDescription,
  NoteType,
  CodeEditorComponentData,
  Spreadsheet
} from "./types";
import { buildTable, Cell, Row } from "../../utils/dom-utils";
import { markdowntoHTML } from "../../utils/to-html";

const defaultEditorDescription = (item: SNNote): EditorDescription => {
  const isHtml =
    item.content.text.includes("<") && item.content.text.includes("</");
  return {
    file_type: isHtml ? "html" : "txt",
    note_type: isHtml ? NoteType.RichText : NoteType.Markdown
  };
};

export class StandardNotes implements IFileProvider {
  public type = "file" as const;
  public supportedExtensions = [".zip"];
  public version = "1.0.0";
  public name = "Standard Notes";
  public examples = [
    "Standard Notes Backup - Fri Jan 14 2022 10_31_29 GMT+0500.zip"
  ];

  filter(file: File) {
    return [".txt"].includes(file.extension);
  }

  async *process(file: File, _settings: ProviderSettings, _files: File[]) {
    if (file.name !== "Standard Notes Backup and Import File.txt") return;

    const data: SNBackup = <SNBackup>JSON.parse(await file.text());
    if (!data.items) {
      throw new Error("Invalid backup file.");
    }

    if (data.version !== ProtocolVersion.V004) {
      throw new Error(`Unsupported backup file version: ${data.version}.`);
    }

    const components: SNComponent[] = [];
    const tags: SNTag[] = [];
    const snnotes: SNNote[] = [];

    for (const item of data.items) {
      switch (item.content_type) {
        case SNItemType.Note:
          snnotes.push(<SNNote>item);
          break;
        case SNItemType.Component:
          components.push(<SNComponent>item);
          break;
        case SNItemType.Tag:
          tags.push(<SNTag>item);
          break;
      }
    }

    for (const item of snnotes) {
      const { createdAt, updatedAt } = this.getTimestamps(item);
      const content = this.parseContent(item, components);
      const note: Note = {
        title: item.content.title,
        dateCreated: createdAt,
        dateEdited: updatedAt,
        pinned: <boolean>item.content.appData[DefaultAppDomain]?.pinned,
        tags: this.getTags(item, tags),
        content
      };

      yield note;
    }
  }

  getEditor(item: SNNote, components: SNComponent[]): EditorDescription {
    const componentData = item.content.appData[ComponentDataDomain] || {};
    const componentId = Object.keys(componentData).pop();
    if (!componentId) return defaultEditorDescription(item);

    const component = components.find(
      (c) =>
        c.uuid === componentId &&
        (c.content.area === ComponentArea.Editor ||
          c.content.area === ComponentArea.EditorStack)
    );
    if (!component) return defaultEditorDescription(item);
    const editor = <EditorDescription>component.content.package_info;
    if (
      editor.note_type === NoteType.Code &&
      Boolean(componentData[componentId])
    ) {
      editor.language = (<CodeEditorComponentData>(
        componentData[componentId]
      )).mode;
    }
    return editor;
  }

  getTags(item: SNNote, tags: SNTag[]): string[] {
    if (!item.content.references || !item.content.references.length) return [];

    const noteTags: string[] = [];
    for (const reference of item.content.references) {
      const tag = tags.find((tag) => tag.uuid === reference.uuid);
      if (!tag) continue;
      noteTags.push(tag.content.title);
    }
    return noteTags;
  }

  /**
   * Find object in array with maximum index
   * @param array
   * @returns
   */
  maxIndexItem<T extends { index?: number }>(array: T[]): T {
    return array.sort((a, b) => (b.index || 0) - (a.index || 0))[0];
  }

  parseContent(item: SNNote, components: SNComponent[]): Content {
    const editor = this.getEditor(item, components);

    const data = item.content.text;
    switch (editor.note_type) {
      case NoteType.RichText:
        return {
          data: data,
          type: ContentType.HTML
        };
      case NoteType.Code: {
        let language = editor.language || "plaintext";
        if (language === "htmlmixed") language = "html";
        else if (language === "markdown")
          return { type: ContentType.HTML, data: markdowntoHTML(data) };

        const html = markdowntoHTML(["```" + language, data, "```"].join("\n"));
        return {
          type: ContentType.HTML,
          data: html
        };
      }
      case NoteType.Spreadsheet: {
        const spreadsheet = <Spreadsheet>JSON.parse(data);
        let html = ``;

        for (const sheet of spreadsheet.sheets) {
          if (!sheet.rows || sheet.rows.length === 0) continue;

          const lastCell = this.maxIndexItem(
            sheet.rows.map((row) => this.maxIndexItem(row.cells || []))
          );
          const lastRow = this.maxIndexItem(sheet.rows);
          const [maxColumns, maxRows] = [
            lastCell.index || 0,
            lastRow.index || 0
          ];

          const rows: Row[] = [];
          for (let i = 0; i <= maxRows; i++) {
            const row = sheet.rows.find(({ index }) => index === i);
            const cells: Cell[] = [];

            for (let col = 0; col <= maxColumns; col++) {
              const cell = row?.cells?.find(({ index }) => index === col);
              cells.push({ type: "td", value: cell?.value?.toString() || "" });
            }
            rows.push({ cells });
          }

          html += buildTable(rows);
        }
        return {
          type: ContentType.HTML,
          data: html
        };
      }
      case NoteType.Authentication: {
        const tokens = <any[]>JSON.parse(data);
        const html = tokens
          .map((token) =>
            buildTable(
              Object.keys(token).map((key) => ({
                cells: [
                  { type: "th", value: key },
                  { type: "td", value: token[key] }
                ]
              }))
            )
          )
          .join("\n");
        return {
          data: html,
          type: ContentType.HTML
        };
      }
      case NoteType.Task:
      case NoteType.Markdown:
      default:
        return {
          data: markdowntoHTML(data),
          type: ContentType.HTML
        };
    }
  }

  private getTimestamps(note: SNNote) {
    let createdAt =
      typeof note.created_at === "string"
        ? new Date(note.created_at).getTime()
        : note.created_at_timestamp
        ? note.created_at_timestamp / 1000
        : undefined;
    let updatedAt =
      typeof note.updated_at === "string"
        ? new Date(note.updated_at).getTime()
        : note.updated_at_timestamp
        ? note.updated_at_timestamp / 1000
        : undefined;

    if (updatedAt === 0) updatedAt = undefined;
    if (createdAt === 0) createdAt = undefined;
    return { createdAt, updatedAt };
  }
}
