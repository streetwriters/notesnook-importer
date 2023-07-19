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

export type ProviderType = "network" | "file";

interface IBaseProvider<T extends ProviderType> {
  type: T;
  version: string;
  name: string;
}

export interface IFileProvider<TPreProcessResult = unknown>
  extends IBaseProvider<"file"> {
  supportedExtensions: string[];
  examples?: string[];
  filter(file: File): boolean;
  preprocess?: (files: File[]) => Promise<TPreProcessResult>;
  process(
    currentFile: File,
    settings: ProviderSettings,
    files: File[],
    data?: TPreProcessResult
  ): AsyncGenerator<Note, void, unknown>;
}

export interface INetworkProvider<TSettings> extends IBaseProvider<"network"> {
  process(settings: TSettings): Promise<Error[]>;
}

export type IProvider = IFileProvider | INetworkProvider<unknown>;

export interface ProviderSettings {
  clientType: "browser" | "node";
  hasher: IHasher;
  storage: IStorage<Note>;
  reporter: (current: number, total?: number) => void;
}

export type ProviderResult = {
  errors: Error[];
  notes: Note[];
};
