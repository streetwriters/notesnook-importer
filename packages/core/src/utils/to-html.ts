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

import { marked } from "marked";

const emptyParagraph: marked.TokenizerExtension & marked.RendererExtension = {
  name: "emptyParagraph",
  level: "block",
  start(src) {
    return src.match(/^\n\n\n|^\r\n\r\n\r\n/)?.index;
  },
  tokenizer(src, _) {
    const rule = /^\n\n\n|^\r\n\r\n\r\n/;
    const match = rule.exec(src);
    if (match) {
      const token = {
        type: "paragraph",
        raw: match[0],
        text: match[0],
        tokens: [{ type: "br", raw: "<br>" } as const]
      };
      return token;
    }
  },
  renderer() {
    return `<p><br></p>`;
  }
};

const CHECKLIST_ITEM_REGEX = /class="checklist--item/gm;
marked.use({
  extensions: [emptyParagraph],

  renderer: {
    text(text) {
      return text.replace(/( {2,})/gm, (_, whitespace) => {
        return "&nbsp;".repeat(whitespace.length);
      });
    },
    br: function () {
      return `</p><p data-spacing="single">`;
    },
    checkbox: function () {
      return "";
    },
    listitem: function (text, task, checked) {
      if (task)
        return `<li class="checklist--item${
          checked ? " checked" : ""
        }">${text}</li>`;
      return false;
    },
    list: function (body) {
      if (CHECKLIST_ITEM_REGEX.test(body)) {
        return `<ul class="checklist">${body}</ul>`;
      }
      return false;
    },
    code: function (code, language, _isEscaped) {
      return `<pre class="language-${language?.toLowerCase()}"><code class="language-${language?.toLowerCase()}">${code
        .replace(/(\r\n)+/gm, "<br/>")
        .replace(/\n+/gm, "<br/>")}</code></pre>`;
    }
  }
});

export function markdowntoHTML(src: string) {
  return marked(src, { gfm: true, breaks: true });
}
