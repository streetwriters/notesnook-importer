import { marked } from "marked";

const webComponent: marked.TokenizerExtension & marked.RendererExtension = {
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
        tokens: [{ type: "br", raw: "<br>" } as const],
      };
      return token;
    }
  },
  renderer() {
    return `<p><br></p>`;
  },
};

const CHECKLIST_ITEM_REGEX = /class="checklist--item/gm;
marked.use({
  extensions: [webComponent],

  renderer: {
    br: function() {
      return `</p><p data-spacing="single">`;
    },
    checkbox: function() {
      return "";
    },
    listitem: function(text, task, checked) {
      if (task)
        return `<li class="checklist--item${
          checked ? " checked" : ""
        }">${text}</li>`;
      return false;
    },
    list: function(body) {
      if (CHECKLIST_ITEM_REGEX.test(body)) {
        return `<ul class="checklist">${body}</ul>`;
      }
      return false;
    },
    code: function(code, language, isEscaped) {
      return `<pre class="language-${language?.toLowerCase()}"><code class="language-${language?.toLowerCase()}">${code
        .replace(/(\r\n)+/gm, "<br/>")
        .replace(/\n+/gm, "<br/>")}</code></pre>`;
    },
  },
});

export function markdowntoHTML(src: string) {
  return marked(src, { gfm: true, breaks: true });
}
