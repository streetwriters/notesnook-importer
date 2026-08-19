# @notesnook-importer/onenote

Microsoft OneNote `.one` / `.onetoc2` / `.onepkg` parser and HTML converter. Reads OneNote files directly — no OneNote installation or export step required. Implemented as a from-scratch parser for the OneNote desktop file format (`[MS-ONESTORE]` / `[MS-ONE]`) with an HTML converter modeled after [`one2html`](https://github.com/msiemens/one2html).

Part of the [Notesnook Importer](https://github.com/streetwriters/notesnook-importer) monorepo.

## Install

```bash
npm install @notesnook-importer/onenote
```

Requires `@notesnook-importer/core` (peer dependency for HTML element types).

## Supported file formats

| Format | Notes |
| --- | --- |
| `.one` | OneNote sections (OneNote 2016 / 2019 / LTSC desktop format). |
| `.onetoc2` | Notebook tables of contents. Used to build the notebook hierarchy. |
| `.onepkg` | OneNote package (CAB archive containing a notebook). Supports uncompressed, MSZIP and LZX/LZXD compression. |

> **Not supported:** files in the *FSSHTTPB packaging format* (OneDrive web UI downloads), the legacy OneNote 2007 format, and encrypted sections without a password.

## Getting OneNote files

| Source | How to get the files |
| --- | --- |
| OneNote desktop (2016, 2019, LTSC) | Export as a `.onepkg` package via *File → Export → Notebook → OneNote Package*, or select files/folders directly. |
| OneDrive | Download the notebook folder from OneDrive (contains `.onetoc2` + `.one` section files). |
| OneNote for Windows 10/11 | Export each section as a `.one` file via *Settings → Export*. |

Zip archives containing any of the above are unpacked automatically.

> **Keep the folder structure.** A `.onetoc2` file only imports the `.one` files in the same directory (and subdirectories for section groups).

## What it does

- Parses `.onetoc2` notebooks to resolve section ordering and section groups
- Section groups become nested folders; each page becomes a note
- Converts page content to Notesnook HTML, preserving visual layout (positioning, indentation, sizes)

### Notebook structure

- Notebooks (`.onetoc2`) and their section ordering
- Section groups, including nested groups, imported as nested notebooks
- Standalone sections (`.one` files without a notebook)

### Pages

- Page titles (including title formatting and `HYPERLINK` marker cleanup)
- Created & last modified dates, author, and page level (sub-pages)
- Pages with no title fall back to `Untitled Page N`; empty pages are skipped

### Text & formatting

- Rich text paragraphs with per-character text runs
- Bold, italic, underline, strikethrough, superscript, subscript
- Font family, font size, font color, text highlight color
- Paragraph alignment (left/center/right) and spacing
- Hyperlinks — both the hidden `\uFDDF HYPERLINK` marker format and plain `http(s)://` text

### Lists & note tags

- Numbered lists (decimal, upper/lower roman, upper/lower latin) and bulleted lists
- List restart values, bullet fonts/colors, Wingdings bullet fixes
- Note tags & to-do checkboxes: 30+ checkable shapes render as checkbox icons
- Other tag icons (star, question mark, priority, contact, light bulb, etc.)
- Note tag label highlight/text colors applied to content

### Tables

- Tables with row/column counts, column widths, locked columns, visible borders
- Cell background colors and cell contents (including nested lists and note tags)

### Images & attachments

- Embedded images extracted and imported as attachments (with OCR alt text and width/height constraints)
- Embedded files (documents, audio, video) imported as attachments with original file names

### Ink (handwriting)

- Handwritten ink rendered as inline SVG strokes, preserving stroke color, width, pen tip style, and page position
- Ink embedded inside text paragraphs (inline handwriting, spaces, line breaks)

### Encrypted sections

Password-protected sections are fully supported via [MS-OFFCRYPTO] Agile Encryption (AES-256-CBC with SHA-512 key derivation).

**Providing a password — Provider API:**

```ts
settings.options = {
  onenote: {
    getPassword: async (filename) => {
      return passwords[filename];
    }
  }
};
```

**Providing a password — Direct API:**

```ts
const section = await parseOneNoteSection(bytes, "My Section", "s3cret");
const notebook = await parseOneNoteNotebook(tocBytes, resolveFile, "s3cret");
```

## Not supported

- **FSSHTTPB/OneDrive packaging format** — files downloaded via the OneDrive web UI in "package" format
- **OneNote 2007 (or earlier) legacy format** and alternative packaging
- **Encrypted sections without a password** — skipped with a warning; provide a password to decrypt
- **Math/equation formatting** — imported as plain text
- **Ink handwriting recognition (OCR) text** — recognized text is parsed but not added to the note
- **Audio/video recordings** — imported as attachment only when embedded; external `onefiles` references are skipped
- **Version history & conflict pages** — only the current revision is imported
- **Section/notebook colors** — read but not applied to notes yet

## Usage

```ts
import {
  parseOneNoteSection,
  parseOneNoteNotebook,
  parseOneNoteNotebookToc,
  extractOnepkg,
  isOnepkg,
  renderPage,
  sniffOneNoteFileType,
  OneNoteEncryptedError
} from "@notesnook-importer/onenote";
```

## License

GPL-3.0-or-later
