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

export interface Metadata {
  globalId: string;
  parentId: string;
  rootParentId: string;
  createdAt?: number;
  dateAdded?: number;
  dateUpdated?: number;
  updatedAt?: number;
  type: string;
  role: string;
  title: string;
  url: string;
  locationLat: number;
  locationLng: number;
  shared: boolean;
  favorite: boolean;
  lastChangeBy: number;
  cntNotes: number;
  size: number;
  editnote: boolean;
  isEncrypted: boolean;
  color: string;
  isCompleted: boolean;
  workspaceId: string;
  isImported: boolean;
  isFullwidth: boolean;
  userId: number;
  isReady: boolean;
  outliner: boolean;
  emoji: string;
  is_portal_share: boolean;
  tags: string[];
  path: string;
  parents: string[];
  workspace: string;
  attachments: Attachment[];
}

export interface Attachment {
  id: number;
  globalId: string;
  displayName: string;
  mime: string;
  dateAdded: number;
  dateUpdated: number;
  noteGlobalId: string;
  type: string;
  role: string;
  extra: Extra;
  isScreenshot: boolean;
  size: number;
  inList: boolean;
  storedFileUUID: string;
  isEncrypted: boolean;
  workspaceId: string;
  userId: number;
  state: string;
}

export interface Extra {
  height?: number;
  width?: number;
  type?: string;
}
