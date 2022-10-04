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

import {
  AuthenticationResult,
  PublicClientApplication,
} from "@azure/msal-node";
import { AuthConfig, SCOPES } from "./config";
import {
  PersistenceCachePlugin,
  FilePersistence,
} from "@azure/msal-node-extensions";

let client: PublicClientApplication | undefined;

async function getClient(config: AuthConfig): Promise<PublicClientApplication> {
  if (!client) {
    const persistence = await FilePersistence.create("./tokenCache.json");

    client = new PublicClientApplication({
      auth: {
        authority: "https://login.microsoftonline.com/common",
        clientId: config.clientId,
      },
      cache: {
        cachePlugin: new PersistenceCachePlugin(persistence),
      },
    });
  }
  return client;
}

export async function authenticate(
  config: AuthConfig
): Promise<AuthenticationResult | null> {
  const client = await getClient(config);
  const accountInfo = await client.getTokenCache().getAllAccounts();

  return await client
    .acquireTokenSilent({
      scopes: SCOPES,
      account: accountInfo[0],
    })
    .catch(() => {
      if (!client) return null;
      return client.acquireTokenByDeviceCode({
        scopes: SCOPES,
        deviceCodeCallback: (res) => {
          console.log(res.message);
        },
      });
    });
}
