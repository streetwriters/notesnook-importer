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

import { Button, Text } from "@theme-ui/components";
import { Accordion } from "./accordion";

type ImportHelpProps = {
  onDownload: () => void;
};

export function ImportHelp(props: ImportHelpProps) {
  return (
    <Accordion
      title="How to import your notes into Notesnook?"
      sx={{ bg: "bgSecondary", mt: 2, borderRadius: "default" }}
    >
      <Text
        as="ol"
        variant="body"
        sx={{
          lineHeight: "24px",
          paddingInlineStart: 30,
          pb: 2
        }}
      >
        <Text as="li">
          <Button variant="primary" sx={{ py: 0 }} onClick={props.onDownload}>
            Download the ZIP file
          </Button>{" "}
          containing your notes
        </Text>
        <Text as="li">
          <a href="https://app.notesnook.com/">Open Notesnook</a> and make sure
          you are logged in.
        </Text>
        <Text as="li">
          Go to <b>Settings</b>
        </Text>
        <Text as="li">
          Expand the section titled <b>Notesnook Importer</b>
        </Text>
        <Text as="li">
          Click on <b>Import from ZIP file</b>
        </Text>
        <Text as="li">Select the downloaded ZIP file</Text>
        <Text as="li">Your notes should appear in the app.</Text>
      </Text>
    </Accordion>
  );
}
