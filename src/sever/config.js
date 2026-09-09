import path from 'path';

export const ROOT = path.resolve(process.argv[2] ?? import.meta.dirname);
export const INDEX_PATH = process.argv[3];  