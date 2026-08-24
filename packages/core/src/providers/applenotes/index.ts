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

import { gunzipSync } from "fflate";
import { ContentType, Note, Notebook } from "../../models/note";
import { Attachment, attachmentToHTML } from "../../models/attachment";
import { File } from "../../utils/file";
import { path } from "../../utils/path";
import { createObjectId } from "../../utils/object-id";
import {
  detectFileType,
  mimeFromExtension,
  mimeFromUti
} from "../../utils/file-type";
import { SqlDatabase } from "../../utils/sqlite-adapter";
import { defaultSqliteAdapter } from "../../utils/sql-js";
import { IHasher } from "../../utils/hasher";
import { unpackKeyedArchive, decodeBplist } from "../../utils/bplist";
import {
  AppleNotesCryptoData,
  decryptAppleNotes,
  ANAccount,
  ANAttachment,
  ANAttributeRun,
  ANContext,
  ANConverter,
  ANConverterType,
  ANFolderType,
  ANStyleType,
  NoteConverter,
  TableConverter,
  ScanConverter,
  getProtobufRoot,
  firstLine,
  noteTitle,
  Type
} from "@notesnook-importer/applenotes";
import {
  IFileProvider,
  ProviderMessage,
  ProviderSettings,
  error,
  log
} from "../provider";
import { Providers } from "../provider-factory";

const CORETIME_OFFSET = 978307200;
const URL_LINE = /^https?:\/\/\S+$/;

interface NoteRow {
  Z_PK: number;
  ZFOLDER: number | null;
  ZTITLE1: string;
  ZIDENTIFIER: string | null;
  ZCREATIONDATE1?: number;
  ZCREATIONDATE2?: number;
  ZCREATIONDATE3?: number;
  ZMODIFICATIONDATE1?: number;
  ZISPASSWORDPROTECTED?: number;
  zdata: string | null;
}

interface FolderRow {
  Z_PK: number;
  ZTITLE2: string;
  ZPARENT: number | null;
  ZFOLDERTYPE: number;
  ZOWNER: number;
}

interface AccountRow {
  Z_PK: number;
  ZNAME: string;
  ZIDENTIFIER: string;
}

type DecodedNote = {
  row: NoteRow;
  text: string;
  runs: ANAttributeRun[];
  title: string;
  id: string;
  account: ANAccount | undefined;
  notebook: Notebook | undefined;
  dateCreated: number;
  dateEdited: number;
  password?: string;
};

export class AppleNotes implements IFileProvider<never> {
  id: Providers = "applenotes";
  type = "file" as const;
  supportedExtensions = [".sqlite"];
  examples = ["NoteStore.sqlite"];
  version = "1.0.0";
  name = "Apple Notes";
  helpLink =
    "https://help.notesnook.com/importing-notes/import-notes-from-apple-notes";

  filter(file: File) {
    return file.extension === ".sqlite" && file.name === "NoteStore.sqlite";
  }

  async *process(
    file: File,
    settings: ProviderSettings,
    files: File[]
  ): AsyncGenerator<ProviderMessage, void, unknown> {
    let db: SqlDatabase;
    try {
      const adapter =
        settings.options?.applenotes?.adapter ?? defaultSqliteAdapter;
      db = await adapter.open({
        main: file.stream,
        wal: findSibling(file, files, "-wal")?.stream,
        shm: findSibling(file, files, "-shm")?.stream
      });
    } catch (e) {
      yield error(e, { file });
      return;
    }

    try {
      const decoded = await this.readNotes(db, files, settings);
      if (decoded.length === 0) {
        yield log("No notes found in the Apple Notes database.");
        return;
      }

      const noteIds: Record<string, string> = {};
      for (const note of decoded) {
        if (note.row.ZIDENTIFIER)
          noteIds[note.row.ZIDENTIFIER.toUpperCase()] = note.id;
      }

      for (const note of decoded) {
        try {
          const context = new AppleNotesContext(
            db,
            noteIds,
            files,
            settings.hasher,
            note.account,
            note.password
          );

          const converter = new NoteConverter(
            context,
            {
              attributeRun: note.runs,
              noteText: note.text
            },
            this.shouldOmitFirstLine(note)
          );

          const noteData: Note = {
            id: note.id,
            title: note.title,
            dateCreated: note.dateCreated,
            dateEdited: note.dateEdited,
            notebooks: note.notebook ? [note.notebook] : [],
            attachments: context.attachments,
            content: {
              type: ContentType.HTML,
              data: await converter.format()
            }
          };

          yield { type: "note", note: noteData };
        } catch (e) {
          yield error(e, { note: { title: note.title } });
        }
      }
    } finally {
      db.close();
    }
  }

