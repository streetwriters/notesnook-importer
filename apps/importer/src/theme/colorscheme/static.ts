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

import { colord } from "colord";

export class StaticColors {
  static construct(accent: string) {
    return {
      shade: colord(accent).alpha(0.1).toRgbString(),
      textSelection: colord(accent).alpha(0.2).toRgbString(),
      dimPrimary: colord(accent).alpha(0.7).toRgbString(),
      transparent: "transparent",
      static: "white",
      error: "#E53935",
      errorBg: "#E5393520",
      success: "#4F8A10",
      warnBg: "#ffc107",
      warn: "#2b2b2b",
      favorite: "#ffd700",
      red: "#f44336",
      orange: "#FF9800",
      yellow: "#f0c800",
      green: "#4CAF50",
      blue: "#2196F3",
      purple: "#9568ED",
      gray: "#9E9E9E"
    };
  }
}
