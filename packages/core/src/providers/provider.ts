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

import { Note } from "../models/note";
import { File } from "../utils/file";
import { IHasher } from "../utils/hasher";
import { IStorage } from "@notesnook-importer/storage";
import { Providers } from "./provider-factory";

export type ProviderType = "network" | "file";

interface IBaseProvider {
  type: ProviderType;
  version: string;
  id: Providers;
  name: string;
  helpLink: string;
}

export type ProviderLogMessage = { type: "log"; text: string; date: number };
export type ProviderErrorMessage = { type: "error"; error: Error };
export type ProviderNoteMessage = { type: "note"; note: Note };

export type ProviderMessage =
  | ProviderLogMessage
  | ProviderNoteMessage
  | ProviderErrorMessage;

export interface IFileProvider<TPreProcessResult = unknown>
  extends IBaseProvider {
  type: "file";
  requiresNetwork?: boolean;
  supportedExtensions: string[];
  examples?: string[];
  filter(file: File): boolean;
  preprocess?: (files: File[]) => Promise<TPreProcessResult>;
  process(
    currentFile: File,
    settings: ProviderSettings,
    files: File[],
    data?: TPreProcessResult
  ): AsyncGenerator<ProviderMessage, void, unknown>;
}

export interface INetworkProvider<TSettings extends ProviderSettings>
  extends IBaseProvider {
  type: "network";
  process(settings: TSettings): AsyncGenerator<ProviderMessage, void, unknown>;
}

export type IProvider = IFileProvider | INetworkProvider<ProviderSettings>;

export interface ProviderSettings {
  clientType: "browser" | "node";
  hasher: IHasher;
  storage: IStorage<Note>;
  log?: (message: ProviderLogMessage) => void;
  reporter: (current: number, total?: number) => void;
}

export type ProviderResult = {
  errors: Error[];
  notes: Note[];
};

export function log(message: string): ProviderLogMessage {
  return { type: "log", date: Date.now(), text: message };
}

export function error(
  error: unknown,
  ref?: { file?: File; note?: Note }
): ProviderErrorMessage {
  let message = error instanceof Error ? error.message : JSON.stringify(error);
  if (ref?.note) message += ` (note: ${ref?.note.title})`;
  if (ref?.file) message += ` (file: ${ref?.file.name})`;
  return {
    type: "error",
    error: new Error(message)
  };
}
