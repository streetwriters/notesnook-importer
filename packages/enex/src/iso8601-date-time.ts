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

export class ISO8601DateTime {
  static toDate(date: string): Date | null {
    if (date.length < 16) return null;

    const year = date.substring(0, 4);
    const month = date.substring(4, 6);
    const day = date.substring(6, 8);
    const hour = date.substring(9, 11);
    const minute = date.substring(11, 13);
    const second = date.substring(13, 15);
    const datetime = Date.parse(
      `${year}-${month}-${day}T${hour}:${minute}:${second}Z`
    );

    if (isNaN(datetime)) return null;

    return new Date(datetime);
  }
}
