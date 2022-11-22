import { Note } from "@notesnook-importer/core";
import { IStorage } from "@notesnook-importer/storage";

export type TransformResult = {
  totalNotes: number;
  errors: Error[];
};
