import { mkdir, rm } from 'node:fs/promises';
import { globSync } from 'node:fs';
import { dirname, join, relative } from 'node:path';
import { build } from 'esbuild';

await rm('.test-dist', { recursive: true, force: true });

const sources = globSync('src/**/*.ts').sort();
await Promise.all(
  sources.map(async (entryPoint) => {
    const relativeSource = relative('src', entryPoint).replace(/\\/g, '/');
    const outfile = join(
      '.test-dist',
      relativeSource.replace(/\.ts$/, '.mjs'),
    );
    await mkdir(dirname(outfile), { recursive: true });
    await build({
      entryPoints: [entryPoint],
      outfile,
      bundle: true,
      charset: 'utf8',
      format: 'esm',
      legalComments: 'none',
      platform: 'node',
      target: 'es2019',
    });
  }),
);
