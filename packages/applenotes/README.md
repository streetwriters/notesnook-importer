# @notesnook-importer/applenotes

Apple Notes parser and decryption library. Reads `NoteStore.sqlite` directly — no export step required — and converts note bodies (gzip-compressed protobuf), attachments, tables, scans, and encrypted notes into structured HTML.

Part of the [Notesnook Importer](https://github.com/streetwriters/notesnook-importer) monorepo.

## Install

```bash
npm install @notesnook-importer/applenotes
```

Requires `@notesnook-importer/core` (peer dependency for `SqlDatabase` and `Attachment` types).

## What it does

- Opens an Apple Notes SQLite database (`NoteStore.sqlite`)
- Decodes gzip-compressed `NoteStoreProto` protobuf blobs for each note body
- Converts `ANAttributeRun` rich-text spans to HTML (bold, italic, lists, checklists, headings, alignment, colors, etc.)
- Resolves attachments (images, files, voice recordings, PDFs, drawings) from the provided filesystem
- Decodes CRDT-based tables into HTML tables
- Handles document scans and drawing fallback images
- Decrypts password-protected notes (all three schemes: classic, modern macOS 15+, and CloudKit verifier-only)

## Usage

```typescript
import {
  getProtobufRoot,
  decryptAppleNotes,
  NoteConverter,
  type ANAccount,
  type ANContext
} from "@notesnook-importer/applenotes";
```

### Decryption

```typescript
import { decryptAppleNotes, type AppleNotesCryptoData } from "@notesnook-importer/applenotes";

const plaintext: Uint8Array = await decryptAppleNotes(password, {
  salt,
  iterations,
  wrappedKey,
  iv,
  tag,
  ciphertext,
  aad // optional — for modern notes with metadata plist
});
```

Uses WebCrypto (PBKDF2-HMAC-SHA256 → AES-KW → AES-GCM). Requires a secure context in browsers.

### Protobuf root

```typescript
import { getProtobufRoot } from "@notesnook-importer/applenotes";

const root = getProtobufRoot(); // protobufjs Root from the embedded NoteStoreProto descriptor
```

## Package structure

| File | Purpose |
|------|---------|
| `src/models.ts` | TypeScript types for Apple Notes protobuf messages (`ANNote`, `ANAttributeRun`, `ANParagraphStyle`, etc.) |
| `src/crypto.ts` | `decryptAppleNotes()` — PBKDF2 → AES-KW → AES-GCM decryption |
| `src/descriptor.ts` | Embedded NoteStoreProto protobuf descriptor |
| `src/convert-note.ts` | `NoteConverter` — converts a note's attribute runs to HTML |
| `src/convert-table.ts` | `TableConverter` — decodes CRDT mergeable data into HTML tables |
| `src/convert-scan.ts` | `ScanConverter` — handles document scan attachments |

## License

GPL-3.0-or-later
