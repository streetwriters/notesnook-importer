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
import { ProviderFactory } from "../src/providers/provider-factory";
import { hasher } from "./utils";
import sinon from "sinon";
import { OneNoteClient } from "@notesnook-importer/onenote";
import { Notebook } from "@microsoft/microsoft-graph-types-beta";
import Data from "./data/onenote/notebooks.json";
import { Content } from "@notesnook-importer/onenote";
import fs from "fs";
import crypto from "crypto";
import path from "path";
import { pack } from "../src/utils/archiver";
import { unzipSync } from "fflate";

tap.afterEach(() => {
  sinon.reset();
  sinon.restore();
});

const notebooks: Notebook[] = Data as Notebook[];
tap.test(
  `transform OneNote data to Notesnook importer compatible format`,
  async () => {
    const output = await importFromOnenote();
    output.notes.forEach((n) => {
      n.attachments?.forEach((a) => {
        a.data = undefined;
      });
    });
    tap.matchSnapshot(JSON.stringify(output.notes), "onenote");
  }
);

tap.test(
  `transform & pack OneNote data to Notesnook importer compatible format`,
  async () => {
    const output = pack((await importFromOnenote()).notes);
    const unzipped = unzipSync(output);
    tap.matchSnapshot(Object.keys(unzipped), `onenote-packed`);
  }
);

async function importFromOnenote() {
  const provider = ProviderFactory.getProvider("onenote");
  sinon.replace(OneNoteClient.prototype, "getNotebooks", async () => {
    for (const notebook of notebooks) {
      for (const section of notebook.sections ?? []) {
        if (!section.pages) continue;

        for (let i = 0; i < section.pages.length; ++i) {
          const page = section.pages[i];
          if (typeof page.content === "string")
            page.content = new Content(page.content, {
              attachmentResolver: async (url) => {
                const filePath = path.join(
                  __dirname,
                  "data",
                  "onenote",
                  md5(url)
                );
                return fs.readFileSync(filePath);
              }
            });
        }
      }
    }
    return notebooks;
  });

  const output = await provider.process({
    clientId: "",
    clientType: "node",
    hasher
  });
  return output;
}

function md5(str: string) {
  return crypto.createHash("md5").update(str).digest("hex");
}
