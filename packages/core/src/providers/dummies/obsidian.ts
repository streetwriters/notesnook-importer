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

import { File } from "../../utils/file";
import { Markdown, MarkdownSettings } from "../md";
import { ProviderMessage } from "../provider";
import { Providers } from "../provider-factory";

/**
 * This is just a dummy class for holding metadata.
 * The actual processing of Obsidian markdown is handled
 * by the Markdown processor.
 */
export class Obsidian extends Markdown {
  id: Providers = "obsidian";
  type = "file" as const;
  supportedExtensions = [".md", ".markdown", ".mdown"];
  version = "1.0.0";
  name = "Obsidian";
  examples = ["document.md"];
  helpLink =
    "https://help.notesnook.com/importing-notes/import-notes-from-obsidian";

  async *process(
    file: File,
    settings: MarkdownSettings,
    files: File[]
  ): AsyncGenerator<ProviderMessage, void, unknown> {
    settings.filenameAsTitle = true;
    yield* super.process(file, settings, files);
  }
}
