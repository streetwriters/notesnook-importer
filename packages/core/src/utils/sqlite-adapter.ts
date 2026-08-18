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

export type SqlParams = unknown[] | Record<string, unknown>;
export type SqlRow = Record<string, unknown>;

/**
 * A read-only view over an SQLite database. Providers only ever run SELECT /
 * PRAGMA queries, so the surface is intentionally tiny. Methods are async
 * because browser SQLite engines (wa-sqlite, OPFS-backed) are asynchronous.
 */
export interface SqlDatabase {
  all<T = SqlRow>(sql: string, params?: SqlParams): Promise<T[]>;
  get<T = SqlRow>(sql: string, params?: SqlParams): Promise<T | undefined>;
  close(): Promise<void> | void;
}

/**
 * A database file given either as raw bytes (small databases, the built-in
 * adapter) or as a stream (large databases, to avoid loading the whole file
 * into memory).
 */
export type SqliteDatabaseSource = Uint8Array | ReadableStream<Uint8Array>;

/**
 * The database files that make up a single SQLite database. Apple Notes and
 * Apple Journal use WAL mode, so the `-wal` and `-shm` sibling files may
 * contain the most recent changes. An adapter is free to use them or ignore
 * them.
 */
export interface SqliteDatabaseFiles {
  /** The main database file (e.g. NoteStore.sqlite). */
  main: SqliteDatabaseSource;
  /** The write-ahead log file (e.g. NoteStore.sqlite-wal). */
  wal?: SqliteDatabaseSource;
  /** The shared-memory index file (e.g. NoteStore.sqlite-shm). */
  shm?: SqliteDatabaseSource;
}

/**
 * Collects a database source into a single Uint8Array. Streams are read to
 * completion — this is only used by adapters that require the whole file in
 * memory (e.g. the built-in sql.js adapter).
 */
export async function toBytes(source: SqliteDatabaseSource): Promise<Uint8Array> {
  if (source instanceof Uint8Array) return source;

  const reader = source.getReader();
  const chunks: Uint8Array[] = [];
  let size = 0;
  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      chunks.push(value);
      size += value.byteLength;
    }
  } finally {
    reader.releaseLock();
  }

  const out = new Uint8Array(size);
  let offset = 0;
  for (const chunk of chunks) {
    out.set(chunk, offset);
    offset += chunk.byteLength;
  }
  return out;
}

/**
 * Opens an SQLite database from raw file bytes. Implementations decide how to
 * locate the SQLite engine (sql.js, wa-sqlite, node:sqlite, ...) and whether
 * to replay WAL data.
 */
export interface SqliteAdapter {
  open(files: SqliteDatabaseFiles): Promise<SqlDatabase>;
}
