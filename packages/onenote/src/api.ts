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

import type {
  OnenotePage,
  Notebook as OnenoteNotebook,
  OnenoteSection,
  SectionGroup as OnenoteSectionGroup
} from "@microsoft/microsoft-graph-types-beta/microsoft-graph";
import { GraphAPIResponse, ItemType } from "./types";
import { Client, GraphError } from "@microsoft/microsoft-graph-client";
import { Content } from "./content";
import { AuthConfig } from "./auth/config";

const defaultProperties = [
  "createdDateTime",
  "displayName",
  "lastModifiedDateTime",
  "id"
] as const;

export class OneNoteClient {
  #client: Client;
  constructor(authConfig: AuthConfig) {
    this.#client = Client.init({
      defaultVersion: "beta",
      authProvider: async (done) => {
        try {
          if ("window" in global) {
            const { authenticate } = await import("./auth/browser");
            const result = await authenticate(authConfig);
            if (result) done(null, result.accessToken);
            else done("Could not get access token", null);
          } else {
            // const { authenticate } = await import("./auth/node");
            // const result = await authenticate(authConfig);
            // if (result) done(null, result.accessToken);
            // else
            done("Could not get access token", null);
          }
        } catch (e) {
          console.error(e);
          done(e, null);
        }
      }
    });
  }

  async *getNotebooks() {
    for await (const notebooks of this.#getAll<OnenoteNotebook>(
      `/me/onenote/notebooks`,
      "notebook",
      defaultProperties,
      ["sections", `sectionGroups($expand=sections,sectionGroups)`]
    )) {
      for (const notebook of notebooks) {
        if (!notebook.id) continue;

        this.#processSections(notebook, "notebooks");
        this.#processSectionGroups(notebook, "sectionGroups");
        yield notebook;
      }
    }
  }

  #processSections(
    parent: OnenoteNotebook | OnenoteSectionGroup,
    parentType: "notebooks" | "sectionGroups"
  ) {
    if (!parent.sections) return;

    for (const section of parent.sections) {
      if (!section.id) continue;
      if (parentType === "notebooks")
        section.parentNotebook = this.#getParent(parent);
      else if (parentType === "sectionGroups")
        section.parentSectionGroup = this.#getParent(parent);
    }
  }

  #processSectionGroups(
    parent: OnenoteNotebook | OnenoteSectionGroup,
    parentType: "notebooks" | "sectionGroups"
  ) {
    if (!parent.sectionGroups) return;

    for (const sectionGroup of parent.sectionGroups) {
      if (!sectionGroup.id) continue;

      if (parentType === "notebooks")
        sectionGroup.parentNotebook = this.#getParent(parent);
      else if (parentType === "sectionGroups")
        sectionGroup.parentSectionGroup = this.#getParent(parent);

      this.#processSections(sectionGroup, "sectionGroups");
      this.#processSectionGroups(sectionGroup, "sectionGroups");
    }
  }

  async *getPages(section: OnenoteSection) {
    for await (const pages of this.#getAll<OnenotePage>(
      `/me/onenote/sections/${section.id}/pages`,
      "page",
      [
        "id",
        "title",
        "createdDateTime",
        "lastModifiedDateTime",
        "level",
        "order",
        "userTags"
      ]
    )) {
      for (const page of pages) {
        if (!page.id) continue;
        page.parentSection = {
          parentSectionGroup: section.parentSectionGroup,
          parentNotebook: section.parentNotebook,
          id: section.id,
          displayName: section.displayName
        };
        yield page;
      }
    }
  }

  async getPageContent(page: OnenotePage): Promise<Content | null> {
    try {
      const stream = <NodeJS.ReadableStream | null>(
        await this.#client
          .api(`/me/onenote/pages/${page.id}/content`)
          .getStream()
      );
      if (!stream) return null;

      const html = (await convertStream(stream)).toString("utf8");
      return new Content(html, {
        attachmentResolver: (url) => this.#resolveDataUrl(url, page)
      });
    } catch (e) {
      const error = <Error>e;
      const pageRef = page.title || page.id;
      const notebook = page.parentSection?.parentNotebook?.displayName;
      const section = page.parentSection?.displayName;
      const errorMessage = `Failed to get page content for page "${pageRef}" in ${notebook} > ${section}`;
      this.#handleError(error, errorMessage);
    }
    return null;
  }

  async *#getAll<T, TKeys extends keyof T = keyof T>(
    url: string,
    type: ItemType,
    properties: readonly TKeys[],
    expand?: string | string[]
  ) {
    const items: T[] = [];

    let response: GraphAPIResponse<T[]> | undefined = undefined;
    let skip = 0;
    const limit = 100;
    while (!response || !!response["@odata.nextLink"]) {
      console.log("EHREE");
      response = <GraphAPIResponse<T[]>>await this.#client
        .api(url)
        .top(limit)
        .skip(skip)
        .select(<string[]>(<unknown>properties))
        .expand(expand || [])
        .get()
        .catch(async (e) => {
          console.log(e);
          const error = <Error>e;
          const errorMessage = `Failed to get ${type}`;
          this.#handleError(error, errorMessage);
          return undefined;
        });

      if (!response || !response.value) break;
      yield response.value;
      skip += limit;
    }
    return items;
  }

  async #resolveDataUrl(
    url: string,
    page: OnenotePage
  ): Promise<Buffer | null> {
    try {
      const stream = <NodeJS.ReadableStream | null>(
        await this.#client.api(url).getStream()
      );
      if (!stream) return null;
      return await convertStream(stream);
    } catch (e) {
      const error = <Error>e;
      const pageRef = page.title || page.id;
      const notebook = page.parentSection?.parentNotebook?.displayName;
      const section = page.parentSection?.displayName;
      const errorMessage = `Failed to resolve attachment in page "${pageRef}" in ${notebook} > ${section}`;
      this.#handleError(error, errorMessage);
    }
    return null;
  }

  #handleError(e: Error, message: string) {
    const error = <Error>e;
    let errorMessage = message;
    if (error.message) errorMessage += ` (original error: ${error.message}).`;
    if (error instanceof GraphError) {
      if (error.statusCode === 404) return;
      errorMessage += ` (Request failed with status code: ${error.statusCode}).`;
    }
    throw new Error(errorMessage);
  }

  #getParent(parent: OnenoteNotebook | OnenoteSectionGroup) {
    return { id: parent.id, displayName: parent.displayName };
  }
}

function convertStream(
  stream: NodeJS.ReadableStream | ReadableStream
): Promise<Buffer> {
  return new Promise(async (resolve, reject) => {
    if (isWebStream(stream)) {
      const chunks: Buffer[] = [];
      const reader = stream.getReader();

      await reader
        .read()
        .then(function processText({ done, value }): Promise<any> | void {
          if (done) {
            resolve(Buffer.concat(chunks));
            return;
          }

          chunks.push(Buffer.from(value));
          return reader.read().then(processText);
        });
    } else {
      const chunks: Buffer[] = [];

      stream.on("data", (chunk) => chunks.push(Buffer.from(chunk)));
      stream.on("error", (err) => reject(err));
      stream.on("end", () => resolve(Buffer.concat(chunks)));
    }
  });
}

function isWebStream(
  stream: NodeJS.ReadableStream | ReadableStream
): stream is ReadableStream {
  return "ReadableStream" in globalThis && stream instanceof ReadableStream;
}
