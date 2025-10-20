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

import { Evernote } from "./evernote";
import { Markdown } from "./md";
import { HTML } from "./html";
import { GoogleKeep } from "./keep";
import { Simplenote } from "./simplenote";
import { ZohoNotebook } from "./zoho-notebook";
import { Joplin } from "./joplin";
import { TextBundle } from "./textbundle";
import { Text } from "./txt";
import { Obsidian } from "./dummies/obsidian";
import { SkiffPages } from "./skiff-pages";
import { Fusebase } from "./fusebase";

const providerMap = {
  evernote: Evernote,
  md: Markdown,
  txt: Text,
  html: HTML,
  keep: GoogleKeep,
  simplenote: Simplenote,
  zohonotebook: ZohoNotebook,
  joplin: Joplin,
  textbundle: TextBundle,
  skiffpages: SkiffPages,
  fusebase: Fusebase,

  // Dummies
  obsidian: Obsidian
};

type ProvidersMap = typeof providerMap;

export type Providers = keyof ProvidersMap;

export class ProviderFactory {
  static getAvailableProviders(): Providers[] {
    return Object.keys(providerMap) as Providers[];
  }

  static getProvider<TProvider extends Providers>(
    provider: TProvider
  ): InstanceType<ProvidersMap[TProvider]> {
    const Provider = new providerMap[provider]();
    return Provider as InstanceType<ProvidersMap[TProvider]>;
  }
}