  private shouldOmitFirstLine(note: DecodedNote): boolean {
    if (!note.text.includes("\n")) return false;
    const first = firstLine(note.text);
    if (!first || URL_LINE.test(first)) return false;

    // Only omit the first line when it is the note title (a Title styled
    // heading or the same as the stored title). Otherwise the first line is
    // real content and must stay in the note body.
    const firstRunStyle = note.runs[0]?.paragraphStyle?.styleType;
    if (firstRunStyle === ANStyleType.Title) return true;
    return first === note.title;
  }

  private async readNotes(
    db: SqlDatabase,
    files: File[],
    settings: ProviderSettings
  ): Promise<DecodedNote[]> {
    const keys = await this.getEntityKeys(db);
    const accounts = await this.getAccounts(db, keys);
    const folders = await this.getFolders(db, keys);
    const notebookByFolder = this.buildNotebooks(folders, accounts);

    const noteColumns = await this.availableColumns(
      db,
      "ziccloudsyncingobject"
    );
    const select = [
      "zcso.z_pk",
      "zcso.zfolder",
      "zcso.ztitle1",
      "zcso.zidentifier",
      ...(noteColumns.includes("zcreationdate1")
        ? ["zcso.zcreationdate1"]
        : []),
      ...(noteColumns.includes("zcreationdate2")
        ? ["zcso.zcreationdate2"]
        : []),
      ...(noteColumns.includes("zcreationdate3")
        ? ["zcso.zcreationdate3"]
        : []),
      ...(noteColumns.includes("zmodificationdate1")
        ? ["zcso.zmodificationdate1"]
        : []),
      ...(noteColumns.includes("zispasswordprotected")
        ? ["zcso.zispasswordprotected"]
        : []),
      "hex(nd.zdata) AS zdata"
    ].join(", ");

    const rows = await db.all<NoteRow>(
      `SELECT ${select}
       FROM ziccloudsyncingobject AS zcso
       LEFT JOIN zicnotedata AS nd ON nd.znote = zcso.z_pk
       WHERE zcso.z_ent = ${keys.ICNote} AND zcso.ztitle1 IS NOT NULL`
    );

    const decoded: DecodedNote[] = [];

    outer: for (const row of rows) {
      if (!row.zdata) continue;

      let body: string | Uint8Array = row.zdata;
      let notePassword: string | undefined;

      if (row.ZISPASSWORDPROTECTED) {
        const cryptoData = await this.getCryptoData(db, row.Z_PK, row.zdata);
        if (!cryptoData) {
          settings.log?.(
            log(`Could not find encryption metadata for note "${row.ZTITLE1}".`)
          );
          continue;
        }

        while (typeof body === "string") {
          const password = await settings.options?.applenotes?.getPassword?.(
            row.ZTITLE1 || "Encrypted note"
          );
          if (!password) {
            settings.log?.(
              log(
                `Skipping password protected note "${row.ZTITLE1}" (no password provided).`
              )
            );
            continue outer;
          }

          try {
            body = await decryptAppleNotes(password, cryptoData);
            // Locked notes encrypt their attachments too — the password is
            // needed to decrypt the media files.
            notePassword = password;
          } catch (e) {
            settings.log?.(
              log(
                `Could not decrypt note "${row.ZTITLE1}": ${
                  (e instanceof Error ? e.message : String(e)) ||
                  "Wrong password."
                }`
              )
            );
          }
        }
      }

      const decodedBody = this.decodeData(body, "ciofecaforensics.Document");
      if (!decodedBody) continue;

      const { text, runs } = decodedBody;

      const account =
        row.ZFOLDER !== null
          ? accountsByOwner(accounts, folders, row.ZFOLDER)
          : undefined;
      const dateCreated = this.decodeTime(
        row.ZCREATIONDATE3 || row.ZCREATIONDATE2 || row.ZCREATIONDATE1
      );
      const dateEdited = this.decodeTime(row.ZMODIFICATIONDATE1);

      const id = createObjectId(dateCreated);
      decoded.push({
        row,
        text,
        runs,
        title: noteTitle(text, row.ZTITLE1 || ""),
        id,
        account,
        notebook:
          row.ZFOLDER !== null ? notebookByFolder.get(row.ZFOLDER) : undefined,
        dateCreated,
        dateEdited,
        password: notePassword
      });
    }

    return decoded;
  }

