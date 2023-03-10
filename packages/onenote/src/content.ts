/*
This file is part of the Notesnook project (https://notesnook.com/)

Copyright (C) 2022 Streetwriters (Private) Limited

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

import { Element, Document } from "domhandler";
import { selectAll } from "css-select";
import { removeElement, replaceElement, findOne } from "domutils";
import { parseDocument } from "htmlparser2";
import { render } from "dom-serializer";

/**
 * List of invalid attributes we should remove part of our
 * sanitizer.
 */
const invalidAttributes: string[] = ["lang"];
/**
 * This list includes attributes we want to further operate
 * on but which should otherwise be left alone.
 */
const validAttributes: string[] = ["style", "data-tag"];
/**
 * HTML output from Evernote is relatively clean but there
 * are a lot of domain-specific inline styles. This list serves
 * as a very basic inline styles sanitizer.
 */
const validStyles: string[] = [
  "background-color",
  "color",
  "text-align",
  "font-family",
  "font-size"
];
/**
 * This is a list of special elements used by Evernote for different
 * purposes.
 */
const invalidElements: string[] = ["object", "img"];
const cssSelector: string = [
  ...validAttributes.map((attr) => `[${attr}]`),
  ...invalidAttributes.map((attr) => `[${attr}]`),
  ...invalidElements
].join(",");

export interface IElementHandler {
  process(type: string, element: Element): Promise<string | undefined>;
}

type AttachmentResolver = (url: string) => Promise<Buffer | null>;
type ContentOptions = {
  attachmentResolver: AttachmentResolver;
};

export class Content {
  #document: Document;
  constructor(html: string, private readonly options: ContentOptions) {
    this.#document = parseDocument(html);
  }

  async transform(handler?: IElementHandler): Promise<string> {
    const body = findOne(
      (e) => e.tagName === "body",
      this.#document.childNodes
    );
    const elements = selectAll(cssSelector, body);
    if (!body || !elements) return "";

    for (let i = 0; i < elements.length; ++i) {
      const element = elements[i];
      if (!element) continue;

      const elementType =
        filterAttributes(element) || element.tagName.toLowerCase();

      switch (elementType) {
        case "checklist": {
          const siblings: Element[] = [];
          const ul = [`<ul class="checklist">`];
          for (; i < elements.length; ++i) {
            const next = elements[i];
            if (
              !next ||
              !next.attribs ||
              !next.attribs["data-tag"]?.startsWith("to-do")
            )
              break;

            const li = [
              `<li${
                next.attribs["data-tag"] === "to-do:completed"
                  ? ` class="checked"`
                  : ""
              }>`,
              render(next.childNodes),
              "</li>"
            ];
            ul.push(...li);
            if (next !== element) siblings.push(next);
          }
          ul.push("</ul>");
          replaceElement(element, parseDocument(ul.join("")));

          siblings.forEach((elem) => {
            removeElement(elem);
          });
          break;
        }
        case "img":
        case "object": {
          const data = await downloadAttachment(
            element,
            ["data-fullres", "src", "data"],
            this.options.attachmentResolver
          );
          if (!data) {
            removeElement(element);
            break;
          }
          element.attribs["data"] = data;

          if (handler) {
            const result = await handler.process(elementType, element);
            if (result) replaceElement(element, parseDocument(result));
            else removeElement(element);
          } else removeElement(element);
          break;
        }
      }
    }
    return render(body.childNodes);
  }

  get raw(): string {
    const body = findOne(
      (e) => e.tagName === "body",
      this.#document.childNodes
    );
    if (!body) return render(this.#document);
    return render(body?.childNodes);
  }

  toJSON(): string {
    return this.raw;
  }
}

function filterAttributes(element: Element): string | null {
  let elementType: string | null = null;

  for (const attr of invalidAttributes) {
    if (element.attribs[attr]) delete element.attribs[attr];
  }

  for (const attr of validAttributes) {
    if (!element.attribs[attr]) continue;
    const value = element.attribs[attr];
    if (!value) {
      delete element.attribs[attr];
      continue;
    }

    switch (attr) {
      case "data-tag":
        if (!value.startsWith("to-do")) break;
        elementType = "checklist";
        break;
      case "style": {
        const styles = stylesToObject(value);
        for (const style in styles) {
          if (validStyles.indexOf(style) === -1) delete styles[style];
        }
        const newStyle = objectToStyles(styles);
        if (newStyle) element.attribs[attr] = newStyle;
        else delete element.attribs[attr];
        break;
      }
    }
  }
  return elementType;
}

function stylesToObject(input: string): Record<string, string> {
  const styles = input.split(";");
  const output: Record<string, string> = {};
  for (const style of styles) {
    const [key, value] = style.trim().split(":");
    output[key] = value;
  }
  return output;
}

function objectToStyles(input: Record<string, string>): string {
  const output: string[] = [];
  for (const key in input) {
    output.push(`${key}:${input[key]}`);
  }
  return output.join(";");
}

async function downloadAttachment(
  element: Element,
  attributes: string[],
  resolver: AttachmentResolver
): Promise<string | false> {
  let src = null;
  for (const attribute of attributes) {
    src = element.attribs[attribute];
    if (src) break;
  }
  if (!src) return false;

  const data = await resolver(src);
  if (!data) throw new Error(`Failed to download attachment at ${src}.`);

  return data.toString("base64");
}
