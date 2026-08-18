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

import { encodeXML } from "entities";
import {
  ANAttributeRun,
  ANContext,
  ANFontWeight,
  ANBaseline,
  ANEmphasisColor,
  ANStyleType,
  ANAlignment
} from "./models";

const SOFT_RETURN = "\u2028";
const OBJECT_REPLACEMENT_CHAR = "\uFFFC";
const NOTE_URI = /applenotes:note\/([-0-9a-f]+)(?:\?ownerIdentifier=.*)?/;

const EMPHASIS_COLORS: Record<ANEmphasisColor, string> = {
  [ANEmphasisColor.Purple]: "#F3E6F7",
  [ANEmphasisColor.Pink]: "#F7E6EA",
  [ANEmphasisColor.Orange]: "#FAE5CE",
  [ANEmphasisColor.Mint]: "#DEFEBF",
  [ANEmphasisColor.Blue]: "#DBEBFB"
};

const TITLE_LIMIT = 200;

export function firstLine(noteText: string): string {
  return (
    noteText
      .split("\n")
      .map((line) =>
        line
          .replace(new RegExp(OBJECT_REPLACEMENT_CHAR, "g"), "")
          .replace(/[\u2028\u2029]/g, " ")
          .trim()
      )
      .find((line) => line !== "") ?? ""
  );
}

export function noteTitle(noteText: string, stored: string): string {
  const line = firstLine(noteText ?? "");
  const trimmed = stored?.trim();
  if (!line) return trimmed || "";
  if (!trimmed) return line.length > TITLE_LIMIT ? line.slice(0, TITLE_LIMIT).trimEnd() : line;

  // Apple truncates the stored title, so prefer the full first text line when
  // the stored title is a truncated prefix of it.
  if (line.toLowerCase().startsWith(trimmed.toLowerCase())) {
    return line.length > TITLE_LIMIT ? line.slice(0, TITLE_LIMIT).trimEnd() : line;
  }
  return trimmed.length > TITLE_LIMIT ? trimmed.slice(0, TITLE_LIMIT).trimEnd() : trimmed;
}

type BlockKind =
  | "title"
  | "heading"
  | "subheading"
  | "monospaced"
  | "list"
  | "numberlist"
  | "checkbox"
  | "paragraph";

type Block = {
  kind: BlockKind;
  inline: string;
  indent?: number;
  align?: string;
  checked?: boolean;
  blockquote?: boolean;
};

type ClippedRun = {
  text: string;
  attr: ANAttributeRun;
};

export type ANNoteContent = {
  noteText: string;
  attributeRun: ANAttributeRun[];
};

export class NoteConverter {
  note: ANNoteContent;
  ctx: ANContext;
  omitFirstLine: boolean;

  constructor(ctx: ANContext, note: ANNoteContent, omitFirstLine = false) {
    this.ctx = ctx;
    this.note = note;
    this.omitFirstLine = omitFirstLine;
  }

  async format(table = false): Promise<string> {
    const blocks = await this.buildBlocks();
    if (!table && this.omitFirstLine) blocks.shift();
    return renderBlocks(blocks);
  }

  private async buildBlocks(): Promise<Block[]> {
    const { lines, ranges } = splitLines(this.note.noteText);
    const blocks: Block[] = [];

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];

      const [start, end] = ranges[i];
      const runs = this.clipRuns(start, end);
      if (runs.length === 0) continue;

      const hasAttachment = runs.some((r) => !!r.attr.attachmentInfo);
      if (line.replace(new RegExp(OBJECT_REPLACEMENT_CHAR, "g"), "").trim() === "" && !hasAttachment) {
        continue;
      }

      const style = runs.find((r) => r.attr.paragraphStyle)?.attr.paragraphStyle;
      const inline = await this.formatRuns(runs);

      const block: Block = {
        kind: "paragraph",
        inline
      };

