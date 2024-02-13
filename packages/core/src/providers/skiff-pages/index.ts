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

import { getAttributeValue } from "domutils";
import { File } from "../../utils/file";
import { parseFrontmatter } from "../../utils/frontmatter";
import { markdowntoHTML } from "../../utils/to-html";
import { HTML } from "../html";
import {
  IFileProvider,
  ProviderMessage,
  ProviderSettings,
  log
} from "../provider";
import { z } from "zod";
import { AADMeta } from "@skiff-org/skiff-crypto";
import { ChaCha20Poly1305 } from "@stablelib/chacha20poly1305";

const CacheElementMetadata = z.object({
  cacheID: z.string(),
  cacheDataKey: z.string(),
  url: z.string()
});

export class SkiffPages implements IFileProvider {
  public requiresNetwork = true;
  public type = "file" as const;
  public supportedExtensions = [".md", ".markdown", ".mdown"];
  public version = "1.0.0";
  public name = "Skiff Pages";
  public examples = ["Skiff.zip"];
  public helpLink =
    "https://help.notesnook.com/importing-notes/import-notes-from-skiff-pages";

  filter(file: File) {
    return this.supportedExtensions.includes(file.extension);
  }

  async *process(
    file: File,
    settings: ProviderSettings,
    files: File[]
  ): AsyncGenerator<ProviderMessage, void, unknown> {
    const text = await file.text();
    const { content } = parseFrontmatter(text);
    const lines = content.split("\n");
    const title = lines[0].startsWith("#") ? lines[0].slice(1) : undefined;
    const html = markdowntoHTML(title ? lines.slice(1).join("\n") : content);
    const note = await HTML.processHTML(
      file,
      files,
      settings.hasher,
      html,
      async (element) => {
        const encoded = getAttributeValue(element, "src");
        if (!encoded) return;

        const decodedJSON = decodeURIComponent(encoded);
        const metadata = CacheElementMetadata.safeParse(
          JSON.parse(decodedJSON)
        );
        if (!metadata.success) return;

        settings.log?.(log(`Downloading image (${metadata.data.url})`));

        try {
          const response = await fetch(
            `https://cors.notesnook.com/${metadata.data.url}`
          );
          if (!response.ok) return;

          const raw = await response.arrayBuffer();

          const parsedMetadata = AADMeta.deserialize(new Uint8Array(raw));
          if (!parsedMetadata) return;

          const decrypted = new ChaCha20Poly1305(
            Buffer.from(metadata.data.cacheDataKey, "base64")
          ).open(
            parsedMetadata.metadata.nonce,
            parsedMetadata.content,
            parsedMetadata.rawMetadata
          );
          if (!decrypted) return;

          settings.log?.(
            log(`Image downloaded and decrypted (${metadata.data.url})`)
          );

          return new File({
            data: new Blob([decrypted], { type: "image/*" }),
            name: metadata.data.cacheID,
            size: decrypted.length
          });
        } catch (e) {
          settings.log?.(
            log(`Failed to download image (url: ${metadata.data.url}): ${e}`)
          );
        }
      }
    );
    note.title = title || note.title;

    yield { type: "note", note };
  }
}
