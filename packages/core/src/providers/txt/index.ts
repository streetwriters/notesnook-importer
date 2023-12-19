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

import { IFileProvider, ProviderMessage, ProviderSettings } from "../provider";
import { File } from "../../utils/file";
import { textToHTML } from "../../utils/to-html";
import { HTML } from "../html";

export class Text implements IFileProvider {
  public type = "file" as const;
  public supportedExtensions = [".txt"];
  public version = "1.0.0";
  public name = "Text";
  public examples = ["import-help.txt"];
  public helpLink =
    "https://help.notesnook.com/importing-notes/import-notes-from-plaintext-files";

  filter(file: File) {
    return this.supportedExtensions.includes(file.extension);
  }

  async *process(
    file: File,
    settings: ProviderSettings,
    files: File[]
  ): AsyncGenerator<ProviderMessage, void, unknown> {
    const data = await file.text();
    const html = textToHTML(data);
    yield {
      type: "note",
      note: await HTML.processHTML(file, files, settings.hasher, html)
    };
  }
}
