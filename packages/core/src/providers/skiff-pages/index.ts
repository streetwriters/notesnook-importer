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
import { ChaCha20Poly1305 } from "@stablelib/chacha20poly1305";
import { Providers } from "../provider-factory";
import varint from "varint";

const CacheElementMetadata = z.object({
  cacheID: z.string(),
  cacheDataKey: z.string(),
  url: z.string()
});

export class SkiffPages implements IFileProvider {
  id: Providers = "skiffpages";
  requiresNetwork = true;
  type = "file" as const;
  supportedExtensions = [".md", ".markdown", ".mdown"];
  version = "1.0.0";
  name = "Skiff Pages";
  examples = ["Skiff.zip"];
  helpLink =
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

// Taken from: https://github.com/skiff-org/skiff-apps/blob/main/libs/skiff-crypto/src/aead/common.ts
/**
 * AADMeta is a class that encapsulates the additional metadata included in these envelope implementations.
 */
export class AADMeta {
  constructor(
    readonly version: string,
    readonly type: string,
    readonly nonce: Uint8Array
  ) {}

  static deserialize(data: Uint8Array): {
    metadata: AADMeta;
    rawMetadata: Uint8Array;
    content: Uint8Array;
  } | null {
    const header = extractVarintPrefixed({ bs: data.copyWithin(0, 0) });

    const rawMetadata = varintPrefixed(header);
    const content = data.slice(rawMetadata.length);

    const headerBuf = { bs: header.copyWithin(0, 0) };

    const metadataVersion = utf8BytesToString(extractVarintPrefixed(headerBuf));
    if (metadataVersion !== AADMeta.METADATA_VERSION) {
      throw new Error("unrecognized metadata version");
    }
    const metadata = new AADMeta(
      utf8BytesToString(extractVarintPrefixed(headerBuf)),
      utf8BytesToString(extractVarintPrefixed(headerBuf)),
      extractVarintPrefixed(headerBuf)
    );

    if (headerBuf.bs.length !== 0) {
      throw new Error("unexpected additional content in header");
    }

    return {
      metadata,
      rawMetadata,
      content
    };
  }

  static readonly METADATA_VERSION = "0.1.0";
}

/**
 *
 * @param o - object containing a reference to a Uint8Array. Modifies this value in-place.
 */
export function extractVarintPrefixed(o: { bs: Uint8Array }): Uint8Array {
  // Extract a varint-prefixed value from the underlying byte array.
  // a varint is a multi-byte 7-bit encoding of a number representing how many of the following bytes
  // are a part of this field. The 8th bit represents whether or not the number is continued into the next byte.

  // For example, if we had 130 bytes of content that have been serialized with a leading varint prefix,
  // we would have 132 bytes of data. The first two bytes would encode the length of 130, and the rest is the content.

  const chunkLen = varint.decode(o.bs); // Extract the length of the chunk
  const chunkLenLen = varint.encodingLength(chunkLen); // Figure out how many bytes were used to express that length
  const chunk = o.bs.slice(chunkLenLen, chunkLen + chunkLenLen); // Extract that chunk

  o.bs = o.bs.slice(chunkLen + chunkLenLen);

  return chunk;
}

export function varintPrefixed(data: Uint8Array): Uint8Array {
  return concatUint8Arrays(Uint8Array.from(varint.encode(data.length)), data);
}

/**
 * Concatenate several Uint8Arrays together.
 * Equivalent to calling `Uint8Array.of(...u8s[0], ...u8s[1], ...)` but shouldn't blow up the stack for large arrays.
 *
 * @param u8s some Uint8Arrays
 * @returns a Uint8Array
 */
export function concatUint8Arrays(...u8s: Uint8Array[]): Uint8Array {
  let totalLen = 0;
  u8s.forEach((elem) => {
    totalLen += elem.byteLength;
  });

  const ret: Uint8Array = new Uint8Array(totalLen);

  let index = 0;
  u8s.forEach((elem) => {
    ret.set(elem, index);
    index += elem.byteLength;
  });

  return ret;
}

function utf8BytesToString(data: Uint8Array) {
  const utf8decoder = new TextDecoder();
  return utf8decoder.decode(data);
}
