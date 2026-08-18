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

import {
  Content,
  EmbeddedFile,
  Image,
  Ink,
  InkStroke,
  List,
  Outline,
  OutlineElement,
  OutlineItem,
  Page,
  RichText,
  Table,
  TableCell
} from "../onenote/types";
import { ActionItemStatus, NoteTagShape } from "../one/property-set";
import {
  ICON_ARROW_RIGHT,
  ICON_AWARD,
  ICON_BOOK,
  ICON_BUBBLE,
  ICON_CHECKBOX_COMPLETE,
  ICON_CHECKBOX_EMPTY,
  ICON_CHECK_MARK,
  ICON_CIRCLE,
  ICON_CONTACT,
  ICON_EMAIL,
  ICON_ERROR,
  ICON_FILM,
  ICON_FLAG,
  ICON_HOME,
  ICON_LIGHT_BULB,
  ICON_LINK,
  ICON_LOCK,
  ICON_MUSIC,
  ICON_PAPER,
  ICON_PEN,
  ICON_PERSON,
  ICON_PHONE,
  ICON_QUESTION_MARK,
  ICON_SQUARE,
  ICON_STAR
} from "./icons";
import { AttributeSet, StyleSet, px } from "./utils";

const COLOR_BLUE = "#4673b7";
const COLOR_GREEN = "#369950";
const COLOR_ORANGE = "#dba24d";
const COLOR_PINK = "#f78b9d";
const COLOR_RED = "#db5b4d";
const COLOR_YELLOW = "#ffd678";

const FORMAT_NUMBERED_LIST = "\ufffd";
const HYPERLINK_MARKER = "\ufddfHYPERLINK \"";

/**
 * Resolves the binary data of an image or embedded file into an HTML string.
 * Used by the importer to attach hashed attachments instead of writing files
 * to disk.
 */
export type ResourceResolver = (
  data: Uint8Array,
  filename: string,
  extension?: string,
  meta?: { width?: number; height?: number; altText?: string }
) => string | Promise<string>;

export type RenderOptions = {
  resolveResource?: ResourceResolver;
};

type NoteTagStyle = StyleSet;

class PageRenderer {
  private inList = false;
  private globalStyles = new Map<string, StyleSet>();
  private globalClasses = new Set<string>();
  private usedFilenames = new Set<string>();

  constructor(private readonly options: RenderOptions) {}

  async renderPage(page: Page): Promise<string> {
    const titleText = page.titleText || "Untitled Page";

    let content = "";

    if (page.title) {
      const title = page.title;
      const styles = new StyleSet();
      styles.set("position", "absolute");
      styles.set("top", px(title.offsetVertical + 0.5));
      styles.set("left", px(title.offsetHorizontal + 1.0));

      let titleField = `<div class="title" style="${styles}">`;
      for (const outline of title.contents) {
        titleField += await this.renderOutline(outline);
      }
      titleField += "</div>";
      content += titleField;
    }

    const pageContent = (
      await Promise.all(page.contents.map((c) => this.renderPageContent(c)))
    ).join("");
    content += pageContent;

    return renderPageTemplate(titleText, content, this.globalStyles);
  }

  private genClass(prefix: string): string {
    let i = 0;
    while (true) {
      const className = `${prefix}-${i}`;
      if (!this.globalClasses.has(className)) {
        this.globalClasses.add(className);
        return className;
      }
      i += 1;
    }
  }

  private renderPageContent(
    content: Page["contents"][number]
  ): Promise<string> | string {
    switch (content.type) {
      case "outline":
        return this.renderOutline(content.outline);
      case "image":
        return this.renderImage(content.image);
      case "embeddedFile":
        return this.renderEmbeddedFile(content.embeddedFile);
      case "ink":
        return this.renderInk(content.ink, undefined, false);
      case "unknown":
        return "";
    }
  }

  private renderContent(content: Content): Promise<string> | string {
    switch (content.type) {
      case "richText":
        return this.renderRichText(content.richText);
      case "table":
        return this.renderTable(content.table);
      case "image":
        return this.renderImage(content.image);
      case "embeddedFile":
        return this.renderEmbeddedFile(content.embeddedFile);
      case "ink":
        return this.renderInk(content.ink, undefined, false);
      case "unknown":
        return "";
    }
  }

  // -----------------------------------------------------------------------
  // Rich text
  // -----------------------------------------------------------------------

  private renderRichText(text: RichText): string {
    let content = "";
    let style = this.parseParagraphStyles(text);

    const noteTags = this.renderNoteTags(text.noteTags);
    if (noteTags) {
      content += noteTags.markup;
      style.extend(noteTags.styles);
    }

    content += this.parseContent(text);

    if (content.startsWith("http://") || content.startsWith("https://")) {
      content = `<a href="${content}">${content}</a>`;
    }

    const tag = text.paragraphStyle.styleId;
    if (
      tag &&
      !this.inList &&
      tag !== "PageDateTime" &&
      tag !== "PageTitle"
    ) {
      return `<${tag}${style.length > 0 ? ` style="${style}"` : ""}>${content}</${tag}>`;
    } else if (style.length > 0) {
      return `<span style="${style}">${content}</span>`;
    }
    return content;
  }

