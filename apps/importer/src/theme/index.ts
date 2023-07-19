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

import ColorSchemeFactory from "./colorscheme";
import VariantsFactory from "./variants";
import { FontFactory } from "./font";
import { Theme } from "theme-ui";

export class ThemeFactory {
  static construct(): Theme {
    return {
      breakpoints: ["480px", "1000px", "1000px"],
      space: [0, 5, 10, 15, 20, 25, 30, 35],
      sizes: { full: "100%", half: "50%" },
      radii: { none: 0, default: 10 },
      colors: ColorSchemeFactory.construct("light"),
      rawColors: ColorSchemeFactory.construct("light"),
      ...FontFactory.construct(),
      ...new VariantsFactory(),
    };
  }
}
