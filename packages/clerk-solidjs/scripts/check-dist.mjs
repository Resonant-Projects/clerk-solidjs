#!/usr/bin/env node
// Checks the built package the way an app's bundler sees it:
//
// 1. Every path in package.json `exports` exists in dist.
// 2. For the browser, node and solid conditions (with and without
//    `development`), the ESM files `.` and `./start` resolve to reach exactly
//    one copy of the Clerk contexts, so `/start`'s ClerkProvider and the
//    root entry's hooks share it.
// 3. The ESM files import without throwing in node.
//
// Run it after `pnpm build`.

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const packageDir = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  '..'
);
const pkg = JSON.parse(
  fs.readFileSync(path.join(packageDir, 'package.json'), 'utf8')
);
const failures = [];
const fail = (message) => failures.push(message);

// A string only the Clerk instance context module contains.
const CONTEXT_MARKER = 'ClerkInstanceProvider can only be used within';

/** Every file path in an exports value. */
const leafPaths = (node) =>
  typeof node === 'string'
    ? [node]
    : Object.values(node ?? {}).flatMap(leafPaths);

for (const target of new Set(Object.values(pkg.exports).flatMap(leafPaths))) {
  if (!fs.existsSync(path.join(packageDir, target))) {
    fail(`exports points to ${target}, which the build did not produce`);
  }
}

/** Resolves an exports value the way Node and Vite do: first matching key wins. */
const resolveExport = (node, conditions) => {
  if (typeof node === 'string') return node;
  for (const [key, value] of Object.entries(node)) {
    if (key === 'default' || conditions.includes(key)) {
      const resolved = resolveExport(value, conditions);
      if (resolved) return resolved;
    }
  }
  return undefined;
};

/** The files a module reaches through relative imports. */
const moduleGraph = (entry) => {
  const seen = new Set();
  const visit = (file) => {
    if (seen.has(file)) return;
    seen.add(file);
    const source = fs.readFileSync(file, 'utf8');
    const specifiers = source.matchAll(
      /(?:from|import)\s*["'](\.{1,2}\/[^"']+)["']/g
    );
    for (const [, specifier] of specifiers) {
      visit(path.resolve(path.dirname(file), specifier));
    }
  };
  visit(entry);
  return seen;
};

const conditionSets = [
  ['browser', 'import'],
  ['browser', 'development', 'import'],
  ['node', 'import'],
  ['solid', 'browser', 'import'],
  ['solid', 'browser', 'development', 'import'],
  ['solid', 'node', 'import']
];

for (const conditions of conditionSets) {
  const label = conditions.join('+');
  const contextFiles = {};
  for (const subpath of ['.', './start']) {
    const target = resolveExport(pkg.exports[subpath], conditions);
    if (!target) {
      fail(`${label}: ${subpath} resolves to nothing`);
      continue;
    }
    const graph = moduleGraph(path.join(packageDir, target));
    contextFiles[subpath] = [...graph].filter((file) =>
      fs.readFileSync(file, 'utf8').includes(CONTEXT_MARKER)
    );
    if (contextFiles[subpath].length !== 1) {
      fail(
        `${label}: ${subpath} reaches ${contextFiles[subpath].length} copies of the Clerk contexts`
      );
    }
  }
  const [root] = contextFiles['.'] ?? [];
  const [start] = contextFiles['./start'] ?? [];
  if (root && start && root !== start) {
    fail(
      `${label}: . and ./start use different copies of the Clerk contexts (${path.relative(packageDir, root)}, ${path.relative(packageDir, start)})`
    );
  } else if (root && start) {
    console.log(
      `PASS  ${label}: . and ./start share ${path.relative(packageDir, root)}`
    );
  }
}

// The precompiled ESM files must load in node. JSX files are compiled by the
// app's bundler, so they are not imported here, and neither is `./start`: it
// imports @solidjs/router, whose plain-node build is its DOM build, so only a
// Solid-aware bundler such as SolidStart's can load it.
for (const subpath of ['.', './errors', './server', './start/server']) {
  const target = resolveExport(pkg.exports[subpath], ['node', 'import']);
  try {
    await import(pathToFileURL(path.join(packageDir, target)).href);
    console.log(`PASS  node imports ${subpath} (${target})`);
  } catch (error) {
    fail(
      `node could not import ${subpath} (${target}): ${error instanceof Error ? error.message : error}`
    );
  }
}

if (failures.length) {
  console.error(`\n${failures.length} problem(s):\n- ${failures.join('\n- ')}`);
  process.exit(1);
}
console.log('\ndist checks passed');
