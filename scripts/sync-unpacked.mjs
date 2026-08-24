import { cp, mkdir, rm } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';

const projectRoot = fileURLToPath(new globalThis.URL('..', import.meta.url));
const sourceDirectory = `${projectRoot}/.output/chrome-mv3`;
const targetDirectory = `${projectRoot}/Visual-Bookmark-Extension`;

await rm(targetDirectory, { force: true, recursive: true });
await mkdir(targetDirectory, { recursive: true });
await cp(sourceDirectory, targetDirectory, { recursive: true });
