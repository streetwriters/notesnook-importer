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

export interface KeepNote {
  attachments?: Attachment[];
  color?: string;
  isTrashed?: boolean;
  isPinned?: boolean;
  isArchived?: boolean;
  textContent?: string;
  textContentHtml?: string;
  listContent?: ListItem[];
  annotations?: Annotation[];
  title?: string;
  userEditedTimestampUsec: number;
  createdTimestampUsec?: number;
  labels?: Label[];
}

export interface Annotation {
  description?: string;
  source?: string;
  title?: string;
  url?: string;
}

export interface Attachment {
  filePath: string;
  mimetype: string;
}

export interface Label {
  name: string;
}

export interface ListItem {
  text: string;
  textHtml?: string;
  isChecked: boolean;
}

export function listToHTML(list: ListItem[]): string {
  return `<ul class="checklist">
        ${list
          .map((t) =>
            t.isChecked
              ? `<li class="checked">${t.text}</li>`
              : `<li>${t.text}</li>`
          )
          .join("")}
      </ul>`;
}
