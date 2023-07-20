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

import { Markdown } from "../md";

/**
 * This is just a dummy class for holding metadata.
 * The actual processing of Obsidian markdown is handled
 * by the Markdown processor.
 */
export class Obsidian extends Markdown {
  public type = "file" as const;
  public supportedExtensions = [".md", ".markdown", ".mdown"];
  public version = "1.0.0";
  public name = "Obsidian";
  public examples = ["document.md"];
  public helpLink =
    "https://help.notesnook.com/importing-notes/import-notes-from-obsidian";
}
