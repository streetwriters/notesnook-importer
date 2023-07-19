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
import { StaticColors } from "./static";

export class LightColorScheme {
  static construct(accent: string) {
    return {
      primary: colord(accent).toHex(),
      background: "white",
      bgTransparent: "#ffffff99",
      accent: "white",
      bgSecondary: "#f7f7f7",
      bgSecondaryText: "#5E5E5E",
      border: "#e7e7e7",
      hover: "#f0f0f0",
      active: "#ababab",
      fontSecondary: "white",
      fontTertiary: "#656565",
      text: "#202124",
      overlay: "rgba(0, 0, 0, 0.1)",
      secondary: "white",
      icon: "#3b3b3b",
      disabled: "#9b9b9b",
      placeholder: colord("#000000")
        .alpha(0.6)
        .toHex(),
      ...StaticColors.construct(accent),
    };
  }
}
