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

import tap from "tap";
import { parse } from "../index";

tap.test("enex file without an en-export element should throw", async () => {
  const invalidEnex = "<h1></h1>";

  tap.rejects(
    parse(invalidEnex),
    /Invalid enex file. Must contain en-export element./g
  );
});

tap.test(
  "enex file without application attribute in en-export element should throw",
  async () => {
    const invalidEnex = `<en-export export-date="20070120T174209Z" version="10.12.3">
  <note>
    <title>test - checklist</title>
    <content>
    </content>
  </note>
  </en-export>`;
    tap.rejects(
      parse(invalidEnex),
      /Invalid enex. application attribute is required./g
    );
  }
);

tap.test(
  "enex file without version attribute in en-export element should throw",
  async () => {
    const invalidEnex = `<en-export export-date="20070120T174209Z" application="evernote">
    <note>
    <title>test - checklist</title>
    <content>
    </content>
  </note>
  </en-export>`;
    tap.rejects(
      parse(invalidEnex),
      /Invalid enex. version attribute is required./g
    );
  }
);

tap.test(
  "enex file without export-date attribute in en-export element should throw",
  async () => {
    const invalidEnex = `<en-export application="evernote" version="10.12.3">
    <note>
    <title>test - checklist</title>
    <content>
    </content>
  </note>
  </en-export>`;
    tap.rejects(
      parse(invalidEnex),
      /Invalid enex. export-date attribute is required./g
    );
  }
);

tap.test("enex file with an invalid export-date should throw", async () => {
  const invalidEnex = `<en-export export-date="helloworld" application="evernote" version="10.12.3">
  <note>
  <title>test - checklist</title>
  <content>
  </content>
</note>
    </en-export>`;
  tap.rejects(parse(invalidEnex), /export-date value is not a valid date./g);
});

tap.test("enex file without note elements element should throw", async () => {
  const invalidEnex = `<en-export export-date="20070120T174209Z" application="evernote" version="10.12.3">
  </en-export>`;
  tap.rejects(parse(invalidEnex), /Invalid enex. Enex file contains 0 notes./g);
});
