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
  ANAttachment,
  ANContext,
  ANConverter,
  ANMergeableDataObject,
  ANMergableDataProto,
  ANTableObject
} from "./models";

export class ScanConverter extends ANConverter {
  scan: ANMergeableDataObject;
  objects: ANTableObject[];

  static protobufType = "ciofecaforensics.MergableDataProto";

  constructor(ctx: ANContext, scan: ANMergableDataProto) {
    super(ctx);

    this.scan = scan.mergableDataObject;
    this.objects = this.scan.mergeableDataObjectData.mergeableDataObjectEntry;
  }

  async format(): Promise<string> {
    const links: string[] = [];

    for (const object of this.objects) {
      if (!object.customMap) continue;
      const imageUuid = object.customMap.mapEntry[0].value.stringValue;

      const row = await this.ctx.database.get<{ Z_PK: number; ZMEDIA: number; ZTYPEUTI: string }>(
        "SELECT z_pk, zmedia, ztypeuti FROM ziccloudsyncingobject WHERE zidentifier = ?",
        [imageUuid]
      );

      if (!row) return "<p>Cannot decode scan</p>";

      let html = await this.ctx.resolveAttachment(row.Z_PK, ANAttachment.Scan, true);
      if (!html) html = await this.ctx.resolveAttachment(row.ZMEDIA, row.ZTYPEUTI);

      if (html) {
        links.push(html);
      } else {
        return "<p>Cannot decode scan</p>";
      }
    }

    return links.join("");
  }
}
