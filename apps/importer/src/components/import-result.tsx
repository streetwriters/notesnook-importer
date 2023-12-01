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

import { Button, Text, Flex } from "@theme-ui/components";
import { Note, IProvider, pack } from "@notesnook-importer/core";
import { useCallback, useState } from "react";
import { StepContainer } from "./step-container";
import { NotePreview } from "./note-preview";
import { ImportErrors } from "./import-errors";
import { ImportHelp } from "./import-help";
import { NotesList } from "./notes-list";
import { TransformResult } from "../types";
import { BrowserStorage } from "@notesnook-importer/storage/dist/browser";
import { createWriteStream } from "../utils/stream-saver";
import { toBlob } from "@notesnook-importer/core/dist/src/utils/stream";
import { saveAs } from "file-saver";

type ImportResultProps = {
  result: TransformResult;
  provider: IProvider;
  onReset: () => void;
};

export function ImportResult(props: ImportResultProps) {
  const { provider, result, onReset } = props;
  const [selectedNote, setSelectedNote] = useState<Note | undefined>();
  const [downloaded, setDownloaded] = useState(0);
  const [isDone, setIsDone] = useState(false);
  const [error, setError] = useState<Error>();

  const downloadAsZip = useCallback(async () => {
    try {
      const storage = new BrowserStorage<Note>(provider.name);

      if (navigator.serviceWorker) {
        await pack(storage, setDownloaded).pipeTo(
          createWriteStream("notesnook-importer.zip")
        );
      } else {
        saveAs(
          await toBlob(pack(storage, setDownloaded)),
          "notesnook-importer.zip"
        );
      }
    } catch (error) {
      if (error instanceof Error) setError(error);
      else if (typeof error === "string") setError(new Error(error));
    } finally {
      setIsDone(true);
    }
  }, [provider]);

  if (result.totalNotes <= 0) {
    return (
      <StepContainer sx={{ flexDirection: "column", alignItems: "stretch" }}>
        <Text variant="title">Import unsuccessful</Text>
        <Text variant="body" sx={{ mt: 2 }}>
          We failed to import the selected files. Please try again.
        </Text>
        {result.errors.length > 0 && <ImportErrors errors={result.errors} />}
        <Button onClick={onReset} sx={{ alignSelf: "center", mt: 2, px: 4 }}>
          Start over
        </Button>
      </StepContainer>
    );
  }

  if (isDone && !error) {
    return (
      <StepContainer sx={{ flexDirection: "column", alignItems: "stretch" }}>
        <Text variant="title">Download successful</Text>
        <Text variant="body" sx={{ mt: 2 }}>
          Please look in your Downloads directory for the downloaded .zip
          archive (or wherever else you saved it).
        </Text>
        <Button onClick={onReset} sx={{ alignSelf: "center", mt: 2, px: 4 }}>
          Start over
        </Button>
      </StepContainer>
    );
  } else if (error && isDone) {
    return (
      <StepContainer sx={{ flexDirection: "column", alignItems: "stretch" }}>
        <Text variant="title">Download unsuccessful</Text>
        <Text variant="body" sx={{ mt: 2 }}>
          We failed to download the processed files. Please try again.
        </Text>
        <ImportErrors errors={[error]} />
        <Button onClick={onReset} sx={{ alignSelf: "center", mt: 2, px: 4 }}>
          Start over
        </Button>
      </StepContainer>
    );
  }

  if (downloaded) {
    return (
      <StepContainer
        sx={{
          flexDirection: "column",
          alignItems: "stretch"
        }}
      >
        <Text variant="title" sx={{ textAlign: "center" }}>
          Downloaded {downloaded} of {result.totalNotes} notes
        </Text>
        <Text variant="subBody" sx={{ mt: 1, textAlign: "center" }}>
          This might take a while.
        </Text>

        <Flex
          sx={{
            mt: 2,
            height: "5px",
            bg: "primary",
            width: `${(downloaded / result.totalNotes) * 100}%`,
            borderRadius: 5
          }}
        />
      </StepContainer>
    );
  }

  return (
    <StepContainer
      sx={{
        flexDirection: "column",
        alignItems: "stretch"
      }}
    >
      <Text variant="title">Your import is ready for download</Text>
      {result ? (
        <>
          <Text variant="body" sx={{ color: "fontTertiary" }}></Text>
          <NotesList
            provider={provider}
            totalNotes={result.totalNotes}
            onNoteSelected={(note) => setSelectedNote(note)}
          />
          {result.errors.length > 0 && <ImportErrors errors={result.errors} />}
          <ImportHelp onDownload={downloadAsZip} />
          <Button
            variant="primary"
            sx={{ alignSelf: "center", mt: 2 }}
            onClick={downloadAsZip}
          >
            Download ZIP file
          </Button>
        </>
      ) : null}
      {selectedNote && (
        <NotePreview
          note={selectedNote}
          onClose={() => setSelectedNote(undefined)}
        />
      )}
    </StepContainer>
  );
}
