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

import "./globals";
import tap from "tap";
import { transform, Note, pack } from "../index";
import { getFiles, hasher } from "./utils";
import { ProviderFactory } from "../src/providers/provider-factory";
// import { unzipSync } from "fflate";
import { ProviderSettings } from "../src/providers/provider";
import { MemoryStorage } from "@notesnook-importer/storage/dist/memory";
import { unzip } from "../src/utils/unzip-stream";

for (const providerName of ProviderFactory.getAvailableProviders()) {
  const provider = ProviderFactory.getProvider(providerName);
  if (provider.type === "network") continue;

  tap.test(
    `transform ${providerName} files to notesnook importer compatible format`,
    async () => {
      const files = getFiles(providerName);
      if (files.length <= 0) return;

      const storage = new MemoryStorage<Note>();
      const settings: ProviderSettings = {
        hasher,
        clientType: "node",
        reporter() {},
        storage
      };

      await transform(provider, files, settings);
      const notes = Object.values(storage.storage);
      notes.forEach((n) => {
        n.attachments?.forEach((a) => {
          a.data = undefined;
        });
      });
      tap.matchSnapshot(JSON.stringify(notes), providerName);
    }
  );

  tap.test(
    `transform & pack ${providerName} files to notesnook importer compatible format`,
    async () => {
      const files = getFiles(providerName);
      if (files.length <= 0) return;

      const storage = new MemoryStorage<Note>();
      const settings: ProviderSettings = {
        hasher,
        clientType: "node",
        reporter() {},
        storage
      };

      await transform(provider, files, settings);

      const output = pack(storage);
      const unzippedFiles = await unzip({
        data: output,
        name: "Test.zip",
        size: 0
      });
      tap.matchSnapshot(
        unzippedFiles.map((f) => f.path || f.name),
        `${providerName}-packed`
      );
    }
  );
}
