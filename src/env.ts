import dotenv from 'dotenv';
import path from 'path';
import { existsSync } from 'fs';

const loadEnv = () => {
  const root = process.cwd();
  
  // 1. Load defaults
  const defaultsPath = path.join(root, '.env.local.defaults');
  if (existsSync(defaultsPath)) {
    dotenv.config({ path: defaultsPath });
  }

  // 2. Override with local settings
  const localPath = path.join(root, '.env.local');
  if (existsSync(localPath)) {
    dotenv.config({ path: localPath, override: true });
  }

  // 3. Final validation/defaults
  process.env.NODE_ENV = process.env.NODE_ENV || 'development';
  process.env.DEPENDENCY_MODE = process.env.DEPENDENCY_MODE || 'MOCK';
  process.env.PORT = process.env.PORT || '3000';
};

loadEnv();
