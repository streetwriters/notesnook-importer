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

class TextFactory {
  constructor() {
    return {
      default: new Default(),
      heading: new Heading(),
      subheading: new Subheading(),
      title: new Title(),
      subtitle: new Subtitle(),
      body: new Body(),
      subBody: new SubBody(),
      error: new Error(),
    };
  }
}
export default TextFactory;

class Default {
  constructor() {
    return {
      color: "text",
      fontFamily: "body",
    };
  }
}

class Heading {
  constructor() {
    return {
      variant: "text.default",
      fontFamily: "heading",
      fontWeight: "bold",
      fontSize: "heading",
    };
  }
}

class Subheading {
  constructor() {
    return {
      variant: "text.heading",
      fontSize: "subheading",
    };
  }
}

class Title {
  constructor() {
    return {
      variant: "text.heading",
      fontSize: "title",
      fontWeight: "bold",
    };
  }
}
class Subtitle {
  constructor() {
    return {
      variant: "text.heading",
      fontSize: "subtitle",
      fontWeight: "bold",
    };
  }
}

class Body {
  constructor() {
    return { variant: "text.default", fontSize: "body" };
  }
}

class SubBody {
  constructor() {
    return {
      variant: "text.default",
      fontSize: "subBody",
      color: "fontTertiary",
    };
  }
}

class Error {
  constructor() {
    return { variant: "text.default", fontSize: "subBody", color: "error" };
  }
}
