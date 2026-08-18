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

// Generates a synthetic Apple Notes database (NoteStore.sqlite) for tests.
// Run with: npx ts-node scripts/generate-apple-notes-fixture.ts

const fs = require("fs");
const path = require("path");

const CORE = path.join(__dirname, "..", "packages", "core");
const initSqlJs = require(path.join(CORE, "node_modules", "sql.js"));
const { Root } = require(path.join(CORE, "node_modules", "protobufjs"));
const { gzipSync } = require(path.join(CORE, "node_modules", "fflate"));
const { encodeBplist, buildKeyedArchive } = require("./bplist-encoder.js");

const descriptor = {
  nested: {
    ciofecaforensics: {
      nested: {
        Color: { fields: { red: { type: "float", id: 1 }, green: { type: "float", id: 2 }, blue: { type: "float", id: 3 }, alpha: { type: "float", id: 4 } } },
        AttachmentInfo: { fields: { attachmentIdentifier: { type: "string", id: 1 }, typeUti: { type: "string", id: 2 } } },
        Font: { fields: { fontName: { type: "string", id: 1 }, pointSize: { type: "float", id: 2 }, fontHints: { type: "int32", id: 3 } } },
        ParagraphStyle: { fields: { styleType: { type: "int32", id: 1, options: { default: -1 } }, alignment: { type: "int32", id: 2 }, indentAmount: { type: "int32", id: 4 }, checklist: { type: "Checklist", id: 5 }, blockquote: { type: "int32", id: 8 } } },
        Checklist: { fields: { uuid: { type: "bytes", id: 1 }, done: { type: "int32", id: 2 } } },
        AttributeRun: { fields: { length: { type: "int32", id: 1 }, paragraphStyle: { type: "ParagraphStyle", id: 2 }, font: { type: "Font", id: 3 }, fontWeight: { type: "int32", id: 5 }, underlined: { type: "int32", id: 6 }, strikethrough: { type: "int32", id: 7 }, superscript: { type: "int32", id: 8 }, link: { type: "string", id: 9 }, color: { type: "Color", id: 10 }, emphasisColor: { type: "int32", id: 14 }, attachmentInfo: { type: "AttachmentInfo", id: 12 } } },
        Document: { fields: { version: { type: "int32", id: 2 }, note: { type: "Note", id: 3 } } },
        NoteStoreProto: { fields: { document: { type: "Document", id: 2 } } },
        Note: { fields: { noteText: { type: "string", id: 2 }, attributeRun: { rule: "repeated", type: "AttributeRun", id: 5 } } }
      }
    }
  }
};

const ICAccount = 100;
const ICFolder = 101;
const ICNote = 102;
const ICAttachment = 103;
const ICMedia = 104;

const ACCOUNT_UUID = "A1B2C3D4-E5F6-7890-ABCD-EF1234567890";
const MEDIA_ID = "bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb";
const MEDIA_GEN = "g1";
const IMAGE_FILENAME = "IMG_0001.JPG";
const PDF_FILENAME = "document.pdf";

const CORETIME_OFFSET = 978307200;

let root;
function getRoot() {
  if (!root) root = Root.fromJSON(descriptor);
  return root;
}

function encodeNoteBody({ text, runs }) {
  const root = getRoot();
  const Document = root.lookupType("ciofecaforensics.Document");
  const note = Document.create({
    note: {
      noteText: text,
      attributeRun: runs.map((r) =>
        Document.lookupType("ciofecaforensics.AttributeRun").create(r)
      )
    }
  });
  const buffer = Document.encode(note).finish();
  return gzipSync(buffer);
}

function run(length, opts = {}) {
  return {
    length,
    paragraphStyle: opts.styleType !== undefined
      ? {
          styleType: opts.styleType,
          alignment: opts.alignment,
          indentAmount: opts.indent,
          blockquote: opts.blockquote,
          checklist: opts.checked !== undefined ? { done: opts.checked ? 1 : 0 } : undefined
        }
      : undefined,
    fontWeight:
      opts.bold !== undefined || opts.italic !== undefined
        ? opts.bold && opts.italic
          ? 3
          : opts.bold
            ? 1
            : 2
        : undefined,
    italic: undefined,
    underlined: opts.underline ? 1 : undefined,
    strikethrough: opts.strike ? 1 : undefined,
    link: opts.link,
    attachmentInfo: opts.attachment
  };
}

// Build a note body from text segments so run lengths always match the text.
function body(segments) {
  const text = segments.map((s) => s.text).join("");
  const runs = [];
  for (const segment of segments) {
    runs.push(run(segment.text.length, segment.opts || {}));
  }
  return encodeNoteBody({ text, runs });
}