  private async getEntityKeys(
    db: SqlDatabase
  ): Promise<Record<string, number>> {
    const keys = await db.all<{ Z_ENT: number; Z_NAME: string }>(
      "SELECT z_ent, z_name FROM z_primarykey"
    );
    return Object.fromEntries(keys.map((k) => [k.Z_NAME, k.Z_ENT]));
  }

  private async getAccounts(
    db: SqlDatabase,
    keys: Record<string, number>
  ): Promise<AccountRow[]> {
    return await db.all<AccountRow>(
      "SELECT z_pk, zname, zidentifier FROM ziccloudsyncingobject WHERE z_ent = ?",
      [keys.ICAccount]
    );
  }

  private async getFolders(
    db: SqlDatabase,
    keys: Record<string, number>
  ): Promise<FolderRow[]> {
    return await db.all<FolderRow>(
      "SELECT z_pk, ztitle2, zparent, zfoldertype, zowner FROM ziccloudsyncingobject WHERE z_ent = ? AND ztitle2 IS NOT NULL",
      [keys.ICFolder]
    );
  }

  private buildNotebooks(
    folders: FolderRow[],
    accounts: AccountRow[]
  ): Map<number, Notebook> {
    const nodes = new Map<number, Notebook>();
    const parentOf = new Map<number, number | null>();
    const owners = new Map<number, number>();
    const filtered = folders.filter(
      (folder) =>
        folder.ZFOLDERTYPE !== ANFolderType.Smart &&
        folder.ZFOLDERTYPE !== ANFolderType.Trash
    );

    for (const folder of filtered) {
      nodes.set(folder.Z_PK, { title: folder.ZTITLE2, children: [] });
      parentOf.set(folder.Z_PK, folder.ZPARENT);
      owners.set(folder.Z_PK, folder.ZOWNER);
    }

    const singleAccount = accounts.length <= 1;

    const notebookFor = (
      folderPk: number,
      seen = new Set<number>()
    ): Notebook => {
      const title = nodes.get(folderPk)!.title;
      const parent = parentOf.get(folderPk);
      if (parent === null || parent === undefined || seen.has(parent)) {
        return { title, children: [] };
      }
      seen.add(folderPk);
      const parentNotebook = notebookFor(parent, seen);
      parentNotebook.children = [{ title, children: [] }];
      return parentNotebook;
    };

    const result = new Map<number, Notebook>();
    for (const folder of filtered) {
      let notebook = notebookFor(folder.Z_PK);

      if (!singleAccount) {
        const account = accounts.find(
          (a) => a.Z_PK === owners.get(folder.Z_PK)
        );
        if (account && !folderHasAncestor(folder.Z_PK, parentOf)) {
          notebook = { title: account.ZNAME, children: [notebook] };
        }
      }

      result.set(folder.Z_PK, notebook);
    }
    return result;
  }

  private async availableColumns(
    db: SqlDatabase,
    table: string
  ): Promise<string[]> {
    const cols = await db.all<{ name: string }>(`PRAGMA table_info(${table})`);
    return cols.map((col) => col.name.toLowerCase());
  }

  private async rawColumns(db: SqlDatabase, table: string): Promise<string[]> {
    const cols = await db.all<{ name: string }>(`PRAGMA table_info(${table})`);
    return cols.map((col) => col.name);
  }

