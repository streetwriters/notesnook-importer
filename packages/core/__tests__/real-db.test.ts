import "./globals";
import { test } from "vitest";
import path from "path";
import fs from "fs";
import os from "os";
import { createRequire } from "node:module";
import { Note } from "../src/models";
import { File } from "../src/utils/file";
import { hasher, pathToFile } from "./utils";
import {
  SqlDatabase,
  SqliteAdapter,
  SqliteDatabaseFiles,
  toBytes
} from "../src/utils/sqlite-adapter";
import { ProviderFactory } from "../src/providers/provider-factory";

const require = createRequire(import.meta.url);

function walk(dir: string, out: string[] = []): string[] {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, entry.name);
    if (entry.isSymbolicLink()) continue;
    if (entry.isDirectory()) walk(p, out);
    else out.push(p);
  }
  return out;
}

class NodeSqliteAdapter implements SqliteAdapter {
  async open(files: SqliteDatabaseFiles): Promise<SqlDatabase> {
    const { DatabaseSync } = require("node:sqlite");
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), "nn-importer-"));
    const mainPath = path.join(dir, "db.sqlite");
    fs.writeFileSync(mainPath, Buffer.from(await toBytes(files.main)));
    if (files.wal)
      fs.writeFileSync(
        mainPath + "-wal",
        Buffer.from(await toBytes(files.wal))
      );
    if (files.shm)
      fs.writeFileSync(
        mainPath + "-shm",
        Buffer.from(await toBytes(files.shm))
      );
    const db = new DatabaseSync(mainPath);
    return {
      async all(sql: string, params?: any) {
        const stmt = db.prepare(sql);
        return params === undefined
          ? stmt.all()
          : stmt.all(...(params as unknown[]));
      },
      async get(sql: string, params?: any) {
        const stmt = db.prepare(sql);
        return params === undefined
          ? stmt.get()
          : stmt.get(...(params as unknown[]));
      },
      close() {
        db.close();
        fs.rmSync(dir, { recursive: true, force: true });
      }
    };
  }
}

test.skip("real applenotes db with WAL-capable adapter", async () => {
  const provider: any = ProviderFactory.getProvider("applenotes");
  const root = path.resolve(__dirname, "../../..", "group.com.apple.notes");
  const paths = walk(root).filter(
    (p) =>
      !p.includes(".DS_Store") &&
      // Keep the bundle zip but not the extracted .app contents.
      !p.includes("/ytmenu.app/")
  );
  const files = paths.map(pathToFile);
  const dbFile = files.find((f) => provider.filter(new File(f)))!;
  const fileObjs = files.map((f) => new File(f));
  const notes: Note[] = [];
  const settings = {
    hasher,
    clientType: "node" as const,
    reporter() {},
    log: (m: { text: string }) =>
      process.stdout.write("  LOG: " + m.text + "\n"),
    storage: { write: async (n: Note) => notes.push(n) },
    options: {
      applenotes: {
        adapter: new NodeSqliteAdapter(),
        getPassword: async () => process.env.APPLE_NOTES_PASSWORD
      }
    }
  };
  for await (const m of provider.process(
    new File(dbFile),
    settings,
    fileObjs
  )) {
    if (m.type === "error")
      process.stdout.write("  ERROR: " + m.error.message + "\n");
    if (m.type === "note") {
      const atts = (m.note.attachments || [])
        .map((a) => `${a.filename}:${a.mime}`)
        .join(", ");
      const hasAudio = /<audio/.test(m.note.content?.data || "");
      const hasImage = /<img/.test(m.note.content?.data || "");
      process.stdout.write(
        `  NOTE: ${m.note.title} | atts: [${atts}] | audio:${hasAudio} img:${hasImage}\n`
      );
      if (m.note.title === "Locked note") {
        const image = (m.note.attachments || []).find(
          (a) => a.mime === "image/jpeg"
        );
        if (image) {
          process.stdout.write(
            `  LOCKED IMAGE: ${image.filename} ${image.size} bytes (mime ${image.mime})\n`
          );
        } else {
          process.stdout.write("  LOCKED IMAGE: MISSING\n");
        }
      }
    }
  }
  process.stdout.write("TOTAL NOTES: " + notes.length + "\n");
});