      switch (style?.styleType) {
        case ANStyleType.Title:
          block.kind = "title";
          break;
        case ANStyleType.Heading:
          block.kind = "heading";
          break;
        case ANStyleType.Subheading:
          block.kind = "subheading";
          break;
        case ANStyleType.Monospaced:
          block.kind = "monospaced";
          break;
        case ANStyleType.DottedList:
        case ANStyleType.DashedList:
          block.kind = "list";
          block.indent = style?.indentAmount || 0;
          break;
        case ANStyleType.NumberedList:
          block.kind = "numberlist";
          block.indent = style?.indentAmount || 0;
          break;
        case ANStyleType.Checkbox:
          block.kind = "checkbox";
          block.indent = style?.indentAmount || 0;
          block.checked = !!style?.checklist?.done;
          break;
        default:
          if (style?.alignment !== undefined && style.alignment !== ANAlignment.Left) {
            block.align = convertAlign(style.alignment);
          }
          break;
      }

      block.blockquote = !!style?.blockquote;
      blocks.push(block);
    }

    return mergeMonospaced(blocks);
  }

  private clipRuns(start: number, end: number): ClippedRun[] {
    const runs: ClippedRun[] = [];
    let offset = 0;

    for (const run of this.note.attributeRun) {
      const runStart = offset;
      const runEnd = offset + run.length;
      offset = runEnd;

      if (runEnd <= start || runStart >= end) continue;

      const clipStart = Math.max(runStart, start);
      const clipEnd = Math.min(runEnd, end);
      const text = this.note.noteText.slice(clipStart, clipEnd);

      runs.push({ text, attr: run });
    }
    return runs;
  }

  private async formatRuns(runs: ClippedRun[]): Promise<string> {
    let out = "";
    for (const { text, attr } of runs) {
      if (attr.attachmentInfo) {
        out += await this.ctx.formatAttachment(attr);
      } else {
        out += formatInline(attr, text, (link) => this.resolveInternalLink(link, text));
      }
    }
    return out;
  }

  private resolveInternalLink(link: string, fragment: string): string {
    const match = link.match(NOTE_URI);
    if (!match) return `<a href="${encodeXML(link)}">${encodeXML(fragment)}</a>`;

    const id = this.ctx.noteIds[match[1].toUpperCase()];
    if (!id) return encodeXML(fragment);

    return `<a href="nn://note/${id}">${encodeXML(fragment)}</a>`;
  }
}

function mergeMonospaced(blocks: Block[]): Block[] {
  const merged: Block[] = [];
  for (const block of blocks) {
    const last = merged[merged.length - 1];
    if (block.kind === "monospaced" && last?.kind === "monospaced") {
      last.inline += "\n" + block.inline;
    } else {
      merged.push(block);
    }
  }
  return merged;
}

function formatInline(
  attr: ANAttributeRun,
  fragment: string,
  resolveLink: (link: string) => string
): string {
  // Soft returns (`\u2028`) become real line breaks — encode the text between
  // them so the `<br>` tag isn't escaped into literal text.
  let content = fragment
    .split(SOFT_RETURN)
    .map(encodeXML)
    .join("<br>");

  switch (attr.fontWeight) {
    case ANFontWeight.Bold:
      content = `<strong>${content}</strong>`;
      break;
    case ANFontWeight.Italic:
      content = `<em>${content}</em>`;
      break;
    case ANFontWeight.BoldItalic:
      content = `<strong><em>${content}</em></strong>`;
      break;
  }

  if (attr.strikethrough) content = `<s>${content}</s>`;
  if (attr.underlined) content = `<u>${content}</u>`;
  if (attr.superscript === ANBaseline.Super) content = `<sup>${content}</sup>`;
  if (attr.superscript === ANBaseline.Sub) content = `<sub>${content}</sub>`;

  if (attr.link && attr.link !== fragment) {
    content = resolveLink(attr.link);
  }

  const styles: string[] = [];
  if (attr.color) {
    const { red, green, blue } = attr.color;
    styles.push(
      `color:rgb(${Math.round(red * 255)},${Math.round(green * 255)},${Math.round(
        blue * 255
      )})`
    );
  }
  if (attr.emphasisColor) {
    styles.push(`background-color: ${EMPHASIS_COLORS[attr.emphasisColor]}`);
  }
  if (styles.length > 0) content = `<span style="${styles.join(";")}">${content}</span>`;

  return content;
}

function convertAlign(alignment: ANAlignment): string {
  switch (alignment) {
    default:
      return "left";
    case ANAlignment.Centre:
      return "center";
    case ANAlignment.Right:
      return "right";
    case ANAlignment.Justify:
      return "justify";
  }
}

