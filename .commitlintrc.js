/* eslint-disable @typescript-eslint/no-var-requires */

const { execSync } = require("child_process");
const { readFileSync } = require("fs");

const authorEmail = execSync(`git config --global --get user.email`)
  .toString("utf-8")
  .trim();
const authors = readFileSync("AUTHORS", "utf-8");
const isAuthor = authors.includes(`<${authorEmail}>`);

const SCOPES = [
  "web",
  "core",
  "enex",
  "onenote",
  "znel",
  "config",
  "ci",
  "setup",
  "docs",
  "refactor",
  "misc",
  "global"
];

module.exports = {
  rules: {
    "signed-off-by": [isAuthor ? 0 : 2, "always", `Signed-off-by:`],
    "type-enum": [2, "always", SCOPES],
    "type-empty": [2, "never"]
  }
};
