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
import { KeepNote, listToHTML } from "./types";
import { IFileProvider, ProviderMessage, ProviderSettings } from "../provider";
import { File } from "../../utils/file";
import { Attachment, attachmentToHTML } from "../../models/attachment";
import { markdowntoHTML } from "../../utils/to-html";
import { Providers } from "../provider-factory";

const colorMap: Record<string, string | undefined> = {
  default: undefined,
  red: "red",
  orange: "orange",
  yellow: "yellow",
  green: "green",
  teal: "green",
  cerulean: "blue",
  blue: "blue",
  pink: "purple",
  purple: "purple",
  gray: "gray",
  brown: "orange"
};

export class GoogleKeep implements IFileProvider {
  id: Providers = "keep";
  type = "file" as const;
  supportedExtensions = [".zip"];
  examples = ["takeout.zip"];
  version = "1.0.0";
  name = "Google Keep";
  helpLink =
    "https://help.notesnook.com/importing-notes/import-notes-from-googlekeep";

  filter(file: File) {
    return [".json"].includes(file.extension);
  }

  async *process(
    file: File,
    settings: ProviderSettings,
    files: File[]
  ): AsyncGenerator<ProviderMessage, void, unknown> {
    const data = await file.text();
    const keepNote = <KeepNote>JSON.parse(data);

    const dateEdited = this.usToMs(keepNote.userEditedTimestampUsec);
    const dateCreated = keepNote.createdTimestampUsec
      ? this.usToMs(keepNote.createdTimestampUsec)
      : dateEdited;
    const note: Note = {
      title: keepNote.title || file.nameWithoutExtension,
      dateCreated: dateCreated,
      dateEdited,
      pinned: keepNote.isPinned,
      archived: keepNote.isArchived,
      color: colorMap[keepNote.color?.toLowerCase() || "default"],
      tags: keepNote.labels?.map((label) => label.name),
      content: {
        type: ContentType.HTML,
        data: this.getContent(keepNote)
      }
    };

    if (keepNote.attachments && note.content) {
      note.attachments = [];
      for (const keepAttachment of keepNote.attachments) {
        const attachmentFile = files.find((f) =>
          keepAttachment.filePath.includes(f.nameWithoutExtension)
        );
        if (!attachmentFile) continue;

        const data = await attachmentFile.bytes();
        if (!data) continue;

        const dataHash = await settings.hasher.hash(data);
        const attachment: Attachment = {
          data,
          filename: attachmentFile.name,
          size: data.byteLength,
          hash: dataHash,
          hashType: settings.hasher.type,
          mime: keepAttachment.mimetype
        };

        note.content.data += attachmentToHTML(attachment);
        note.attachments.push(attachment);
      }
    }
    yield { type: "note", note };
  }

  private getContent(keepNote: KeepNote): string {
    return keepNote.textContent
      ? markdowntoHTML(keepNote.textContent)
      : keepNote.listContent
        ? listToHTML(keepNote.listContent)
        : "";
  }

  private usToMs(us: number) {
    return us / 1000;
  }
}
