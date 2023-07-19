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

import { Flex, Input, Text, Button } from "@theme-ui/components";
import { useCallback, useEffect, useState } from "react";
import { useDropzone } from "react-dropzone";
import { StepContainer } from "./step-container";
import { Accordion } from "./accordion";
import {
  IFileProvider,
  transform,
  ProviderSettings,
  IFile
} from "@notesnook-importer/core";
import { xxhash64 } from "hash-wasm";
import { BrowserStorage } from "@notesnook-importer/storage/dist/browser";
import { TransformResult } from "../types";
import { bytesToSize } from "../utils/bytes";

type FileProviderHandlerProps = {
  provider: IFileProvider;
  onTransformFinished: (result: TransformResult) => void;
};

type Progress = {
  total: number;
  done: number;
};

export function FileProviderHandler(props: FileProviderHandlerProps) {
  const { provider, onTransformFinished } = props;
  const [files, setFiles] = useState<File[]>([]);
  const [filesProgress, setFilesProgress] = useState<Progress>({
    done: 0,
    total: 0
  });
  const [progress, setProgress] = useState<Progress>({
    done: 0,
    total: 0
  });

  const onDrop = useCallback((acceptedFiles: File[]) => {
    setFiles((files) => {
      const newFiles = [...acceptedFiles, ...files];
      return newFiles;
    });
  }, []);

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    accept: provider?.supportedExtensions?.concat(".zip")
  });

  useEffect(() => {
    setFiles([]);
  }, [provider]);

  if (filesProgress.done) {
    return (
      <StepContainer sx={{ flexDirection: "column", alignItems: "stretch" }}>
        <Text variant="title">
          Processing {filesProgress.done} of {filesProgress.total} file(s)
        </Text>
        <Text variant="body" sx={{ mt: 4, textAlign: "center" }}>
          Found {progress.done} {progress.total ? `of ${progress.total}` : ""}{" "}
          notes
        </Text>
      </StepContainer>
    );
  }

  return (
    <StepContainer sx={{ flexDirection: "column", alignItems: "stretch" }}>
      <Text variant="title">Select {provider?.name} files</Text>

      <Flex
        {...getRootProps()}
        sx={{
          justifyContent: "center",
          alignItems: "center",
          height: 200,
          border: "2px dashed var(--theme-ui-colors-border)",
          borderRadius: "default",
          mt: 2,
          cursor: "pointer",
          ":hover": {
            bg: "bgSecondary"
          }
        }}
      >
        <Input {...getInputProps()} />
        <Text variant="body" sx={{ textAlign: "center" }}>
          {isDragActive
            ? "Drop the files here"
            : "Drag & drop files here, or click to select files"}
          <br />
          <Text variant="subBody">
            Only {provider?.supportedExtensions.join(", ")} files are supported.
            {provider?.supportedExtensions.includes(".zip") ? null : (
              <>
                You can also select .zip files containing{" "}
                {provider?.supportedExtensions.join(", ")} files.
              </>
            )}
            <br />
            {provider.examples ? (
              <>For example, {provider.examples.join(", ")}</>
            ) : null}
          </Text>
        </Text>
      </Flex>
      {files.length > 0 ? (
        <Accordion
          title={`${files.length} ${
            files.length > 1 ? "files" : "file"
          } selected`}
          sx={{
            border: "1px solid var(--theme-ui-colors-border)",
            mt: 2,
            borderRadius: "default"
          }}
        >
          <Flex
            sx={{ flexDirection: "column", overflowY: "auto", maxHeight: 400 }}
          >
            {files.map((file, index) => (
              <Flex
                key={file.name}
                sx={{
                  p: 2,
                  bg: index % 2 ? "transparent" : "bgSecondary",
                  alignItems: "center",
                  justifyContent: "space-between",
                  cursor: "pointer",
                  ":hover": {
                    bg: "hover"
                  }
                }}
                onClick={() => {
                  setFiles((files) => {
                    const _files = files.slice();
                    _files.splice(index, 1);
                    return _files;
                  });
                }}
                title="Click to remove"
              >
                <Text variant="body">{file.name}</Text>
                <Text variant="body">{bytesToSize(file.size, " ")}</Text>
              </Flex>
            ))}
          </Flex>
        </Accordion>
      ) : null}

      {!!files.length && (
        <>
          <Text
            variant="body"
            sx={{
              bg: "text",
              color: "static",
              mt: 2,
              borderRadius: 5,
              p: 1
            }}
          >
            Please make sure you have at least{" "}
            {bytesToSize(files.reduce((prev, file) => prev + file.size, 0))} of
            free space before proceeding.
          </Text>
          <Button
            sx={{ alignSelf: "center", mt: 2, px: 4 }}
            onClick={async () => {
              const errors: Error[] = [];
              let totalNotes = 0;
              const settings: ProviderSettings = {
                clientType: "browser",
                hasher: { type: "xxh64", hash: xxhash64 },
                storage: new BrowserStorage(provider.name),
                reporter: (current, total) => {
                  setProgress({ done: current, total: total || 0 });
                  ++totalNotes;
                }
              };
              await settings.storage.clear();

              setProgress({ total: 0, done: 0 });
              setFilesProgress({
                total: files.length,
                done: 0
              });

              for (const file of files) {
                setFilesProgress((p) => ({
                  ...p,
                  done: p.done + 1
                }));

                const providerFile: IFile = {
                  name: file.name,
                  modifiedAt: file.lastModified,
                  size: file.size,
                  data: file
                };
                errors.push(
                  ...(await transform(provider, [providerFile], settings))
                );
              }
              console.log("DONE", totalNotes);
              onTransformFinished({
                totalNotes,
                errors
              });
            }}
          >
            Start processing
          </Button>
        </>
      )}
    </StepContainer>
  );
}
