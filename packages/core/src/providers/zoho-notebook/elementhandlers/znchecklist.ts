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

import { BaseHandler } from "./base";
import type { HTMLElement } from "node-html-parser";

type Task = {
  checked: boolean;
  text: string;
}

export class ZNChecklist extends BaseHandler {
  async process(element: HTMLElement): Promise<string | undefined> {
    const checkboxes = element.querySelectorAll("checkbox");
    const tasks: Task[] = [];
    for (const checkbox of checkboxes) {
      tasks.push({ text: checkbox.innerHTML, checked: checkbox.getAttribute("checked") === "true" });
    }

    return tasksToHTML(tasks);
  }
}


function tasksToHTML(tasks: Task[]) {
  return `<ul class="checklist">
        ${tasks
      .map((t) =>
        t.checked
          ? `<li class="checked">${t.text}</li>`
          : `<li>${t.text}</li>`
      )
      .join("")}
      </ul>`;
}
