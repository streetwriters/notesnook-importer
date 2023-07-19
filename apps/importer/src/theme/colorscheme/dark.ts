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

export class DarkColorScheme {
  static construct(accent: string) {
    return {
      primary: colord(accent).toHex(),
      placeholder: colord("#ffffff")
        .alpha(0.6)
        .toHex(),
      background: "#1f1f1f",
      bgTransparent: "#1f1f1f99",
      accent: "#000",
      bgSecondary: "#2b2b2b",
      bgSecondaryText: "#A1A1A1",
      border: "#2b2b2b",
      hover: "#3b3b3b",
      fontSecondary: "#000",
      fontTertiary: "#A1A1A1",
      text: "#d3d3d3",
      overlay: "rgba(53, 53, 53, 0.5)",
      secondary: "black",
      icon: "#dbdbdb",
      disabled: "#5b5b5b",
      ...StaticColors.construct(accent),
    };
  }
}
