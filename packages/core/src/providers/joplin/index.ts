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

import { ContentType, Note, Notebook } from "../../models/note";
import { File } from "../../utils/file";
import { IFileProvider, ProviderMessage, ProviderSettings } from "../provider";
import {
  NoteEntity,
  FolderEntity,
  TagEntity,
  NoteTagEntity,
  ResourceEntity
} from "./types";
import { Attachment, attachmentToHTML } from "../../models/attachment";
import { IHasher } from "../../utils/hasher";
import { unserialize } from "./helpers";
import { ModelType } from "./types";
import { markdowntoHTML } from "../../utils/to-html";
import { parseDocument } from "htmlparser2";
import { Document } from "domhandler";
import { render } from "dom-serializer";
import { textContent, replaceElement, findAll, findOne } from "domutils";
import { detectFileType } from "../../utils/file-type";
import { Providers } from "../provider-factory";

type JoplinData = {
  notes: NoteEntity[];
  noteTags: NoteTagEntity[];
  folders: FolderEntity[];
  tags: TagEntity[];
  resources: ResourceEntity[];
};

const headingTags = ["h1", "h2", "h3", "h4", "h5", "h6"];

export class Joplin implements IFileProvider<JoplinData> {
  id: Providers = "joplin";
  type = "file" as const;
  supportedExtensions = [".jex"];
  examples = ["3_10_22.jex", "5_12_21.jex"];
  version = "1.0.0";
  name = "Joplin";
  helpLink =
    "https://help.notesnook.com/importing-notes/import-notes-from-joplin";

  filter(file: File) {
    return [".md"].includes(file.extension);
  }

  async preprocess(files: File[]) {
    const data: JoplinData = {
      folders: [],
      noteTags: [],
      notes: [],
      resources: [],
      tags: []
    };

    for (const file of files) {
      if (file.extension !== ".md") continue;
      const item = unserialize(await file.text());
      switch (item.type_) {
        case ModelType.Note:
          data.notes.push(item);
          break;
        case ModelType.NoteTag:
          data.noteTags.push(item);
          break;
        case ModelType.Resource:
          data.resources.push(item);
          break;
        case ModelType.Tag:
          data.tags.push(item);
          break;
        case ModelType.Folder:
          data.folders.push(item);
          break;
      }
    }

    return data;
  }

  async *process(
    file: File,
    settings: ProviderSettings,
    files: File[],
    data?: JoplinData
  ): AsyncGenerator<ProviderMessage, void, unknown> {
    if (!data) return;
    const note = data.notes.find(
      (note) => file.nameWithoutExtension === note.id
    );
    if (!note) return;
    if (!note.id || !note.body) return;

    const tags = this.resolveTags(note.id, data.tags, data.noteTags);
    const parentFolder = data.folders.find((a) => a.id === note.parent_id);
    const notebooks: Notebook[] = [];
    const html = markdowntoHTML(note.body);
    const document = parseDocument(html);

    const title =
      note.title ||
      (() => {
        const heading = findOne(
          (e) => headingTags.includes(e.tagName.toLowerCase()),
          document.childNodes,
          false
        );
        return heading ? textContent(heading) : undefined;
      })() ||
      "Untitled note";
    const attachments = await this.resolveResources(
      data.resources,
      document,
      files,
      settings.hasher
    );
    if (parentFolder) {
      const notebook = this.resolveFolders(data.folders, parentFolder);
      if (notebook) notebooks.push(notebook);
    }

    const _note: Note = {
      title,
      dateCreated: note.user_created_time || note.created_time,
      dateEdited: note.user_updated_time || note.updated_time,
      tags,
      attachments,
      notebooks,
      content: {
        data: render(document.childNodes),
        type: ContentType.HTML
      }
    };
    yield { type: "note", note: _note };
  }

  private resolveTags(
    noteId: string,
    tags: TagEntity[],
    noteTags: NoteTagEntity[]
  ) {
    return tags
      .filter((t) => {
        return noteTags.some(
          (noteTag) => noteTag.tag_id === t.id && noteTag.note_id === noteId
        );
      })
      .map((tag) => tag.title!);
  }

  private async resolveResources(
    resources: ResourceEntity[],
    document: Document,
    files: File[],
    hasher: IHasher
  ) {
    const attachments: Attachment[] = [];
    const elements = Object.fromEntries(
      findAll(
        (elem) =>
          (!!elem.attribs.src && elem.attribs.src.startsWith(":/")) ||
          (!!elem.attribs.href && elem.attribs.href.startsWith(":/")),
        document.childNodes
      ).map((e) => [e.attribs.src || e.attribs.href, e])
    );

    for (const resource of resources) {
      if (!resource.id) continue;
      const element = elements[`:/${resource.id}`];
      if (!element) continue;
      const resourceFile = files.find((f) =>
        f.path?.includes(`resources/${resource.id}`)
      );
      if (!resourceFile) continue;

      const data = await resourceFile.bytes();
      if (!data) continue;

      const dataHash = await hasher.hash(data);
      const attachment: Attachment = {
        data,
        size: data.byteLength,
        hash: dataHash,
        filename: resource.title || resource.filename || dataHash,
        hashType: hasher.type,
        mime:
          resource.mime ||
          detectFileType(data)?.mime ||
          "application/octet-stream"
      };
      attachments.push(attachment);
      replaceElement(element, parseDocument(attachmentToHTML(attachment)));
    }
    return attachments;
  }

  private resolveFolders(
    folders: FolderEntity[],
    parentFolder: FolderEntity
  ): Notebook | undefined {
    let folder: FolderEntity | undefined = parentFolder;
    const path: string[] = [parentFolder.title!];
    while (folder?.parent_id) {
      folder = folders.find((f) => f.id === folder?.parent_id);
      if (!folder) break;
      path.push(folder.title!);
    }

    let rootNotebook: Notebook | undefined = undefined;
    for (let i = 0; i < path.length; i++) {
      rootNotebook = {
        title: path[i],
        children: rootNotebook ? [rootNotebook] : []
      };
    }
    return rootNotebook;
  }
}