  private parseContent(data: RichText): string {
    if (data.embeddedObjects.length > 0) {
      return data.embeddedObjects
        .map((object) => {
          switch (object.type) {
            case "ink":
              return this.renderInk(object.ink, object.boundingBox, true);
            case "inkSpace":
              return `<span class="ink-space" style="padding-left: ${px(
                object.width
              )}; padding-top: ${px(object.height)};"></span>`;
            case "inkLineBreak":
              return '<span class="ink-linebreak"><br></span>';
          }
        })
        .join("");
    }

    const indices = data.textRunIndices;
    const styles = data.textRunFormatting;
    let text = data.text;

    if (text.length === 0) text = "&nbsp;";

    if (indices.length === 0) {
      return fixNewlines(text);
    }

    // Split the text into parts specified by the text run indices.
    const parts: string[] = [];
    for (let i = indices.length - 1; i >= 0; --i) {
      const index = indices[i];
      parts.push(text.slice(index));
      text = text.slice(0, index);
    }
    parts.push(text);
    parts.reverse();

    let inHyperlink = false;
    const content = parts
      .map((part, i) => {
        const style = styles[i] ?? defaultParagraphStyling();
        if (style.hyperlink) {
          const rendered = this.renderHyperlink(part, style, inHyperlink);
          inHyperlink = true;
          return rendered;
        } else {
          inHyperlink = false;
          const parsed = this.parseStyle(style);
          if (parsed.length > 0) {
            return `<span style="${parsed}">${part}</span>`;
          }
          return part;
        }
      })
      .join("");

    return fixNewlines(content);
  }

