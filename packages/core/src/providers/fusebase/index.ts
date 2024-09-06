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

import { IFileProvider, ProviderMessage, ProviderSettings } from "../provider";
import { File } from "../../utils/file";
import { markdowntoHTML } from "../../utils/to-html";
import { Metadata } from "./types";
import { parseDocument } from "htmlparser2";
import {
  findOne,
  isTag,
  isText,
  removeElement,
  textContent,
  replaceElement,
  findAll,
  getAttributeValue
} from "domutils";
import { AnyNode, Element, Text } from "domhandler";
import selectAll, { is, selectOne, compile } from "css-select";
import render from "dom-serializer";
import {
  Attachment,
  attachmentToHTML,
  ContentType,
  Notebook
} from "../../models";
import { IHasher } from "../../utils/hasher";
import { detectFileType } from "../../utils/file-type";
import { sanitizeFilename } from "../../utils/filename";
import { createObjectId } from "../../utils/object-id";

const colorMap: Record<string, string | undefined> = {
  ed5454: "red",
  fda639: "orange",
  fac92f: "yellow",
  "8bc34a": "green",
  "5573a7": "blue",
  "42a5f5": "blue",
  b39ddb: "purple"
};

const IGNORED_ELEMENTS = compile(
  ".nimbus-board, .outline, .tasks-list, .inline-progress, .step-aggregator"
);
const DIV_AS_PARAGRAPH = compile("div.paragraph,div.table-text-common");
const BUTTON = compile(".button-single");
const HR = compile(".horizontal-line");
const DROPDOWN_LIST = compile(".inline-dropdown-list");
const GRID = compile(".grid-wrapper");
const ATTACHMENT_ELEMENTS = compile(".file-wrapper,.image-wrapper");
const CODE_BLOCK = compile(".syntax-wrapper");
const HINTBLOCK = compile(".hintblock");
const TOGGLE = compile(".nimbus-toggle");
const TABLE = compile(".table-wrapper");
const LIST = compile(".editor-list");
const WEBCLIP = compile(".nimbus-html");
const BOOKMARK = compile(".nimbus-bookmark");
const MENTION = compile("mention.mention");

export class Fusebase implements IFileProvider {
  public type = "file" as const;
  public supportedExtensions = [".json"];
  public version = "1.0.0";
  public name = "Fusebase (formerly Nimbus Note)";
  public examples = ["nimbus-export.zip"];
  public helpLink =
    "https://help.notesnook.com/importing-notes/import-notes-from-fusebase";
  private ids: Record<string, string> = {};

  filter(file: File) {
    return this.supportedExtensions.includes(file.extension);
  }

  async *process(
    file: File,
    settings: ProviderSettings,
    files: File[]
  ): AsyncGenerator<ProviderMessage, void, unknown> {
    const metadata = JSON.parse(await file.text()) as Metadata;
    const contentFile = files.find(
      (f) => f.directory === file.directory && f.name === "note.html"
    );
    const { attachments, html } = await this.processHTML(
      (await contentFile?.text()) || "<p></p>",
      metadata,
      files,
      settings.hasher
    );

    let rootNotebook: Notebook | undefined = undefined;
    for (let i = metadata.parents.length - 1; i >= 0; i--) {
      rootNotebook = {
        title: metadata.parents[i],
        children: rootNotebook ? [rootNotebook] : []
      };
    }

    yield {
      type: "note",
      note: {
        id: this.ids[metadata.globalId],
        title: metadata.title,
        dateCreated: metadata.createdAt || metadata.dateAdded,
        dateEdited: metadata.updatedAt || metadata.dateUpdated,
        tags: metadata.tags,
        color: colorMap[metadata.color],
        favorite: metadata.favorite,
        attachments,
        notebooks: rootNotebook ? [rootNotebook] : [],
        content: {
          type: ContentType.HTML,
          data: html
        }
      }
    };
  }

