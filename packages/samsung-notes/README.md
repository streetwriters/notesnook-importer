# Samsung Notes (`.sdocx`) Import Support

This package (`@notesnook-importer/samsung-notes`) parses Samsung Notes
`.sdocx` files — ZIP archives containing binary note metadata, page files, and
media assets — and converts them into HTML.

## Supported

### Note metadata

- Title (falls back to the first non-empty line of body text when empty)
- Created & modified dates
- Page order (from `pageIdInfo.dat`) and per-page canvas geometry
- Tags (from page properties)
- Note background color per page

### Typed text (keyboard input)

- Body text with paragraph structure
- Character formatting:
  - Text color
  - Background color (highlights)
  - Font size & font family
  - Bold, italic, underline, strikethrough
  - Hyperlinks (linked text becomes an `<a>` element)
- Paragraph formatting:
  - Alignment (left, right, center, justify)
  - Bulleted lists (circle, diamond, arrow)
  - Numbered lists (digits, circled digits, alphabet, roman numerals)
  - Checklists (checkbox paragraphs)
  - Line spacing & indentation

### S Pen handwriting

- Handwritten strokes are rendered as SVG images (base64 data URIs in
  `<img>` tags) preserving:
  - Stroke geometry (all points)
  - Pen color
  - Pen size
  - Pressure & timestamps (parsed; see [limitations](#limitations))
- Strokes without a direct color fall back to the pen preset info stored in
  `note.note`

### Images & files

- Inserted images, rendered at their original position and size, including
  crop rectangles
- Imported PDF page backgrounds
- Attached files (from the attached-file table in `note.note`), exported as
  attachments at the end of the note
- Voice recordings (name, duration and timestamps), exported as audio
  attachments rendered as `<audio>` elements
- All referenced media files (from `media/mediaInfo.dat`) are exported as
  attachments

### Note structure

- One `.sdocx` file maps to a single note with all pages concatenated
- Empty trailing placeholder pages are skipped

## Not supported

The following parts of the `.sdocx` format are **not** imported:

- **Locked/encrypted notes** — page data is encrypted and is not decrypted
- **`.spi` painting/cache payloads** — proprietary raster encoding; `.spi`
  files are preserved as opaque attachments only
- **Stroke pressure** — pressure values are parsed but not used to vary SVG
  stroke width (strokes render with uniform width)
- **Pen materials** — fountain pen/brush textures are not rendered; only
  color, size and geometry are preserved
- **Layer metadata** — layer visibility/locking is ignored; all layers are
  rendered in stacking order
- **Templates & custom objects** — page templates, canvas cache maps and
  custom object payloads are skipped

## Usage

```ts
import { parse, toHTML } from "@notesnook-importer/samsung-notes";

// `data` is the raw .sdocx file contents
const parsed = parse(data);
const html = await toHTML(parsed, elementHandler);
```

Pass an `IElementHandler` to `toHTML` to receive media files (images, PDFs)
for attachment creation. Without a handler, images are embedded as data URIs.
