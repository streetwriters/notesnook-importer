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
  Entity,
  OnenotePage,
  Notebook as OnenoteNotebook,
  OnenoteSection,
  SectionGroup as OnenoteSectionGroup,
} from "@microsoft/microsoft-graph-types-beta";
import { GraphAPIResponse, IProgressReporter, ItemType } from "./types";
import { Client, GraphError } from "@microsoft/microsoft-graph-client";
import { Content } from "./content";
import { AuthConfig } from "./auth/config";

const defaultProperties = [
  "createdDateTime",
  "displayName",
  "lastModifiedDateTime",
  "id",
] as const;

export class OneNoteClient {
  #client: Client;
  #reporter?: IProgressReporter;
  constructor(authConfig: AuthConfig, reporter?: IProgressReporter) {
    this.#reporter = reporter;
    this.#client = Client.init({
      authProvider: async (done) => {
        if ("window" in global) {
          const { authenticate } = await import("./auth/browser");
          const result = await authenticate(authConfig);
          if (result) done(null, result.accessToken);
          else done("Could not get access token", null);
        } else {
          const { authenticate } = await import("./auth/node");
          const result = await authenticate(authConfig);
          if (result) done(null, result.accessToken);
          else done("Could not get access token", null);
        }
      },
    });
  }

  async getNotebooks(): Promise<OnenoteNotebook[]> {
    const notebooks: OnenoteNotebook[] = await this.#getAll(
      `/me/onenote/notebooks`,
      "notebook",
      defaultProperties
    );

    return await this.#processAll(
      notebooks,
      "notebook",
      async (notebook: OnenoteNotebook) => {
        if (!notebook.id) return;

        notebook.sections = await this.#getSections(notebook, "notebooks");
        notebook.sectionGroups = await this.#getSectionGroups(
          notebook,
          "sectionGroups"
        );
      }
    );
  }

  async #getSections(
    parent: OnenoteNotebook | OnenoteSectionGroup,
    parentType: "notebooks" | "sectionGroups"
  ): Promise<OnenoteSection[]> {
    const sections: OnenoteSection[] = await this.#getAll(
      `/me/onenote/${parentType}/${parent.id}/sections`,
      "section",
      defaultProperties
    );

    return await this.#processAll(sections, "section", async (section) => {
      if (!section.id) return;
      if (parentType === "notebooks")
        section.parentNotebook = this.#getParent(parent);
      else if (parentType === "sectionGroups")
        section.parentSectionGroup = this.#getParent(parent);

      section.pages = await this.#getPages(section);
    });
  }

  async #getSectionGroups(
    parent: OnenoteNotebook | OnenoteSectionGroup,
    parentType: "notebooks" | "sectionGroups"
  ): Promise<OnenoteSectionGroup[]> {
    const sectionGroups: OnenoteSectionGroup[] = await this.#getAll(
      `/me/onenote/${parentType}/${parent.id}/sectionGroups`,
      "sectionGroup",
      defaultProperties
    );

    return await this.#processAll(
      sectionGroups,
      "sectionGroup",
      async (sectionGroup) => {
        if (!sectionGroup.id) return;

        if (parentType === "notebooks")
          sectionGroup.parentNotebook = this.#getParent(parent);
        else if (parentType === "sectionGroups")
          sectionGroup.parentSectionGroup = this.#getParent(parent);

        sectionGroup.sections = await this.#getSections(
          sectionGroup,
          "sectionGroups"
        );
        sectionGroup.sectionGroups = await this.#getSectionGroups(
          sectionGroup,
          "sectionGroups"
        );
      }
    );
  }

  async #getPages(section: OnenoteSection): Promise<OnenotePage[]> {
    const pages: OnenotePage[] = await this.#getAll(
      `/me/onenote/sections/${section.id}/pages`,
      "page",
      [
        "id",
        "title",
        "createdDateTime",
        "lastModifiedDateTime",
        "level",
        "order",
        "userTags",
      ]
    );

    return await this.#processAll(pages, "page", async (page) => {
      if (!page.id) return;
      page.parentSection = {
        parentSectionGroup: section.parentSectionGroup,
        parentNotebook: section.parentNotebook,
        id: section.id,
        displayName: section.displayName,
      };
      page.content = await this.#getPageContent(page);
    });
  }

  async #getPageContent(page: OnenotePage): Promise<Content | null> {
    try {
      const stream = <NodeJS.ReadableStream | null>(
        await this.#client
          .api(`/me/onenote/pages/${page.id}/content`)
          .getStream()
      );
      if (!stream) return null;

      const html = (await convertStream(stream)).toString("utf8");
      return new Content(html, {
        attachmentResolver: (url) => this.#resolveDataUrl(url, page),
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

  async #processAll<T extends Entity>(
    items: T[],
    type: ItemType,
    process: (item: T) => Promise<void>
  ): Promise<T[]> {
    this.#reporter?.report({
      op: "process",
      type,
      total: items.length,
      current: 0,
    });

    for (let i = 0; i < items.length; ++i) {
      const item = items[i];
      await process(item);

      this.#reporter?.report({
        op: "process",
        type,
        total: items.length,
        current: i + 1,
      });
    }
    return items;
  }

  async #getAll<T, TKeys extends keyof T>(
    url: string,
    type: ItemType,
    properties: readonly TKeys[]
  ): Promise<T[]> {
    const items: T[] = [];

    let response: GraphAPIResponse<T[]> | undefined = undefined;
    let skip = 0;
    const limit = 100;
    while (!response || !!response["@odata.nextLink"]) {
      this.#reporter?.report({
        op: "fetch",
        type,
        total: skip + limit,
        current: skip,
      });

      response = <GraphAPIResponse<T[]>>await this.#client
        .api(url)
        .top(limit)
        .skip(skip)
        .select(<string[]>(<unknown>properties))
        .get()
        .catch(async (e) => {
          const error = <Error>e;
          const errorMessage = `Failed to get ${type}`;
          this.#handleError(error, errorMessage);
          return undefined;
        });

      if (!response || !response.value) break;
      items.push(...response.value);
      skip += limit;
    }

    this.#reporter?.report({
      op: "fetch",
      type,
      total: items.length,
      current: items.length,
    });
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
      errorMessage += ` (Request failed with status code: ${error.statusCode}).`;
    }
    this.#reporter?.error(new Error(errorMessage));
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
