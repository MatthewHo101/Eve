import { readdirSync } from 'node:fs';
import { join } from 'node:path';
import { spawnSync } from 'node:child_process';

function javascriptFiles(directory) {
  return readdirSync(directory, { withFileTypes: true }).flatMap(entry => {
    if (['node_modules', '.git', '.vercel'].includes(entry.name)) return [];
    const path = join(directory, entry.name);
    return entry.isDirectory() ? javascriptFiles(path) : /\.(js|mjs)$/.test(entry.name) ? [path] : [];
  });
}

for (const file of javascriptFiles('.')) {
  const result = spawnSync(process.execPath, ['--check', file], { stdio: 'inherit' });
  if (result.error) throw result.error;
  if (result.status !== 0) process.exit(result.status || 1);
}
console.log('JavaScript syntax checks passed.');
