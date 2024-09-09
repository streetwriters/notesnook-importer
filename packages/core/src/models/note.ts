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

import { Providers } from "../providers/provider-factory";
import { Attachment } from "./attachment";

export const COMPATIBILITY_VERSION = 2;

export type Note = {
  id?: string;
  title: string;
  dateCreated?: number;
  dateEdited?: number;
  content?: Content;
  tags?: string[];
  favorite?: boolean;
  pinned?: boolean;
  color?: string;
  notebooks?: LegacyNotebook[] | Notebook[];
  attachments?: Attachment[];

  compatibilityVersion?: number;
  source?: Providers;
};

export type Content = {
  data: string;
  type: ContentType;
};

export enum ContentType {
  HTML = "html",
  TEXT = "text"
}

/**
 * @deprecated
 */
export type LegacyNotebook = {
  notebook: string;
  topic?: string;
};

export type Notebook = {
  title: string;
  children: Notebook[];
};
