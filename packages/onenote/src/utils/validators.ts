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

import { GUID } from "./guid";

function validateProperty(
  target: any,
  memberName: string,
  validate: (value: any) => void
) {
  let currentValue: any = target[memberName];
  Object.defineProperty(target, memberName, {
    set: (newValue: any) => {
      validate(newValue);
      currentValue = newValue;
    },
    get: () => currentValue,
  });
}

export function mustBeZero(target: any, memberName: string) {
  validateProperty(target, memberName, (newValue: any) => {
    if (typeof newValue === "number" && newValue !== 0)
      throw new Error(`${memberName} must be zero but got ${newValue}.`);
  });
}

export function mustNotBeZero(target: any, memberName: string) {
  validateProperty(target, memberName, (newValue: any) => {
    if (typeof newValue === "number" && newValue === 0)
      throw new Error(`${memberName} must not be zero but got ${newValue}.`);
  });
}

export function mustMatchGUID(...matches: GUID[]) {
  return function (target: any, memberName: string) {
    validateProperty(target, memberName, (newValue: any) => {
      if (matches.every((m) => !newValue.equals(m)))
        throw new Error(
          `${memberName} must be one of ${matches} but got ${newValue}.`
        );
    });
  };
}

export function mustMatch(...matches: any[]) {
  return function (target: any, memberName: string) {
    validateProperty(target, memberName, (newValue: any) => {
      if (matches.every((m) => newValue !== m))
        throw new Error(`${memberName} must be one of ${matches}.`);
    });
  };
}

export function mustHaveLength(length: number) {
  return function (target: any, memberName: string) {
    validateProperty(target, memberName, (newValue: any) => {
      if (newValue.length !== length)
        throw new Error(`${memberName} must have ${length} elements.`);
    });
  };
}

export const mustBeFcrNil: Matcher = {
  isValid: (value) => !value.isZero,
  error: (name) => `${name} must have a value of fcrNil.`,
};

export const mustBeFcrZero: Matcher = {
  isValid: (value) => value.isZero,
  error: (name) => `${name} must have a value of fcrZero.`,
};

export const mustNotBeFcrNil: Matcher = {
  isValid: (value) => !value.isNil,
  error: (name) => `${name} must not have a value of fcrNil.`,
};

export const mustNotBeFcrZero: Matcher = {
  isValid: (value) => !value.isZero,
  error: (name) => `${name} must not have a value of fcrZero.`,
};

type Matcher = {
  isValid: (value: any) => boolean;
  error: (name: string) => string;
};
export function property(...matchers: Matcher[]) {
  return function (target: any, memberName: string) {
    validateProperty(target, memberName, (newValue: any) => {
      for (const matcher of matchers) {
        if (!matcher.isValid(newValue))
          throw new Error(matcher.error(memberName));
      }
    });
  };
}
