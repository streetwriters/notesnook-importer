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

import { test, describe } from "vitest";
import { markdowntoHTML } from "../src/utils/to-html";

test("parse wikiLinkFile", (t) => {
  t.expect(markdowntoHTML("![[image.jpg]]")).toBe(
    `<p><a href="image.jpg"></a></p>`
  );
});

test("parse wikiLinkFile with width", (t) => {
  t.expect(markdowntoHTML("![[image.jpg|100]]")).toBe(
    `<p><a href="image.jpg" width="100"></a></p>`
  );
});

test("parse wikiLinkFile with width and height", (t) => {
  t.expect(markdowntoHTML("![[image.jpg|100x100]]")).toBe(
    `<p><a href="image.jpg" width="100" height="100"></a></p>`
  );
});

test("parse wikiLinkFile inline", (t) => {
  t.expect(
    markdowntoHTML("HELLO WORLD ![[image.jpg|100x100]] afterwards _italic_")
  ).toBe(
    `<p>HELLO WORLD <a href="image.jpg" width="100" height="100"></a> afterwards <em>italic</em></p>`
  );
});

test("parse wikiLinkFile with hash", (t) => {
  t.expect(markdowntoHTML("![[image.pdf#hello]]")).toBe(
    `<p><a href="image.pdf"></a></p>`
  );
});

test("parse wikiLinkFile with alias", (t) => {
  t.expect(markdowntoHTML("![[image.pdf|IMAGE]]")).toBe(
    `<p><a href="image.pdf"></a></p>`
  );
});

test("parse inline comment", (t) => {
  t.expect(markdowntoHTML("Hello world %%comment%% of _my own_.")).toBe(
    `<p>Hello world of <em>my own</em>.</p>`
  );
});

test("remove block comment (simple)", (t) => {
  t.expect(
    markdowntoHTML(`I am a paragraph

%%
This is a block comment.
%%

With another paragraph below **ehlo**.`)
  ).toBe(
    `<p>I am a paragraph</p>
<p>With another paragraph below <strong>ehlo</strong>.</p>`
  );
});

test("remove block comment (complex)", (t) => {
  t.expect(
    markdowntoHTML(`I am a paragraph

%%
This is a block comment.

With another paragraph

And some other stuff like an image:

![](image.jpg)
%%

With another paragraph below **ehlo**.`)
  ).toBe(
    `<p>I am a paragraph</p>
<p>With another paragraph below <strong>ehlo</strong>.</p>`
  );
});

test("parse checklist", (t) => {
  t.expect(
    markdowntoHTML(`- [ ] Task item 1
- [x] Task item 2`)
  ).toBe(
    `<ul class="checklist">
<li class="checklist--item">Task item 1</li>
<li class="checklist--item checked">Task item 2</li>
</ul>`
  );
});

test("parse nested checklist", (t) => {
  t.expect(
    markdowntoHTML(`- [x] Task 1
- [ ] Task 2
  - [ ] Subtask 2a
  - [ ] Subtask 2b
- [ ] Task 3
  - [x] Subtask 3a
    - [ ] Sub-subtask 3a1
  - [ ] Subtask 3b`)
  ).toBe(
    `<ul class="checklist">
<li class="checklist--item checked">Task 1</li>
<li class="checklist--item">Task 2
<ul class="checklist">
<li class="checklist--item">Subtask 2a</li>
<li class="checklist--item">Subtask 2b</li>
</ul>
</li>
<li class="checklist--item">Task 3
<ul class="checklist">
<li class="checklist--item checked">Subtask 3a
<ul class="checklist">
<li class="checklist--item">Sub-subtask 3a1</li>
</ul>
</li>
<li class="checklist--item">Subtask 3b</li>
</ul>
</li>
</ul>`
  );
});

test("parse codeblock", (t) => {
  t.expect(
    markdowntoHTML(`\`\`\`javascript
function google() {
}

<html>good</html>
<COmponent>{() => {}}</Component>
<co-co>hello</co-co>
\`\`\``)
  ).toBe(
    `<pre class="language-javascript"><code class="language-javascript">function google() {<br/>}<br/><br/>&lt;html>good&lt;/html><br/>&lt;COmponent>{() => {}}&lt;/Component><br/>&lt;co-co>hello&lt;/co-co><br/></code></pre>`
  );
});

test("parse softbreak line", (t) => {
  t.expect(
    markdowntoHTML(`hello world
i am here`)
  ).toBe(`<p>hello world i am here</p>`);

  t.expect(
    markdowntoHTML(`The killer feature of \`markdown-it\` is very effective support of
syntax plugins.`)
  ).toBe(
    "<p>The killer feature of <code>markdown-it</code> is very effective support of syntax plugins.</p>"
  );
});

test("parse inline math", (t) => {
  t.expect(markdowntoHTML(`I am a math $2+2$`)).toBe(
    `<p>I am a math <span class="math math-inline">2+2</span></p>`
  );
});

test("parse block math", (t) => {
  t.expect(
    markdowntoHTML(`I am a math block:

$$
L = \\frac{1}{2} \\rho v^2 S C_L
$$`)
  ).toBe(`<p>I am a math block:</p>
<div class="math math-display">L = \\frac{1}{2} \\rho v^2 S C_L</div>`);
});

test("parse subscript & superscript", (t) => {
  t.expect(markdowntoHTML(`I am an equation: H~2~O 19^th^`)).toBe(
    `<p>I am an equation: H<sub>2</sub>O 19<sup>th</sup></p>`
  );
});

test("parse highlight", (t) => {
  t.expect(markdowntoHTML(`I am ==highlighted== **again**.`)).toBe(
    `<p>I am <span style="background-color: rgb(255, 255, 0);">highlighted</span> <strong>again</strong>.</p>`
  );
});

test("do not double encode html entities", async (t) => {
  t.expect(
    markdowntoHTML(`I am some code with entities:

\`\`\`
I am damn happy to here & and < > what else.
\`\`\`

And **something** else.`)
  ).toBe(
    `<p>I am some code with entities:</p>
<pre><code>I am damn happy to here &#38; and &lt; > what else.<br/></code></pre>
<p>And <strong>something</strong> else.</p>`
  );
});

describe("parse hard line breaks", () => {
  const hardLineBreakTests = [
    {
      name: "trailing spaces",
      input: `
line 1  
line 2  
line 3
  
line 4`,
      expected: `<p data-spacing="single">line 1</p>
<p data-spacing="single">line 2</p>
<p data-spacing="single">line 3</p>
<p>line 4</p>`
    },
    {
      name: "trailing backslashes",
      input: `
line 1\\
line 2\\
line 3
  
line 4`,
      expected: `<p data-spacing="single">line 1</p>
<p data-spacing="single">line 2</p>
<p data-spacing="single">line 3</p>
<p>line 4</p>`
    }
  ];

  for (const { name, input, expected } of hardLineBreakTests) {
    test(name, async (t) => {
      const result = markdowntoHTML(input);
      t.expect(result).toBe(expected);
    });
  }
});
