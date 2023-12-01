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

import {
  PublicClientApplication,
  AuthenticationResult
} from "@azure/msal-browser";
import { AuthConfig, SCOPES } from "./config";

let client: PublicClientApplication | undefined;

function getClient(config: AuthConfig): PublicClientApplication {
  if (!client)
    client = new PublicClientApplication({
      auth: {
        clientId: config.clientId,
        redirectUri: config.redirectUri
      },
      cache: config.cache
        ? {
            cacheLocation: "localStorage",
            storeAuthStateInCookie: false,
            secureCookies: false
          }
        : undefined
    });
  return client;
}

export async function authenticate(
  config: AuthConfig
): Promise<AuthenticationResult | null> {
  const client = getClient(config);
  const accounts = client.getAllAccounts();
  return await client
    .acquireTokenSilent({
      scopes: SCOPES,
      account: accounts[0]
    })
    .catch(() => {
      if (!client) return null;
      return client.acquireTokenPopup({
        scopes: SCOPES
      });
    });
}
