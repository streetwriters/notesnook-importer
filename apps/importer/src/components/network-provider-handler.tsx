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
  OneNote
} from "@notesnook-importer/core";
import { xxhash64 } from "hash-wasm";
import { useCallback, useState } from "react";
import { BrowserStorage } from "@notesnook-importer/storage/dist/browser";
import { TransformResult } from "../types";

type NetworkProviderHandlerProps = {
  provider: INetworkProvider<unknown>;
  onTransformFinished: (result: TransformResult) => void;
};

const settings: ProviderSettings = {
  clientType: "browser",
  hasher: { type: "xxh64", hash: (data) => xxhash64(data) },
  storage: new BrowserStorage("temp"),
  reporter: () => {}
};

export function NetworkProviderHandler(props: NetworkProviderHandlerProps) {
  const { provider, onTransformFinished } = props;
  const [progress, setProgress] = useState<string | null>();

  const startImport = useCallback(() => {
    (async () => {
      if (!provider) return;
      if (provider instanceof OneNote) {
        setProgress(null);
        const errors = await provider.process({
          ...settings,
          clientId: "4952c7cf-9c02-4fb7-b867-b87727bb52d8",
          redirectUri:
            process.env.NODE_ENV === "development"
              ? "http://localhost:3000"
              : "https://importer.notesnook.com",
          report: setProgress
        });
        onTransformFinished({ totalNotes: 0, errors });
        setProgress(null);
      }
    })();
  }, [onTransformFinished, provider]);

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
          <Text
            as="pre"
            variant="body"
            sx={{
              textAlign: "center",
              my: 4,
              bg: "bgSecondary",
              p: 4,
              fontFamily: "monospace",
              whiteSpace: "pre-wrap"
            }}
          >
            {progress}
          </Text>
        </>
      ) : (
        <>
          <Text variant="title">Connect your {provider.name} account</Text>
          <Button
            variant="primary"
            onClick={startImport}
            sx={{ my: 4, alignSelf: "center" }}
          >
            Start importing
          </Button>
        </>
      )}
    </StepContainer>
  );
}
