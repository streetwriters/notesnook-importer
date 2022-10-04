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
import {
  IFileProvider,
  iterate,
  ProviderResult,
  ProviderSettings,
} from "../provider";
import { parse } from "node-html-parser";
import { path } from "../../utils/path";

export class HTML implements IFileProvider {
  type: "file" = "file";
  public supportedExtensions = [".html"];
  public validExtensions = [...this.supportedExtensions];
  public version = "1.0.0";
  public name = "HTML";

  async process(
    files: File[],
    settings: ProviderSettings
  ): Promise<ProviderResult> {
    return iterate(this, files, (file, notes) => {
      const data = file.text;
      const document = parse(data);

      const title =
        document.querySelector("title")?.textContent ||
        document.querySelector("h1,h2")?.textContent;
      const note: Note = {
        title: title || path.basename(file.name),
        dateCreated: file.createdAt,
        dateEdited: file.modifiedAt,
        content: {
          type: ContentType.HTML,
          data: document.querySelector("body")?.innerHTML || data,
        },
      };
      notes.push(note);

      return Promise.resolve(true);
    });
  }
}
