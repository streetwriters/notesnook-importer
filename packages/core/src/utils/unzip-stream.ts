/* eslint-disable header/header */
/**
 * Taken from Conflux & modified
 * Read (and build) zip files with whatwg streams in the browser.
 *
 * @author Transcend Inc. <https://transcend.io>
 * @license MIT
 */

import { IFile } from "./file";
import { path } from "./path";
import { Deflate, Inflate } from "./fflate-shim";
import {
  BlobReader,
  Entry,
  Uint8ArrayWriter,
  ZipReader,
  configure
} from "@zip.js/zip.js";

configure({ Deflate, Inflate });

export async function unzip(zip: IFile): Promise<IFile[]> {
  const extracted: IFile[] = [];
  const reader = new ZipReader(new BlobReader(zip.data));

  for (const entry of await reader.getEntries()) {
    extracted.push({
      name: path.basename(entry.filename),
      path: entry.filename,
      data: new ZipEntry(entry),
      size: entry.uncompressedSize,
      modifiedAt: entry.lastModDate.getTime(),
      parent: zip
    });
  }

  await reader.close();
  return extracted;
}

class ZipEntry extends Blob {
  private ts = new TransformStream();
  constructor(private readonly entry: Entry) {
    super();
  }

  stream(): ReadableStream<Uint8Array> {
    this.entry.getData?.(this.ts.writable);
    return this.ts.readable;
  }

  async text(): Promise<string> {
    return new TextDecoder().decode(await this.arrayBuffer());
  }

  get size() {
    return this.entry.uncompressedSize;
  }

  async arrayBuffer(): Promise<ArrayBuffer> {
    const writer = new Uint8ArrayWriter();
    await this.entry.getData?.(writer);
    return (await writer.getData()).buffer;
  }

  slice(
    _start?: number | undefined,
    _end?: number | undefined,
    _contentType?: string | undefined
  ): Blob {
    throw new Error("Slice is not supported.");
  }
}
