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

import { encodeNonAsciiHTML } from "entities";
import { remark } from "remark";
import remarkGfm from "remark-gfm";
import remarkRehype from "remark-rehype";
import rehypeStringify from "rehype-stringify";
import { Plugin, Transformer } from "unified";
import { visit } from "unist-util-visit";
import type {
  Root as HastRoot,
  ElementContent
} from "remark-rehype/node_modules/@types/hast";
import type { Paragraph, Root, PhrasingContent } from "mdast";
import { isElement } from "hast-util-is-element";
import remarkMath from "remark-math";
import remarkSubSuper from "remark-supersub";
import { Data, Literal, Node, Parent } from "unist";

export function markdowntoHTML(
  src: string,
  options: { allowDangerousHtml: boolean; encodeHtmlEntities?: boolean } = {
    allowDangerousHtml: true,
    encodeHtmlEntities: true
  }
) {
  const result = remark()
    .use(remarkGfm, { singleTilde: false })
    .use(remarkMath)
    .use(remarkSubSuper)
    .use(remarkHighlight)
    .use(removeComments)
    .use(convertFileEmbeds)
    .use(convertHardLineBreaks)
    .use(remarkRehype, { allowDangerousHtml: options.allowDangerousHtml })
    .use(escapeCode)
    .use(fixChecklistClasses)
    .use(liftLanguageToPreFromCode)
    .use(collapseMultilineParagraphs)
    .use(rehypeStringify, {
      allowDangerousHtml: options.allowDangerousHtml,
      tightSelfClosing: true,
      closeSelfClosing: true,
      closeEmptyElements: true,
      characterReferences: {
        useShortestReferences: true
      }
    })
    .processSync(src);
  return result.value as string;
}

const fixChecklistClasses: Plugin = function () {
  return (tree) => {
    visit(tree, (node) => {
      if (
        !isElement(node, "ul") ||
        !node.properties ||
        !(node.properties?.className as string[])?.includes(
          "contains-task-list"
        )
      )
        return;

      node.properties.className = ["checklist"];

      for (const child of node.children) {
        if (!isElement(child, "li") || !child.properties) continue;

        const isChecked =
          isElement(child.children[0]) && child.children[0].properties?.checked;

        child.properties.className = ["checklist--item"];
        if (isChecked) child.properties.className.push("checked");

        child.children = child.children?.slice(1);

        // remove leading space from the first text node if present
        if (child.children.length > 0 && child.children[0].type === "text") {
          child.children[0].value = child.children[0].value.replace(/^ /, "");
        }
      }
    });
  };
};

const liftLanguageToPreFromCode: Plugin = function () {
  return (tree) => {
    visit(tree, (node) => {
      if (!isElement(node, "pre") || !isElement(node.children[0], "code"))
        return;
      node.properties = node.children[0].properties;
    });
  };
};

const removeComments: Plugin<[], Root, Root> = function () {
  return (tree: Root) => {
    visit(tree, "text", (node) => {
      node.value = node.value.replace(/%%.+%%\s/, "");
    });

    let isBlockCommentOpen = false;
    visit(tree, (node, index, parent) => {
      if (node.type === "paragraph") {
        const first = node.children[0];
        const last = node.children[node.children.length - 1];

        const isOpening = first.type === "text" && first.value.startsWith("%%");
        const isClosing = last.type === "text" && last.value.endsWith("%%");

        const remove =
          (isOpening && isClosing) ||
          (!isBlockCommentOpen && isOpening) ||
          (isBlockCommentOpen && isClosing) ||
          isBlockCommentOpen;

        if (isOpening && !isBlockCommentOpen) isBlockCommentOpen = true;
        if (isBlockCommentOpen && isClosing) isBlockCommentOpen = false;

        if (remove && index) {
          parent?.children.splice(index, 1);
          return ["skip", index];
        }
      } else if (isBlockCommentOpen && index) {
        parent?.children.splice(index, 1);
        return ["skip", index];
      }
    });
  };
};

