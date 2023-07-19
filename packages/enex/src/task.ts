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

import { Reminder } from "./reminder";
import { DateUIOption } from "./types";

export enum TaskStatus {
  OPEN = "open",
  COMPLETED = "completed"
}

export type Task = {
  title: string;
  created: Date;
  updated: Date;
  taskStatus: TaskStatus;
  inNote: boolean;
  taskFlag: string;
  sortWeight: string;
  noteLevelID: string;
  taskGroupNoteLevelID: string;
  dueDate: Date | null;
  dueDateUIOption: DateUIOption | null;
  timeZone: string | null;
  statusUpdated: Date | null;
  creator: string | null;
  lastEditor: string | null;
  reminder: Reminder | null;
};
