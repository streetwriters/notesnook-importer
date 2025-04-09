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

import { COMPATIBILITY_VERSION } from "./src/models";
import {
  IFileProvider,
  INetworkProvider,
  ProviderMessage,
  ProviderSettings,
  log
} from "./src/providers/provider";
import { unpack } from "./src/utils/archiver";
import { IFile, File } from "./src/utils/file";

type Counter = { count: number };
export async function transform<TSettings extends ProviderSettings>(
  provider: INetworkProvider<TSettings>,
  settings: TSettings
): Promise<Error[]>;
export async function transform(
  provider: IFileProvider,
  files: IFile[],
  settings: ProviderSettings
): Promise<Error[]>;
export async function transform<TSettings extends ProviderSettings>(
  provider: IFileProvider | INetworkProvider<TSettings>,
  filesOrSettings: IFile[] | TSettings,
  settings?: ProviderSettings
): Promise<Error[]> {
  if (provider.type === "file") {
    if (Array.isArray(filesOrSettings) && settings)
      return transformFiles(provider, filesOrSettings, settings);
  } else if (provider.type === "network") {
    if (!Array.isArray(filesOrSettings))
      return transformNetwork(provider, filesOrSettings);
  }
  return [new Error("Invalid usage. Please specify a valid provider.")];
}

async function transformNetwork<TSettings extends ProviderSettings>(
  provider: INetworkProvider<TSettings>,
  settings: TSettings
): Promise<Error[]> {
  const errors: Error[] = [];
  const counter: Counter = { count: 0 };
  try {
    for await (const message of provider.process(settings)) {
      await processProviderMessage(
        message,
        settings,
        counter,
        errors,
        provider
      );
    }
  } catch (e) {
    console.error(e);
    if (isQuotaExceeded(e)) {
      errors.push(new Error(`You are out of storage space.`));
    } else {
      errors.push(<Error>e);
    }
  }
  return errors;
}

async function transformFiles(
  provider: IFileProvider,
  files: IFile[],
  settings: ProviderSettings
): Promise<Error[]> {
  const errors: Error[] = [];
  const counter: Counter = { count: 0 };

  settings.log?.(log(`Unpacking ${files.length} file(s)...`));

  const allFiles = await unpack(files);

  settings.log?.(log(`Unpacked into ${allFiles.length}...`));

  const preprocessData = await provider.preprocess?.(allFiles);

  settings.log?.(log(`Preprocessing complete...`));

  for (const file of allFiles) {
    // ignore all hidden files
    if (isHidden(file)) continue;

    if (!provider.filter(file)) {
      settings.log?.(log(`Skipping ${file.name}...`));
      continue;
    }
    settings.log?.(log(`Processing ${file.name}...`));
    try {
      for await (const message of provider.process(
        file,
        settings,
        allFiles,
        preprocessData
      )) {
        await processProviderMessage(
          message,
          settings,
          counter,
          errors,
          provider
        );
      }
    } catch (e) {
      console.error(e);
      if (isQuotaExceeded(e)) {
        errors.push(new Error(`You are out of storage space.`));
      } else {
        errors.push(<Error>e);
      }
    }
  }
  return errors;
}

async function processProviderMessage(
  message: ProviderMessage,
  settings: ProviderSettings,
  counter: Counter,
  errors: Error[],
  provider: IFileProvider | INetworkProvider<ProviderSettings>
) {
  switch (message.type) {
    case "error":
      errors.push(message.error);
      break;
    case "log":
      settings.log?.(message);
      break;
    case "note":
      message.note.compatibilityVersion = COMPATIBILITY_VERSION;
      message.note.source = provider.id;
      await settings.storage.write(message.note);
      settings.reporter(++counter.count);
      break;
  }
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

function isHidden(file: File) {
  if (file.name.startsWith(".")) return true;
  const parts = file.path?.split("/");
  if (!parts) return false;
  for (const part of parts) {
    if (part.startsWith(".")) return true;
  }
  return false;
}
