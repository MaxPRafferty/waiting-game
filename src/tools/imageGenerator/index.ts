import { MockImageGenerator } from './implementations/mock/index.js';
import { SatoriImageGenerator } from './implementations/satori/index.js';
import type { IImageGenerator } from './interface.js';

const mode = process.env.DEPENDENCY_MODE || 'MOCK';

export const imageGenerator: IImageGenerator = mode === 'LIVE' 
  ? new SatoriImageGenerator() 
  : new MockImageGenerator();
