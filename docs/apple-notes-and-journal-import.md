# Importing from Apple Notes & Apple Journal

This document describes everything the Notesnook Importer supports (and does not support) when importing from **Apple Notes** and **Apple Journal** on macOS.

Both importers read the apps' native on-disk databases directly. There is no export step required, but the database lives inside a macOS container that is hidden by default and protected by the system.

---

## Before you start (both apps)

Both databases live under:

```
~/Library/Group Containers/
```

| App | Container folder | Main database |
| --- | --- | --- |
| Apple Notes | `group.com.apple.notes` | `NoteStore.sqlite` |
| Apple Journal | `group.com.apple.Journal` | `Journal.sqlite` |

> **macOS permissions.** Both folders are protected by macOS *TCC* (Transparency, Consent, and Control). To read them you must grant the Notesnook app (or the terminal/process importing the files) **Full Disk Access** in `System Settings → Privacy & Security → Full Disk Access`. Without it, the folder will appear empty or "Operation not permitted".

> **WAL mode.** Both databases use SQLite *WAL* (Write-Ahead Logging). Recent changes may still live in the `-wal` file rather than the main `.sqlite` file, so the importer collects the `-wal`/`-shm` sibling files alongside the main database and hands all three to the SQLite adapter. How the adapter treats them depends on the engine:
>
> - The built-in **sql.js** adapter (used in tests / standalone) can only read the main database — it does not replay WAL files. In that case, **fully quit** Apple Notes / Apple Journal before exporting so the WAL is checkpointed into the main `.sqlite` file.
> - Applications can supply their own adapter via `ProviderSettings.options.applenotes.adapter` / `applejournal.adapter`. The Notesnook app ships a **wa-sqlite** adapter that imports the database and its `-wal` file into IndexedDB and replays the WAL with exclusive locking — so users do not need to checkpoint the database manually.

> **File delivery.** The importer accepts individual files, or a `.zip` of the whole container folder. If you want attachments, the **entire container folder** (including `Accounts/`, `Media/`, `FallbackImages/`, `Documents/`, etc.) must be provided — attachments are resolved from the files you give it.

---

## Apple Notes (`NoteStore.sqlite`)

### How it works

- The importer opens `NoteStore.sqlite` (SQLite) and reads notes from the Core Data tables (`ZICCLOUDSYNCINGOBJECT`, `ZICNOTEDATA`, …).
- Each note body is stored as a **gzip-compressed protobuf** (`NoteStoreProto`). The importer decompresses and decodes it, then converts the rich-text runs into Notesnook HTML.
- Attachments are resolved against the files provided alongside the database (e.g. from a zip of the whole `group.com.apple.notes` folder).

### Supported file detection

| Property | Value |
| --- | --- |
| Provider id | `applenotes` |
| File extension | `.sqlite` |
| File name | `NoteStore.sqlite` |
| Example | `NoteStore.sqlite`, or `group.com.apple.notes.zip` |

### What is imported

