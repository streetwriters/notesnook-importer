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

import { IFileProvider, ProviderSettings } from "../provider";
import { File } from "../../utils/file";
import { Markdown } from "../md";
import { HTML } from "../html";
import { Text } from "../txt";

export class TextBundle implements IFileProvider {
  public type = "file" as const;
  public supportedExtensions = [".textbundle", ".textpack"];
  public version = "1.0.0";
  public name = "TextBundle";
  public examples = ["example.textbundle", "example.textpack"];

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

  async *process(file: File, settings: ProviderSettings, files: File[]) {
    console.log("FILE", file.name);
    for (const provider of this.supportedProviders) {
      if (!provider.filter(file)) continue;
      yield* provider.process(file, settings, files);
    }
  }
}
