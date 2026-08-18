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

import { MediaEntry } from "./media";
import { SamsungPage, Stroke, TextFieldObject } from "./page";
import { ParsedSdocx } from "./sdocx";
import {
  BulletTypes,
  Paragraph,
  Span,
  SpanTypes,
  TextCommon
} from "./text-common";

export interface IElementHandler {
  process(
    type: "image" | "file",
    media: MediaEntry,
    width?: number,
    height?: number
  ): Promise<string | undefined>;
}

const MIME_BY_EXTENSION: Record<string, string> = {
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".png": "image/png",
  ".gif": "image/gif",
  ".webp": "image/webp",
  ".svg": "image/svg+xml",
  ".bmp": "image/bmp",
  ".pdf": "application/pdf",
  ".m4a": "audio/mp4",
  ".mp3": "audio/mpeg",
  ".3gp": "audio/3gpp",
  ".aac": "audio/aac",
  ".ogg": "audio/ogg",
  ".wav": "audio/wav",
  ".amr": "audio/amr",
  ".spi": "application/octet-stream"
};

export async function toHTML(
  parsed: ParsedSdocx,
  handler?: IElementHandler
): Promise<string> {
  const parts: string[] = [];

  const bodyHtml = renderText(parsed.note.body);
  if (bodyHtml.trim()) parts.push(bodyHtml);

  const mediaById = new Map(parsed.media.map((entry) => [entry.bindId, entry]));
  const usedBindIds = new Set<number>();
  const visiblePages = parsed.pages.filter(
    (page) =>
      page.strokes.length ||
      page.images.length ||
      page.textFields.length ||
      page.pdfBackgrounds.length
  );

  for (const page of visiblePages) {
    parts.push(await renderPage(page, mediaById, handler, usedBindIds));
  }

  for (const attachedFile of parsed.attachedFiles ?? []) {
    if (usedBindIds.has(attachedFile.bindId)) continue;
    usedBindIds.add(attachedFile.bindId);
    parts.push(await renderAttachedFile(attachedFile, handler));
  }

  for (const voice of parsed.voiceRecordings ?? []) {
    if (usedBindIds.has(voice.media.bindId)) continue;
    usedBindIds.add(voice.media.bindId);
    parts.push(await renderVoiceRecording(voice.media, handler));
  }

  return parts.join("");
}

async function renderPage(
  page: SamsungPage,
  mediaById: Map<number, MediaEntry>,
  handler?: IElementHandler,
  usedBindIds?: Set<number>
): Promise<string> {
  const backgroundColor =
    page.backgroundColor !== undefined
      ? argbToCss(page.backgroundColor)
      : "#ffffff";
  const contents: string[] = [];

  if (page.pdfBackgrounds.length) {
    for (const pdf of page.pdfBackgrounds) {
      const media = mediaById.get(pdf.fileId);
      if (!media) continue;
      usedBindIds?.add(pdf.fileId);
      const width = pdf.rect.right - pdf.rect.left;
      const height = pdf.rect.bottom - pdf.rect.top;
      contents.push(
        await renderMediaObject(
          handler,
          "file",
          media,
          pdf.rect.left,
          pdf.rect.top,
          width,
          height
        )
      );
    }
  }

  for (const image of page.images) {
    const media = mediaById.get(image.bindId);
    if (!media) continue;
    usedBindIds?.add(image.bindId);
    const width = image.rect.right - image.rect.left;
    const height = image.rect.bottom - image.rect.top;
    contents.push(
      await renderMediaObject(
        handler,
        "image",
        media,
        image.rect.left,
        image.rect.top,
        width,
        height
      )
    );
  }

  for (const textField of page.textFields) {
    contents.push(renderTextField(textField));
  }

  if (page.strokes.length) {
    const rendered = await renderStrokes(page.strokes, page, handler);
    if (rendered) contents.push(rendered);
  }

  return (
    `<div style="position:relative;width:${page.width}px;height:${page.height}px;max-width:100%;background-color:${backgroundColor};overflow:hidden;margin:16px 0;">` +
    contents.join("") +
    `</div>`
  );
}

async function renderMediaObject(
  handler: IElementHandler | undefined,
  type: "image" | "file",
  media: MediaEntry,
  left: number,
  top: number,
  width: number,
  height: number
): Promise<string> {
  let inner: string;
  if (handler) {
    const html = await handler.process(type, media, width, height);
    inner =
      html ??
      renderDataUri(media) ??
      `<div>${escapeHtml(media.filename)}</div>`;
  } else {
    inner = renderDataUri(media) ?? `<div>${escapeHtml(media.filename)}</div>`;
  }
  return `<div style="position:absolute;left:${round(left)}px;top:${round(
    top
  )}px;width:${round(width)}px;height:${round(height)}px;">${inner}</div>`;
}

