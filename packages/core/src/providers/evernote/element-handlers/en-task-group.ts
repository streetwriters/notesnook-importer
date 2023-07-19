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

import { Task, TaskStatus } from "@notesnook-importer/enex";
import { BaseHandler } from "./base";
import { Element } from "domhandler";
import { getAttributeValue } from "domutils";

export class ENTaskGroup extends BaseHandler {
  async process(element: Element): Promise<string | undefined> {
    if (!this.enNote.tasks) return;
    const taskGroupId = getAttributeValue(element, "task-group-id");
    if (!taskGroupId) return;
    const tasks = this.enNote.tasks.filter(
      (t) => t.taskGroupNoteLevelID === taskGroupId
    );
    return tasksToHTML(tasks);
  }
}

function tasksToHTML(tasks: Task[]) {
  return `<ul class="checklist">
        ${tasks
          .map((t) =>
            t.taskStatus === TaskStatus.COMPLETED
              ? `<li class="checked">${t.title}</li>`
              : `<li>${t.title}</li>`
          )
          .join("")}
      </ul>`;
}
