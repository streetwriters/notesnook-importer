import {
  AnyNode,
  ChildNode,
  Document,
  Element,
  ParentNode,
  Text
} from "domhandler";
import {
  findAll,
  findOne,
  isTag,
  removeElement,
  replaceElement,
  appendChild,
  textContent,
  append,
  prepend
} from "domutils";

export function convertBrToSingleSpacedParagraphs(document: Document): void {
  const brs = findAll(
    (elem) => isTag(elem) && elem.tagName === "br",
    document.childNodes
  );

  for (const br of brs) {
    if (!br.parent) continue;

    let paragraph = findClosest(br, "p");

    if (!paragraph) {
      // we split and wrap all text nodes into their own single spaced
      // paragraphs
      const nodes = getSiblingTextNodes(br);

      if (nodes.length > 0) {
        paragraph = new Element("p", { "data-spacing": "single" }, []);
        nodes.reverse().forEach((node) => appendChild(paragraph!, node));
        replaceElement(br, paragraph);
        continue;
      }

      // we convert the next pargraph into a single spaced paragraph
      const nextSibling = br.nextSibling;
      if (nextSibling && isTag(nextSibling) && nextSibling.tagName === "p") {
        nextSibling.attribs["data-spacing"] = "single";
      }

      // just convert all br tags into single spaced paragraphs
      const newParagraph = new Element("p", { "data-spacing": "single" }, []);
      replaceElement(br, newParagraph);
      continue;
    }

    if (
      paragraph &&
      (paragraph.childNodes.length === 1 ||
        !textContent(paragraph) ||
        textContent(paragraph).trim().length === 0)
    ) {
      // if paragraph is empty, we clean out the paragraph and move on.
      paragraph.childNodes = [];
      continue;
    }

    if (paragraph) {
      splitOn(paragraph, br);
      const brIndex = paragraph.children.indexOf(br);
      const afterBr = paragraph.children.slice(brIndex + 1);
      removeElement(br);
      if (afterBr.length > 0) {
        const newParagraph = new Element("p", {
          ...paragraph.attribs,
          "data-spacing": "single"
        });
        for (const child of afterBr) {
          appendChild(newParagraph, child);
        }
        append(paragraph, newParagraph);
      }
    }
  }
}

function findClosest(node: ChildNode, tagName: string): Element | null {
  let current = node.parent;
  while (current) {
    if (isTag(current) && current.tagName === tagName) {
      return current;
    }
    current = current.parent;
  }
  return null;
}

function splitOn(bound: Element, cutElement: ChildNode) {
  let grandparent: ParentNode | null = null;
  for (let parent = cutElement.parent; bound !== parent; parent = grandparent) {
    if (parent && isTag(parent)) {
      const right = new Element(
        parent.tagName,
        { ...parent.attribs },
        [],
        parent.type
      );
      let nextSibling;
      while ((nextSibling = cutElement.next)) appendChild(right, nextSibling);
      grandparent = parent.parent ?? null;
      if (grandparent) {
        append(parent, right);
        prepend(right, cutElement);
      }
    }
  }
}

const inlineTags = new Set([
  "A",
  "ABBR",
  "B",
  "BDI",
  "BDO",
  // "BR",
  "CITE",
  "CODE",
  "DATA",
  "DFN",
  "EM",
  "I",
  // "IMG",
  // "INPUT",
  "KBD",
  "LABEL",
  "MARK",
  "Q",
  "S",
  "SAMP",
  "SMALL",
  "SPAN",
  "STRONG",
  "SUB",
  "SUP",
  "TEXTAREA",
  "TIME",
  "U",
  "VAR",
  "WBR"
]);

function getSiblingTextNodes(element: ChildNode): ChildNode[] {
  const siblings = [];
  let sibling: ChildNode | null = element;
  while ((sibling = sibling.previousSibling)) {
    if (isTag(sibling) && !inlineTags.has(sibling.tagName.toUpperCase())) break;
    else siblings.push(sibling);
  }
  return siblings;
}
