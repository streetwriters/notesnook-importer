import { ContentType, Note } from "../../models/note";
import { SimplenoteExport } from "./types";
import {
  IFileProvider,
  iterate,
  ProviderResult,
  ProviderSettings,
} from "../provider";
import { File } from "../../utils/file";
import { marked } from "marked";
import { markdowntoHTML } from "../../utils/to-html";

const webComponent: marked.TokenizerExtension & marked.RendererExtension = {
  name: "emptyParagraph",
  level: "block",
  start(src) {
    return src.match(/^\n\n\n|^\r\n\r\n\r\n/)?.index;
  },
  tokenizer(src, _) {
    const rule = /^\n\n\n|^\r\n\r\n\r\n/;
    const match = rule.exec(src);
    if (match) {
      const token = {
        type: "paragraph",
        raw: match[0],
        text: match[0],
        tokens: [{ type: "br", raw: "<br>" } as const],
      };
      return token;
    }
  },
  renderer() {
    return `<p><br></p>`;
  },
};

marked.use({ extensions: [webComponent] });

export class Simplenote implements IFileProvider {
  type: "file" = "file";
  public supportedExtensions = [".json"];
  public validExtensions = [".txt", ...this.supportedExtensions];
  public version = "1.0.0";
  public name = "Simplenote";

  async process(
    files: File[],
    settings: ProviderSettings
  ): Promise<ProviderResult> {
    return iterate(this, files, async (file, notes, errors) => {
      const data = file.text;
      const { activeNotes } = <SimplenoteExport>JSON.parse(data);
      if (!activeNotes) return false;

      for (let activeNote of activeNotes) {
        if (
          !activeNote.content ||
          !activeNote.creationDate ||
          !activeNote.lastModified
        ) {
          errors.push(
            new Error(
              `Invalid note. content, creationDate & lastModified properties are required. (File: ${file.name})`
            )
          );
          continue;
        }

        const lines = activeNote.content.split(/\r\n|\n/);
        const title = lines.shift();
        const content = markdowntoHTML(lines.join("\n"));

        let note: Note = {
          title: title || "Untitled note",
          dateCreated: new Date(activeNote.creationDate).getTime(),
          dateEdited: new Date(activeNote.lastModified).getTime(),
          pinned: activeNote.pinned,
          tags: activeNote.tags,
          content: {
            type: ContentType.HTML,
            data: content,
          },
        };

        notes.push(note);
      }

      return true;
    });
  }
}