// Encode a body wrapped in a NoteStoreProto (used by some macOS versions).
function bodyWrapped(segments) {
  const root = getRoot();
  const Document = root.lookupType("ciofecaforensics.Document");
  const NoteStoreProto = root.lookupType("ciofecaforensics.NoteStoreProto");
  const text = segments.map((s) => s.text).join("");
  const document = Document.create({
    note: {
      noteText: text,
      attributeRun: segments.map((s) =>
        Document.lookupType("ciofecaforensics.AttributeRun").create(run(s.text.length, s.opts || {}))
      )
    }
  });
  const proto = NoteStoreProto.create({ document });
  return gzipSync(NoteStoreProto.encode(proto).finish());
}

// Encode an empty Document with no note body at all.
function emptyBody() {
  const root = getRoot();
  const Document = root.lookupType("ciofecaforensics.Document");
  return gzipSync(Document.encode(Document.create({})).finish());
}

// Encrypt a note body using Apple's scheme: PBKDF2-HMAC-SHA256 to derive a KEK,
// AES-KW to wrap the content key, AES-GCM for the payload.
async function encryptBody(password, plaintextBytes) {
  const subtle = globalThis.crypto.subtle;
  const enc = new TextEncoder();

  const salt = new Uint8Array(16);
  globalThis.crypto.getRandomValues(salt);
  const iterations = 1000;

  const passwordKey = await subtle.importKey("raw", enc.encode(password), "PBKDF2", false, ["deriveBits"]);
  const kekBytes = await subtle.deriveBits(
    { name: "PBKDF2", salt, iterations, hash: "SHA-256" },
    passwordKey,
    128
  );

  const contentKeyBytes = new Uint8Array(16);
  globalThis.crypto.getRandomValues(contentKeyBytes);
  const contentKey = await subtle.importKey("raw", contentKeyBytes, "AES-GCM", true, ["encrypt"]);
  const kek = await subtle.importKey("raw", kekBytes, "AES-KW", false, ["wrapKey"]);
  const wrappedKey = new Uint8Array(await subtle.wrapKey("raw", contentKey, kek, "AES-KW"));

  const iv = new Uint8Array(12);
  globalThis.crypto.getRandomValues(iv);
  const ciphertextWithTag = new Uint8Array(
    await subtle.encrypt({ name: "AES-GCM", iv }, contentKey, plaintextBytes)
  );
  const tag = ciphertextWithTag.slice(ciphertextWithTag.length - 16);
  const ciphertext = ciphertextWithTag.slice(0, ciphertextWithTag.length - 16);

  return { salt, iterations, wrappedKey, iv, tag, ciphertext };
}