function renderDataUri(media: MediaEntry): string | null {
  if (!media.data) return null;
  const extension = media.filename.includes(".")
    ? media.filename.slice(media.filename.lastIndexOf(".")).toLowerCase()
    : "";
  const mime = MIME_BY_EXTENSION[extension] ?? "application/octet-stream";
  const dataUri = `data:${mime};base64,${toBase64(media.data)}`;
  if (mime.startsWith("image/"))
    return `<img style="width:100%;height:100%;object-fit:contain;" src="${dataUri}" />`;
  if (mime === "application/pdf")
    return `<iframe style="width:100%;height:100%;" src="${dataUri}"></iframe>`;
  if (mime.startsWith("audio/"))
    return `<audio controls="controls" style="width:100%;" src="${dataUri}"></audio>`;
  return null;
}

async function renderAttachedFile(
  media: MediaEntry,
  handler?: IElementHandler
): Promise<string> {
  let inner: string | undefined;
  if (handler) inner = await handler.process("file", media);
  if (!inner) inner = renderDataUri(media) ?? undefined;
  if (!inner)
    inner = `<div title="${escapeHtml(media.filename)}">${escapeHtml(
      media.filename
    )}</div>`;
  return `<div style="margin-top:16px;">${inner}</div>`;
}

async function renderVoiceRecording(
  media: MediaEntry,
  handler?: IElementHandler
): Promise<string> {
  let inner: string | undefined;
  if (handler) inner = await handler.process("file", media);
  if (!inner) inner = renderDataUri(media) ?? undefined;
  if (!inner)
    inner = `<div title="${escapeHtml(media.filename)}">${escapeHtml(
      media.filename
    )}</div>`;
  return `<div style="margin-top:16px;">${inner}</div>`;
}

function renderTextField(textField: TextFieldObject): string {
  const width = Math.max(textField.rect.right - textField.rect.left, 1);
  return `<div style="position:absolute;left:${round(
    textField.rect.left
  )}px;top:${round(textField.rect.top)}px;width:${round(
    width
  )}px;overflow:hidden;">${renderText(textField.text)}</div>`;
}

async function renderStrokes(
  strokes: Stroke[],
  page: SamsungPage,
  handler?: IElementHandler
) {
  const paths = strokes
    .map((stroke) => {
      if (!stroke.points.length) return "";
      const d =
        stroke.points.length === 1
          ? `M${round(stroke.points[0].x)} ${round(
              stroke.points[0].y
            )} l 0.01 0`
          : stroke.points
              .map(
                (point, index) =>
                  `${index === 0 ? "M" : "L"}${round(point.x)} ${round(point.y)}`
              )
              .join(" ");
      return `<path d="${d}" stroke="${argbToCss(
        stroke.color
      )}" stroke-width="${round(stroke.penSize)}" fill="none" stroke-linecap="round" stroke-linejoin="round" />`;
    })
    .filter(Boolean)
    .join("");

  const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${page.width} ${page.height}">${paths}</svg>`;
  return await handler?.process(
    "image",
    {
      data: new TextEncoder().encode(svg),
      filename: "strokes.svg",
      hash: "",
      bindId: -1,
      isFileAttached: false,
      refCount: 1,
      modifiedTime: Date.now()
    },
    undefined,
    undefined
  );
}

interface Segment {
  start: number;
  end: number;
  spans: Span[];
}

export function renderText(text: TextCommon): string {
  if (!text.text) return "";

  const paragraphs = splitParagraphs(text);
  const grouped = groupParagraphs(paragraphs);
  const output: string[] = [];

  for (const group of grouped) {
    if (group.length === 1) {
      output.push(renderSingleParagraph(group[0], text));
      continue;
    }

    const listStyle = getListStyle(group[0].bulletType);
    const items = group
      .map((paragraph) => {
        const inner = renderParagraphContent(paragraph, text);
        if (group[0].bulletType === BulletTypes.checker)
          return `<li style="list-style:none;"><input type="checkbox" disabled="disabled" />${inner}</li>`;
        return `<li>${inner}</li>`;
      })
      .join("");
    output.push(`<ul style="${listStyle}">${items}</ul>`);
  }

  return output.join("");
}

interface ParagraphSlice {
  index: number;
  start: number;
  end: number;
  content: string;
  bulletType: number;
  indentLevel?: number;
  alignment?: number;
  lineSpacingType?: number;
  lineSpacing?: number;
}

