# Importing from Microsoft OneNote

This document describes everything the Notesnook Importer supports (and does not support) when importing from **Microsoft OneNote**.

The importer reads OneNote files directly — no OneNote installation or export step is required. It is implemented as a from-scratch parser for the OneNote desktop file format (`[MS-ONESTORE]` / `[MS-ONE]`) with an HTML converter modeled after [`one2html`](https://github.com/msiemens/one2html).

---

## Before you start

Get your notes out of OneNote in one of the following ways:

| Source | How to get the files |
| --- | --- |
| OneNote desktop (2016, 2019, LTSC) | Select the files/folders directly, or export a notebook as a `.onepkg` package via *File → Export → Notebook → OneNote Package*. |
| OneDrive | Download the notebook folder from OneDrive (contains a `.onetoc2` file plus `.one` section files). |
| OneNote for Windows 10/11 | Export each section as a `.one` file via *Settings → Export*. |

The importer accepts individual `.one` files, a notebook (a `.onetoc2` file together with its `.one` section files in the same folder), an entire notebook folder (including section groups), or a single `.onepkg` package. Zip archives containing any of the above are unpacked automatically.

> **Keep the folder structure.** Section files are associated with their notebook by *folder*: a `.onetoc2` file only imports the `.one` files that live in the same directory (and its subdirectories, for section groups). When you select individual files without their folders, each `.one` file is imported as a standalone section and `.onetoc2` files are ignored.

---

## Supported file formats

| Format | Notes |
| --- | --- |
| `.one` | OneNote sections (OneNote 2016 / 2019 / LTSC desktop format). |
| `.onetoc2` | Notebook tables of contents. Used to build the notebook hierarchy. |
| `.onepkg` | OneNote package (CAB archive containing a notebook). Extracted in memory — supports uncompressed, MSZIP and LZX/LZXD compressed packages. |

> **Not supported:** files in the *FSSHTTPB packaging format* (files downloaded through the OneDrive web interface that start with the `{638DE92F…}` format GUID), the legacy OneNote 2007 (or earlier) format, and section files with encrypted content. Such files/sections are skipped with a warning.

---

## How it works

- A notebook (`.onetoc2`) lists its sections and section groups. The importer resolves every entry against the files you provided, skipping missing entries and `OneNote_RecycleBin`.
- Section groups become nested folders: `Section Group → … → Section` maps to nested notebooks in Notesnook.
- Every page becomes a note. Sub-pages are imported as regular notes (flat).
- Page content is converted to Notesnook HTML, preserving the visual layout (positioning, indentation, sizes) using the same approach as `one2html`.

---

## What is supported

### Notebook structure

- Notebooks (`.onetoc2`) and their section ordering.
- Section groups, including nested groups, imported as nested notebooks.
- Section and notebook colors are read (not yet applied to imported notes).
- Standalone sections (`.one` files without a notebook).

### Pages

- Page titles (including title formatting and the `HYPERLINK` marker cleanup).
- Page created & last modified dates, page author and page level (sub-pages).
- Pages with no title fall back to `Untitled Page N`; completely empty pages are skipped.

### Text & formatting

- Rich text paragraphs with per-character text runs.
- **Bold**, *italic*, underline, strikethrough, superscript and subscript.
- Font family, font size, font color and text highlight color.
- Paragraph alignment (left/center/right) and paragraph spacing.
- Hyperlinks — both the hidden `\uFDDF HYPERLINK "…"` marker format and plain `http(s)://` text.

### Lists & note tags

- Numbered lists (decimal, upper/lower roman, upper/lower latin) and bulleted lists.
- List restart values, bullet fonts/colors and Wingdings bullet fixes.
- Note tags & to-do checkboxes: the 30+ checkable shapes (checkboxes, checkboxes with star/flag/person/arrow/exclamation, numbered checkboxes, follow-up flags) render as the checkbox icon with a check when completed.
- Other tag icons render where a matching icon exists (star, question mark, priority, contact, light bulb, home, comment, award, email, music, film, link, lock, book, paper, pen, squares in various colors, …).
- Note tag label highlight/text colors are applied to the content.

### Tables

- Tables with row/column counts, column widths, locked columns and visible borders.
- Cell background colors and cell contents (including nested lists and note tags).

### Images & attachments

- Embedded images are extracted and imported as attachments (with OCR alt text where available, and width/height constraints).
- Embedded files (documents, audio, video, …) are imported as attachments with their original file names.

### Ink (handwriting)

- Handwritten ink is rendered as inline **SVG** strokes, preserving stroke color, width, pen tip style and position on the page.
- Ink embedded inside text paragraphs (inline handwriting, spaces and line breaks) is supported.

### Packages

- `.onepkg` packages are extracted entirely in memory (CAB format; uncompressed, MSZIP, LZX and LZXD compression) and imported like a regular notebook folder.

---

## What is *not* supported

- **FSSHTTPB/OneDrive packaging format** — files downloaded via the OneDrive web UI in the "package" format are detected and skipped.
- **OneNote 2007 (or earlier) legacy format** and **alternative packaging**.
- **Encrypted/password-protected sections** — sections containing encryption data are skipped with a warning (their content cannot be read).
- **Math/equation formatting** — equations are imported as their plain text representation.
- **Ink handwriting recognition (OCR) text** — recognized text is parsed but not added to the imported note.
- **Audio/video recordings** — recorded media is imported as an attachment only when its data is embedded in the file; references to external `onefiles` are skipped.
- **Version history & conflict pages** — only the current revision of each page is imported.
- **Section/notebook colors** — read but not applied to notes yet.
