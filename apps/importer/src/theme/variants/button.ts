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

class ButtonFactory {
  constructor() {
    return {
      default: new Default(),
      primary: new Primary(),
      secondary: new Secondary(),
      tertiary: new Tertiary(),
    };
  }
}
export default ButtonFactory;

class Default {
  constructor() {
    return {
      bg: "transparent",
      fontFamily: "body",
      fontWeight: "body",
      fontSize: "body",
      borderRadius: "5px",
      cursor: "pointer",
      p: 1,
      px: 2,
      transition: "filter 200ms ease-in, box-shadow 200ms ease-out",
      ":hover:not(:disabled)": {
        filter: "brightness(90%)",
      },
      ":active": {
        filter: "brightness(98%)",
      },
      outline: "none",
      ":focus-visible:not(:active)": {
        boxShadow: "0px 0px 0px 2px var(--text)",
      },
      ":disabled": {
        opacity: 0.5,
        cursor: "not-allowed",
      },
    };
  }
}

class Primary {
  constructor() {
    return {
      variant: "buttons.default",
      color: "static",
      bg: "primary",
    };
  }
}

class Secondary {
  constructor() {
    return {
      variant: "buttons.default",
      color: "text",
      bg: "border",
    };
  }
}

class Tertiary {
  constructor() {
    return {
      variant: "buttons.default",
      color: "text",
      bg: "transparent",
      border: "2px solid",
      borderColor: "border",
      ":hover": {
        borderColor: "primary",
      },
    };
  }
}
