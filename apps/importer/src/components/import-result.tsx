import { Button, Text } from "@theme-ui/components";
import { pack, ProviderResult, Note } from "@notesnook-importer/core";
import { useCallback, useState } from "react";
import { StepContainer } from "./step-container";
import { NotePreview } from "./note-preview";
import { ImportErrors } from "./import-errors";
import { ImportHelp } from "./import-help";
import { saveAs } from "file-saver";
import { NotesList } from "./notes-list";

type ImportResultProps = {
  result: ProviderResult;
};

export function ImportResult(props: ImportResultProps) {
  const { result } = props;
  const [selectedNote, setSelectedNote] = useState<Note | undefined>();

  const downloadAsZip = useCallback(() => {
    if (!result) return;
    const packed = pack(result.notes);
    saveAs(
      new Blob([packed], { type: "application/zip" }),
      `notesnook-importer.zip`
    );
  }, [result]);

  return (
    <StepContainer
      sx={{
        flexDirection: "column",
        alignItems: "stretch"
      }}
    >
      <Text variant="title">Your notes are ready for download</Text>
      {result ? (
        <>
          <Text variant="body" sx={{ color: "fontTertiary" }}></Text>
          <NotesList
            notes={result?.notes}
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
