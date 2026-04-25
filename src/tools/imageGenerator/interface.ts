export interface IImageGenerator {
  generate(seq: number): Promise<Buffer>;
}
