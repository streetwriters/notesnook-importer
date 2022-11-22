export class ProgressStream extends TransformStream {
  progress = 0;
  constructor(report: (bytesRead: number) => void) {
    super({
      start() {},
      transform: async (chunk, controller) => {
        this.progress += chunk.byteLength;
        report(this.progress);
        controller.enqueue(chunk);
      },
      flush() {}
    });
  }
}
