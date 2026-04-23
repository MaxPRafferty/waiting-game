export interface IImageGenerator {
  /**
   * Generates a PNG image buffer for the given queue position.
   */
  generate(position: number): Promise<Buffer>;
}
