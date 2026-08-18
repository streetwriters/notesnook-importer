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

// Generates a synthetic Apple Journal database (Journal.sqlite) for tests.
// Run with: node scripts/generate-apple-journal-fixture.js

const fs = require("fs");
const path = require("path");

const CORE = path.join(__dirname, "..", "packages", "core");
const initSqlJs = require(path.join(CORE, "node_modules", "sql.js"));

const MEDIA_UUID = "MEDIA-0001-0000-0000-0000-000000000001";

function main() {
  initSqlJs().then((SQL) => {
    const db = new SQL.Database();

    db.run(`CREATE TABLE Z_PRIMARYKEY (Z_ENT INTEGER, Z_NAME VARCHAR, Z_SUPER INTEGER, Z_MAX INTEGER)`);
    db.run(`CREATE TABLE Z_METADATA (Z_VERSION INTEGER PRIMARY KEY, Z_UUID VARCHAR, Z_PLIST BLOB)`);
    db.run(`CREATE TABLE ZJENTRY (
      Z_PK INTEGER PRIMARY KEY, Z_ENT INTEGER, Z_OPT INTEGER,
      ZCREATIONDATE TIMESTAMP, ZMODIFICATIONDATE TIMESTAMP,
      ZTEXT VARCHAR, ZBODY BLOB, ZMOOD INTEGER,
      ZWEATHER INTEGER, ZSTARRED INTEGER, ZUUID VARCHAR
    )`);
    db.run(`CREATE TABLE ZJENTRYASSET (
      Z_PK INTEGER PRIMARY KEY, Z_ENT INTEGER, Z_OPT INTEGER,
      ZENTRY INTEGER, ZUUID VARCHAR, ZFILENAME VARCHAR,
      ZTYPE INTEGER
    )`);

    db.run("INSERT INTO Z_PRIMARYKEY VALUES (1, 'ZJENTRY', 0, 1)");
    db.run("INSERT INTO Z_PRIMARYKEY VALUES (2, 'ZJENTRYASSET', 0, 2)");

    const created = 730000000; // Core Data timestamp (seconds since 2001-01-01)
    const created2 = 730000100;

    db.run(
      "INSERT INTO ZJENTRY (Z_PK, Z_ENT, Z_OPT, ZCREATIONDATE, ZMODIFICATIONDATE, ZTEXT, ZMOOD, ZUUID) VALUES (?, 1, 1, ?, ?, ?, 1, 'ENTRY-0001-0000-0000-0000-000000000001')",
      [1, 730000000, 730000050, "Today I went for a walk in the park.\nThe weather was beautiful and I felt calm."]
    );
    db.run(
      "INSERT INTO ZJENTRY (Z_PK, Z_ENT, Z_OPT, ZCREATIONDATE, ZMODIFICATIONDATE, ZTEXT, ZMOOD, ZUUID) VALUES (?, 1, 1, ?, ?, ?, 2, 'ENTRY-0002-0000-0000-0000-000000000002')",
      [2, created2, created2 + 100, "A short note about work."]
    );

    db.run(
      "INSERT INTO ZJENTRYASSET (Z_PK, Z_ENT, Z_OPT, ZENTRY, ZUUID, ZFILENAME, ZTYPE) VALUES (?, 2, 1, 1, ?, ?, 1)",
      [1, MEDIA_UUID, "photo.jpg"]
    );

    const outDir = path.join(CORE, "__tests__", "data", "applejournal");
    const documentsDir = path.join(outDir, "Documents", MEDIA_UUID);
    fs.mkdirSync(documentsDir, { recursive: true });

    const png = Buffer.from(
      "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==",
      "base64"
    );
    fs.writeFileSync(path.join(documentsDir, "photo.jpg"), png);

    const data = db.export();
    fs.writeFileSync(path.join(outDir, "Journal.sqlite"), Buffer.from(data));
    db.close();
    console.log("Wrote Journal.sqlite + media to", outDir);
  });
}

main();
