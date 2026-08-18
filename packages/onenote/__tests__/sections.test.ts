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

import { describe, expect, it } from "vitest";
import fs from "fs";
import path from "path";
import { fdir } from "fdir";
import { parseOneNoteSection } from "../src/onenote";
import { renderPage } from "../src/render";
import { Section } from "../src/onenote/types";

const DATA_DIR = path.join(__dirname, "data");

// A single sample section with known content that exercises images, ink,
// tables, lists and note tags. Other samples are only checked to parse.
const KNOWN_SECTION = "Sample1.one";

// Sections that contain data we do not support (encrypted content written by
// newer OneNote builds with unknown node types).
const UNSUPPORTED_SECTIONS = new Set(["New section.one"]);

function getSamples(): string[] {
  return new fdir()
    .withFullPaths()
    .filter((p) => p.endsWith(".one"))
    .crawl(DATA_DIR)
    .sync() as string[];
}

function getPages(section: Section) {
  return section.pageSeries.flatMap((series) => series.pages);
}

describe("onenote sections", () => {
  it.each(getSamples())("should parse %s", (file) => {
    const name = path.basename(file);
    const buffer = new Uint8Array(fs.readFileSync(file));
    if (UNSUPPORTED_SECTIONS.has(name)) return;

    const section = parseOneNoteSection(buffer, name);
    expect(section.displayName).toBeTruthy();
    const pages = getPages(section);
    expect(pages.length).toBeGreaterThan(0);
    for (const page of pages) {
      expect(page.contents.length).toBeGreaterThan(0);
      expect(page.createdAt).toBeGreaterThan(0);
    }
  });

  it("should render a page to HTML", async () => {
    const buffer = new Uint8Array(
      fs.readFileSync(path.join(DATA_DIR, KNOWN_SECTION))
    );
    const section = parseOneNoteSection(buffer, KNOWN_SECTION);
    const page = getPages(section)[0];

    const html = await renderPage(page, {
      resolveResource: (data) =>
        `<img src="data:application/octet-stream;base64,${Buffer.from(
          data
        ).toString("base64")}" />`
    });
    expect(html).toContain("<!DOCTYPE html>");
    expect(html).toContain(page.titleText!);
    // Sample1 contains rich text, images, tables, lists and note tags.
    expect(html).toContain("<img");
    expect(html).toContain("note-tag-icon");
    expect(html).toContain("<table");
    expect(html).toContain("<ol");
  });

  it("should render ink as SVG strokes", async () => {
    const buffer = new Uint8Array(
      fs.readFileSync(path.join(DATA_DIR, "Quick Notes.one"))
    );
    const section = parseOneNoteSection(buffer, "Quick Notes.one");
    const pages = getPages(section);
    const inkPage = pages.find((page) =>
      page.contents.some((content) => content.type === "ink")
    );
    expect(inkPage).toBeTruthy();

    const html = await renderPage(inkPage!);
    expect(html).toContain("<path ");
    expect(html).toContain("viewBox");
  });
});