  async processHTML(
    html: string,
    metadata: Metadata,
    files: File[],
    hasher: IHasher
  ) {
    const document = parseDocument(html);
    const body = selectOne("#note-root", document.childNodes) as Element | null;
    const attachments: Attachment[] = [];
    if (!body) return { html, attachments };

    await visit(body.children, (node) => {
      if (!isTag(node)) return Op.NOOP;

      if (is(node, IGNORED_ELEMENTS)) {
        return Op.REMOVE;
      }

      if (is(node, DIV_AS_PARAGRAPH)) {
        return this.handleParagraph(node);
      } else if (is(node, BUTTON)) {
        return this.handleButton(node);
      } else if (node.name === "date") {
        return this.handleDate(node);
      } else if (is(node, HR)) {
        return this.handleHR(node);
      } else if (is(node, DROPDOWN_LIST)) {
        return this.handleDropdown(node);
      } else if (is(node, GRID)) {
        return this.handleGrid(node);
      } else if (is(node, ATTACHMENT_ELEMENTS)) {
        return this.handleAttachment(
          node,
          metadata,
          attachments,
          files,
          hasher
        );
      } else if (is(node, CODE_BLOCK)) {
        return this.handleCodeBlock(node);
      } else if (is(node, HINTBLOCK)) {
        return this.handleHintBlock(node);
      } else if (is(node, TOGGLE)) {
        return this.handleToggle(node);
      } else if (is(node, TABLE)) {
        return this.handleTable(node);
      } else if (is(node, LIST)) {
        return this.handleList(node);
      } else if (is(node, WEBCLIP)) {
        return this.handleWebClip(node, metadata, attachments, files, hasher);
      } else if (is(node, BOOKMARK)) {
        return this.handleBookmark(node);
      } else if (is(node, MENTION)) {
        return this.handleMention(node);
      }

      return Op.NOOP;
    });
    return {
      html: render(body.childNodes),
      attachments
    };
  }

  private handleParagraph(node: Element) {
    node.name = "p";
    delete node.attribs.class;
    return Op.NOOP;
  }

  private handleButton(node: Element) {
    const button = selectOne("nimbus-button.single-button", node.childNodes);
    if (!button || !isTag(button)) return Op.REMOVE;

    const url = getAttributeValue(button, "data-url");
    const target = getAttributeValue(button, "data-target");
    if (!url || !target) return Op.REMOVE;

    const content =
      button.firstChild && isTag(button.firstChild)
        ? button.firstChild.childNodes
        : [];

    node.name = "a";
    node.attribs = { href: url, target };
    node.childNodes = content;
    return Op.SKIP;
  }

  private handleDate(node: Element) {
    const dateText = selectOne(".input-date-text", node.childNodes);
    if (!dateText || !isTag(dateText)) return Op.REMOVE;
    node.name = "span";
    node.childNodes = dateText.childNodes;
    node.attribs = {};
    return Op.SKIP;
  }

  private handleHR(node: Element) {
    node.name = "hr";
    node.childNodes = [];
    node.attribs = {};
    return Op.SKIP;
  }

  private handleDropdown(node: Element) {
    const label = selectOne(".select-label-text", node.childNodes);
    if (!label) return Op.REMOVE;
    node.name = "code";
    node.childNodes = [new Text(textContent(label))];
    node.attribs = {};
    return Op.SKIP;
  }

  private handleGrid(node: Element) {
    node.childNodes = node.children
      .map((div) => (isTag(div) ? div.children : []))
      .flat();
    node.name = "div";
    return Op.NOOP;
  }

  private async handleAttachment(
    node: Element,
    metadata: Metadata,
    attachments: Attachment[],
    files: File[],
    hasher: IHasher
  ) {
    const filenameElement = findOne(
      (elem) => elem.name === "a",
      node.childNodes,
      true
    );
    if (!filenameElement) return Op.REMOVE;

    const path = getAttributeValue(filenameElement, "href")?.replace("./", "");
    if (!path) return Op.REMOVE;

    const resource = metadata.attachments.find((a) =>
      path.includes(a.globalId)
    );
    const file = files.find((file) => file.path && file.path.endsWith(path));
    if (!file || !resource) return Op.REMOVE;

    const data = await file.bytes();
    if (!data) return Op.REMOVE;

    const hash = await hasher.hash(data);

    const attachment: Attachment = {
      data,
      filename: resource.displayName || hash,
      size: data.length,
      hash: hash,
      hashType: hasher.type,
      mime:
        resource?.mime ||
        detectFileType(data)?.mime ||
        "application/octet-stream",
      height: resource.extra.height,
      width: resource.extra.width
    };
    attachments.push(attachment);
    replaceElement(node, parseDocument(attachmentToHTML(attachment)));
    return Op.SKIP;
  }

  private handleCodeBlock(node: Element) {
    const syntax = findOne(
      (elem) => elem.name === "syntax",
      node.childNodes,
      true
    );
    if (!syntax) return Op.REMOVE;

    const language = getAttributeValue(syntax, "data-nimbus-language");
    if (!language) return Op.REMOVE;

    const code = findOne(
      (elem) => elem.name === "pre",
      syntax.childNodes,
      true
    );
    if (!code) return Op.REMOVE;

    node.name = "pre";
    node.attribs = { class: `lang-${language}` };
    code.name = "code";
    code.attribs = {};
    code.childNodes = [new Text(textContent(code))];
    node.childNodes = [code];
    return Op.SKIP;
  }

