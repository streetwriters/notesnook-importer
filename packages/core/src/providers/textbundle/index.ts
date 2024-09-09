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
import { Markdown } from "../md";
import { HTML } from "../html";
import { Text } from "../txt";
import { Providers } from "../provider-factory";

export class TextBundle implements IFileProvider {
  id: Providers = "textbundle";
  type = "file" as const;
  supportedExtensions = [".textbundle", ".textpack"];
  version = "1.0.0";
  name = "TextBundle";
  examples = ["example.textbundle", "example.textpack"];
  helpLink =
    "https://help.notesnook.com/importing-notes/import-notes-from-textbundle-files";

  private readonly supportedProviders = [
    new Markdown(),
    new HTML(),
    new Text()
  ];

  filter(file: File) {
    if (file.path?.includes("__MACOSX")) return false;

    for (const provider of this.supportedProviders) {
      if (provider.filter(file)) return true;
    }
    return false;
  }

  async *process(
    file: File,
    settings: ProviderSettings,
    files: File[]
  ): AsyncGenerator<ProviderMessage, void, unknown> {
    for (const provider of this.supportedProviders) {
      if (!provider.filter(file)) continue;
      for await (const message of provider.process(file, settings, files)) {
        if (message.type === "note") message.note.notebooks = [];
        yield message;
      }
    }
  }
}
