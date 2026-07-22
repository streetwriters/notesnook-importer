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

import { ContentType, Note } from "../../models/note";
import { File } from "../../utils/file";
import { IFileProvider, ProviderMessage, ProviderSettings } from "../provider";
import { NoteType, Spreadsheet } from "./types";
import { buildTable, Cell, Row } from "../../utils/dom-utils";
import { Providers } from "../provider-factory";
import { HTML } from "../html";
import { Markdown } from "../md";
import { Text } from "../txt";
import { ElementType, parseDocument } from "htmlparser2";
import { appendChild, findAll, removeElement } from "domutils";
import { Document, Element, isTag } from "domhandler";

export class StandardNotes implements IFileProvider {
  id: Providers = "standardnotes";
  type = "file" as const;
  supportedExtensions = [".zip"];
  version = "1.0.0";
  name = "Standard Notes";
  examples = ["Standard Notes Export - Fri Jan 14 2022 10_31_29 GMT+0500.zip"];
  helpLink =
    "https://help.notesnook.com/importing-notes/import-notes-from-standardnotes";

  filter(file: File) {
    return [".txt", ".html", ".md", ".json"].includes(file.extension);
  }

  async *process(
    file: File,
    _settings: ProviderSettings,
    _files: File[]
  ): AsyncGenerator<ProviderMessage, void, unknown> {
    if (file.extension === ".txt") {
      const text = new Text();
      yield* text.process(file, _settings, _files);
    }

    if (file.extension === ".html") {
      const data = await file.text();
      const document = parseDocument(data);
      this.removeEmptyLines(document);
      this.convertCodeBlockLanguage(document);
      this.fixNestedLists(document);
      const note = await HTML.processHTML(
        file,
        _files,
        _settings.hasher,
        document
      );
      yield { type: "note", note };
    }

    if (file.extension === ".md") {
      const md = new Markdown();
      yield* md.process(file, _settings, _files);
    }

    if (file.extension !== ".json") return;

    const text = await file.text();
    const data = JSON.parse(text);
    let type: NoteType.Authentication | NoteType.Spreadsheet | null = null;

    if (Array.isArray(data)) {
      type = NoteType.Authentication;
    } else if ("sheets" in data) {
      type = NoteType.Spreadsheet;
    } else {
      type = null;
    }

    if (type === NoteType.Authentication) {
      const html = this.parseAuthenticationContent(text);
      const note: Note = {
        title: file.nameWithoutExtension,
        dateCreated: file.createdAt,
        dateEdited: file.modifiedAt,
        content: {
          data: html,
          type: ContentType.HTML
        }
      };
      yield { type: "note", note };
    }

    if (type === NoteType.Spreadsheet) {
      const html = this.parseSpreadsheetContent(text);
      const note: Note = {
        title: file.nameWithoutExtension,
        dateCreated: file.createdAt,
        dateEdited: file.modifiedAt,
        content: {
          type: ContentType.HTML,
          data: html
        }
      };
      yield { type: "note", note };
    }
  }

  /**
   * Find object in array with maximum index
   * @param array
   * @returns
   */
  maxIndexItem<T extends { index?: number }>(array: T[]): T {
    return array.sort((a, b) => (b.index || 0) - (a.index || 0))[0];
  }

  private parseAuthenticationContent(data: string): string {
    const tokens = <any[]>JSON.parse(data);
    return tokens
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
  }

  private parseSpreadsheetContent(data: string): string {
    const spreadsheet = <Spreadsheet>JSON.parse(data);
    let html = ``;

    for (const sheet of spreadsheet.sheets) {
      if (!sheet.rows || sheet.rows.length === 0) continue;

      const lastCell = this.maxIndexItem(
        sheet.rows.map((row) => this.maxIndexItem(row.cells || []))
      );
      const lastRow = this.maxIndexItem(sheet.rows);
      const [maxColumns, maxRows] = [lastCell.index || 0, lastRow.index || 0];

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
    return html;
  }

  private removeEmptyLines(document: Document): void {
    const emptyParagraphs = findAll(
      (e) => isEmptyParagraph(e),
      document.childNodes
    );
    for (const p of emptyParagraphs) {
      if (
        !!p.nextSibling &&
        isTag(p.nextSibling) &&
        isEmptyParagraph(p.nextSibling)
      ) {
        p.attribs["data-spacing"] = "single";
      } else {
        removeElement(p);
      }
    }
  }

  private convertCodeBlockLanguage(document: Document): void {
    const codeBlocks = findAll(
      (e) => isTag(e) && e.tagName === "pre",
      document.childNodes
    );
    for (const pre of codeBlocks) {
      pre.attribs.class +=
        " language-" + (pre.attribs["data-language"] || "text");
    }
  }

  private fixNestedLists(document: Document): void {
    const nestedLists = findAll(
      (e) =>
        isTag(e) &&
        e.tagName === "li" &&
        e.attribs["class"]?.includes("Lexical__nestedListItem"),
      document.childNodes
    );
    for (const list of nestedLists) {
      if (
        !!list.previousSibling &&
        isTag(list.previousSibling) &&
        list.previousSibling.tagName === "li" &&
        list.firstChild
      ) {
        appendChild(list.previousSibling, list.firstChild);
        removeElement(list);
      }
    }
  }
}

function isEmptyParagraph(e: Element): boolean {
  return (
    e.tagName === "p" &&
    e.childNodes.length === 1 &&
    e.firstChild?.type === ElementType.Tag &&
    e.firstChild.tagName === "br"
  );
}
