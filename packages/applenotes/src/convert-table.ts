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
  ANContext,
  ANConverter,
  ANMergableDataProto,
  ANMergeableDataObject,
  ANTableKey,
  ANTableObject,
  ANTableType,
  ANTableUuidMapping
} from "./models";
import { NoteConverter } from "./convert-note";

export class TableConverter extends ANConverter {
  table: ANMergeableDataObject;

  keys: ANTableKey[];
  types: ANTableType[];
  uuids: string[];

  objects: ANTableObject[];

  rowCount: number = 0;
  rowLocations: ANTableUuidMapping = {};

  columnCount: number = 0;
  columnLocations: ANTableUuidMapping = {};

  static protobufType = "ciofecaforensics.MergableDataProto";

  constructor(ctx: ANContext, table: ANMergableDataProto) {
    super(ctx);
    this.table = table.mergableDataObject;

    const data = this.table.mergeableDataObjectData;

    this.keys = data.mergeableDataObjectKeyItem;
    this.types = data.mergeableDataObjectTypeItem;
    this.uuids = data.mergeableDataObjectUuidItem.map((u) => this.uuidToString(u));
    this.objects = data.mergeableDataObjectEntry;
  }

  async parse(): Promise<string[][] | null> {
    const root = this.objects.find(
      (e) => e.customMap && this.types[e.customMap.type] == ANTableType.ICTable
    );
    if (!root) return null;

    let cellData: ANTableObject | null = null;

    for (const entry of root.customMap.mapEntry) {
      const object = this.objects[entry.value.objectIndex];

      switch (this.keys[entry.key]) {
        case ANTableKey.Rows:
          [this.rowLocations, this.rowCount] = this.findLocations(object);
          break;

        case ANTableKey.Columns:
          [this.columnLocations, this.columnCount] = this.findLocations(object);
          break;

        case ANTableKey.CellColumns:
          cellData = object;
          break;
      }
    }

    if (!cellData) return null;
    return await this.computeCells(cellData);
  }

  findLocations(object: ANTableObject): [ANTableUuidMapping, number] {
    const ordering: string[] = [];
    const indices: ANTableUuidMapping = {};

    for (const element of object.orderedSet.ordering.array.attachment) {
      ordering.push(this.uuidToString(element.uuid));
    }

    for (const element of object.orderedSet.ordering.contents.element) {
      const key = this.getTargetUuid(element.key);
      const value = this.getTargetUuid(element.value);

      indices[value] = ordering.indexOf(key);
    }

    return [indices, ordering.length];
  }

  async computeCells(cellData: ANTableObject): Promise<string[][]> {
    const result = Array(this.rowCount)
      .fill(0)
      .map(() => Array(this.columnCount));

    for (const column of cellData.dictionary.element) {
      const columnLocation = this.columnLocations[this.getTargetUuid(column.key)];
      const rowData = this.objects[column.value.objectIndex];

      for (const row of rowData.dictionary.element) {
        const rowLocation = this.rowLocations[this.getTargetUuid(row.key)];
        const rowContent = this.objects[row.value.objectIndex];

        if (!(rowLocation in result) || !rowContent) continue;

        const converter = new NoteConverter(this.ctx, rowContent.note, false);
        result[rowLocation][columnLocation] = await converter.format(true);
      }
    }

    return result;
  }

  async format(): Promise<string> {
    const table = await this.parse();
    if (!table || table.length === 0) return "";

    const rows = table
      .map((row) => `<tr>${row.map((cell) => `<td>${cell}</td>`).join("")}</tr>`)
      .join("");

    return `<table><tbody>${rows}</tbody></table>`;
  }

  getTargetUuid(entry: any): string {
    const reference = this.objects[entry.objectIndex];
    const uuidIndex = reference.customMap.mapEntry[0].value.unsignedIntegerValue;
    return this.uuids[uuidIndex];
  }

  uuidToString(uuid: Uint8Array): string {
    let out = "";
    for (const byte of uuid) out += byte.toString(16).padStart(2, "0");
    return out;
  }
}
