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

import tap from "tap";
import { pack, transform } from "../index";
import { getFiles, hasher } from "./utils";
import { ProviderFactory } from "../src/providers/provider-factory";
import { unzipSync } from "fflate";
import { ProviderSettings } from "../src/providers/provider";

const settings: ProviderSettings = { hasher, clientType: "node" };
for (const providerName of ProviderFactory.getAvailableProviders()) {
  const provider = ProviderFactory.getProvider(providerName);
  if (provider.type === "network") continue;

  const files = getFiles(providerName);
  if (files.length <= 0) continue;

  tap.test(
    `transform ${providerName} files to notesnook importer compatible format`,
    async () => {
      const output = await transform(provider, files, settings);
      output.notes.forEach((n) => {
        n.attachments?.forEach((a) => {
          a.data = undefined;
        });
      });
      tap.matchSnapshot(JSON.stringify(output.notes), providerName);
    }
  );

  tap.test(
    `transform & pack ${providerName} files to notesnook importer compatible format`,
    async () => {
      const output = pack((await transform(provider, files, settings)).notes);
      const unzipped = unzipSync(output);
      tap.matchSnapshot(Object.keys(unzipped), `${providerName}-packed`);
    }
  );
}
