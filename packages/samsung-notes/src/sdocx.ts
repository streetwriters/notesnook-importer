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

import { parseContainer } from "./container";
import { parseNote, SamsungNote, VoiceRecording } from "./note";
import { parsePage, SamsungPage } from "./page";
import { parseMediaInfo, MediaEntry } from "./media";
import { BinaryReader } from "./reader";

export interface VoiceRecordingWithMedia {
  recording: VoiceRecording;
  media: MediaEntry;
}

export interface ParsedSdocx {
  note: SamsungNote;
  pages: SamsungPage[];
  media: MediaEntry[];
  attachedFiles: MediaEntry[];
  voiceRecordings: VoiceRecordingWithMedia[];
  title: string;
}

export function parse(data: Uint8Array): ParsedSdocx {
  const container = parseContainer(data);
  const note = parseNote(container.note);

  const mediaInfo = container.mediaInfo
    ? parseMediaInfo(container.mediaInfo)
    : { formatVersion: 0, entries: [] as MediaEntry[] };
  for (const entry of mediaInfo.entries) {
    entry.data = findMediaFile(container.media, entry.filename);
  }

  const attachedFiles = note.attachedFiles
    .map(
      (file) =>
        mediaInfo.entries.find((entry) => entry.bindId === file.bindId) ??
        mediaInfo.entries.find(
          (entry) =>
            entry.filename.toLowerCase() === file.filename.toLowerCase()
        )
    )
    .filter((entry): entry is MediaEntry => !!entry && !!entry.data);

  const voiceRecordings = note.voiceRecordings
    .map((recording) => ({
      recording,
      media:
        mediaInfo.entries.find((entry) => entry.bindId === recording.bindId) ??
        mediaInfo.entries.find((entry) => isAudioFilename(entry.filename))
    }))
    .filter(
      (item): item is VoiceRecordingWithMedia =>
        !!item.media && !!item.media.data
    );

  const pageIds = container.pageIds
    ? parsePageIds(container.pageIds)
    : new Set<string>();
  const pagesByName = new Map(
    container.pages.map((page) => [page.id, page] as const)
  );

  const pageOptions = {
    stringIds: note.stringIds,
    penInfo: note.currentPenInfo ?? note.legacyPenInfo
  };

  const pages: SamsungPage[] = [];
  for (const id of pageIds) {
    const page = pagesByName.get(id.toLowerCase());
    if (!page) continue;
    pages.push(parsePage(page.data, pageOptions));
    pagesByName.delete(page.id);
  }
  for (const [, page] of pagesByName)
    pages.push(parsePage(page.data, pageOptions));

  return {
    note,
    pages,
    media: mediaInfo.entries,
    attachedFiles,
    voiceRecordings,
    title: getTitle(note)
  };
}

const AUDIO_EXTENSIONS = [
  ".m4a",
  ".mp3",
  ".3gp",
  ".aac",
  ".ogg",
  ".wav",
  ".amr"
];

function isAudioFilename(filename: string): boolean {
  const name = filename.toLowerCase();
  return AUDIO_EXTENSIONS.some((extension) => name.endsWith(extension));
}

function parsePageIds(bytes: Uint8Array): Set<string> {
  const reader = new BinaryReader(bytes);
  reader.skip(32); // file hash
  const count = reader.u16();
  if (count > 64) return new Set();
  const ids = new Set<string>();
  for (let i = 0; i < count; ++i) {
    const id = reader.utf16();
    if (id) ids.add(id.toLowerCase());
    reader.skip(32); // page hash
  }
  return ids;
}

function findMediaFile(
  media: Map<string, Uint8Array>,
  filename: string
): Uint8Array | null {
  const name = filename.toLowerCase();
  for (const [path, data] of media) {
    const segment = path.split("/").pop()?.toLowerCase();
    if (segment === name) return data;
  }
  return null;
}

export function getTitle(note: SamsungNote): string {
  const title = note.title.text.trim();
  if (title) return title;
  const firstLine = note.body.text.split("\n").find((line) => line.trim());
  return firstLine?.trim() ?? "";
}
