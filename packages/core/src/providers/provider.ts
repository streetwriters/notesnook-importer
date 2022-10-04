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

import { Note } from "../models/note";
import { File } from "../utils/file";
import { IHasher } from "../utils/hasher";

export type ProviderType = "network" | "file";

interface IBaseProvider<T extends ProviderType> {
  type: T;
  version: string;
  name: string;
}

export interface IFileProvider extends IBaseProvider<"file"> {
  supportedExtensions: string[];
  validExtensions: string[];
  process(files: File[], settings: ProviderSettings): Promise<ProviderResult>;
}

export interface INetworkProvider<TSettings> extends IBaseProvider<"network"> {
  process(settings: TSettings): Promise<ProviderResult>;
}

export type IProvider = IFileProvider | INetworkProvider<unknown>;

export interface ProviderSettings {
  clientType: "browser" | "node";
  hasher: IHasher;
}

export type ProviderResult = {
  errors: Error[];
  notes: Note[];
};

type ProcessAction = (
  file: File,
  notes: Note[],
  errors: Error[]
) => Promise<boolean>;

/**
 * Iterate over files & perform transformation in an error resistant
 * manner. All errors are collected for later processing.
 */
export async function iterate(
  provider: IFileProvider,
  files: File[],
  process: ProcessAction
): Promise<ProviderResult> {
  const notes: Note[] = [];
  const errors: Error[] = [];

  for (const file of files) {
    if (file.extension) {
      if (!provider.validExtensions.includes(file.extension)) {
        errors.push(new Error(`Invalid file type: ${file.name}`));
        continue;
      } else if (!provider.supportedExtensions.includes(file.extension))
        continue;
    }

    try {
      if (!(await process(file, notes, errors))) continue;
    } catch (e) {
      errors.push(<Error>e);
    }
  }

  return { notes, errors };
}
