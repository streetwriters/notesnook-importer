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
import streamSaver from "streamsaver";
streamSaver.mitm = "/mitm.html";

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

  const downloadAsZip = useCallback(async () => {
    const storage = new BrowserStorage<Note>(provider.name);

    await pack(storage, setDownloaded).pipeTo(
      streamSaver.createWriteStream("notesnook-importer.zip")
    );
    setIsDone(true);
  }, [provider]);

  if (isDone) {
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