  private handleHintBlock(node: Element) {
    const text = findOne(
      (elem) => !!getAttributeValue(elem, "classname")?.includes("nimbus-text"),
      node.childNodes,
      true
    );
    if (!text) return Op.REMOVE;
    node.name = "div";
    node.attribs = {
      class: "callout",
      "data-callout-type": "hint"
    };
    node.childNodes = [
      new Element("h3", {}, [new Text("")]),
      new Element("p", {}, text.childNodes)
    ];
    return Op.SKIP;
  }
  private handleToggle(node: Element) {
    const header = selectOne(".nimbus-toggle-header", node.childNodes);
    const content = selectOne(".nimbus-toggle-content", node.childNodes);
    if (!header || !content || !isTag(header) || !isTag(content))
      return Op.REMOVE;
    node.name = "div";
    node.attribs = {
      class: "callout",
      "data-callout-type": "info"
    };
    node.childNodes = [
      new Element("h3", {}, [new Text(textContent(header))]),
      ...content.childNodes
    ];
    return Op.NOOP;
  }
  private handleTable(node: Element) {
    const table = findOne(
      (elem) => elem.name === "table",
      node.childNodes,
      true
    );
    const tfoot = findOne(
      (elem) => elem.name === "tfoot",
      node.childNodes,
      true
    );
    if (!table) return Op.REMOVE;
    if (tfoot) removeElement(tfoot);
    const th = selectAll("thead th.table-head-item", table.childNodes).map(
      (th) => {
        if (!isTag(th)) return th;
        th.childNodes = [new Element("p", {}, [new Text(textContent(th))])];
        return th;
      }
    );
    const tr = selectOne("thead > tr", table.childNodes);
    if (tr && isTag(tr)) tr.childNodes = th;

    selectAll("tbody td.table-head-item", table.childNodes).forEach((td) => {
      if (td.nextSibling) removeElement(td.nextSibling);
      removeElement(td);
    });

    replaceElement(node, table);
    return node;
  }
  private handleList(node: Element) {
    let listTagName = "ul";
    let listAttributes: Record<string, string> = {};
    for (const child of node.childNodes) {
      if (!isTag(child)) continue;
      const className = getAttributeValue(child, "class");
      if (className?.includes("list-item-checkbox")) {
        listTagName = "ul";
        listAttributes = { class: "checklist" };
        break;
      } else if (className?.includes("list-item-number")) {
        listTagName = "ol";
        break;
      } else if (className?.includes("list-item-bullet")) {
        listTagName = "ul";
        break;
      }
    }

    const list = nestedListToNodes(
      convertToNestedList(node.childNodes),
      listTagName,
      listAttributes,
      (li) => ({
        class: li.attributes["data-checked"] === "true" ? "checked" : ""
      })
    );
    if (!list) return Op.NOOP;
    replaceElement(node, list);
    return list;
  }
  private async handleWebClip(
    node: Element,
    metadata: Metadata,
    attachments: Attachment[],
    files: File[],
    hasher: IHasher
  ) {
    const titleElement = selectOne(
      ".collapsible-content-name-text",
      node.childNodes
    );
    const content = selectOne(".nimbus-html-body", node.childNodes);
    if (!content || !isTag(content)) return Op.REMOVE;

    const resources = findAll(
      (e) =>
        e.tagName === "img" ||
        (!!e.attribs.src && e.attribs.src.startsWith("./assets")),
      node.childNodes
    );
    for (const resourceElement of resources) {
      const src = getAttributeValue(resourceElement, "src")?.replace("./", "");
      const resource = metadata.attachments.find((res) =>
        src?.includes(res.globalId)
      );
      if (!resource || !src) continue;

      const file = files.find((file) => file.path && file.path.endsWith(src));
      const data = await file?.bytes();
      if (!file || !data) continue;

      resourceElement.name = "img";
      resourceElement.attribs.src = `data:${resource.mime};base64,${Buffer.from(
        data.buffer
      ).toString("base64")}`;
    }

    const data = new TextEncoder().encode(
      render(content.childNodes, {
        xmlMode: false,
        decodeEntities: true,
        encodeEntities: false,
        selfClosingTags: true
      })
    );
    const dataHash = await hasher.hash(data);
    const title =
      (titleElement && textContent(titleElement)) || metadata.title || dataHash;
    const attachment = {
      data,
      filename: `${sanitizeFilename(title, {
        replacement: "-"
      })}.clip`,
      size: data.length,
      hash: dataHash,
      hashType: hasher.type,
      mime: "application/vnd.notesnook.web-clip"
    };
    attachments.push(attachment);
    replaceElement(
      node,
      parseDocument(attachmentToHTML(attachment, metadata.url, title))
    );
    return Op.SKIP;
  }
  private handleBookmark(node: Element) {
    const href = selectOne(
      ".nimbus-bookmark__info__src",
      node.childNodes
    ) as Element;
    const text = selectOne(
      ".nimbus-bookmark__info__src-text",
      node.childNodes
    ) as Element;
    const description = selectOne(
      ".nimbus-bookmark__info__desc",
      node.childNodes
    ) as Element;
    const name = selectOne(
      ".nimbus-bookmark__info__name",
      node.childNodes
    ) as Element;
    if (!href || !text || !description || !name) return Op.REMOVE;
    replaceElement(
      node,
      parseDocument(
        markdowntoHTML(`**Title:** ${textContent(name)}

**URL:** [${textContent(text)}](${href.attribs.href})

**Description:** ${textContent(description)}

---`)
      )
    );
    return Op.SKIP;
  }
  private handleMention(node: Element) {
    const type = getAttributeValue(node, "data-mention-type");
    const name = getAttributeValue(node, "data-mention-name");
    const id = getAttributeValue(node, "data-mention-object_id");
    if (type !== "note" || !name || !id) return Op.REMOVE;
    this.ids[id] = this.ids[id] || createObjectId();
    node.name = "a";
    node.attribs = { href: `nn://note/${this.ids[id]}` };
    node.childNodes = [new Text(name)];
    return Op.SKIP;
  }
}

