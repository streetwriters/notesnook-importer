/* eslint-disable header/header */

/*
 * Taken from https://github.com/natemoo-re/ultramatter
 * MIT License Copyright (c) 2022 Nate Moore
 *
 * Permission is hereby granted, free of
 * charge, to any person obtaining a copy of this software and associated
 * documentation files (the "Software"), to deal in the Software without
 * restriction, including without limitation the rights to use, copy, modify, merge,
 * publish, distribute, sublicense, and/or sell copies of the Software, and to
 * permit persons to whom the Software is furnished to do so, subject to the
 * following conditions:
 *
 * The above copyright notice and this permission notice
 * (including the next paragraph) shall be included in all copies or substantial
 * portions of the Software.
 *
 * THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF
 * ANY KIND, EXPRESS OR IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF
 * MERCHANTABILITY, FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO
 * EVENT SHALL THE AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR
 * OTHER LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING
 * FROM, OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN
 * THE SOFTWARE.
 */
import matter from "gray-matter";

export interface Result {
  frontmatter?: {
    title?: string;
    tags?: string | string[];
    pinned?: boolean;
    favorite?: boolean;

    created_at?: string;
    updated_at?: string;
    edited_at?: string;
    created?: string;
    updated?: string;
    edited?: string;
    ["created-at"]?: string;
    ["updated-at"]?: string;
    ["edited-at"]?: string;
    ["date created"]?: string;
    ["date updated"]?: string;
    ["date edited"]?: string;

    color?: string;
  };
  content: string;
}

export function parseFrontmatter(input: string): Result {
  const { content, data } = matter(input);
  return {
    content,
    frontmatter: data
  };
}
