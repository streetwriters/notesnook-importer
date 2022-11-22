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

import { ContentType, Note } from "../../models/note";
import { File } from "../../utils/file";
import { IFileProvider, ProviderSettings } from "../provider";
import { parseDocument } from "htmlparser2";
import { textContent, findOne } from "domutils";
import { render } from "dom-serializer";

export class HTML implements IFileProvider {
  public type = "file" as const;
  public supportedExtensions = [".html"];
  public examples = ["Import.html"];
  public version = "1.0.0";
  public name = "HTML";

  filter(file: File) {
    return this.supportedExtensions.includes(file.extension);
  }

  async *process(file: File, _settings: ProviderSettings, _files: File[]) {
    const data = await file.text();
    const document = parseDocument(data);

    const body = findOne(
      (e) => e.tagName === "body",
      document.childNodes,
      true
    );

    const titleElement = findOne(
      (e) => ["title", "h1", "h2"].includes(e.tagName),
      document.childNodes,
      true
    );
    const title = titleElement
      ? textContent(titleElement)
      : file.nameWithoutExtension;
    const note: Note = {
      title: title,
      dateCreated: file.createdAt,
      dateEdited: file.modifiedAt,
      content: {
        type: ContentType.HTML,
        data: body ? render(body) : data
      }
    };

    yield note;
  }
}