enum Op {
  SKIP,
  REMOVE,
  NOOP
}
async function visit(
  nodes: AnyNode[],
  handler: (node: AnyNode) => Op | Element | Promise<Op | Element>
) {
  const markForRemoval: AnyNode[] = [];
  for (const node of nodes) {
    const result = await handler(node);
    if (result === Op.SKIP) continue;
    if (result === Op.REMOVE) {
      markForRemoval.push(node);
      continue;
    }

    if (result instanceof Element) await visit(result.children, handler);
    else if ("children" in node) {
      await visit(node.children, handler);
    }
  }
  for (const node of markForRemoval) removeElement(node);
}

type ListItem = {
  childNodes: AnyNode[];
  children: ListItem[];
  attributes: Record<string, string>;
};
function convertToNestedList(list: AnyNode[]) {
  const result: ListItem[] = [];
  const stack: ListItem[] = [];

  list.forEach((li) => {
    if (!isTag(li) || li.name !== "li") {
      removeElement(li);
      return;
    }
    const indent = parseInt(
      li.attribs.class
        ?.split(" ")
        .find((c) => c.startsWith("indent-"))
        ?.replace("indent-", "") || "0"
    );

    const newItem: ListItem = {
      childNodes: li.childNodes,
      children: [],
      attributes: li.attribs
    };

    // If the stack is empty, or the current item's indent is 0, add to the root
    if (stack.length === 0 || indent === 0) {
      result.push(newItem);
      stack.length = 1; // Reset the stack to track root level
      stack[0] = newItem;
    } else {
      // If current indent is greater than the top item in the stack, nest under the last item
      if (indent > stack.length - 1) {
        stack[stack.length - 1].children.push(newItem);
      } else {
        // Pop stack to find the correct parent
        stack.length = indent + 1;
        stack[indent - 1].children.push(newItem);
      }

      // Update stack to include the current item
      stack[indent] = newItem;
    }
  });

  return result;
}

function nestedListToNodes(
  list: ListItem[],
  tag: string,
  attributes: Record<string, string>,
  listItemAttributes: (li: ListItem) => Record<string, string>
) {
  if (list.length <= 0) return;
  const nodes: Element[] = [];
  for (const li of list) {
    const nested = nestedListToNodes(
      li.children,
      tag,
      attributes,
      listItemAttributes
    );
    const children: AnyNode[] = li.childNodes.map((c) =>
      isText(c) ? new Element("p", {}, [c]) : c
    );
    if (nested) children.push(nested);
    nodes.push(new Element("li", listItemAttributes(li), children));
  }
  return new Element(tag, attributes, nodes);
}
