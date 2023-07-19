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

import { IProvider, Note } from "@notesnook-importer/core";
import { Accordion } from "./accordion";
import { Virtuoso } from "react-virtuoso";
import { useState, useEffect } from "react";
import { BrowserStorage } from "@notesnook-importer/storage/dist/browser";
import { Flex, Text } from "theme-ui";

type NotesListProps = {
  provider: IProvider;
  totalNotes: number;
  onNoteSelected: (note: Note) => void;
};
export function NotesList(props: NotesListProps) {
  const { provider, totalNotes, onNoteSelected } = props;
  const [items, setItems] = useState<Note[]>([]);

  useEffect(() => {
    (async () => {
      const storage = new BrowserStorage<Note>(provider.name);
      setItems(await storage.get(items.length, items.length + 20));
    })();
  }, [provider.name]);

  return (
    <Accordion
      title={`${totalNotes} notes found`}
      sx={{
        border: "1px solid var(--theme-ui-colors-border)",
        mt: 2,
        borderRadius: "default"
      }}
    >
      <Virtuoso
        style={{ height: 300 }}
        data={items}
        endReached={async () => {
          const storage = new BrowserStorage<Note>(provider.name);
          setItems(await storage.get(items.length, items.length + 20));
        }}
        itemContent={(index, note) => (
          <Flex
            key={note.title + note.dateCreated}
            sx={{
              flexDirection: "column",
              p: 2,
              bg: index % 2 ? "transparent" : "bgSecondary",
              cursor: "pointer",
              ":hover": {
                bg: "hover"
              }
            }}
            onClick={() => {
              onNoteSelected(note);
            }}
            title="Click to preview"
          >
            <Text variant="body">{note.title}</Text>
            {note.dateEdited && (
              <Text variant="subBody">
                Last modified on:{" "}
                {new Date(note.dateEdited).toLocaleString(undefined, {
                  dateStyle: "short",
                  timeStyle: "short"
                })}
              </Text>
            )}
          </Flex>
        )}
      ></Virtuoso>
    </Accordion>
  );
}
