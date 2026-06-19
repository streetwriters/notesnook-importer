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

import { ChildNode, Document, Element, Text } from "domhandler";
import {
  append,
  appendChild,
  findAll,
  isTag,
  removeElement,
  replaceElement
} from "domutils";

/**
 * Converts `<div>` elements to `<p>` elements where the content is valid
 * inside a paragraph (phrasing content only). For divs with mixed inline and
 * block content, the inline runs are wrapped in `<p>` elements and block
 * elements are hoisted out. Style and dir attributes are preserved.
 *
 * Must be called BEFORE convertBrToSingleSpacedParagraphs so that <br> tags
 * inside the newly-created <p> elements are handled correctly.
 */
export function convertDivsToParagraphs(document: Document): void {
  const divs = findAll(
    (elem) => isTag(elem) && elem.tagName === "div",
    document.childNodes
  );

  // Process deepest-first so inner divs are resolved before outer ones
  for (const div of divs.reverse()) {
    if (!div.parent) continue;

    const children = [...div.children];

    if (children.every(isPhrasingContent)) {
      // All inline: straightforward div → <p> replacement
      const p = new Element("p", inheritableAttribs(div));
      for (const child of children) appendChild(p, child);
      replaceElement(div, p);
    } else {
      // Mixed content: split at block boundaries.
      // Inline runs become <p> elements; block elements are hoisted as-is.
      splitDivAtBlockBoundaries(div);
    }
  }
}

function splitDivAtBlockBoundaries(div: Element): void {
  const attribs = inheritableAttribs(div);
  const children = [...div.children];
  const replacement: ChildNode[] = [];
  let inlineBuffer: ChildNode[] = [];

  function flushBuffer() {
    if (inlineBuffer.length === 0) return;
    // Drop buffers that are nothing but whitespace text nodes
    if (inlineBuffer.every((n) => !isTag(n) && !(n as Text).data?.trim())) {
      inlineBuffer = [];
      return;
    }
    const p = new Element("p", { ...attribs });
    for (const node of inlineBuffer) appendChild(p, node);
    replacement.push(p);
    inlineBuffer = [];
  }

  for (const child of children) {
    if (isPhrasingContent(child)) {
      inlineBuffer.push(child);
    } else {
      flushBuffer();
      removeElement(child); // detach from div
      replacement.push(child);
    }
  }
  flushBuffer();

  if (replacement.length === 0) {
    removeElement(div);
    return;
  }

  const [first, ...rest] = replacement;
  replaceElement(div, first);
  let prev = first;
  for (const node of rest) {
    append(prev, node);
    prev = node;
  }
}

/**
 * HTML phrasing content — elements that are valid as direct children of <p>.
 * Block-level tags (hr, div, h1-h6, ul, ol, li, pre, blockquote, table…)
 * are intentionally absent.
 */
const phrasingContentTags = new Set([
  "a",
  "abbr",
  "b",
  "bdi",
  "bdo",
  "br",
  "cite",
  "code",
  "data",
  "dfn",
  "em",
  "i",
  "img",
  "input",
  "kbd",
  "label",
  "mark",
  "meter",
  "output",
  "picture",
  "q",
  "ruby",
  "s",
  "samp",
  "select",
  "small",
  "span",
  "strong",
  "sub",
  "sup",
  "textarea",
  "time",
  "u",
  "var",
  "wbr"
]);

function isPhrasingContent(node: ChildNode): boolean {
  // Text nodes, comment nodes, etc. are always valid inside <p>
  if (!isTag(node)) return true;
  return phrasingContentTags.has(node.tagName);
}

/** Only copy attributes that are meaningful on a <p> element.
 * If the div has no text-align of its own, inherits one from the nearest
 * ancestor that specifies it (CSS text-align is inherited by default but
 * ancestor divs may be unwrapped, so we need to make it explicit). */
function inheritableAttribs(div: Element): Record<string, string> {
  const result: Record<string, string> = {};
  if (div.attribs.dir) result.dir = div.attribs.dir;

  let style = div.attribs.style ?? "";
  if (!hasTextAlign(style)) {
    const inherited = findAncestorTextAlign(div);
    if (inherited) {
      style = style
        ? `${style}; text-align: ${inherited}`
        : `text-align: ${inherited}`;
    }
  }
  if (style) result.style = style;

  return result;
}

function hasTextAlign(style: string): boolean {
  return /text-align\s*:/i.test(style);
}

/** Walk up the ancestor chain and return the nearest explicit text-align value. */
function findAncestorTextAlign(element: Element): string | undefined {
  let node = element.parent;
  while (node) {
    if (isTag(node)) {
      const match = node.attribs.style?.match(/text-align\s*:\s*([^;]+)/i);
      if (match) return match[1].trim();
    }
    node = node.parent;
  }
  return undefined;
}