function splitLines(text: string): { lines: string[]; ranges: [number, number][] } {
  const lines: string[] = [];
  const ranges: [number, number][] = [];
  let start = 0;
  for (let i = 0; i <= text.length; i++) {
    if (i === text.length || text[i] === "\n") {
      lines.push(text.slice(start, i));
      ranges.push([start, i]);
      start = i + 1;
    }
  }
  return { lines, ranges };
}

type ListStackEntry = {
  tag: "ul" | "ol";
  checklist: boolean;
  indent: number;
  liOpen: boolean;
};

function renderBlocks(blocks: Block[]): string {
  const parts: string[] = [];
  const stack: ListStackEntry[] = [];

  const closeListsAbove = (indent: number): string => {
    let s = "";
    while (stack.length && stack[stack.length - 1].indent > indent) {
      const top = stack[stack.length - 1];
      if (top.liOpen) s += "</li>";
      s += `</${top.tag}>`;
      stack.pop();
      if (stack.length) {
        const parent = stack[stack.length - 1];
        if (parent.liOpen) {
          s += "</li>";
          parent.liOpen = false;
        }
      }
    }
    return s;
  };

  const closeAllLists = (): string => {
    let s = "";
    while (stack.length) {
      const top = stack[stack.length - 1];
      if (top.liOpen) s += "</li>";
      s += `</${top.tag}>`;
      stack.pop();
      if (stack.length) {
        const parent = stack[stack.length - 1];
        if (parent.liOpen) {
          s += "</li>";
          parent.liOpen = false;
        }
      }
    }
    return s;
  };

  const listStart = (block: Block): string => {
    let s = "";
    const tag: "ul" | "ol" = block.kind === "numberlist" ? "ol" : "ul";
    const indent = block.indent ?? 0;
    const checklist = block.kind === "checkbox";
    const cls = checklist ? ' class="checklist"' : "";

    if (stack.length === 0) {
      if (indent > 0) {
        s += "<ul><li>&nbsp;";
        stack.push({ tag: "ul", checklist: false, indent: 0, liOpen: true });
      } else {
        s += `<${tag}${cls}>`;
        stack.push({ tag, checklist, indent: 0, liOpen: false });
      }
    }

    const top = stack[stack.length - 1];
    if (indent > top.indent) {
      s += `<${tag}${cls}>`;
      stack.push({ tag, checklist, indent, liOpen: false });
    } else {
      if (top.liOpen) {
        s += "</li>";
        top.liOpen = false;
      }
      if (top.tag !== tag || top.checklist !== checklist) {
        s += `</${top.tag}>`;
        stack.pop();
        s += `<${tag}${cls}>`;
        stack.push({ tag, checklist, indent, liOpen: false });
      }
    }

    const liClass = checklist
      ? ` class="checklist--item${block.checked ? " checked" : ""}"`
      : "";
    s += `<li${liClass}>`;
    stack[stack.length - 1].liOpen = true;
    return s;
  };

  const blockContent = (block: Block): string => {
    let content = block.inline;
    if (block.kind === "monospaced") content = content.replace(/<br>/g, "\n");
    if (block.blockquote) content = `<blockquote>${content}</blockquote>`;
    return content;
  };

  for (const block of blocks) {
    if (block.kind === "list" || block.kind === "numberlist" || block.kind === "checkbox") {
      parts.push(closeListsAbove(block.indent ?? 0));
      parts.push(listStart(block));
      parts.push(blockContent(block));
      continue;
    }

    parts.push(closeAllLists());

    const content = blockContent(block);
    switch (block.kind) {
      case "title":
        parts.push(`<h1>${content}</h1>`);
        break;
      case "heading":
        parts.push(`<h2>${content}</h2>`);
        break;
      case "subheading":
        parts.push(`<h3>${content}</h3>`);
        break;
      case "monospaced":
        parts.push(`<pre>${content}</pre>`);
        break;
      case "paragraph":
        parts.push(
          block.align
            ? `<p style="text-align:${block.align};margin:0">${content}</p>`
            : `<p>${content}</p>`
        );
        break;
    }
  }

  parts.push(closeAllLists());
  return parts.join("");
}