  private async getCryptoData(
    db: SqlDatabase,
    pk: number,
    zdata: string
  ): Promise<AppleNotesCryptoData | null> {
    // Modern notes (macOS 15+ / iOS 17+) embed all crypto parameters in the
    // note body itself, so try that first.
    const modern = parseModernNoteBody(hexToBytes(zdata));
    if (modern) return modern;

    const objectsColumns = await this.rawColumns(db, "ziccloudsyncingobject");
    const noteColumns = await this.rawColumns(db, "zicnotedata");
    // Resolve the exact (case-preserving) column name; SQLite can be
    // case-sensitive when resolving some identifiers, so we always match the
    // stored spelling.
    const col = (columns: string[], name: string) =>
      columns.find((c) => c.toLowerCase() === name);

    const saltCol = col(objectsColumns, "zcryptosalt");
    const iterationsCol = col(objectsColumns, "zcryptoiterationcount");
    const wrappedKeyCol = col(objectsColumns, "zcryptowrappedkey");
    const ivCol =
      col(objectsColumns, "zcryptoinitializationvector") ||
      col(noteColumns, "zcryptoinitializationvector");
    const tagCol =
      col(objectsColumns, "zcryptotag") || col(noteColumns, "zcryptotag");
    const unappliedCol =
      col(objectsColumns, "zunappliedencryptedrecorddata") ||
      col(objectsColumns, "zunappliedencryptedrecord");

    const selectBlob = (column: string, alias: string) =>
      `hex(ziccloudsyncingobject.${column}) AS ${alias}`;

    const row = await db.get<{
      salt?: string;
      iterations?: number;
      wrappedKey?: string;
      iv?: string;
      tag?: string;
      unapplied?: Uint8Array | null;
    }>(
      `SELECT
        ${saltCol ? selectBlob(saltCol, "salt") : "NULL AS salt"},
        ${iterationsCol ? `ziccloudsyncingobject.${iterationsCol} AS iterations` : "NULL AS iterations"},
        ${wrappedKeyCol ? selectBlob(wrappedKeyCol, "wrappedKey") : "NULL AS wrappedKey"},
        ${ivCol ? selectBlob(ivCol, "iv") : "NULL AS iv"},
        ${tagCol ? selectBlob(tagCol, "tag") : "NULL AS tag"},
        ${unappliedCol ? `ziccloudsyncingobject.${unappliedCol} AS unapplied` : "NULL AS unapplied"}
       FROM ziccloudsyncingobject
       LEFT JOIN zicnotedata ON zicnotedata.znote = ziccloudsyncingobject.z_pk
       WHERE ziccloudsyncingobject.z_pk = ?`,
      [pk]
    );

    if (!row) return null;

    const ciphertext = hexToBytes(zdata);

    // Primary path: the wrapped key is stored directly.
    if (row.salt && row.wrappedKey && row.iv && row.tag && row.iterations) {
      return {
        salt: hexToBytes(row.salt),
        iterations: row.iterations,
        wrappedKey: hexToBytes(row.wrappedKey),
        iv: hexToBytes(row.iv),
        tag: hexToBytes(row.tag),
        ciphertext
      };
    }

    // Fallback: verifier-only notes keep the real key material in the CloudKit
    // record (ZUNAPPLIEDENCRYPTEDRECORD), serialized as an NSKeyedArchiver.
    if (!row.unapplied) return null;

    const crypto = extractCloudKitCrypto(row.unapplied);
    if (
      !crypto ||
      !row.salt ||
      !row.iv ||
      !row.tag ||
      typeof row.iterations !== "number"
    ) {
      return null;
    }

    return {
      salt: hexToBytes(row.salt),
      iterations: row.iterations,
      wrappedKey: crypto.wrappedKey,
      iv: hexToBytes(row.iv),
      tag: hexToBytes(row.tag),
      ciphertext
    };
  }

  private decodeData(
    zdata: string | Uint8Array,
    protobufType: string
  ): { text: string; runs: ANAttributeRun[] } | null {
    const root = getProtobufRoot();
    const bytes = gunzipSync(
      typeof zdata === "string" ? hexToBytes(zdata) : zdata
    );

    const decode = (typeName: string): any | null => {
      try {
        const type = root.lookupType(typeName) as Type;
        const decoded = type.decode(bytes);
        return (decoded as any).note || (decoded as any).document?.note || null;
      } catch {
        return null;
      }
    };

    let note = decode(protobufType);
    if (!note && protobufType === "ciofecaforensics.Document") {
      // Some macOS versions wrap the note body in a NoteStoreProto instead of
      // a bare Document message.
      note = decode("ciofecaforensics.NoteStoreProto");
    }
    if (!note) return null;

    return {
      text: (note.noteText as string) || "",
      runs: (note.attributeRun || []) as ANAttributeRun[]
    };
  }

  private decodeTime(timestamp: number | undefined): number {
    if (!timestamp || timestamp < 1) return Date.now();
    return Math.floor((timestamp + CORETIME_OFFSET) * 1000);
  }
}

