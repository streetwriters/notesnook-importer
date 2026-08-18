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

import filetypeinfo from "magic-bytes.js";
import { path } from "./path";

export function detectFileType(data: Uint8Array) {
  const type = filetypeinfo(data).at(0);
  if (!type) return;
  return {
    ext: type.extension,
    mime: type.mime
  };
}

/**
 * Magic byte detection is unreliable for container formats (e.g. M4A audio is
 * often reported as video/mp4), so known file extensions are mapped to their
 * canonical MIME type as an override.
 */
const EXTENSION_TO_MIME: Record<string, string> = {
  ".m4a": "audio/mp4",
  ".mp3": "audio/mpeg",
  ".aac": "audio/aac",
  ".ogg": "audio/ogg",
  ".oga": "audio/ogg",
  ".opus": "audio/opus",
  ".wav": "audio/wav",
  ".flac": "audio/flac",
  ".caf": "audio/x-caf",
  ".3gp": "audio/3gpp",
  ".amr": "audio/amr",
  ".mp4": "video/mp4",
  ".mov": "video/quicktime",
  ".m4v": "video/x-m4v",
  ".webm": "video/webm",
  ".mkv": "video/x-matroska",
  ".avi": "video/x-msvideo",
  ".pdf": "application/pdf",
  ".jpeg": "image/jpeg",
  ".jpg": "image/jpeg",
  ".png": "image/png",
  ".gif": "image/gif",
  ".bmp": "image/bmp",
  ".heic": "image/heic",
  ".heif": "image/heif",
  ".webp": "image/webp",
  ".svg": "image/svg+xml"
};

export function mimeFromExtension(filename: string): string | undefined {
  return EXTENSION_TO_MIME[path.extname(filename).toLowerCase()];
}

/**
 * Maps the Uniform Type Identifiers used by Apple to MIME types. Apple Notes
 * stores the UTI of every attachment, which is the most reliable signal.
 */
const UTI_TO_MIME: Record<string, string> = {
  "com.apple.m4a-audio": "audio/mp4",
  "public.mpeg-4-audio": "audio/mp4",
  "public.mp3": "audio/mpeg",
  "org.xiph.mp3": "audio/mpeg",
  "public.aac-audio": "audio/aac",
  "org.xiph.ogg-audio": "audio/ogg",
  "org.xiph.flac": "audio/flac",
  "com.apple.coreaudio-format": "audio/x-caf",
  "public.wav": "audio/wav",
  "public.audio": "audio/mp4",
  "public.mpeg-4": "video/mp4",
  "com.apple.quicktime-movie": "video/quicktime",
  "public.jpeg": "image/jpeg",
  "public.png": "image/png",
  "public.gif": "image/gif",
  "public.heic": "image/heic",
  "public.heif": "image/heif",
  "public.webp": "image/webp",
  "public.bmp": "image/bmp",
  "com.adobe.pdf": "application/pdf",
  "com.apple.application-bundle": "application/zip",
  "com.pkware.zip-archive": "application/zip",
  "public.url": "text/uri-list"
};

export function mimeFromUti(uti: string): string | undefined {
  return UTI_TO_MIME[uti];
}
