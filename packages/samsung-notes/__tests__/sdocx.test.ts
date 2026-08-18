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

import { readFileSync, readdirSync } from "fs";
import path from "path";
import { expect, test } from "vitest";
import { parse, toHTML } from "../index";

const dataDir = path.join(__dirname, "data");

// Stub handler keeps snapshots small: media is never embedded as data URIs.
const stubHandler = {
  async process(type: "image" | "file", media: { filename: string }) {
    return `<div data-testid="media" data-filename="${media.filename}"></div>`;
  }
};

for (const file of readdirSync(dataDir)) {
  test(`parse ${file}`, async () => {
    const parsed = parse(readFileSync(path.join(dataDir, file)));

    expect(parsed.note.formatVersion).toBe(4000);
    expect(parsed.note.createdTime).toBeGreaterThan(0);
    expect(parsed.note.modifiedTime).toBeGreaterThanOrEqual(
      parsed.note.createdTime
    );
    expect(parsed.pages.length).toBeGreaterThan(0);
    expect(parsed.title).toBeTruthy();

    const html = await toHTML(parsed, stubHandler);
    expect(html).toMatchSnapshot();
  });
}

test("parse handwritten note", () => {
  const parsed = parse(
    readFileSync(path.join(dataDir, "Notes_251018_172615.sdocx"))
  );

  expect(parsed.note.body.text).toContain("Hello world");
  expect(parsed.title).toBe("Hello world");

  const handwrittenPage = parsed.pages.find((p) => p.strokes.length);
  expect(handwrittenPage).toBeDefined();
  expect(handwrittenPage!.strokes.length).toBe(9);

  const stroke = handwrittenPage!.strokes[0];
  expect(stroke.points.length).toBeGreaterThan(10);
  expect(stroke.penSize).toBeGreaterThan(0);
  expect(stroke.color).toBeDefined();
  // sample page canvas is 720x1018; stroke points must fit inside
  for (const point of stroke.points) {
    expect(point.x).toBeGreaterThanOrEqual(0);
    expect(point.x).toBeLessThanOrEqual(handwrittenPage!.width);
    expect(point.y).toBeGreaterThanOrEqual(0);
    expect(point.y).toBeLessThanOrEqual(handwrittenPage!.height);
  }
});

test("parse typed text note", () => {
  const parsed = parse(
    readFileSync(path.join(dataDir, "Notes_260804_125813.sdocx"))
  );

  expect(parsed.note.body.text).toBe("\nDjkddk\nDjdjdjd\nDif");
  expect(parsed.title).toBe("Djkddk");
  expect(parsed.pages.every((page) => !page.strokes.length)).toBe(true);
});

test("render typed text as html", async () => {
  const parsed = parse(
    readFileSync(path.join(dataDir, "Notes_260804_125818.sdocx"))
  );
  const html = await toHTML(parsed);

  expect(html).toContain("Jdjdnd.xx");
  expect(html).toContain("<p");
  expect(html).not.toContain("data:image/svg+xml");
});

test("render handwriting as svg attachment", async () => {
  const parsed = parse(
    readFileSync(path.join(dataDir, "Notes_251018_172615.sdocx"))
  );

  const calls: {
    type: string;
    media: { filename: string; data?: Uint8Array };
    width?: number;
    height?: number;
  }[] = [];
  const html = await toHTML(parsed, {
    async process(type, media, width, height) {
      calls.push({ type, media, width, height });
      return `<img data-testid="strokes" data-filename="${media.filename}" />`;
    }
  });

  expect(calls).toHaveLength(1);
  const call = calls[0];
  expect(call.type).toBe("image");
  expect(call.media.filename).toBe("strokes.svg");
  expect(call.width).toBeUndefined();
  expect(call.height).toBeUndefined();
  expect(call.media.data).toBeDefined();

  const svg = new TextDecoder().decode(call.media.data);
  expect(svg).toContain("<path");
  expect(svg).toContain("stroke-linecap");
  expect(svg).toContain('viewBox="0 0 720 1018"');
  expect(svg).not.toContain('preserveAspectRatio="none"');
  expect(svg).not.toContain(`width="720"`);
  expect(svg).not.toContain(`height="1018"`);

  expect(html).toContain('data-testid="strokes"');
  expect(html).not.toContain("<svg");
  // trailing empty page must not render
  expect(html.match(/position:relative/g)?.length).toBe(1);
});