function accountsByOwner(
  accounts: AccountRow[],
  folders: FolderRow[],
  folderPk: number
): ANAccount | undefined {
  const seen = new Set<number>();
  let current = folderPk;
  while (current !== null && !seen.has(current)) {
    seen.add(current);
    const folder = folders.find((f) => f.Z_PK === current);
    if (!folder) return undefined;
    const account = accounts.find((a) => a.Z_PK === folder.ZOWNER);
    if (account)
      return { name: account.ZNAME, uuid: account.ZIDENTIFIER, path: "" };
    current = folder.ZPARENT ?? -1;
  }
  return undefined;
}

class AppleNotesContext implements ANContext {
  noteIds: Record<string, string>;
  attachments: Attachment[] = [];

  constructor(
    readonly database: SqlDatabase,
    noteIds: Record<string, string>,
    private readonly files: File[],
    private readonly hasher: IHasher,
    private readonly account: ANAccount | undefined,
    private readonly password?: string
  ) {
    this.noteIds = noteIds;
  }

  decodeData<T extends ANConverter>(
    hexdata: string,
    converterType: ANConverterType<T>
  ): T {
    const root = getProtobufRoot();
    const type = root.lookupType(converterType.protobufType) as Type;
    const decoded = type.decode(gunzipSync(hexToBytes(hexdata)));
    return new converterType(this, decoded);
  }

  async formatAttachment(attr: ANAttributeRun): Promise<string> {
    const info = attr.attachmentInfo;
    if (!info) return "";

    switch (info.typeUti) {
      case ANAttachment.Hashtag:
      case ANAttachment.Mention: {
        const row = await this.database.get<{ ZALTTEXT: string }>(
          "SELECT zalttext FROM ziccloudsyncingobject WHERE zidentifier = ?",
          [info.attachmentIdentifier]
        );
        return row?.ZALTTEXT || "";
      }

      case ANAttachment.InternalLink: {
        const row = await this.database.get<{
          ZTOKENCONTENTIDENTIFIER: string;
        }>(
          "SELECT ztokencontentidentifier FROM ziccloudsyncingobject WHERE zidentifier = ?",
          [info.attachmentIdentifier]
        );
        if (!row?.ZTOKENCONTENTIDENTIFIER) return "";
        const id = this.noteIds[row.ZTOKENCONTENTIDENTIFIER.toUpperCase()];
        if (!id) return "";
        const target = await this.database.get<{ ZTITLE1: string }>(
          "SELECT ztitle1 FROM ziccloudsyncingobject WHERE zidentifier = ?",
          [row.ZTOKENCONTENTIDENTIFIER]
        );
        return `<a href="nn://note/${id}">${target?.ZTITLE1 || ""}</a>`;
      }

      case ANAttachment.Table: {
        const row = await this.database.get<{ zdata: string }>(
          "SELECT hex(zmergeabledata1) AS zdata FROM ziccloudsyncingobject WHERE zidentifier = ?",
          [info.attachmentIdentifier]
        );
        if (!row?.zdata) return "";
        const converter = this.decodeData(row.zdata, TableConverter);
        return await converter.format();
      }

      case ANAttachment.UrlCard: {
        const row = await this.database.get<{
          ZTITLE: string;
          ZURLSTRING: string;
        }>(
          "SELECT ztitle, zurlstring FROM ziccloudsyncingobject WHERE zidentifier = ?",
          [info.attachmentIdentifier]
        );
        if (!row?.ZURLSTRING) return "";
        return `<a href="${row.ZURLSTRING}">${row.ZTITLE || row.ZURLSTRING}</a>`;
      }

      case ANAttachment.Scan:
      case ANAttachment.ModifiedScan: {
        const row = await this.database.get<{ zdata: string }>(
          "SELECT hex(zmergeabledata1) AS zdata FROM ziccloudsyncingobject WHERE zidentifier = ?",
          [info.attachmentIdentifier]
        );
        if (!row?.zdata) return "";
        const converter = this.decodeData(row.zdata, ScanConverter);
        return await converter.format();
      }

      case ANAttachment.Drawing:
      case ANAttachment.DrawingLegacy:
      case ANAttachment.DrawingLegacy2: {
        const row = await this.database.get<{ Z_PK: number }>(
          "SELECT z_pk FROM ziccloudsyncingobject WHERE zidentifier = ?",
          [info.attachmentIdentifier]
        );
        if (!row) return "";
        return (await this.resolveAttachment(row.Z_PK, info.typeUti)) || "";
      }

      default: {
        const row = await this.database.get<{ ZMEDIA: number }>(
          "SELECT zmedia FROM ziccloudsyncingobject WHERE zidentifier = ?",
          [info.attachmentIdentifier]
        );
        if (!row?.ZMEDIA) return "";
        return (
          (await this.resolveAttachment(row.ZMEDIA, info.typeUti as string)) ||
          ""
        );
      }
    }
  }