function main() {
  initSqlJs().then(async (SQL) => {
    const db = new SQL.Database();

    db.run(`CREATE TABLE Z_PRIMARYKEY (Z_ENT INTEGER, Z_NAME VARCHAR, Z_SUPER INTEGER, Z_MAX INTEGER)`);
    db.run(`CREATE TABLE ZICCLOUDSYNCINGOBJECT (
      Z_PK INTEGER PRIMARY KEY, Z_ENT INTEGER, Z_OPT INTEGER,
      ZIDENTIFIER VARCHAR, ZNAME VARCHAR, ZTITLE1 VARCHAR, ZTITLE2 VARCHAR,
      ZPARENT INTEGER, ZFOLDERTYPE INTEGER, ZOWNER INTEGER, ZFOLDER INTEGER,
      ZCREATIONDATE1 TIMESTAMP, ZMODIFICATIONDATE1 TIMESTAMP,
      ZISPASSWORDPROTECTED INTEGER,
      ZCRYPTOINITIALIZATIONVECTOR BLOB, ZCRYPTOTAG BLOB, ZCRYPTOSALT BLOB,
      ZCRYPTOITERATIONCOUNT INTEGER, ZCRYPTOWRAPPEDKEY BLOB, ZCRYPTOVERIFIER BLOB,
      ZUNAPPLIEDENCRYPTEDRECORDDATA BLOB,
      ZALTTEXT VARCHAR, ZTOKENCONTENTIDENTIFIER VARCHAR,
      ZTITLE VARCHAR, ZURLSTRING VARCHAR,
      ZSIZEWIDTH INTEGER, ZSIZEHEIGHT INTEGER,
      ZFALLBACKIMAGEGENERATION VARCHAR,
      ZMEDIA INTEGER, ZFILENAME VARCHAR, ZGENERATION1 VARCHAR,
      ZFALLBACKPDFGENERATION VARCHAR, ZTYPEUTI VARCHAR, ZNOTE INTEGER,
      ZDATA BLOB, ZMERGEABLEDATA1 BLOB
    )`);
    db.run(`CREATE TABLE ZICNOTEDATA (Z_PK INTEGER PRIMARY KEY, ZNOTE INTEGER, ZDATA BLOB)`);

    // Entities
    [
      ["ICAccount", ICAccount],
      ["ICFolder", ICFolder],
      ["ICNote", ICNote],
      ["ICAttachment", ICAttachment],
      ["ICMedia", ICMedia]
    ].forEach(([name, ent], i) =>
      db.run("INSERT INTO Z_PRIMARYKEY VALUES (?, ?, 0, ?)", [ent, name, i + 1])
    );

    // Account
    const accountPk = 1;
    db.run(
      "INSERT INTO ZICCLOUDSYNCINGOBJECT (Z_PK, Z_ENT, ZIDENTIFIER, ZNAME) VALUES (?, ?, ?, ?)",
      [accountPk, ICAccount, ACCOUNT_UUID, "iCloud"]
    );

    // Folders
    const personal = 2;
    const projects = 3;
    const work = 4;
    const smart = 5;
    const trash = 6;
    db.run("INSERT INTO ZICCLOUDSYNCINGOBJECT (Z_PK, Z_ENT, ZTITLE2, ZPARENT, ZFOLDERTYPE, ZOWNER) VALUES (?, ?, 'Personal', NULL, 0, ?)", [personal, ICFolder, accountPk]);
    db.run("INSERT INTO ZICCLOUDSYNCINGOBJECT (Z_PK, Z_ENT, ZTITLE2, ZPARENT, ZFOLDERTYPE, ZOWNER) VALUES (?, ?, 'Projects', ?, 0, ?)", [projects, ICFolder, personal, accountPk]);
    db.run("INSERT INTO ZICCLOUDSYNCINGOBJECT (Z_PK, Z_ENT, ZTITLE2, ZPARENT, ZFOLDERTYPE, ZOWNER) VALUES (?, ?, 'Work', NULL, 0, ?)", [work, ICFolder, accountPk]);
    db.run("INSERT INTO ZICCLOUDSYNCINGOBJECT (Z_PK, Z_ENT, ZTITLE2, ZPARENT, ZFOLDERTYPE, ZOWNER) VALUES (?, ?, 'Smart', NULL, 3, ?)", [smart, ICFolder, accountPk]);
    db.run("INSERT INTO ZICCLOUDSYNCINGOBJECT (Z_PK, Z_ENT, ZTITLE2, ZPARENT, ZFOLDERTYPE, ZOWNER) VALUES (?, ?, 'Recently Deleted', NULL, 1, ?)", [trash, ICFolder, accountPk]);

    const created = 699000000; // some core time
    const edited = 699000100;

    const insertNote = (pk, identifier, title, folder, body, opts = {}) => {
      const columns = [
        "Z_PK",
        "Z_ENT",
        "ZIDENTIFIER",
        "ZTITLE1",
        "ZFOLDER",
        "ZCREATIONDATE1",
        "ZMODIFICATIONDATE1",
        "ZISPASSWORDPROTECTED"
      ];
      const values = [
        pk,
        ICNote,
        identifier,
        title,
        folder,
        created,
        edited,
        opts.password || opts.crypto ? 1 : 0
      ];
      if (opts.crypto) {
        columns.push(
          "ZCRYPTOSALT",
          "ZCRYPTOITERATIONCOUNT",
          "ZCRYPTOWRAPPEDKEY",
          "ZCRYPTOINITIALIZATIONVECTOR",
          "ZCRYPTOTAG"
        );
        values.push(
          opts.crypto.salt,
          opts.crypto.iterations,
          opts.crypto.wrappedKey,
          opts.crypto.iv,
          opts.crypto.tag
        );
        if (opts.crypto.verifier) {
          columns.push("ZCRYPTOVERIFIER");
          values.push(opts.crypto.verifier);
        }
        if (opts.crypto.unapplied) {
          columns.push("ZUNAPPLIEDENCRYPTEDRECORDDATA");
          values.push(opts.crypto.unapplied);
        }
      }
      db.run(
        `INSERT INTO ZICCLOUDSYNCINGOBJECT (${columns.join(", ")}) VALUES (${columns.map(() => "?").join(", ")})`,
        values
      );
      db.run("INSERT INTO ZICNOTEDATA (Z_PK, ZNOTE, ZDATA) VALUES (?, ?, ?)", [
        pk,
        pk,
        body
      ]);
    };

    // Note 1: welcome note with formatting
    insertNote(
      10,
      "11111111-1111-1111-1111-111111111111",
      "Welcome to Apple Notes",
      personal,
      body([
        { text: "Welcome to Apple Notes\n", opts: { styleType: 0 } },
        { text: "This is the body with " },
        { text: "bold", opts: { bold: true } },
        { text: " and " },
        { text: "italic", opts: { italic: true } },
        { text: " text and a checklist:\n" },
        { text: "Task one\n", opts: { styleType: 103, checked: false } },
        { text: "Task two\n", opts: { styleType: 103, checked: true } }
      ])
    );

    // Note 2: links & media (internal link to note 1, external link, image)
    insertNote(
      11,
      "22222222-2222-2222-2222-222222222222",
      "Links and media",
      projects,
      body([
        { text: "Check the " },
        {
          text: "welcome note",
          opts: { link: "applenotes:note/11111111-1111-1111-1111-111111111111" }
        },
        { text: " and this URL: " },
        { text: "https://example.com", opts: { link: "https://example.com" } },
        { text: "\n" },
        {
          text: "\uFFFC",
          opts: {
            attachment: {
              attachmentIdentifier: "aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa",
              typeUti: "public.jpeg"
            }
          }
        },
        { text: "\n" }
      ])
    );

    // Note 3: checklist note with a numbered list
    insertNote(
      12,
      "33333333-3333-3333-3333-333333333333",
      "Lists",
      personal,
      body([
        { text: "Grocery list\n", opts: { styleType: 0 } },
        { text: "Milk\n", opts: { styleType: 101 } },
        { text: "Bread\n", opts: { styleType: 101 } },
        { text: "Eggs\n", opts: { styleType: 101 } },
        { text: "Steps:\n" },
        { text: "First\n", opts: { styleType: 102 } },
        { text: "Second\n", opts: { styleType: 102 } }
      ])
    );

    // Note 4: password protected (should be skipped)
    insertNote(
      13,
      "44444444-4444-4444-4444-444444444444",
      "Secret note",
      work,
      body([{ text: "This is a secret note.\n" }]),
      { password: true }
    );

    // Note 5: body wrapped in a NoteStoreProto (some macOS versions)
    insertNote(
      14,
      "55555555-5555-5555-5555-555555555555",
      "Wrapped body",
      work,
      bodyWrapped([
        { text: "Wrapped body\n", opts: { styleType: 0 } },
        { text: "This note body is wrapped in a NoteStoreProto.\n" }
      ])
    );

    // Note 6: empty body (no note message) - should be skipped without errors
    insertNote(
      15,
      "66666666-6666-6666-6666-666666666666",
      "Empty note",
      work,
      emptyBody()
    );

    // Note 7: voice memo (recording)
    insertNote(
      16,
      "77777777-7777-7777-7777-777777777777",
      "Voice memo",
      work,
      body([
        { text: "Voice memo\n", opts: { styleType: 0 } },
        {
          text: "\uFFFC",
          opts: {
            attachment: {
              attachmentIdentifier: "eeeeeeee-eeee-eeee-eeee-eeeeeeeeeeee",
              typeUti: "com.apple.m4a-audio"
            }
          }
        },
        { text: "\n" }
      ])
    );

    // Note 8: encrypted note (password protected with crypto metadata)
    {
      const encrypted = await encryptBody(
        "hunter2",
        body([
          { text: "Secret note\n", opts: { styleType: 0 } },
          { text: "This content is encrypted with a password.\n" }
        ])
      );
      insertNote(
        17,
        "88888888-8888-8888-8888-888888888888",
        "Secret encrypted",
        work,
        encrypted.ciphertext,
        { crypto: encrypted }
      );
    }

    // Note 9: verifier-only encrypted note. The wrapped key is NOT stored in
    // ZCRYPTOWRAPPEDKEY; it lives inside the CloudKit record
    // (ZUNAPPLIEDENCRYPTEDRECORDDATA) as an NSKeyedArchiver.
    {
      const encrypted = await encryptBody(
        "correct horse",
        body([
          { text: "Verifier note\n", opts: { styleType: 0 } },
          { text: "This note's key is stored in the CloudKit record.\n" }
        ])
      );
      const archive = buildKeyedArchive({
        ValueStore: {
          RecordValues: {
            "NS.keys": [
              "CryptoWrappedKey",
              "CryptoSalt",
              "CryptoIterationCount",
              "CryptoInitializationVector",
              "CryptoTag"
            ],
            "NS.objects": [
              encrypted.wrappedKey,
              encrypted.salt,
              encrypted.iterations,
              encrypted.iv,
              encrypted.tag
            ]
          }
        }
      });
      insertNote(
        18,
        "99999999-9999-9999-9999-999999999999",
        "Verifier encrypted",
        work,
        encrypted.ciphertext,
        {
          crypto: {
            salt: encrypted.salt,
            iterations: encrypted.iterations,
            wrappedKey: null,
            iv: encrypted.iv,
            tag: encrypted.tag,
            verifier: new Uint8Array([0xaa, 0xbb, 0xcc]),
            unapplied: encodeBplist(archive)
          }
        }
      );
    }

    // Media: image attachment + media row + file
    const mediaPk = 20;
    db.run(
      "INSERT INTO ZICCLOUDSYNCINGOBJECT (Z_PK, Z_ENT, ZIDENTIFIER, ZFILENAME, ZGENERATION1) VALUES (?, ?, ?, ?, ?)",
      [mediaPk, ICMedia, MEDIA_ID, IMAGE_FILENAME, MEDIA_GEN]
    );

    // Attachment row pointing to media
    const attachmentPk = 21;
    db.run(
      "INSERT INTO ZICCLOUDSYNCINGOBJECT (Z_PK, Z_ENT, ZIDENTIFIER, ZMEDIA, ZTYPEUTI, ZNOTE) VALUES (?, ?, ?, ?, 'public.jpeg', ?)",
      [attachmentPk, ICAttachment, "aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa", mediaPk, 11]
    );

    // A drawing attachment
    const drawingPk = 22;
    db.run(
      "INSERT INTO ZICCLOUDSYNCINGOBJECT (Z_PK, Z_ENT, ZIDENTIFIER, ZFALLBACKIMAGEGENERATION, ZTYPEUTI, ZNOTE) VALUES (?, ?, ?, 'g1', 'com.apple.paper', ?)",
      [drawingPk, ICAttachment, "cccccccc-cccc-cccc-cccc-cccccccccccc", 11]
    );

    // A voice memo (M4A) media + attachment row
    const audioMediaPk = 23;
    db.run(
      "INSERT INTO ZICCLOUDSYNCINGOBJECT (Z_PK, Z_ENT, ZIDENTIFIER, ZFILENAME, ZGENERATION1) VALUES (?, ?, ?, 'recording.m4a', 'g1')",
      [audioMediaPk, ICMedia, "dddddddd-dddd-dddd-dddd-dddddddddddd"]
    );
    db.run(
      "INSERT INTO ZICCLOUDSYNCINGOBJECT (Z_PK, Z_ENT, ZIDENTIFIER, ZMEDIA, ZTYPEUTI, ZNOTE) VALUES (?, ?, ?, ?, 'com.apple.m4a-audio', ?)",
      [24, ICAttachment, "eeeeeeee-eeee-eeee-eeee-eeeeeeeeeeee", audioMediaPk, 16]
    );

    const outDir = path.join(CORE, "__tests__", "data", "applenotes");
    const accountsDir = path.join(outDir, "Accounts", ACCOUNT_UUID);
    const mediaDir = path.join(accountsDir, "Media", MEDIA_ID, MEDIA_GEN);
    const audioMediaDir = path.join(accountsDir, "Media", "dddddddd-dddd-dddd-dddd-dddddddddddd", "g1");
    const fallbackDir = path.join(accountsDir, "FallbackImages", "cccccccc-cccc-cccc-cccc-cccccccccccc", "g1");
    fs.mkdirSync(mediaDir, { recursive: true });
    fs.mkdirSync(audioMediaDir, { recursive: true });
    fs.mkdirSync(fallbackDir, { recursive: true });

    // 1x1 PNG
    const png = Buffer.from(
      "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==",
      "base64"
    );
    fs.writeFileSync(path.join(mediaDir, IMAGE_FILENAME), png);
    fs.writeFileSync(path.join(fallbackDir, "FallbackImage.png"), png);

    // Minimal M4A container (ftyp M4A) - magic bytes detect this as video/mp4,
    // so the importer must use the UTI/extension to map it to audio/mp4.
    const m4a = Buffer.from(
      "0000001c667479704d3441200000000000000000000000000000000000000000",
      "hex"
    );
    fs.writeFileSync(path.join(audioMediaDir, "recording.m4a"), m4a);

    const data = db.export();
    fs.writeFileSync(path.join(outDir, "NoteStore.sqlite"), Buffer.from(data));
    db.close();
    console.log("Wrote NoteStore.sqlite + media to", outDir);
  });
}

main();