  private renderHyperlink(
    text: string,
    style: RichText["textRunFormatting"][number],
    inHyperlink: boolean
  ): string {
    const styles = this.parseStyle(style);

    if (text.startsWith(HYPERLINK_MARKER)) {
      const url = text.slice(HYPERLINK_MARKER.length).replace(/"$/, "");
      return `<a href="${url}" style="${styles}">`;
    } else if (inHyperlink) {
      return `${text}</a>`;
    } else {
      return `<a href="${text}" style="${styles}">${text}</a>`;
    }
  }

  private parseParagraphStyles(text: RichText): StyleSet {
    if (text.embeddedObjects.length > 0) {
      return new StyleSet();
    }

    const styles = this.parseStyle(text.paragraphStyle);
    if (text.textRunFormatting.length === 1) {
      styles.extend(this.parseStyle(text.textRunFormatting[0]));
    }

    if (text.paragraphSpaceBefore > 0) {
      styles.set("padding-top", px(text.paragraphSpaceBefore));
    }
    if (text.paragraphSpaceAfter > 0) {
      styles.set("padding-bottom", px(text.paragraphSpaceAfter));
    }

    switch (text.paragraphAlignment) {
      case 2: // Center
        styles.set("text-align", "center");
        break;
      case 3: // Right
        styles.set("text-align", "right");
        break;
    }

    return styles;
  }

  private parseStyle(style: RichText["textRunFormatting"][number]): StyleSet {
    return this.parseStyleRaw(style);
  }

  private parseStyleRaw(style: RichText["textRunFormatting"][number]): StyleSet {
    const styles = new StyleSet();

    if (style.bold) styles.set("font-weight", "bold");
    if (style.italic) styles.set("font-style", "italic");
    if (style.underline) styles.set("text-decoration", "underline");
    if (style.superscript) styles.set("vertical-align", "super");
    if (style.subscript) styles.set("vertical-align", "sub");
    if (style.strikethrough) styles.set("text-decoration", "line-through");
    if (style.font) styles.set("font-family", style.font);
    if (style.fontSize)
      styles.set("font-size", `${style.fontSize / 2.0}pt`);
    if (style.fontColor?.type === "manual") {
      styles.set(
        "color",
        `rgb(${style.fontColor.r},${style.fontColor.g},${style.fontColor.b})`
      );
    }
    if (style.highlight?.type === "manual") {
      styles.set(
        "background-color",
        `rgb(${style.highlight.r},${style.highlight.g},${style.highlight.b})`
      );
    }

    return styles;
  }

  // -----------------------------------------------------------------------
  // Note tags
  // -----------------------------------------------------------------------

  private renderWithNoteTags(
    noteTags: RichText["noteTags"],
    content: string
  ): string {
    const rendered = this.renderNoteTags(noteTags);
    if (!rendered) return content;
    return `<div style="${rendered.styles}">${rendered.markup}${content}</div>`;
  }

  private renderNoteTags(
    noteTags: RichText["noteTags"]
  ): { markup: string; styles: StyleSet } | undefined {
    if (noteTags.length === 0) return undefined;

    let markup = "";
    const styles = new StyleSet();

    for (const noteTag of noteTags) {
      const definition = noteTag.definition;
      if (!definition) continue;

      if (definition.highlightColor?.type === "manual") {
        styles.set(
          "background-color",
          `rgb(${definition.highlightColor.r},${definition.highlightColor.g},${definition.highlightColor.b})`
        );
      }
      if (definition.textColor?.type === "manual") {
        styles.set(
          "color",
          `rgb(${definition.textColor.r},${definition.textColor.g},${definition.textColor.b})`
        );
      }

      if (definition.shape !== 0) {
        const icon = this.noteTagIcon(definition.shape, noteTag.itemStatus);
        const iconClasses = ["note-tag-icon"];
        if (icon.style.length > 0) {
          const className = this.genClass("icon");
          iconClasses.push(className);
          this.globalStyles.set(`.${className} > svg`, icon.style);
        }
        markup += `<span class="${iconClasses.join(" ")}">${icon.icon}</span>`;
      }
    }

    return { markup, styles };
  }

  private hasNoteTag(element: OutlineElement): boolean {
    return element.contents.some(
      (content) =>
        content.type === "richText" && content.richText.noteTags.length > 0
    );
  }

  private noteTagIcon(
    shape: NoteTagShape,
    status: ActionItemStatus
  ): { icon: string; style: StyleSet } {
    let style = new StyleSet();

    switch (shape) {
      case 0: // NoIcon
        return { icon: "", style };
      case 1: return this.iconCheckbox(status, style, COLOR_GREEN);
      case 2: return this.iconCheckbox(status, style, COLOR_YELLOW);
      case 3: return this.iconCheckbox(status, style, COLOR_BLUE);
      case 4: return this.iconCheckboxWith(status, style, COLOR_GREEN, ICON_STAR);
      case 5: return this.iconCheckboxWith(status, style, COLOR_YELLOW, ICON_STAR);
      case 6: return this.iconCheckboxWith(status, style, COLOR_BLUE, ICON_STAR);
      case 7: return this.iconCheckboxWith(status, style, COLOR_GREEN, '<span class="content">!</span>');
      case 8: return this.iconCheckboxWith(status, style, COLOR_YELLOW, '<span class="content">!</span>');
      case 9: return this.iconCheckboxWith(status, style, COLOR_BLUE, '<span class="content">!</span>');
      case 10: return this.iconCheckboxWith(status, style, COLOR_GREEN, ICON_ARROW_RIGHT);
      case 11: return this.iconCheckboxWith(status, style, COLOR_YELLOW, ICON_ARROW_RIGHT);
      case 12: return this.iconCheckboxWith(status, style, COLOR_BLUE, ICON_ARROW_RIGHT);
      case 13: {
        style.set("fill", COLOR_YELLOW);
        return { icon: ICON_STAR, style: this.iconStyle("normal", style) };
      }
      case 14: // BlueFollowUpFlag
      case 16: // BlueRightArrow
      case 18: // Meeting
      case 19: // TimeSensitive
      case 22: // Pushpin
      case 25: // SmilingFace
      case 27: // YellowKey
        return { icon: "", style };
      case 15: return { icon: ICON_QUESTION_MARK, style: this.iconStyle("normal", style) };
      case 17: return { icon: ICON_ERROR, style: this.iconStyle("normal", style) };
      case 20: return { icon: ICON_PHONE, style: this.iconStyle("normal", style) };
      case 21: return { icon: ICON_LIGHT_BULB, style: this.iconStyle("normal", style) };
      case 23: return { icon: ICON_HOME, style: this.iconStyle("normal", style) };
      case 24: return { icon: ICON_BUBBLE, style: this.iconStyle("normal", style) };
      case 26: return { icon: ICON_AWARD, style: this.iconStyle("normal", style) };
      case 28: return this.iconCheckboxWith(status, style, COLOR_BLUE, '<span class="content">1</span>');
      case 30: return this.iconCheckboxWith(status, style, COLOR_BLUE, '<span class="content">2</span>');
      case 32: return this.iconCheckboxWith(status, style, COLOR_BLUE, '<span class="content">3</span>');
      case 35: return this.iconCheckmark(style, COLOR_BLUE);
      case 36: return this.iconCircle(style, COLOR_BLUE);
      case 48: return this.iconCheckboxWith(status, style, COLOR_GREEN, '<span class="content">1</span>');
      case 50: return this.iconCheckboxWith(status, style, COLOR_GREEN, '<span class="content">2</span>');
      case 52: return this.iconCheckboxWith(status, style, COLOR_GREEN, '<span class="content">3</span>');
      case 55: return this.iconCheckmark(style, COLOR_GREEN);
      case 56: return this.iconCircle(style, COLOR_GREEN);
      case 69: return this.iconCheckboxWith(status, style, COLOR_YELLOW, '<span class="content">1</span>');
      case 71: return this.iconCheckboxWith(status, style, COLOR_YELLOW, '<span class="content">2</span>');
      case 73: return this.iconCheckboxWith(status, style, COLOR_YELLOW, '<span class="content">3</span>');
      case 76: return this.iconCheckmark(style, COLOR_YELLOW);
      case 77: return this.iconCircle(style, COLOR_YELLOW);
      case 89: // FollowUpTodayFlag
      case 90: // FollowUpTomorrowFlag
      case 91: // FollowUpThisWeekFlag
      case 92: // FollowUpNextWeekFlag
      case 93: // NoFollowUpDateFlag
        return this.iconCheckboxWith(status, style, COLOR_BLUE, ICON_FLAG);
      case 94: return this.iconCheckboxWith(status, style, COLOR_BLUE, ICON_PERSON);
      case 95: return this.iconCheckboxWith(status, style, COLOR_YELLOW, ICON_PERSON);
      case 96: return this.iconCheckboxWith(status, style, COLOR_GREEN, ICON_PERSON);
      case 97: return this.iconCheckboxWith(status, style, COLOR_BLUE, ICON_FLAG);
      case 98: return this.iconCheckboxWith(status, style, COLOR_RED, ICON_FLAG);
      case 99: return this.iconCheckboxWith(status, style, COLOR_GREEN, ICON_FLAG);
      case 100: return this.iconSquare(style, COLOR_RED);
      case 101: return this.iconSquare(style, COLOR_YELLOW);
      case 102: return this.iconSquare(style, COLOR_BLUE);
      case 103: return this.iconSquare(style, COLOR_GREEN);
      case 104: return this.iconSquare(style, COLOR_ORANGE);
      case 105: return this.iconSquare(style, COLOR_PINK);
      case 106: return { icon: ICON_EMAIL, style: this.iconStyle("normal", style) };
      case 107: // ClosedEnvelope
      case 108: // OpenEnvelope
      case 109: // MobilePhone
      case 110: // TelephoneWithClock
      case 111: // QuestionBalloon
      case 112: // PaperClip
      case 113: // FrowningFace
      case 114: // InstantMessagingContactPerson
      case 115: // PersonWithExclamationMark
      case 116: // TwoPeople
      case 117: // ReminderBell
        return { icon: "", style };
      case 118: return { icon: ICON_CONTACT, style: this.iconStyle("normal", style) };
      case 119: // RoseOnAStem
      case 120: // CalendarDateWithClock
        return { icon: "", style };
      case 121: return { icon: ICON_MUSIC, style: this.iconStyle("normal", style) };
      case 122: return { icon: ICON_FILM, style: this.iconStyle("normal", style) };
      case 123: // QuotationMark
      case 124: // Globe
        return { icon: "", style };
      case 125: return { icon: ICON_LINK, style: this.iconStyle("normal", style) };
      case 126: // Laptop
      case 127: // Plane
      case 128: // Car
      case 129: // Binoculars
      case 130: // PresentationSlide
        return { icon: "", style };
      case 131: return { icon: ICON_LOCK, style: this.iconStyle("normal", style) };
      case 132: return { icon: ICON_BOOK, style: this.iconStyle("normal", style) };
      case 133: // NotebookWithClock
        return { icon: "", style };
      case 134: return { icon: ICON_PAPER, style: this.iconStyle("normal", style) };
      case 135: // Research
        return { icon: "", style };
      case 136: return { icon: ICON_PEN, style: this.iconStyle("normal", style) };
      default:
        return { icon: "", style };
    }
  }

  private iconCheckbox(
    status: ActionItemStatus,
    style: StyleSet,
    color: string
  ): { icon: string; style: StyleSet } {
    style.set("fill", color);
    const icon = status.completed ? ICON_CHECKBOX_COMPLETE : ICON_CHECKBOX_EMPTY;
    return { icon, style: this.iconStyle("large", style) };
  }

  private iconCheckboxWith(
    status: ActionItemStatus,
    style: StyleSet,
    color: string,
    secondaryIcon: string
  ): { icon: string; style: StyleSet } {
    style.set("fill", color);
    const icon = `${
      status.completed ? ICON_CHECKBOX_COMPLETE : ICON_CHECKBOX_EMPTY
    }<span class="icon-secondary">${secondaryIcon}</span>`;
    return { icon, style: this.iconStyle("large", style) };
  }

  private iconCheckmark(
    style: StyleSet,
    color: string
  ): { icon: string; style: StyleSet } {
    style.set("fill", color);
    return { icon: ICON_CHECK_MARK, style: this.iconStyle("large", style) };
  }

  private iconCircle(
    style: StyleSet,
    color: string
  ): { icon: string; style: StyleSet } {
    style.set("fill", color);
    return { icon: ICON_CIRCLE, style: this.iconStyle("normal", style) };
  }

  private iconSquare(
    style: StyleSet,
    color: string
  ): { icon: string; style: StyleSet } {
    style.set("fill", color);
    return { icon: ICON_SQUARE, style: this.iconStyle("large", style) };
  }

  private iconStyle(
    size: "normal" | "large",
    style: StyleSet
  ): StyleSet {
    if (size === "normal") {
      style.set("height", "16px");
      style.set("width", "16px");
    } else {
      style.set("height", "20px");
      style.set("width", "20px");
    }

    if (!this.inList) {
      style.set("left", size === "normal" ? "-23px" : "-25px");
    } else {
      style.set("left", size === "normal" ? "-38px" : "-40px");
    }

    return style;
  }

  // -----------------------------------------------------------------------
  // Outline
  // -----------------------------------------------------------------------

  private async renderOutline(outline: Outline): Promise<string> {
    const attrs = new AttributeSet();
    const styles = new StyleSet();

    attrs.set("class", "container-outline");

    if (outline.layoutMaxWidth !== undefined) {
      const outlineWidth = outline.isLayoutSizeSetByUser
        ? outline.layoutMaxWidth
        : Math.max(outline.layoutMaxWidth, 13.0);
      styles.set("max-width", px(outlineWidth));
    }

    if (
      outline.offsetHorizontal !== undefined ||
      outline.offsetVertical !== undefined
    ) {
      styles.set("position", "absolute");
    }
    if (outline.offsetHorizontal !== undefined) {
      styles.set("left", px(outline.offsetHorizontal));
    }
    if (outline.offsetVertical !== undefined) {
      styles.set("top", px(outline.offsetVertical));
    }

    if (styles.length > 0) attrs.set("style", styles.toString());

    let contents = `<div ${attrs}>`;
    contents += await this.renderOutlineItems(
      outline.items,
      0,
      outline.childLevel,
      outline.indents
    );
    contents += "</div>";

    return contents;
  }

  private renderOutlineItems(
    items: OutlineItem[],
    parentLevel: number,
    currentLevel: number,
    indents: number[]
  ): Promise<string> {
    return this.renderList(
      flattenOutlineItems(items, parentLevel, currentLevel),
      indents
    );
  }

  private async renderOutlineElement(
    element: OutlineElement,
    parentLevel: number,
    currentLevel: number,
    indents: number[]
  ): Promise<string> {
    let indentWidth = 0;
    for (let i = parentLevel + 1; i <= currentLevel; ++i) {
      indentWidth += indents[i] ?? 0.75;
    }

    const isList = this.isList(element);

    const attrs = new AttributeSet();
    attrs.set("class", "outline-element");
    const styles = new StyleSet();
    styles.set("margin-left", px(indentWidth));
    attrs.set("style", styles.toString());

    let contents = isList ? `<li ${attrs}>` : `<div ${attrs}>`;
    this.inList = isList;

    contents += (await Promise.all(
      element.contents.map((content) => this.renderContent(content))
    )).join("");

    this.inList = false;

    if (!isList) contents += "</div>";

    const children = element.children;
    if (children.length > 0) {
      contents += await this.renderOutlineItems(
        children,
        currentLevel,
        currentLevel + element.childLevel,
        indents
      );
    }

    if (isList) contents += "</li>";
    contents += "\n";

    return contents;
  }

  private isList(element: OutlineElement): boolean {
    return element.listContents.length > 0;
  }

  // -----------------------------------------------------------------------
  // Lists
  // -----------------------------------------------------------------------

  private async renderList(
    elements: { element: OutlineElement; parentLevel: number; currentLevel: number }[],
    indents: number[]
  ): Promise<string> {
    let contents = "";
    let inList = false;
    let listEnd: string | undefined;

    for (const { element, parentLevel, currentLevel } of elements) {
      if (!inList && this.isList(element)) {
        const tags = this.listTags(element);
        contents += tags[0];
        listEnd = tags[1];
        inList = true;
      }

      if (inList && !this.isList(element)) {
        contents += listEnd ?? "";
        inList = false;
      }

      contents += await this.renderOutlineElement(
        element,
        parentLevel,
        currentLevel,
        indents
      );
    }

    if (inList) {
      contents += listEnd ?? "";
    }

    return contents;
  }

  private listTags(element: OutlineElement): [string, string] {
    const list = element.listContents[0];
    const tag = this.isNumberedList(list) ? "ol" : "ul";
    const attrs = this.listAttrs(list, element.listSpacing);
    return [`<${tag} ${attrs}>`, `</${tag}>`];
  }

  private listAttrs(list: List, spacing?: number): AttributeSet {
    const attrs = new AttributeSet();
    const containerStyle = new StyleSet();
    const itemStyle = new StyleSet();
    const markerStyle = new StyleSet();

    let listFont = list.listFont;
    let listFormat = [...list.listFormat];
    let fontSize = list.fontSize;

    const fixed = this.fixWingdings(listFont, listFormat, fontSize);
    listFont = fixed.listFont;
    listFormat = fixed.listFormat;
    fontSize = fixed.fontSize;

    if (listFormat[0] === FORMAT_NUMBERED_LIST) {
      switch (listFormat[1]) {
        case "\u0000":
          break;
        case "\u0001":
          containerStyle.set("list-style-type", "upper-roman");
          break;
        case "\u0002":
          containerStyle.set("list-style-type", "lower-roman");
          break;
        case "\u0003":
          containerStyle.set("list-style-type", "upper-latin");
          break;
        case "\u0004":
          containerStyle.set("list-style-type", "lower-latin");
          break;
      }
    } else if (listFormat.length === 1) {
      markerStyle.set("content", `'${listFormat[0]}'`);
    }

    const bulletSpacing = spacing ?? 0.2;
    itemStyle.set("padding-left", px(bulletSpacing));
    containerStyle.set("position", "relative");
    containerStyle.set("left", px(-bulletSpacing));

    if (listFont) markerStyle.set("font-family", listFont);
    if (list.font) markerStyle.set("font-family", list.font);
    if (list.fontColor?.type === "manual") {
      markerStyle.set(
        "color",
        `rgb(${list.fontColor.r},${list.fontColor.g},${list.fontColor.b})`
      );
    }
    if (fontSize) markerStyle.set("font-size", `${fontSize / 2.0}pt`);
    if (list.listRestart !== undefined) {
      attrs.set("start", list.listRestart.toString());
    }
    if (containerStyle.length > 0) attrs.set("style", containerStyle.toString());

    const className = this.genClass("list");
    if (markerStyle.length > 0) {
      attrs.set("class", className);
      this.globalStyles.set(`.${className} li::marker`, markerStyle);
    }
    this.globalStyles.set(`.${className} li`, itemStyle);

    return attrs;
  }

  private fixWingdings(
    listFont: string | undefined,
    listFormat: string[],
    fontSize: number | undefined
  ): { listFont: string | undefined; listFormat: string[]; fontSize: number | undefined } {
    const first = listFormat[0];
    if (listFont === "Wingdings" && first === "\u00a7") {
      listFormat = ["\u25aa"];
    } else if (listFont === "Wingdings" && first === "\u00a8") {
      listFormat = ["\u25fb"];
    } else if (listFont === "Wingdings" && first === "\u0077") {
      listFormat = ["\u2b25"];
    } else if (listFont === "Wingdings 2" && first === "\u00ae") {
      listFormat = ["\u25c6"];
    } else if (listFont === "Wingdings 3" && first === "\u007d") {
      listFormat = ["\u25b6"];
      fontSize = 18;
    } else {
      return { listFont, listFormat, fontSize };
    }
    return { listFont: "Calibri", listFormat, fontSize };
  }

  private isNumberedList(list: List): boolean {
    return list.listFormat[0] === FORMAT_NUMBERED_LIST;
  }

  // -----------------------------------------------------------------------
  // Table
  // -----------------------------------------------------------------------

  private async renderTable(table: Table): Promise<string> {
    let content = "";
    const styles = new StyleSet();
    styles.set("border-collapse", "collapse");
    if (table.bordersVisible) styles.set("border", "1pt solid #A3A3A3");

    const attributes = new AttributeSet();
    attributes.set("style", styles.toString());
    attributes.set("cellspacing", "0");
    attributes.set("cellpadding", "0");
    if (table.bordersVisible) attributes.set("border", "1");

    content += `<table ${attributes}>`;

    const lockedCols = calcLockedCols(table.colsLocked, table.cols);
    const colWidths = [...table.colWidths];
    while (colWidths.length < table.cols) colWidths.push(0);

    for (const row of table.contents) {
      content += "<tr>";
      const cells = row.contents.map((cell, index) => ({
        cell,
        width: lockedCols[index] ? colWidths[index] : undefined
      }));
      for (const { cell, width } of cells) {
        content += await this.renderTableCell(cell, width);
      }
      content += "</tr>";
    }

    content += "</table>";

    return this.renderWithNoteTags(table.noteTags, content);
  }

  private async renderTableCell(
    cell: TableCell,
    width?: number
  ): Promise<string> {
    const styles = new StyleSet();
    styles.set("padding", "2pt");
    styles.set("vertical-align", "top");
    styles.set("min-width", px(1.0));
    if (width !== undefined) styles.set("width", px(width));
    if (cell.backgroundColor) {
      styles.set(
        "background",
        `rgb(${cell.backgroundColor.r}, ${cell.backgroundColor.g}, ${cell.backgroundColor.b})`
      );
    }

    const attrs = new AttributeSet();
    attrs.set("style", styles.toString());

    let contents = `<td ${attrs}>`;

    const cellLevel = this.tableCellLevel(cell.contents);
    const elements = cell.contents.map((element) => ({
      element,
      parentLevel: 0,
      currentLevel: cellLevel
    }));
    contents += await this.renderList(elements, cell.indents);

    contents += "</td>";
    return contents;
  }

  private tableCellLevel(elements: OutlineElement[]): number {
    const needsNesting = elements.some(
      (element) => this.isList(element) || this.hasNoteTag(element)
    );
    return needsNesting ? 2 : 1;
  }

  // -----------------------------------------------------------------------
  // Images & embedded files
  // -----------------------------------------------------------------------

  private async renderImage(image: Image): Promise<string> {
    let content = "";

    if (image.data && this.options.resolveResource) {
      content = await this.options.resolveResource(
        image.data,
        image.imageFilename ?? "",
        image.extension,
        {
          width: image.pictureWidth,
          height: image.pictureHeight,
          altText: image.altText
        }
      );
    }

    return this.renderWithNoteTags(image.noteTags, content);
  }

  private async renderEmbeddedFile(file: EmbeddedFile): Promise<string> {
    let content = "";
    if (file.data && this.options.resolveResource) {
      content = await this.options.resolveResource(file.data, file.filename);
    }
    return this.renderWithNoteTags(file.noteTags, content);
  }

  // -----------------------------------------------------------------------
  // Ink
  // -----------------------------------------------------------------------

  private renderInk(
    ink: Ink,
    displayBoundingBox: Ink["boundingBox"],
    embedded: boolean
  ): string {
    const strokes =
      ink.content.type === "strokes" ? ink.content.strokes : [];
    if (strokes.length === 0) return "";

    const attrs = new AttributeSet();
    const styles = new StyleSet();
    styles.set("overflow", "visible");
    styles.set("position", "absolute");

    const path = this.renderInkPath(strokes);

    const offsetHorizontal = embedded
      ? 0
      : ink.offsetHorizontal ?? 0;
    const offsetVertical = embedded ? 0 : ink.offsetVertical ?? 0;

    const xBoundary = getBoundary(strokes, (p) => p.x);
    const yBoundary = getBoundary(strokes, (p) => p.y);
    const xMin = xBoundary.min;
    const width = xBoundary.max;
    const yMin = yBoundary.min;
    const height = yBoundary.max;

    const strokeStrength = Math.max(
      strokes[0].width,
      strokes[0].height,
      140.0
    );

    const xMinAdjusted = xMin - strokeStrength / 2.0;
    const yMinAdjusted = yMin - strokeStrength / 2.0;
    const widthAdjusted = width + strokeStrength + SVG_SCALING_FACTOR;
    const heightAdjusted = height + strokeStrength + SVG_SCALING_FACTOR;

    styles.set("height", `${Math.round(heightAdjusted / SVG_SCALING_FACTOR)}px`);
    styles.set("width", `${Math.round(widthAdjusted / SVG_SCALING_FACTOR)}px`);

    const displayYMin = displayBoundingBox?.y ?? 0;
    const displayXMin = displayBoundingBox?.x ?? 0;

    styles.set(
      "top",
      `${Math.round(
        (yMinAdjusted - displayYMin) / SVG_SCALING_FACTOR +
          offsetVertical * 48.0
      )}px`
    );
    styles.set(
      "left",
      `${Math.round(
        (xMinAdjusted - displayXMin) / SVG_SCALING_FACTOR +
          offsetHorizontal * 48.0
      )}px`
    );

    attrs.set(
      "viewBox",
      `${Math.round(xMinAdjusted)} ${Math.round(
        yMinAdjusted
      )} ${Math.round(widthAdjusted)} ${Math.round(heightAdjusted)}`
    );

    if (styles.length > 0) attrs.set("style", styles.toString());

    if (embedded) {
      const spanStyles = new StyleSet();
      if (displayBoundingBox) {
        spanStyles.set(
          "width",
          px((displayBoundingBox.width / SVG_SCALING_FACTOR) / 48.0)
        );
        spanStyles.set(
          "height",
          px((displayBoundingBox.height / SVG_SCALING_FACTOR) / 48.0)
        );
      }
      return `<span style="${spanStyles}" class="ink-text"><svg ${attrs}>${path}</svg></span>`;
    } else {
      return `<svg ${attrs}>${path}</svg>`;
    }
  }

  private renderInkPath(strokes: InkStroke[]): string {
    const attrs = new AttributeSet();
    attrs.set(
      "d",
      strokes.map((stroke) => this.renderInkPathPoints(stroke)).join(" ")
    );

    const stroke = strokes[0];
    const opacity = (255 - (stroke.transparency ?? 0)) / 256.0;
    attrs.set("opacity", opacity.toFixed(2));

    const color = stroke.color !== undefined ? strokeColor(stroke.color) : "WindowText";
    attrs.set("stroke", color);
    attrs.set("stroke-width", Math.round(stroke.width).toString());
    attrs.set(
      "stroke-linejoin",
      (stroke.penTip ?? 0) === 0 ? "round" : "bevel"
    );
    attrs.set(
      "stroke-linecap",
      (stroke.penTip ?? 0) === 0 ? "round" : "square"
    );
    attrs.set("fill", "none");

    return `<path ${attrs} />`;
  }

  private renderInkPathPoints(stroke: InkStroke): string {
    const start = stroke.path[0];
    const rest = stroke.path
      .slice(1)
      .map(displayPoint);
    if (rest.length === 0) rest.push("0 0");
    return `M ${displayPoint(start)} l ${rest.join(" ")}`;
  }
}

const SVG_SCALING_FACTOR = 2540.0 / 96.0;

function displayPoint(p: { x: number; y: number }): string {
  return `${Math.floor(p.x)} ${Math.round(p.y)}`;
}

function strokeColor(value: number): string {
  const r = value % 256;
  const rem = (value - r) / 256;
  const g = rem % 256;
  const b = (rem - g) / 256;
  return `rgb(${r}, ${g}, ${b})`;
}

function getBoundary(
  strokes: { path: { x: number; y: number }[] }[],
  coord: (p: { x: number; y: number }) => number
): { min: number; max: number } {
  let min = Infinity;
  let max = -Infinity;

  for (const stroke of strokes) {
    const start = coord(stroke.path[0]);
    let pos = start;
    for (const point of stroke.path.slice(1)) {
      pos += coord(point);
      if (pos < min) min = pos;
      if (pos > max) max = pos;
    }
  }

  return { min, max: max - min };
}

function calcLockedCols(data: Uint8Array | number[], count: number): boolean[] {
  if (data.length === 0) return new Array(count).fill(false);
  const bytes = Array.isArray(data) ? data : Array.from(data);
  return Array.from({ length: count }, (_, i) => {
    const byte = bytes[Math.floor(i / 8)] ?? 0;
    return (byte & (1 << i % 8)) === 1;
  });
}

function flattenOutlineItems(
  items: OutlineItem[],
  parentLevel: number,
  currentLevel: number
): { element: OutlineElement; parentLevel: number; currentLevel: number }[] {
  const result: { element: OutlineElement; parentLevel: number; currentLevel: number }[] = [];
  for (const item of items) {
    if (item.type === "element") {
      result.push({ element: item.element, parentLevel, currentLevel });
    } else {
      result.push(
        ...flattenOutlineItems(
          item.group.outlines,
          parentLevel,
          currentLevel + item.group.childLevel
        )
      );
    }
  }
  return result;
}

function fixNewlines(text: string): string {
  const replaced = text
    .replace(/\u000b/g, "<br>")
    .replace(/\n/g, "<br>")
    .replace(/\r/g, "<br>");
  return replaced.replace(/<br>(\s+)/g, (_match, spaces: string) => {
    return `<br>${"&nbsp;".repeat(spaces.length)}`;
  });
}

function defaultParagraphStyling(): RichText["textRunFormatting"][number] {
  return {
    bold: false,
    italic: false,
    underline: false,
    strikethrough: false,
    superscript: false,
    subscript: false,
    mathFormatting: false,
    hyperlink: false,
    hyperlinkProtected: false,
    hidden: false
  };
}

function renderPageTemplate(
  name: string,
  content: string,
  globalStyles: Map<string, StyleSet>
): string {
  const globalStylesCss = [...globalStyles.entries()]
    .sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0))
    .map(([selector, style]) => `${selector} { ${style} }`)
    .join("\n");

  return `<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <title>${name}</title>
    <style>
    * { margin: 0; padding: 0; font-weight: normal; }
    table, tr, td { border-color: #A3A3A3; }
    ul, ol { padding: 0; }
    .title .outline-element { display: inline; }
    .title .outline-element:nth-child(2) { margin-left: 10px !important; }
    .container-outline { font-family: Calibri, sans-serif; font-size: 6pt; }
    .ink-text, .ink-space { display: inline-block; position: relative; vertical-align: bottom; }
    .ink-text { top: 0; left: 0; }
    .note-tag-icon { position: relative; }
    .note-tag-icon > svg { position: absolute; }
    .icon-secondary > svg { position: absolute; fill: black; filter: drop-shadow(0 0 2px white); height: 12px; top: -1px; }
    .icon-secondary > .content { position: absolute; color: black; filter: drop-shadow(0 0 2px white); font-size: 10px; top: -1px; user-select: none; }
    ${globalStylesCss}
    </style>
</head>
<body>

${content}

</body>
</html>`;
}

export function renderPage(
  page: Page,
  options: RenderOptions = {}
): Promise<string> {
  return new PageRenderer(options).renderPage(page);
}

export type { NoteTagStyle };
