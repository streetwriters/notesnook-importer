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

import initSqlJs from "sql.js";
import {
  SqlDatabase,
  SqliteAdapter,
  SqlParams,
  toBytes
} from "./sqlite-adapter";

export type SqlJsStatic = Awaited<ReturnType<typeof initSqlJs>>;
export type RawSqlJsDatabase = InstanceType<SqlJsStatic["Database"]>;

let sqlJs: SqlJsStatic | undefined;
let sqlJsPromise: Promise<SqlJsStatic> | undefined;

async function loadWasmBinary(): Promise<Uint8Array | undefined> {
  try {
    // Vite resolves this to the wasm asset URL; in Node it is ignored and
    // sql.js locates the wasm from node_modules on its own.
    // @ts-ignore
    const mod = (await import("sql.js/dist/sql-wasm.wasm?url")) as {
      default: string;
    };
    const res = await fetch(mod.default);
    if (!res.ok) return undefined;
    return new Uint8Array(await res.arrayBuffer());
  } catch {
    return undefined;
  }
}

async function initSqlJsOnce(): Promise<SqlJsStatic> {
  if (sqlJs) return sqlJs;
  if (!sqlJsPromise) {
    sqlJsPromise = loadWasmBinary().then((wasmBinary) =>
      wasmBinary ? initSqlJs({ wasmBinary }) : initSqlJs()
    );
    sqlJsPromise.catch(() => (sqlJsPromise = undefined));
  }
  return sqlJsPromise;
}

export class SqlJsDatabase implements SqlDatabase {
  constructor(private readonly database: RawSqlJsDatabase) {}

  async all<T = Record<string, unknown>>(
    sql: string,
    params?: SqlParams
  ): Promise<T[]> {
    const stmt = this.database.prepare(sql);
    try {
      if (params) stmt.bind(params as never);
      const rows: T[] = [];
      while (stmt.step()) rows.push(stmt.getAsObject() as T);
      return rows;
    } finally {
      stmt.free();
    }
  }

  async get<T = Record<string, unknown>>(
    sql: string,
    params?: SqlParams
  ): Promise<T | undefined> {
    const rows = await this.all<T>(sql, params);
    return rows[0];
  }

  close() {
    this.database.close();
  }
}

/**
 * The built-in adapter backed by sql.js (WASM). It works in browsers and Node
 * without any extra setup. Note that sql.js cannot replay WAL files, so for
 * databases whose recent changes still live in a `-wal` file you should supply
 * your own adapter (e.g. one backed by wa-sqlite) via
 * `ProviderSettings.options`.
 */
export const defaultSqliteAdapter: SqliteAdapter = {
  async open(files) {
    const SQL = await initSqlJsOnce();
    const main = await toBytes(files.main);
    return new SqlJsDatabase(new SQL.Database(main));
  }
};
