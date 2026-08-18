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
  IElementHandler,
  MediaEntry,
  parse,
  toHTML
} from "@notesnook-importer/samsung-notes";
import {
  IFileProvider,
  ProviderMessage,
  ProviderSettings,
  error,
  log
} from "../provider";
import { ContentType, Note, Notebook } from "../../models/note";
import { File } from "../../utils/file";
import { Providers } from "../provider-factory";
import { Attachment, attachmentToHTML } from "../../models/attachment";
import { detectFileType } from "../../utils/file-type";

const AUDIO_MIME_BY_EXTENSION: Record<string, string> = {
  ".m4a": "audio/mp4",
  ".mp3": "audio/mpeg",
  ".3gp": "audio/3gpp",
  ".aac": "audio/aac",
  ".ogg": "audio/ogg",
  ".wav": "audio/wav",
  ".amr": "audio/amr",
  ".svg": "image/svg+xml"
};

function getMime(media: MediaEntry): string {
  const extension = media.filename.includes(".")
    ? media.filename.slice(media.filename.lastIndexOf(".")).toLowerCase()
    : "";
  return (
    AUDIO_MIME_BY_EXTENSION[extension] ??
    detectFileType(media.data!)?.mime ??
    "application/octet-stream"
  );
}

class ElementHandler implements IElementHandler {
  constructor(
    private readonly note: Note,
    private readonly settings: ProviderSettings
  ) {}

  async process(
    _type: "image" | "file",
    media: MediaEntry,
    width?: number,
    height?: number
  ): Promise<string | undefined> {
    if (!media.data) return;

    const hash = await this.settings.hasher.hash(media.data);
    const mime = getMime(media);
    const attachment: Attachment = {
      data: media.data,
      filename: media.filename,
      size: media.data.length,
      hash,
      hashType: this.settings.hasher.type,
      mime,
      width: width ? Math.round(width) : undefined,
      height: height ? Math.round(height) : undefined
    };
    this.note.attachments?.push(attachment);

    return attachmentToHTML(attachment);
  }
}

export class SamsungNotes implements IFileProvider {
  id: Providers = "samsungnotes";
  type = "file" as const;
  supportedExtensions = [".sdocx"];
  examples = ["Note.sdocx", "Notebook.sdocx"];
  version = "1.0.0";
  name = "Samsung Notes";
  helpLink =
    "https://help.notesnook.com/importing-notes/import-notes-from-samsung-notes";

  filter(file: File) {
    return this.supportedExtensions.includes(file.extension);
  }

  async *process(
    file: File,
    settings: ProviderSettings
  ): AsyncGenerator<ProviderMessage, void, unknown> {
    yield log(`Parsing ${file.name}...`);

    let parsed: ReturnType<typeof parse>;
    try {
      const bytes = await file.bytes();
      if (!bytes) throw new Error("Failed to read the file.");
      parsed = parse(bytes);
    } catch (e) {
      yield error(e, { file });
      return;
    }

    const notebook: Notebook = {
      title: "Samsung Notes",
      children: []
    };

    const note: Note = {
      title: parsed.title || file.nameWithoutExtension,
      dateCreated: parsed.note.createdTime,
      dateEdited: parsed.note.modifiedTime,
      tags: [...new Set(parsed.pages.flatMap((page) => page.tags))],
      attachments: [],
      notebooks: [notebook]
    };

    try {
      const html = await toHTML(parsed, new ElementHandler(note, settings));
      note.content = {
        data: html,
        type: ContentType.HTML
      };
    } catch (e) {
      yield error(e, { file, note });
    }

    yield { type: "note", note };
  }
}