function splitParagraphs(text: TextCommon): ParagraphSlice[] {
  const paragraphs: ParagraphSlice[] = [];
  let start = 0;
  let index = 0;
  for (let i = 0; i < text.text.length; ++i) {
    if (text.text[i] !== "\n") continue;
    paragraphs.push({
      index,
      start,
      end: i,
      content: text.text.slice(start, i),
      ...getParagraphFormat(text.paragraphs, index)
    });
    start = i + 1;
    index++;
  }
  if (start < text.text.length || !paragraphs.length) {
    paragraphs.push({
      index,
      start,
      end: text.text.length,
      content: text.text.slice(start),
      ...getParagraphFormat(text.paragraphs, index)
    });
  }
  return paragraphs;
}

function getParagraphFormat(records: Paragraph[], index: number) {
  let bulletType = BulletTypes.none;
  let indentLevel: number | undefined;
  let alignment: number | undefined;
  let lineSpacingType: number | undefined;
  let lineSpacing: number | undefined;
  for (const record of records) {
    if (record.start > index || record.end <= index) continue;
    if (record.type === 3 && record.alignment !== undefined)
      alignment = record.alignment;
    else if (record.type === 2 && record.indentLevel !== undefined)
      indentLevel = record.indentLevel;
    else if (record.type === 5 && record.bulletType !== undefined)
      bulletType = record.bulletType;
    else if (record.type === 4) {
      lineSpacingType = record.lineSpacingType;
      lineSpacing = record.lineSpacing;
    }
  }
  return { bulletType, indentLevel, alignment, lineSpacingType, lineSpacing };
}

function groupParagraphs(paragraphs: ParagraphSlice[]): ParagraphSlice[][] {
  const groups: ParagraphSlice[][] = [];
  let current: ParagraphSlice[] = [];

  const nonEmpty = paragraphs.filter((p, i) => {
    const isFirstOrLast = i === 0 || i === paragraphs.length - 1;
    return p.content.trim() || !isFirstOrLast;
  });

  for (const paragraph of nonEmpty) {
    if (
      paragraph.bulletType !== BulletTypes.none &&
      current.length &&
      current[0].bulletType === paragraph.bulletType
    ) {
      current.push(paragraph);
      continue;
    }
    if (current.length) groups.push(current);
    current = [paragraph];
  }
  if (current.length) groups.push(current);
  return groups;
}

function getListStyle(bulletType: number): string {
  switch (bulletType) {
    case BulletTypes.arrow:
      return "list-style-type:'\\27A4';padding-left:24px;";
    case BulletTypes.diamond:
      return "list-style-type:disc;padding-left:24px;";
    case BulletTypes.digit:
      return "list-style-type:decimal;padding-left:24px;";
    case BulletTypes.circledDigit:
      return "list-style-type:decimal;padding-left:24px;";
    case BulletTypes.alphabet:
      return "list-style-type:lower-alpha;padding-left:24px;";
    case BulletTypes.roman:
      return "list-style-type:lower-roman;padding-left:24px;";
    case BulletTypes.solidCircle:
      return "list-style-type:disc;padding-left:24px;";
    case BulletTypes.checker:
      return "list-style:none;padding:0;";
    default:
      return "list-style-type:disc;padding-left:24px;";
  }
}

function renderSingleParagraph(
  paragraph: ParagraphSlice,
  text: TextCommon
): string {
  if (!paragraph.content.trim()) return "<p><br /></p>";
  return `<p${getParagraphStyle(paragraph)}>${renderParagraphContent(
    paragraph,
    text
  )}</p>`;
}

function getParagraphStyle(paragraph: ParagraphSlice): string {
  const styles: string[] = [];
  if (paragraph.alignment === 1) styles.push("text-align:right;");
  else if (paragraph.alignment === 2) styles.push("text-align:center;");
  else if (paragraph.alignment === 3) styles.push("text-align:justify;");
  if (paragraph.indentLevel)
    styles.push(`margin-left:${paragraph.indentLevel * 24}px;`);
  if (paragraph.lineSpacing !== undefined && paragraph.lineSpacing > 0) {
    if (paragraph.lineSpacingType === 1)
      styles.push(`line-height:${paragraph.lineSpacing}%;`);
    else styles.push(`line-height:${paragraph.lineSpacing}px;`);
  }
  return styles.length ? ` style="${styles.join("")}"` : "";
}

