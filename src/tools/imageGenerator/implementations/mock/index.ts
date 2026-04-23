import type { IImageGenerator } from '../../interface.js';

export class MockImageGenerator implements IImageGenerator {
  async generate(_position: number): Promise<Buffer> {
    // Return a minimal 1x1 transparent PNG buffer
    return Buffer.from(
      'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYAAAAAYAAjCB0C8AAAAASUVORK5CYII=',
      'base64'
    );
  }
}
