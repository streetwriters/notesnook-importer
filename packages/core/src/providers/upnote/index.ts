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
import { ChildNode, Document, Element, Text } from "domhandler";
import { findAll, findOne, removeElement, textContent, isTag } from "domutils";
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
import { convertBrToSingleSpacedParagraphs } from "../../utils/br-to-p";

type UpNotePreprocessData = {
  noteToNotebooks: Map<string, Notebook[]>;
  noteIds: Record<string, string>;
};

const HIGHLIGHT_COLORS = {
  orange: "#FAE5CE",
  red: "#F9DFDE",
  yellow: "#FEF8B0",
  green: "#DEFEBF",
  blue: "#DBEBFB",
  purple: "#EADDFC",
  pink: "#FAE5F9",
  gray: "#EAEAEA"
};

const TEXT_COLORS = {
  orange: "#EA8D34",
  red: "#E54739",
  yellow: "#CDAE61",
  green: "#5CA033",
  blue: "#396FEF",
  purple: "#805AF6",
  pink: "#D362DB",
  gray: "#757575"
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
    return (
      this.supportedExtensions.includes(file.extension) &&
      !file.path?.includes("/notebooks/")
    );
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
      if (!file.name.endsWith(".lnk") && !file.name.endsWith(".html")) continue;

      const pathParts = file.path.split(/[\\/]/);
      const notebooksIndex = pathParts.findIndex(
        (part) => part === "notebooks"
      );
      if (notebooksIndex === -1) continue;

      const notebookParts = pathParts.slice(notebooksIndex + 1, -1);
      if (notebookParts.length === 0) continue;

      const noteFilename = file.nameWithoutExtension;
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

    const editorTag =
      findOne(
        (e) => e.tagName === "div" && e.attribs.class?.includes("shine-editor"),
        contentRoot.childNodes,
        true
      ) || contentRoot;
    const firstTag = editorTag.childNodes.find((c): c is Element => isTag(c));
    if (firstTag?.tagName === "h2" && textContent(firstTag) === title) {
      removeElement(firstTag);
    }

    if (preprocessData?.noteIds) {
      this.convertInternalLinks(document, preprocessData.noteIds);
    }
    this.convertChecklists(document);
    this.convertHighlightsAndTextColors(document);
    this.convertCollapsibleSection(document);
    this.convertCodeblockLanguage(document);
    convertBrToSingleSpacedParagraphs(document);

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

  private convertChecklists(document: Document): void {
    const checklists = findAll(
      (elem) =>
        elem.type === "tag" &&
        elem.tagName === "ul" &&
        elem.children.some(
          (child) =>
            child.type === "tag" &&
            child.tagName === "li" &&
            child.attribs?.["data-checked"] !== undefined
        ),
      document.childNodes
    );

    for (const list of checklists) {
      list.attribs.class = `checklist`;
    }

    const checklistItems = findAll(
      (elem) =>
        elem.type === "tag" &&
        elem.tagName === "li" &&
        elem.attribs?.["data-checked"] !== undefined,
      document.childNodes
    );

    for (const item of checklistItems) {
      const isChecked = item.attribs["data-checked"] === "true";
      item.attribs.class = `checklist--item${isChecked ? " checked" : ""}`;
      delete item.attribs["data-checked"];
    }
  }

  private convertHighlightsAndTextColors(document: Document): void {
    const highlights = findAll(
      (elem) =>
        elem.type === "tag" &&
        elem.tagName === "span" &&
        elem.attribs?.class?.includes("shine-highlight-"),
      document.childNodes
    );

    for (const hl of highlights) {
      const color = hl.attribs.class.replace(
        "shine-highlight-",
        ""
      ) as keyof typeof HIGHLIGHT_COLORS;
      if (!color || !HIGHLIGHT_COLORS[color]) continue;
      const style = `background-color: ${HIGHLIGHT_COLORS[color]};`;
      hl.attribs.style = hl.attribs.style || "";
      hl.attribs.style += style;
      delete hl.attribs.class;
    }

    const textColors = findAll(
      (elem) =>
        elem.type === "tag" &&
        elem.tagName === "span" &&
        elem.attribs?.class?.includes("shine-text-"),
      document.childNodes
    );

    for (const tc of textColors) {
      const color = tc.attribs.class.replace(
        "shine-text-",
        ""
      ) as keyof typeof TEXT_COLORS;
      if (!color || !TEXT_COLORS[color]) continue;
      const style = `color: ${TEXT_COLORS[color]};`;
      tc.attribs.style = tc.attribs.style || "";
      tc.attribs.style += style;
      delete tc.attribs.class;
    }
  }

  private convertCollapsibleSection(document: Document): void {
    const sections = findAll(
      (elem) =>
        elem.type === "tag" &&
        elem.tagName === "div" &&
        elem.attribs?.class?.includes("shine-collapsible-section"),
      document.childNodes
    );

    for (const section of sections) {
      const titleElement = findOne(
        (elem) =>
          elem.type === "tag" &&
          elem.tagName === "div" &&
          elem.attribs?.class?.includes("shine-section-title-inner"),
        section.childNodes,
        true
      );

      const contentElement = findOne(
        (elem) =>
          elem.type === "tag" &&
          elem.tagName === "div" &&
          elem.attribs?.class?.includes("shine-section-content-inner"),
        section.childNodes,
        true
      );
      if (!contentElement) continue;

      const title = titleElement ? textContent(titleElement) : null;
      if (!title) continue;

      section.attribs = {
        class: "callout",
        "data-callout-type": "info"
      };
      section.childNodes = [
        new Element("h3", {}, [new Text(title.trim())]),
        ...contentElement.childNodes
      ];
    }
  }

  private convertCodeblockLanguage(document: Document): void {
    const codeblocks = findAll(
      (elem) =>
        elem.type === "tag" &&
        elem.tagName === "pre" &&
        !!elem.attribs?.["data-code-language"],
      document.childNodes
    );

    for (const codeblock of codeblocks) {
      codeblock.attribs.class =
        "language-" + codeblock.attribs["data-code-language"];
      delete codeblock.attribs["data-code-language"];
    }
  }
}