function renderParagraphContent(
  paragraph: ParagraphSlice,
  text: TextCommon
): string {
  const links = text.spans
    .filter((span) => span.hyperlink !== undefined)
    .map((span) => ({
      start: Math.max(span.start, paragraph.start),
      end: Math.min(span.end, paragraph.end)
    }))
    .filter((link) => link.end > link.start);

  if (!links.length) return renderRange(paragraph.start, paragraph.end, text);

  let output = "";
  let cursor = paragraph.start;
  for (const link of links) {
    if (link.start > cursor) output += renderRange(cursor, link.start, text);
    const url = text.text.slice(link.start, link.end);
    output += `<a href="${escapeHtml(url)}">${renderRange(
      link.start,
      link.end,
      text
    )}</a>`;
    cursor = link.end;
  }
  if (cursor < paragraph.end)
    output += renderRange(cursor, paragraph.end, text);
  return output;
}

function renderRange(start: number, end: number, text: TextCommon): string {
  const segments = getSegments(text.spans, start, end);
  if (!segments.length) return escapeHtml(text.text.slice(start, end));

  let output = "";
  let cursor = start;
  for (const segment of segments) {
    if (segment.start > cursor)
      output += escapeHtml(text.text.slice(cursor, segment.start));
    output += applyStyles(
      text.text.slice(segment.start, segment.end),
      segment.spans
    );
    cursor = segment.end;
  }
  if (cursor < end) output += escapeHtml(text.text.slice(cursor, end));
  return output;
}

function getSegments(spans: Span[], start: number, end: number): Segment[] {
  const applicable: Segment[] = [];
  for (const span of spans) {
    const segmentStart = Math.max(span.start, start);
    const segmentEnd = Math.min(span.end, end);
    if (segmentEnd <= segmentStart) continue;
    applicable.push({ start: segmentStart, end: segmentEnd, spans: [] });
  }

  const boundaries = [
    ...new Set(applicable.flatMap((segment) => [segment.start, segment.end]))
  ].sort((a, b) => a - b);

  const segments: Segment[] = [];
  for (let i = 0; i < boundaries.length - 1; ++i) {
    const segmentStart = boundaries[i];
    const segmentEnd = boundaries[i + 1];
    const spansAtPosition = spans.filter(
      (span) => span.start <= segmentStart && span.end >= segmentEnd
    );
    if (!spansAtPosition.length) continue;
    segments.push({
      start: segmentStart,
      end: segmentEnd,
      spans: spansAtPosition
    });
  }
  return segments;
}

function applyStyles(content: string, spans: Span[]): string {
  let output = escapeHtml(content);
  let style = "";
  for (const span of spans) {
    if (span.type === SpanTypes.foregroundColor && span.color !== undefined)
      style += `color:${argbToCss(span.color)};`;
    else if (
      span.type === SpanTypes.backgroundColor &&
      span.backgroundColor !== undefined
    )
      style += `background-color:${argbToCss(span.backgroundColor)};`;
    else if (span.type === SpanTypes.fontSize && span.fontSize !== undefined)
      style += `font-size:${round(span.fontSize)}px;`;
    else if (span.type === SpanTypes.fontName && span.fontName)
      style += `font-family:${escapeHtml(span.fontName)};`;
  }
  if (style) output = `<span style="${style}">${output}</span>`;

  if (spans.some((span) => span.type === SpanTypes.bold && span.bold))
    output = `<b>${output}</b>`;
  if (spans.some((span) => span.type === SpanTypes.italic && span.italic))
    output = `<i>${output}</i>`;
  if (spans.some((span) => span.type === SpanTypes.underline && span.underline))
    output = `<u>${output}</u>`;
  if (
    spans.some(
      (span) => span.type === SpanTypes.strikethrough && span.strikethrough
    )
  )
    output = `<s>${output}</s>`;

  return output;
}

export function argbToCss(argb: number): string {
  const alpha = ((argb >>> 24) & 0xff) / 255;
  const red = (argb >>> 16) & 0xff;
  const green = (argb >>> 8) & 0xff;
  const blue = argb & 0xff;
  return alpha < 1
    ? `rgba(${red}, ${green}, ${blue}, ${alpha})`
    : `#${[red, green, blue]
        .map((c) => c.toString(16).padStart(2, "0"))
        .join("")}`;
}

function round(value: number): number {
  return Math.round(value * 100) / 100;
}

function escapeHtml(text: string): string {
  return text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function toBase64(bytes: Uint8Array): string {
  let binary = "";
  const chunkSize = 0x8000;
  for (let i = 0; i < bytes.length; i += chunkSize) {
    binary += String.fromCharCode(...bytes.subarray(i, i + chunkSize));
  }
  return btoa(binary);
}