  async resolveAttachment(
    id: number,
    uti: string,
    _hasFallback?: boolean
  ): Promise<string | null> {
    let sourcePath: string | undefined;
    let filename: string | undefined;

    switch (uti) {
      case ANAttachment.ModifiedScan: {
        const row = await this.database.get<{
          ZIDENTIFIER: string;
          ZFALLBACKPDFGENERATION: string;
        }>(
          "SELECT zidentifier, zfallbackpdfgeneration FROM ziccloudsyncingobject WHERE z_pk = ?",
          [id]
        );
        if (!row) return null;
        sourcePath = `FallbackPDFs/${row.ZIDENTIFIER}/${row.ZFALLBACKPDFGENERATION || ""}/FallbackPDF.pdf`;
        filename = "Scan.pdf";
        break;
      }

      case ANAttachment.Scan: {
        const row = await this.database.get<{
          ZIDENTIFIER: string;
          ZSIZEWIDTH: number;
          ZSIZEHEIGHT: number;
        }>(
          "SELECT zidentifier, zsizewidth, zsizeheight FROM ziccloudsyncingobject WHERE z_pk = ?",
          [id]
        );
        if (!row) return null;
        sourcePath = `Previews/${row.ZIDENTIFIER}-1-${row.ZSIZEWIDTH}x${row.ZSIZEHEIGHT}-0.jpeg`;
        filename = "Scan.jpeg";
        break;
      }

      case ANAttachment.Drawing:
      case ANAttachment.DrawingLegacy:
      case ANAttachment.DrawingLegacy2: {
        const row = await this.database.get<{
          ZIDENTIFIER: string;
          ZFALLBACKIMAGEGENERATION: string;
        }>(
          "SELECT zidentifier, zfallbackimagegeneration FROM ziccloudsyncingobject WHERE z_pk = ?",
          [id]
        );
        if (!row) return null;
        sourcePath = row.ZFALLBACKIMAGEGENERATION
          ? `FallbackImages/${row.ZIDENTIFIER}/${row.ZFALLBACKIMAGEGENERATION}/FallbackImage.png`
          : `FallbackImages/${row.ZIDENTIFIER}.jpg`;
        filename = "Drawing.png";
        break;
      }

      default: {
        const row = await this.database.get<{
          ZIDENTIFIER: string;
          ZFILENAME: string;
          ZGENERATION1: string;
        }>(
          "SELECT zidentifier, zfilename, zgeneration1 FROM ziccloudsyncingobject WHERE z_pk = ?",
          [id]
        );
        if (!row?.ZIDENTIFIER) return null;
        // Encrypted media (attachments of a locked note) store the file under
        // the media identifier and leave `zfilename` empty.
        const mediaFilename = row.ZFILENAME || row.ZIDENTIFIER;
        sourcePath = `Media/${row.ZIDENTIFIER}/${row.ZGENERATION1 || ""}/${mediaFilename}`;
        filename = mediaFilename;
        break;
      }
    }

    if (!sourcePath) return null;

    let file = this.findFile(sourcePath);
    if (!file) {
      // Bundles (e.g. `.app`) are stored as zips on disk — `zfilename` is the
      // bundle name (`foo.app`) but the actual file is `foo.app.zip`.
      const zipped = this.findFile(sourcePath + ".zip");
      if (zipped) {
        file = zipped;
        filename = zipped.name;
      }
    }
    if (!file) return null;

    let bytes = await file.bytes();
    if (!bytes) return null;

    // Attachments of a locked note are stored as encrypted bodies (the same
    // NSKeyedArchiver scheme as the note itself) — decrypt them with the
    // note's password.
    if (this.password) {
      const decrypted = await this.decryptEncryptedBody(bytes);
      if (decrypted) {
        bytes = decrypted;
        // Encrypted media are stored without an extension — name them after
        // what they actually contain.
        if (!path.extname(filename) && !filename.includes(".")) {
          const type = detectFileType(bytes);
          if (type?.ext) filename += "." + type.ext;
        }
      }
    }

    const dataHash = await this.hasher.hash(bytes);
    const magicType = detectFileType(bytes);

    // Decode the preferred display width from the attachment's
    // ZMERGEABLEPREFERREDVIEWSIZE (a WallClockMergeableValue protobuf).
    let displayWidth: number | undefined;
    try {
      const pvsRow = await this.database.get<{
        ZMERGEABLEPREFERREDVIEWSIZE: Uint8Array;
      }>(
        "SELECT zmergeablepreferredviewsize FROM ziccloudsyncingobject WHERE zmedia = ?",
        [id]
      );
      displayWidth = decodePreferredViewSize(
        pvsRow?.ZMERGEABLEPREFERREDVIEWSIZE
      );
    } catch {
      // Column may not exist in older databases.
    }

    const attachment: Attachment = {
      data: bytes,
      filename,
      size: bytes.byteLength,
      hash: dataHash,
      hashType: this.hasher.type,
      mime:
        mimeFromUti(uti) ||
        mimeFromExtension(filename) ||
        magicType?.mime ||
        "application/octet-stream",
      ...(displayWidth !== undefined ? { width: displayWidth } : {})
    };
    this.attachments.push(attachment);

    return attachmentToHTML(attachment);
  }

