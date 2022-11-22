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

import { Element } from "domhandler";
import { parseDocument } from "htmlparser2";
import { selectAll } from "css-select";
import { render } from "dom-serializer";
import { removeElement, replaceElement, getElementsByTagName } from "domutils";

/**
 * List of invalid attributes we should remove part of our
 * sanitizer.
 */
const invalidAttributes: string[] = ["lang", "dir", "accessKey", "tabIndex"];
/**
 * This list includes attributes we want to further operate
 * on but which should otherwise be left alone.
 */
const validAttributes: string[] = ["style", "src"];
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
const invalidElements: string[] = [
  "en-media",
  "en-crypt",
  "en-todo",
  // The new editor by evernote includes new special elements.
  // However, these elements are not mentioned in the spec nor
  // do they appear in the exported files (yet). I am adding them
  // here just in case.
  "en-codeblock",
  "en-task-group"
];
const cssSelector: string = [
  ...validAttributes.map((attr) => `[${attr}]`),
  ...invalidAttributes.map((attr) => `[${attr}]`),
  ...invalidElements
].join(",");

export interface IElementHandler {
  process(type: string, element: Element): Promise<string | undefined>;
}

export async function processContent(
  content: string,
  handler?: IElementHandler
): Promise<string> {
  const contentElement = parseDocument(content, { xmlMode: true });
  const [noteElement] = getElementsByTagName(
    "en-note",
    contentElement,
    true,
    1
  );
  if (!noteElement) throw new Error("Could not find a valid en-note tag.");

  const elements = selectAll(cssSelector, noteElement);
  for (const element of elements) {
    const elementType =
      filterAttributes(element) || element.tagName.toLowerCase();

    switch (elementType) {
      case "img-dataurl":
      case "en-codeblock":
      case "en-task-group":
      case "en-crypt":
      case "en-todo":
      case "en-media": {
        if (handler) {
          const result = await handler.process(elementType, element);
          if (result) {
            replaceElement(element, parseDocument(result));
          } else removeElement(element);
        } else removeElement(element);
        break;
      }
    }
  }
  return render(noteElement.childNodes, {
    xmlMode: true
  });
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
      case "src": {
        if (!value.startsWith("data:image/")) break;
        elementType = "img-dataurl";
        break;
      }
      case "style": {
        const styles = stylesToObject(value);
        for (const style in styles) {
          switch (style) {
            case "--en-codeblock":
              elementType = "en-codeblock";
              break;
            case "--en-task-group": {
              elementType = "en-task-group";
              const taskGroupId = styles["--en-id"];
              if (taskGroupId) element.attribs["task-group-id"] = taskGroupId;
              break;
            }
          }
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
