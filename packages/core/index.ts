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

import { IFileProvider, ProviderSettings } from "./src/providers/provider";
import { unpack } from "./src/utils/archiver";
import { IFile } from "./src/utils/file";

export async function transform(
  provider: IFileProvider,
  files: IFile[],
  settings: ProviderSettings
): Promise<Error[]> {
  const errors: Error[] = [];

  const allFiles = await unpack(files);
  const preprocessData = await provider.preprocess?.(allFiles);
  let count = 0;
  for (const file of allFiles) {
    if (!provider.filter(file)) continue;

    try {
      for await (const note of provider.process(
        file,
        settings,
        allFiles,
        preprocessData
      )) {
        await settings.storage.write(note);
        settings.reporter(++count);
      }
    } catch (e) {
      if (isQuotaExceeded(e)) {
        errors.push(new Error(`You are out of storage space.`));
      } else {
        errors.push(<Error>e);
      }
    }
  }
  return errors;
}

export * from "./src/utils/archiver";
export * from "./src/providers/provider-factory";
export * from "./src/providers/provider";
export * from "./src/utils/file";
export * from "./src/models";
export * from "./src/providers";

function isQuotaExceeded(e: unknown) {
  return (
    (e instanceof Error && e.name === "QuotaExceededError") ||
    (e as { inner?: Error }).inner?.name === "QuotaExceededError"
  );
}