  private async decryptEncryptedBody(
    bytes: Uint8Array
  ): Promise<Uint8Array | null> {
    if (bytes.length < 8) return null;
    if (String.fromCharCode(...bytes.slice(0, 8)) !== "bplist00") return null;

    const cryptoData = parseModernNoteBody(bytes);
    if (!cryptoData) return null;

    try {
      return await decryptAppleNotes(this.password!, cryptoData);
    } catch {
      return null;
    }
  }

  private findFile(sourcePath: string): File | undefined {
    const candidates = [sourcePath];
    if (this.account?.uuid) {
      candidates.push(`Accounts/${this.account.uuid}/${sourcePath}`);
    }

    const matches = (path: string) =>
      candidates.some((c) => path === c || path.endsWith("/" + c));

    // Directory/zero-byte entries (e.g. the folder of a `.zip`-stored bundle)
    // must never win over the real file — they have no content.
    const isReal = (file: File) => file.size > 0;

    const byPath = this.files.find(
      (file) => !!file.path && matches(file.path!) && isReal(file)
    );
    if (byPath) return byPath;

    // When files are dropped without relative paths (e.g. from a browser file
    // picker), fall back to matching the file name.
    const filename = sourcePath.split("/").pop();
    return filename
      ? this.files.find((file) => file.name === filename && isReal(file))
      : undefined;
  }
}

function folderHasAncestor(
  folderPk: number,
  parentOf: Map<number, number | null>
): boolean {
  const parent = parentOf.get(folderPk);
  if (parent === null || parent === undefined) return false;
  return true;
}

// ── Preferred view size ─────────────────────────────────────────────────────
// ZMERGEABLEPREFERREDVIEWSIZE is a WallClockMergeableValue protobuf:
//   field 1 (fixed64) = timestamp
//   field 2 (bytes)   = BoxedValue { oneof { integer_value = 1; ... } }
// value 0 = large (full width), value 2 = small (~120 pt).

function readVarint(buf: Uint8Array, pos: number): [number, number] {
  let result = 0;
  let shift = 0;
  while (pos < buf.length) {
    const b = buf[pos++];
    result |= (b & 0x7f) << shift;
    if (!(b & 0x80)) break;
    shift += 7;
  }
  return [result, pos];
}

function decodePreferredViewSize(
  blob: Uint8Array | null | undefined
): number | undefined {
  if (!blob || blob.length < 11) return undefined;

  let i = 0;

  // field 1: fixed64 timestamp (tag + 8 bytes)
  const [tag1, after1] = readVarint(blob, i);
  if (tag1 >> 3 !== 1 || (tag1 & 7) !== 1) return undefined;
  i = after1 + 8;
  if (i >= blob.length) return undefined;

  // field 2: length-delimited BoxedValue
  const [tag2, after2] = readVarint(blob, i);
  if (tag2 >> 3 !== 2 || (tag2 & 7) !== 2) return undefined;
  i = after2;
  const [len, afterLen] = readVarint(blob, i);
  i = afterLen;
  const end = i + len;
  if (end > blob.length) return undefined;

  // BoxedValue: read field 1 (integer_value, varint)
  if (i >= end) return undefined;
  const [btag, bpos] = readVarint(blob, i);
  if (btag >> 3 !== 1 || (btag & 7) !== 0) return undefined;
  const [value] = readVarint(blob, bpos);

  // Apple Notes image sizes: 0 = large (full width), 2 = small
  if (value === 2) return 120;
  // value 0 or any other → no constraint (full width)
  return undefined;
}

