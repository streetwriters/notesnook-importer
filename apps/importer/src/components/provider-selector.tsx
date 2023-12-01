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

import { Flex, Select, Text } from "@theme-ui/components";
import {
  IProvider,
  ProviderFactory,
  Providers
} from "@notesnook-importer/core";
import { StepContainer } from "./step-container";

type ProviderSelectorProps = {
  onProviderChanged: (provider: IProvider) => void;
};

export function ProviderSelector(props: ProviderSelectorProps) {
  return (
    <StepContainer sx={{ flexDirection: "column" }}>
      <Flex
        sx={{
          justifyContent: ["stretch", "space-between"],
          flexDirection: ["column", "row"]
        }}
      >
        <Text variant="title">Select a notes app to import from</Text>
        <Select
          sx={{
            m: 0,
            px: 2,
            border: "1px solid var(--theme-ui-colors-border)",
            outline: "none",
            ":hover": {
              bg: "hover"
            },
            ":active": {
              bg: "background"
            },
            fontFamily: "body",
            fontSize: "body",
            width: ["100%", 150],
            mt: [2, 0],
            p: [2, 0],
            alignItems: "center",
            justifyContent: "center",
            cursor: "pointer"
          }}
          onChange={(e) => {
            const providerName: Providers = e.target.value as Providers;
            props.onProviderChanged(ProviderFactory.getProvider(providerName));
          }}
        >
          <option value="">Select notes app</option>
          {ProviderFactory.getAvailableProviders().map((provider) => (
            <option key={provider} value={provider}>
              {ProviderFactory.getProvider(provider as Providers).name}
            </option>
          ))}
        </Select>
      </Flex>
      <Text variant="body" sx={{ color: "fontTertiary", mt: [2, 0] }}>
        Can&apos;t find your notes app in the list?{" "}
        <a href="https://github.com/streetwriters/notesnook-importer/issues/new">
          Send us a request.
        </a>
      </Text>
    </StepContainer>
  );
}
