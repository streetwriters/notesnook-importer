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

import { INetworkProvider, ProviderSettings } from "../provider";
import { OneNoteClient } from "@notesnook-importer/onenote";
import { Content, ProgressPayload } from "@notesnook-importer/onenote";
import { ContentType, Note, Notebook } from "../../models/note";
import {
  SectionGroup,
  OnenoteSection,
  OnenotePage
} from "@microsoft/microsoft-graph-types-beta";
import { ElementHandler } from "./elementhandlers";
import { parseDocument } from "htmlparser2";
import { findOne, textContent } from "domutils";

type OneNoteSettings = ProviderSettings & {
  clientId: string;
  redirectUri?: string;
  report?: (message: string) => void;
};

export class OneNote implements INetworkProvider<OneNoteSettings> {
  public type = "network" as const;
  public version = "1.0.0";
  public name = "OneNote";

  async process(settings: OneNoteSettings) {
    const errors: Error[] = [];

    const progressCache: Record<string, ProgressPayload> = {};
    const client = new OneNoteClient(
      { clientId: settings.clientId, redirectUri: settings.redirectUri },
      {
        error: (e) => {
          errors.push(e);
        },
        report: (progress) => {
          progressCache[progress.type] = progress;
          if (settings.report)
            settings.report(structuredMessage(progressCache));
        }
      }
    );

    const notebooks = await client.getNotebooks();
    for (const notebook of notebooks) {
      for (const section of notebook.sections ?? []) {
        const sectionNotebooks = this.getNotebooks(section);
        if (!section.pages) continue;

        for (let i = 0; i < section.pages.length; ++i) {
          const page = section.pages[i];
          if (settings.report)
            settings.report(
              `Transforming pages (${i + 1}/${section.pages.length})`
            );

          const note = await this.pageToNote(
            page,
            sectionNotebooks,
            settings
          ).catch((e: Error) => {
            e.message = `${e.message} (page: ${page.title})`;
            errors.push(e);
            console.error(e);
            return null;
          });
          if (!note) continue;

          await settings.storage.write(note);
        }
      }
    }

    if (settings.report) settings.report(`Done!`);
    return errors;
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

function structuredMessage(cache: Record<string, ProgressPayload>): string {
  const sequence = ["notebook", "sectionGroup", "section", "page"];
  const parts: string[] = [];
  for (const key of sequence) {
    const value = cache[key];
    if (!value || value.total == value.current) continue;
    parts.push(progressToString(value));
  }
  return parts.join(" => ");
}

function progressToString(payload: ProgressPayload): string {
  const parts: string[] = [];
  switch (payload.op) {
    case "fetch":
      parts.push("Fetching");
      break;
    case "process":
      parts.push("Processing");
      break;
  }

  switch (payload.type) {
    case "notebook":
      parts.push("notebooks");
      break;
    case "page":
      parts.push("pages");
      break;
    case "section":
      parts.push("sections");
      break;
    case "sectionGroup":
      parts.push("section groups");
      break;
  }

  parts.push(`(${payload.current + 1}/${payload.total})`);
  return parts.join(" ");
}
