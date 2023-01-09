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

import {
  AppDataField,
  BackupFile,
  BackupFileDecryptedContextualPayload,
  ItemContent
} from "@standardnotes/models";
import {
  ComponentArea,
  EditorFeatureDescription,
  NoteType
} from "@standardnotes/features";
import {
  NoteContent,
  TagContent,
  ComponentContent
} from "@standardnotes/models";

enum ContentType {
  Any = "*",
  Item = "SF|Item",
  RootKey = "SN|RootKey|NoSync",
  ItemsKey = "SN|ItemsKey",
  EncryptedStorage = "SN|EncryptedStorage",
  Privileges = "SN|Privileges",
  Note = "Note",
  Tag = "Tag",
  SmartView = "SN|SmartTag",
  Component = "SN|Component",
  Editor = "SN|Editor",
  ActionsExtension = "Extension",
  UserPrefs = "SN|UserPreferences",
  HistorySession = "SN|HistorySession",
  Theme = "SN|Theme",
  File = "SN|File",
  FilesafeCredentials = "SN|FileSafe|Credentials",
  FilesafeFileMetadata = "SN|FileSafe|FileMetadata",
  FilesafeIntegration = "SN|FileSafe|Integration",
  ExtensionRepo = "SN|ExtensionRepo",
  Unknown = "Unknown"
}

enum ProtocolVersion {
  V001 = "001",
  V002 = "002",
  V003 = "003",
  V004 = "004",
  V005 = "005"
}
const ComponentDataDomain = "org.standardnotes.sn.components";
const DefaultAppDomain = "org.standardnotes.sn";

type SNBackupItem<TContent extends ItemContent> =
  BackupFileDecryptedContextualPayload<
    TContent & {
      appData: {
        [DefaultAppDomain]?: Record<AppDataField, any>;
        [ComponentDataDomain]?: Record<string, any | null | undefined>;
      };
    }
  >;

export type SNNote = SNBackupItem<NoteContent>;
export type SNComponent = SNBackupItem<ComponentContent>;
export type SNTag = SNBackupItem<TagContent>;
export type SNBackup = BackupFile;
export type EditorDescription = Pick<
  EditorFeatureDescription,
  "note_type" | "file_type"
> & {
  language?: string;
};
export type CodeEditorComponentData = { mode?: string };

export type Spreadsheet = {
  sheets: kendo.ui.SpreadsheetSheet[];
};

export {
  DefaultAppDomain,
  ComponentDataDomain,
  ProtocolVersion,
  ContentType,
  ComponentArea,
  NoteType
};