test("export attached files", async () => {
  const parsed = parse(readFileSync(path.join(dataDir, "AttachedFile.sdocx")));

  expect(parsed.note.attachedFiles).toHaveLength(1);
  expect(parsed.note.attachedFiles[0].filename).toBe("10@My File.txt");
  expect(parsed.note.attachedFiles[0].bindId).toBe(10);

  expect(parsed.attachedFiles).toHaveLength(1);
  const attached = parsed.attachedFiles[0];
  expect(attached.data).toBeDefined();
  expect(new TextDecoder().decode(attached.data)).toBe("hello attachment");

  const processed: string[] = [];
  const html = await toHTML(parsed, {
    async process(type, media) {
      expect(type).toBe("file");
      processed.push(media.filename);
      return `<span data-testid="attachment">${media.filename}</span>`;
    }
  });
  expect(processed).toEqual(["10@My File.txt"]);
  expect(html).toContain('data-testid="attachment"');
  expect(html).toContain("Jdjdnd.xx");
});

test("attached files without handler fall back to filename", async () => {
  const parsed = parse(readFileSync(path.join(dataDir, "AttachedFile.sdocx")));
  const html = await toHTML(parsed);

  expect(html).toContain("10@My File.txt");
});

test("parse hyperlinks", async () => {
  const parsed = parse(
    readFileSync(path.join(dataDir, "Helo_260815_092722.sdocx"))
  );

  const linkSpan = parsed.note.body.spans.find(
    (span) => span.hyperlink !== undefined
  );
  expect(linkSpan).toBeDefined();
  expect(linkSpan!.hyperlink).toBe(3);

  const url = parsed.note.body.text.slice(linkSpan!.start, linkSpan!.end);
  expect(url).toBe("https://www.w3schools.com/html/html_links.asp");

  const html = await toHTML(parsed, stubHandler);
  expect(html).toContain(`<a href="${url}">`);
  expect(html).toContain(url);
});

test("parse voice recordings", async () => {
  const parsed = parse(
    readFileSync(path.join(dataDir, "Note with voice_260815_091808.sdocx"))
  );

  expect(parsed.note.voiceRecordings).toHaveLength(1);
  const recording = parsed.note.voiceRecordings[0];
  expect(recording.bindId).toBe(0);
  expect(recording.name).toBe("Voice 001");
  expect(recording.duration).toBe("00:00:06");
  expect(recording.durationMs).toBe(6869);
  expect(recording.createdTime).toBeGreaterThan(0);
  expect(recording.modifiedTime).toBeGreaterThan(0);

  expect(parsed.voiceRecordings).toHaveLength(1);
  const voice = parsed.voiceRecordings[0];
  expect(voice.media.filename).toBe("0@6a7fe86f_917b2.m4a");
  expect(voice.media.data).toBeDefined();

  const processed: string[] = [];
  const html = await toHTML(parsed, {
    async process(type, media) {
      expect(type).toBe("file");
      processed.push(media.filename);
      return `<span data-testid="voice">${media.filename}</span>`;
    }
  });
  expect(processed).toEqual(["0@6a7fe86f_917b2.m4a"]);
  expect(html).toContain('data-testid="voice"');
  expect(html).toContain("This note has voice recording.");
});

test("voice recordings without handler render as audio element", async () => {
  const parsed = parse(
    readFileSync(path.join(dataDir, "Note with voice_260815_091808.sdocx"))
  );
  const html = await toHTML(parsed);

  expect(html).toContain("<audio");
  expect(html).toContain("data:audio/mp4;base64,");
});

test("parse pdf backgrounds", async () => {
  const parsed = parse(
    readFileSync(path.join(dataDir, "2026-08-05 09-55_260815_084320.sdocx"))
  );

  const pdfPages = parsed.pages.filter((page) => page.pdfBackgrounds.length);
  expect(pdfPages.length).toBeGreaterThan(0);
  expect(pdfPages[0].pdfBackgrounds[0].fileId).toBe(0);

  const processed: string[] = [];
  const html = await toHTML(parsed, {
    async process(type, media) {
      expect(type).toBe("file");
      if (!processed.includes(media.filename)) processed.push(media.filename);
      return `<span data-testid="pdf"></span>`;
    }
  });
  expect(processed).toEqual(["0@pdf_1787029208151.pdf"]);
  expect(html).toContain('data-testid="pdf"');
});
