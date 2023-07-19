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

import { Entity, ModelType } from "./types";

// Taken from https://github.com/laurent22/joplin/blob/6f1a806e5c7159a544de5d997b189e0e83a9d8ea/packages/lib/models/BaseItem.ts#L477-L523
export function unserialize(content: string): Entity {
  const lines = content.split("\n");
  const output: Record<string, unknown> = {};
  let state = "readingProps";
  const body: string[] = [];

  for (let i = lines.length - 1; i >= 0; i--) {
    let line = lines[i];

    if (state == "readingProps") {
      line = line.trim();

      if (line == "") {
        state = "readingBody";
        continue;
      }

      const p = line.indexOf(":");
      if (p < 0)
        throw new Error(`Invalid property format: ${line}: ${content}`);
      const key = line.substr(0, p).trim();
      const value = line.substr(p + 1).trim();
      output[key] = value;
    } else if (state == "readingBody") {
      body.splice(0, 0, line);
    }
  }

  if (!output.type_)
    throw new Error(`Missing required property: type_: ${content}`);
  output.type_ = Number(output.type_);

  if (body.length && output.type_ !== ModelType.NoteTag) {
    const title = body.splice(0, 2);
    output.title = title[0];
  }

  if (output.type_ === ModelType.Note) output.body = body.join("\n");

  for (const key in output) {
    if (!Object.prototype.hasOwnProperty.call(output, key)) continue;
    output[key] = unserializeFormat(key, output[key as keyof Entity]);
  }
  return output as unknown as Entity;
}

// Taken from https://github.com/laurent22/joplin/blob/dev/packages/lib/models/BaseItem.ts#L325-L351
// slightly modified to remove all database related code
function unserializeFormat(propName: string, propValue: any): string {
  if (propName[propName.length - 1] == "_") return propValue; // Private property

  if (["title_diff", "body_diff"].indexOf(propName) >= 0) {
    if (!propValue) return "";
    propValue = JSON.parse(propValue);
  } else if (["longitude", "latitude", "altitude"].indexOf(propName) >= 0) {
    const places = propName === "altitude" ? 4 : 8;
    propValue = Number(propValue).toFixed(places);
  } else {
    if (
      [
        "created_time",
        "updated_time",
        "user_created_time",
        "user_updated_time"
      ].indexOf(propName) >= 0
    ) {
      propValue = !propValue ? "0" : new Date(propValue).getTime();
    }
  }

  if (propName === "body") return propValue;

  return typeof propValue === "string"
    ? propValue
        .replace(/\\n/g, "\n")
        .replace(/\\r/g, "\r")
        .replace(/\\\n/g, "\\n")
        .replace(/\\\r/g, "\\r")
    : propValue;
}

// export function getEntityType(content)
