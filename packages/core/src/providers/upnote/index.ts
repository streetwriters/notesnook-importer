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

import { render } from "dom-serializer";
import { Document, Element } from "domhandler";
import { findAll, findOne, removeElement, textContent } from "domutils";
import { parseDocument } from "htmlparser2";
import { ContentType, Note, Notebook } from "../../models/note";
import { File } from "../../utils/file";
import { createObjectId } from "../../utils/object-id";
import { HTML } from "../html";
import {
  IFileProvider,
  ProviderMessage,
  ProviderSettings,
  error
} from "../provider";
import { Providers } from "../provider-factory";

type UpNotePreprocessData = {
  noteToNotebooks: Map<string, Notebook[]>;
  noteIds: Record<string, string>;
};

export class UpNote implements IFileProvider<UpNotePreprocessData> {
  id: Providers = "upnote";
  type = "file" as const;
  supportedExtensions = [".html"];
  examples = ["UpNote_Export.zip"];
  version = "1.0.0";
  name = "UpNote";
  helpLink =
    "https://help.notesnook.com/importing-notes/import-notes-from-upnote";

  filter(file: File) {
    return this.supportedExtensions.includes(file.extension);
  }

  async preprocess(files: File[]): Promise<UpNotePreprocessData> {
    const noteToNotebooks = new Map<string, Notebook[]>();
    const noteIds: Record<string, string> = {};

    for (const file of files) {
      if (file.extension === ".html") {
        const noteTitle = file.nameWithoutExtension;
        noteIds[noteTitle] = createObjectId();
      }
    }

    for (const file of files) {
      if (!file.path) continue;
      if (!file.name.endsWith(".lnk")) continue;

      const pathParts = file.path.split(/[\\/]/);
      const notebooksIndex = pathParts.findIndex(
        (part) => part === "notebooks"
      );
      if (notebooksIndex === -1) continue;

      const notebookParts = pathParts.slice(notebooksIndex + 1, -1);
      if (notebookParts.length === 0) continue;

      const noteFilename = file.name.replace(/\.lnk$/, "");
      const notebook = this.buildNotebookHierarchy(notebookParts);
      if (!notebook) continue;

      const existingNotebooks = noteToNotebooks.get(noteFilename) || [];
      existingNotebooks.push(notebook);
      noteToNotebooks.set(noteFilename, existingNotebooks);
    }

    return { noteToNotebooks, noteIds };
  }

  private buildNotebookHierarchy(parts: string[]): Notebook | undefined {
    if (parts.length === 0) return undefined;

    let rootNotebook: Notebook | undefined;
    let currentNotebook: Notebook | undefined;

    for (const part of parts) {
      const newNotebook: Notebook = {
        title: part,
        children: []
      };

      if (!rootNotebook) {
        rootNotebook = newNotebook;
      }
      if (currentNotebook) {
        currentNotebook.children.push(newNotebook);
      }
      currentNotebook = newNotebook;
    }

    return rootNotebook;
  }

  async *process(
    file: File,
    settings: ProviderSettings,
    files: File[],
    preprocessData?: UpNotePreprocessData
  ): AsyncGenerator<ProviderMessage, void, unknown> {
    const data = await file.text();
    try {
      yield {
        type: "note",
        note: await this.processUpNoteHTML(
          file,
          files,
          settings,
          data,
          preprocessData
        )
      };
    } catch (e) {
      yield error(e, { file });
    }
  }

  private async processUpNoteHTML(
    file: File,
    files: File[],
    settings: ProviderSettings,
    html: string,
    preprocessData?: UpNotePreprocessData
  ): Promise<Note> {
    const document = parseDocument(html);
    const body = findOne(
      (e) => e.tagName === "body",
      document.childNodes,
      true
    );
    const contentRoot = body || document;
    const title = file.nameWithoutExtension;

    let titleElement: Element | null = null;
    for (const child of contentRoot.childNodes) {
      if (child.type === "tag") {
        const childText = textContent(child).trim();
        if (childText === title) {
          titleElement = child as Element;
        }
        break;
      }
    }
    if (titleElement) {
      removeElement(titleElement);
    }

    if (preprocessData?.noteIds) {
      this.convertInternalLinks(document, preprocessData.noteIds);
    }

    const tags = this.extractTags(document);
    const attachments = await HTML.extractResources(
      document,
      file,
      files,
      settings.hasher
    );
    const notebooks = preprocessData?.noteToNotebooks.get(file.name) || [];
    const noteId = preprocessData?.noteIds[title];

    const note: Note = {
      id: noteId,
      title,
      dateCreated: file.createdAt,
      dateEdited: file.modifiedAt,
      tags,
      attachments,
      notebooks,
      content: {
        type: ContentType.HTML,
        data: render(contentRoot.childNodes || document.childNodes)
      }
    };

    return note;
  }

  private extractTags(document: Document): string[] {
    const tagElements = findAll(
      (elem) =>
        elem.type === "tag" &&
        elem.tagName === "a" &&
        !!elem.attribs?.["data-upnote-tag"],
      document.childNodes
    );

    const tags: string[] = [];
    for (const elem of tagElements) {
      const tagValue = elem.attribs["data-upnote-tag"];
      if (tagValue) {
        const cleanTag = tagValue.startsWith("#")
          ? tagValue.slice(1)
          : tagValue;
        if (cleanTag && !tags.includes(cleanTag)) {
          tags.push(cleanTag);
        }
      }
    }
    return tags;
  }

  private convertInternalLinks(
    document: Document,
    noteIds: Record<string, string>
  ): void {
    const links = findAll(
      (elem) =>
        elem.type === "tag" &&
        elem.tagName === "a" &&
        !!elem.attribs["data-note-id"],
      document.childNodes
    );

    for (const link of links) {
      const href = link.attribs.href;
      if (!href) continue;

      const noteTitle = decodeURIComponent(href.replace(/\.html$/, ""));
      const id = noteIds[noteTitle];

      if (id) {
        link.attribs.href = `nn://note/${id}`;
        delete link.attribs["data-note-id"];
      }
    }
  }
}
