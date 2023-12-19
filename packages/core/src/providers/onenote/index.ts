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

import {
  INetworkProvider,
  ProviderMessage,
  ProviderSettings,
  log
} from "../provider";
import { OneNoteClient } from "@notesnook-importer/onenote";
import { Content } from "@notesnook-importer/onenote";
import { ContentType, Note, Notebook } from "../../models/note";
import {
  SectionGroup,
  OnenoteSection,
  OnenotePage,
  Notebook as OnenoteNotebook
} from "@microsoft/microsoft-graph-types-beta";
import { ElementHandler } from "./elementhandlers";
import { parseDocument } from "htmlparser2";
import { findOne, textContent } from "domutils";

export type OneNoteSettings = ProviderSettings & {
  clientId: string;
  redirectUri?: string;
  cache?: boolean;
};

export class OneNote implements INetworkProvider<OneNoteSettings> {
  public type = "network" as const;
  public version = "1.0.0";
  public name = "OneNote";
  public helpLink =
    "https://help.notesnook.com/importing-notes/import-notes-from-onenote";

  async *process(
    settings: OneNoteSettings
  ): AsyncGenerator<ProviderMessage, void, unknown> {
    const client = new OneNoteClient(settings);

    yield log("Fetching notebooks...");
    for await (const notebook of client.getNotebooks()) {
      if (!notebook.sections) continue;

      yield log(`Processing notebook: ${notebook.displayName}`);
      yield* this.processNotebook(client, settings, notebook);
    }
  }

  private async *processNotebook(
    client: OneNoteClient,
    settings: OneNoteSettings,
    notebook: OnenoteNotebook | SectionGroup
  ): AsyncGenerator<ProviderMessage, void, unknown> {
    if (!notebook.sections) return;
    for (const section of notebook.sections) {
      const sectionNotebooks = this.getNotebooks(section);

      for await (const page of client.getPages(section)) {
        yield log(
          `Getting page content: ${page.title || "Untitled note"} (id: ${
            page.id
          })`
        );
        page.content = await client.getPageContent(page);

        yield log(
          `Converting page to note: ${page.title || "Untitled note"} (id: ${
            page.id
          })`
        );
        const note = await this.pageToNote(page, sectionNotebooks, settings);
        if (!note) continue;

        yield { type: "note", note };
      }
    }

    if (notebook.sectionGroups)
      for (const sectionGroup of notebook.sectionGroups) {
        yield log(`Processing section group: ${sectionGroup.displayName}`);
        yield* this.processNotebook(client, settings, sectionGroup);
      }
  }

  private async pageToNote(
    page: OnenotePage,
    notebooks: Notebook[],
    settings: OneNoteSettings
  ): Promise<Note | null> {
    if (!(page.content instanceof Content)) return null;

    const note: Note = {
      title: "Untitled note",
      dateCreated: page.createdDateTime
        ? new Date(page.createdDateTime).getTime()
        : undefined,
      dateEdited: page.lastModifiedDateTime
        ? new Date(page.lastModifiedDateTime).getTime()
        : undefined,
      tags: page.userTags ?? [],
      notebooks,
      attachments: []
    };

    const elementHandler = new ElementHandler(note, settings.hasher);
    const data = await page.content.transform(elementHandler);
    const document = parseDocument(data);

    const titleElement = findOne(
      (e) => ["title", "h1", "h2"].includes(e.tagName),
      document.childNodes,
      true
    );
    note.title =
      page.title || (titleElement && textContent(titleElement)) || note.title;

    note.content = {
      data,
      type: ContentType.HTML
    };

    return note;
  }

  private getNotebooks(section: OnenoteSection): Notebook[] {
    const notebooks: Notebook[] = [];
    const topic = section?.displayName || undefined;

    if (section?.parentNotebook?.displayName) {
      notebooks.push({
        topic,
        notebook: section.parentNotebook.displayName
      });
      if (section?.parentSectionGroup) {
        const flattenedSectionGroupsTitle = this.getFlattenedSectionGroupsTitle(
          section.parentSectionGroup
        );
        const notebookTitle = flattenedSectionGroupsTitle.reverse().join(">");
        notebooks.push({
          topic: notebookTitle,
          notebook: section.parentNotebook.displayName
        });
      }
    }

    return notebooks;
  }

  private getFlattenedSectionGroupsTitle(section: SectionGroup): string[] {
    const parts: string[] = [];
    if (section?.displayName) parts.push(section.displayName);
    if (section?.parentSectionGroup)
      parts.push(
        ...this.getFlattenedSectionGroupsTitle(section.parentSectionGroup)
      );
    return parts;
  }
}