const fileEmbedRule = /!\[\[(.+)\]\]/;
const convertFileEmbeds: Plugin<[], Root, Root> = function () {
  return (tree: Root) => {
    visit(tree, "text", (node, index, parent) => {
      const match = fileEmbedRule.exec(node.value);
      if (match && index !== undefined) {
        const [href, dimensions] = match[1].split("|");
        const [width, height] = dimensions ? dimensions.split("x") : [];
        const [filename, _] = href.split("#");
        parent?.children.splice(
          index,
          1,
          {
            type: "text",
            value: node.value.slice(0, match.index)
          },
          {
            type: "link",
            url: filename,
            children: [],
            data: {
              hProperties: {
                width: width && !isNaN(parseInt(width)) ? width : null,
                height: height && !isNaN(parseInt(height)) ? height : null
              }
            }
          },
          {
            type: "text",
            value: node.value.slice(match.index + match[0].length)
          }
        );
        return ["skip", index];
      }
    });
  };
};

const remarkHighlight: () => Transformer = () => (tree) => {
  visit(tree, ["text"], (node, index, parent) => {
    const { value } = node as Literal<string>;

    const values = value.split(/==/);
    if (values.length === 1 || values.length % 2 === 0) {
      return;
    }

    const children: Node<Data>[] = values.map((str, i) =>
      i % 2 === 0
        ? {
            type: "text",
            value: str
          }
        : {
            type: "highlight",
            data: {
              hName: "span",
              hProperties: {
                style: `background-color: rgb(255, 255, 0);`
              }
            },
            children: [
              {
                type: "text",
                value: str
              }
            ]
          }
    );
    (parent as Parent).children.splice(index!, 1, ...children);
    return ["skip", index];
  });
};

const escapeCode: Plugin<[], HastRoot, HastRoot> = function () {
  return (tree: HastRoot) => {
    visit(tree, "element", (node) => {
      if (!isElement(node, "code")) return;
      const children: ElementContent[] = [];
      node.children.forEach((child) => {
        if (child.type === "text") {
          const lines = child.value.split(/\r\n|\n/gm);
          lines.forEach((line, i) => {
            children.push({
              type: "text",
              value: line
            });
            if (i !== lines.length - 1)
              children.push({
                type: "element",
                children: [],
                tagName: "br"
              });
          });
        }
      });
      node.children = children;
    });
  };
};

const collapseMultilineParagraphs: Plugin<[], HastRoot, HastRoot> =
  function () {
    return (tree: HastRoot) => {
      visit(tree, "text", (node) => {
        if (node.value.length > 1)
          node.value = node.value.replace(/[\r\n]/gm, " "); //.trim();
      });
    };
  };

export function textToHTML(src: string) {
  return src
    .split(/[\r\n]/)
    .map((line) =>
      line
        ? `<p data-spacing="single">${encodeLine(line)}</p>`
        : `<p data-spacing="single"></p>`
    )
    .join("");
}

function encodeLine(line: string) {
  line = encodeNonAsciiHTML(line);
  line = line.replace(/(^ +)|( {2,})/g, (sub, ...args) => {
    const [starting, inline] = args;
    if (starting) return "&nbsp;".repeat(starting.length);
    if (inline) return "&nbsp;".repeat(inline.length);
    return sub;
  });
  return line;
}

const convertHardLineBreaks: Plugin<[], Root, Root> = function () {
  return (tree) => {
    visit(tree, "paragraph", (node, index, parent) => {
      if (
        !parent ||
        typeof index !== "number" ||
        !Array.isArray(node.children)
      ) {
        return;
      }

      const hasBreak = node.children.some(
        (c: PhrasingContent) => c.type === "break"
      );
      if (!hasBreak) return;

      const parts: PhrasingContent[][] = [];
      let current: PhrasingContent[] = [];
      for (const child of node.children) {
        if (child.type === "break") {
          parts.push(current);
          current = [];
        } else {
          current.push(child);
        }
      }
      parts.push(current);

      const newParagraphs: Paragraph[] = parts.map((children) => ({
        type: "paragraph",
        children: children.length ? children : [{ type: "text", value: "" }],
        data: {
          hProperties: {
            "data-spacing": "single"
          }
        }
      }));
      parent.children.splice(index, 1, ...newParagraphs);
      return index + newParagraphs.length;
    });
  };
};