| Feature | Supported | Notes |
| --- | --- | --- |
| Notes & note titles | ✅ | Title is taken from the first line of the note (or the stored title) |
| Created / edited dates | ✅ | Preserved exactly |
| Folders → notebooks | ✅ | Folder hierarchy is converted to nested notebooks. Smart folders & Recently Deleted are skipped |
| Multiple accounts | ✅ | When more than one account exists, top-level notebooks are prefixed with the account name |
| **Text formatting** | | |
| Bold, italic, bold+italic | ✅ | |
| Underline | ✅ | |
| Strikethrough | ✅ | |
| Superscript / subscript | ✅ | |
| Text color | ✅ | Converted to inline color |
| Highlights (emphasis colors) | ✅ | Converted to background-color highlights |
| Monospaced text | ✅ | Converted to code blocks (`<pre>`) |
| **Block styles** | | |
| Title / Heading / Subheading | ✅ | Converted to `h1` / `h2` / `h3` |
| Bullet lists (dashed/dotted) | ✅ | With nesting depth |
| Numbered lists | ✅ | With nesting depth |
| Checklists (todo) | ✅ | Converted to Notesnook checklists with checked state |
| Blockquotes | ✅ | |
| Text alignment (left/center/right/justify) | ✅ | |
| Soft line breaks (Shift+Return) | ✅ | |
| **Links & attachments** | | |
| External links | ✅ | |
| Internal note-to-note links | ✅ | Converted to Notesnook internal links (`nn://note/…`) |
| Images & file attachments | ✅ | Resolved from the provided files; embedded into the note |
| PDFs / documents | ✅ | |
| Voice recordings / audio | ✅ | Rendered as `<audio>` elements (MIME is taken from the attachment's UTI/extension, e.g. `audio/mp4` for `.m4a`) |
| Videos | ✅ | Imported as attachments |
| Tables | ✅ | CRDT-based tables are decoded into HTML tables |
| Scans (document scanner) | ✅ | Uses the scan preview/fallback images |
| Drawings / sketches | ✅ | Uses the rendered fallback image |
| Hashtags (`#tag`) & mentions (`@user`) | ✅ | Converted to their alt text |
| URL link cards | ✅ | Converted to a link |
| **Password-protected notes** | ✅ | Decrypted with the note password (prompted via `options.applenotes.getPassword`). Supports all three schemes: classic (columns), modern macOS 15+ (embedded plist body), and verifier-only (CloudKit record). Uses WebCrypto (PBKDF2-HMAC-SHA256 → AES key unwrap → AES-GCM); requires a secure context |

### What is NOT supported

| Feature | Reason |
| --- | --- |
| **Encrypted notes without a password** | Skipped (with a log) if no password is provided via `options.applenotes.getPassword` |
| **V2 (Keychain-keyed) notes** | Notes whose `metadata` carries an `accountKeyIdentifier` use an iCloud Keychain key and cannot be decrypted with the password alone |
| **Handwriting as ink** | Only the rendered fallback image of a drawing is imported, not the raw ink data |
| **Live Photos** | The "Live" photo component is not preserved |
| **WAL-only changes (sql.js adapter)** | With the built-in sql.js adapter, quit the app before exporting so the WAL is checkpointed. A WAL-capable adapter (e.g. wa-sqlite) reads `-wal` directly |
| **Trash / Smart folders** | Skipped (Notes in Recently Deleted and Smart Folders are not imported) |
| **Attachments missing from the provided files** | Only imported when the matching file is included in the upload |

### Password-protected note attachments

Attachments of a locked note are encrypted with the note's password, using the same scheme as the note body. When a password is provided, media files (`Media/<identifier>/…`) are decrypted on import and the correct file extension is restored from their contents (e.g. `public.jpeg` → `.jpeg`). Previews (`Previews/…/*.encrypted`) are ignored since the full-res media file is decrypted instead.

### Image display size

When an image has a preferred display size set ("small" via the right-click menu in Apple Notes), the importer sets `width="120"` on the `<img>` tag so the image renders at the smaller size rather than full width. Images with no preference or "large" are imported at full width.

---

## Apple Journal (`Journal.sqlite`)

> ⚠️ **Experimental.** The Apple Journal database schema is **undocumented and private** and can change between macOS releases. The importer uses adaptive schema detection rather than a fixed schema, which means it is more resilient — but it should be validated against your specific macOS version.

### How it works

- The importer opens the database and **discovers the schema automatically** (`sqlite_master` + `PRAGMA table_info`).
- It looks for an entries table (matching `ZJENTRY` or any table with a creation-date column).
- Entry text is read from text columns; if the body is stored as an **archived attributed string** (binary plist), the importer decodes it and extracts the text.
- Photos / media are matched from the container's `Documents/` folder using asset UUIDs and filenames referenced in the database.

### Supported file detection

| Property | Value |
| --- | --- |
| Provider id | `applejournal` |
| File extension | `.sqlite` |
| File name | Any name containing `journal` (e.g. `Journal.sqlite`) |
| Example | `Journal.sqlite`, or `group.com.apple.Journal.zip` |

### What is imported

| Feature | Supported | Notes |
| --- | --- | --- |
| Journal entries | ✅ | One note per entry |
| Entry title | ✅ | First line of the entry text |
| Created / edited dates | ✅ | Preserved exactly |
| Entry text | ✅ | Plain text (paragraphs, line breaks) |
| Photos & media | ✅ | Matched by UUID / filename from the `Documents/` folder |

### What is NOT supported

| Feature | Reason |
| --- | --- |
| **Rich text formatting** | Journal entries are imported as plain text; inline formatting (if any) is not preserved |
| **Mood / state of mind** | The mood field is not imported |
| **Weather** | Not imported |
| **Activity / workout / music / map assets** | Only file-based media (photos/videos) is imported; embedded content types are dropped |
| **WAL-only changes** | See the "WAL mode" note above — quit the app before exporting |
| **Schema stability** | The schema is undocumented; if Apple changes it, some entries may not import until the importer is updated |

---

## Common notes

- **Attachment hashing.** All attachments are de-duplicated by hash before being written, so the same image used in many notes is only stored once.
- **Zips are unpacked automatically.** If you provide a `.zip` of the container folder, the importer unpacks it internally and resolves attachments from the extracted files.
- **Missing files are skipped gracefully.** If an attachment file is not part of the upload, the note still imports — the attachment is simply omitted.
- **Errors are non-fatal.** A note that fails to parse (e.g. a password-protected note) is reported in the import log while the rest continue.

## Related

- Help pages: [import-notes-from-apple-notes](https://help.notesnook.com/importing-notes/import-notes-from-apple-notes) and [import-notes-from-apple-journal](https://help.notesnook.com/importing-notes/import-notes-from-apple-journal)