/**
 * Parses the modern (macOS 15+ / iOS 17+) encryption body. The note's ZDATA is
 * an NSKeyedArchiver with:
 *   - wrappedEncryptionKey: RFC 3394 wrapped 32-byte content key
 *   - encryptedData: ciphertext + IV(32) + tag(16)
 *   - metadata: used as AES-GCM additional authenticated data
 *   - unauthenticatedMetadata: passphrase salt + iteration count + hint
 *
 * Returns crypto parameters, or null if ZDATA isn't a modern encrypted body.
 */
function parseModernNoteBody(zdata: Uint8Array): AppleNotesCryptoData | null {
  if (zdata.length < 8) return null;
  if (String.fromCharCode(...zdata.slice(0, 8)) !== "bplist00") return null;

  const unpacked = unpackKeyedArchive(zdata) as { root?: unknown } | null;
  if (!unpacked) return null;

  const root = unpacked.root as
    | {
        wrappedEncryptionKey?: unknown;
        encryptedData?: unknown;
        metadata?: unknown;
        unauthenticatedMetadata?: unknown;
      }
    | undefined;
  if (!root) return null;

  const wrappedKey = root.wrappedEncryptionKey;
  const encryptedData = root.encryptedData;
  const aad = root.metadata;
  const unauth = root.unauthenticatedMetadata;
  if (
    !(wrappedKey instanceof Uint8Array) ||
    !(encryptedData instanceof Uint8Array) ||
    !(aad instanceof Uint8Array) ||
    !(unauth instanceof Uint8Array)
  ) {
    return null;
  }

  const unauthData = decodeBplist(unauth) as {
    passphraseSalt?: unknown;
    passphraseIterationCount?: unknown;
  } | null;
  if (
    !unauthData ||
    !(unauthData.passphraseSalt instanceof Uint8Array) ||
    typeof unauthData.passphraseIterationCount !== "number"
  ) {
    return null;
  }

  // Layout: ciphertext + IV(32) + tag(16)
  const splitPoint = encryptedData.length - 48;
  if (splitPoint <= 0) return null;

  return {
    salt: unauthData.passphraseSalt,
    iterations: unauthData.passphraseIterationCount,
    wrappedKey,
    iv: encryptedData.slice(splitPoint, splitPoint + 32),
    tag: encryptedData.slice(splitPoint + 32),
    ciphertext: encryptedData.slice(0, splitPoint),
    aad
  };
}

/**
 * Extracts the encryption key material from Apple's CloudKit record
 * (ZUNAPPLIEDENCRYPTEDRECORD), which is an NSKeyedArchiver binary plist.
 * Verifier-only notes store `CryptoWrappedKey` here instead of in the
 * ZCRYPTOWRAPPEDKEY column.
 */
function extractCloudKitCrypto(
  archiveData: Uint8Array
): { wrappedKey: Uint8Array } | null {
  const unpacked = unpackKeyedArchive(archiveData);
  if (!unpacked || typeof unpacked !== "object") return null;

  const recordValues = (unpacked as any).root?.ValueStore?.RecordValues;
  if (!recordValues) return null;

  const keys = recordValues["NS.keys"] as unknown[];
  const values = recordValues["NS.objects"] as unknown[];
  if (!Array.isArray(keys) || !Array.isArray(values)) return null;

  const value = (name: string): unknown => {
    const index = keys.indexOf(name);
    return index >= 0 ? values[index] : undefined;
  };

  const toBytes = (v: unknown): Uint8Array | undefined => {
    if (v instanceof Uint8Array) return v;
    if (
      v &&
      typeof v === "object" &&
      (v as any)["NS.data"] instanceof Uint8Array
    ) {
      return (v as any)["NS.data"];
    }
    return undefined;
  };

  const wrappedKey = toBytes(value("CryptoWrappedKey"));
  if (!wrappedKey) return null;

  return { wrappedKey };
}

function findSibling(
  file: File,
  files: File[],
  suffix: string
): File | undefined {
  return files.find((f) => f.name === file.name + suffix);
}

function hexToBytes(hex: string): Uint8Array {
  const bytes = new Uint8Array(hex.length / 2);
  for (let i = 0; i < bytes.length; i++) {
    bytes[i] = parseInt(hex.substr(i * 2, 2), 16);
  }
  return bytes;
}
