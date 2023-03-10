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

import { ContentType, Note, Notebook } from "../../models/note";
import { File } from "../../utils/file";
import { IFileProvider, ProviderSettings } from "../provider";
import { path } from "../../utils/path";
import { ZNotebook } from "./types";
import { Znel } from "@notesnook-importer/znel";
import { ElementHandler } from "./elementhandlers";

export class ZohoNotebook implements IFileProvider {
  public type = "file" as const;
  public supportedExtensions = [".zip"];
  public version = "1.0.0";
  public name = "Zoho Notebook";
  public examples = ["Notebook_02Mar2022_0441.zip"];

  filter(file: File) {
    return [".znel"].includes(file.extension);
  }

  async *process(file: File, settings: ProviderSettings, files: File[]) {
    const notebook = await this.getNotebook(file, files);
    const znel = new Znel(await file.text());
    const note: Note = {
      title: znel.metadata.title,
      tags: znel.tags,
      dateCreated: znel.metadata.createdDate?.getTime(),
      dateEdited: znel.metadata.modifiedDate?.getTime(),
      attachments: [],
      notebooks: notebook ? [notebook] : []
    };

    const elementHandler = new ElementHandler(note, files, settings.hasher);
    try {
      const html = await znel.content.toHtml(elementHandler);
      note.content = {
        data: html,
        type: ContentType.HTML
      };
    } catch (e) {
      console.error(e);
    }

    yield note;
  }

  private async getNotebook(
    file: File,
    files: File[]
  ): Promise<Notebook | undefined> {
    const rootArchiveName = file.parent?.parent?.name || "";
    const archivePath = file.parent?.path;

    const rootDirectory = archivePath?.split("/")?.slice(0, 2) || [];

    const notebookPath = path.join(
      rootArchiveName,
      ...rootDirectory,
      "meta.json"
    );

    const notebookFile = files.find((f) => f.path === notebookPath);
    let notebook: Notebook | undefined;
    if (notebookFile) {
      const zohoNotebook: ZNotebook = JSON.parse(await notebookFile.text());
      notebook = { notebook: zohoNotebook.name, topic: "All notes" };
    }
    return notebook;
  }
}
