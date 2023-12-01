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

import { Text, Button } from "@theme-ui/components";
import { StepContainer } from "./step-container";
import {
  INetworkProvider,
  ProviderSettings,
  OneNote,
  OneNoteSettings,
  transform
} from "@notesnook-importer/core";
import { xxhash64 } from "hash-wasm";
import { useRef, useState } from "react";
import { BrowserStorage } from "@notesnook-importer/storage/dist/browser";
import { TransformResult } from "../types";
import { Accordion } from "./accordion";

type NetworkProviderHandlerProps = {
  provider: INetworkProvider<ProviderSettings>;
  onTransformFinished: (result: TransformResult) => void;
};

type Progress = {
  total: number;
  done: number;
};

function getProviderSettings(
  provider: INetworkProvider<ProviderSettings>,
  settings: ProviderSettings
) {
  if (provider instanceof OneNote) {
    return {
      ...settings,
      cache: false,
      clientId: "6c32bdbd-c6c6-4cda-bcf0-0c8ec17e5804",
      redirectUri:
        process.env.NODE_ENV === "development"
          ? "http://localhost:3000"
          : "https://importer.notesnook.com"
    } as OneNoteSettings;
  }
}

export function NetworkProviderHandler(props: NetworkProviderHandlerProps) {
  const { provider, onTransformFinished } = props;
  const [progress, setProgress] = useState<Progress>();
  const [_, setCounter] = useState<number>(0);
  const logs = useRef<string[]>([]);

  return (
    <StepContainer
      sx={{
        flexDirection: "column",
        alignItems: "stretch"
      }}
    >
      {progress ? (
        <>
          <Text variant="title">Importing your notes from {provider.name}</Text>
          <Text variant="body" sx={{ mt: 4 }}>
            Found {progress.done} {progress.total ? `of ${progress.total}` : ""}{" "}
            notes
          </Text>
          {logs.current.length > 0 && (
            <Accordion title="Logs" isOpened>
              <Text
                as="pre"
                variant="body"
                sx={{
                  fontFamily: "monospace",
                  maxHeight: 250,
                  overflowY: "auto"
                }}
              >
                {logs.current.map((c, index) => (
                  <>
                    <span key={index.toString()}>{c}</span>
                    <br />
                  </>
                ))}
              </Text>
            </Accordion>
          )}
        </>
      ) : (
        <>
          <Text variant="title">Connect your {provider.name} account</Text>
          <Text variant="body" sx={{ color: "fontTertiary", mt: [2, 0] }}>
            Check out our step-by-step guide on{" "}
            <a href={provider.helpLink} target="_blank" rel="noreferrer">
              how to import from {provider.name}.
            </a>
          </Text>
          <Button
            variant="primary"
            onClick={async () => {
              let totalNotes = 0;
              const settings = getProviderSettings(provider, {
                clientType: "browser",
                hasher: { type: "xxh64", hash: xxhash64 },
                storage: new BrowserStorage(provider.name),
                log: (message) => {
                  logs.current.push(
                    `[${new Date(message.date).toLocaleString()}] ${
                      message.text
                    }`
                  );
                  setCounter((s) => ++s);
                },
                reporter: (current, total) => {
                  setProgress({ done: current, total: total || 0 });
                  ++totalNotes;
                }
              });
              if (!settings) return;

              await settings.storage.clear();

              setProgress({ total: 0, done: 0 });

              const errors = await transform(provider, settings);
              console.log(errors);
              onTransformFinished({
                totalNotes,
                errors
              });
            }}
            sx={{ my: 4, alignSelf: "center" }}
          >
            Start importing
          </Button>
        </>
      )}
    </StepContainer>
  );
}
