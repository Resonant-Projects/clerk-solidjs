#!/usr/bin/env node
// Checks the built package the way an app's bundler sees it:
//
// 1. Every path in package.json `exports` exists in dist.
// 2. For the browser, node and solid conditions (with and without
//    `development`), the ESM files `.`, `./start`, `./legacy`,
//    `./experimental` and `./internal` resolve to reach exactly one copy of
//    the Clerk contexts, the same one, so
//    `/start`'s ClerkProvider and the other entries' hooks share it.
// 3. The ESM files import without throwing in node.
// 4. Nothing is CommonJS: each CommonJS entry carried its own copy of the
//    Clerk contexts, so 4.0 ships ESM only.
// 5. `./start/server` gives the browser its stub, which reaches no
//    @clerk/backend, and every server runtime the real entry, including
//    worker builds that also set `browser`.
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
  if (/\.c[jt]s$/.test(target)) {
    fail(`exports points to ${target}, a CommonJS file`);
  }
}
for (const field of ['main', 'module']) {
  if (/\.c[jt]s$/.test(pkg[field] ?? '')) {
    fail(`package.json ${field} is CommonJS: ${pkg[field]}`);
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

/** The entries that use the Clerk contexts. */
const contextSubpaths = [
  '.',
  './start',
  './legacy',
  './experimental',
  './internal'
];

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
  for (const subpath of contextSubpaths) {
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
  const copies = new Set(
    contextSubpaths.flatMap((subpath) => contextFiles[subpath] ?? [])
  );
  if (copies.size > 1) {
    fail(
      `${label}: ${contextSubpaths.join(', ')} use different copies of the Clerk contexts (${[...copies].map((file) => path.relative(packageDir, file)).join(', ')})`
    );
  } else if (copies.size === 1) {
    console.log(
      `PASS  ${label}: ${contextSubpaths.join(', ')} share ${path.relative(packageDir, [...copies][0])}`
    );
  }
}

const serverEntry = pkg.exports['./start/server'];
const SERVER_TARGET = './dist/start/server/index.js';
for (const conditions of [
  ['browser', 'import'],
  ['browser', 'development', 'import'],
  ['solid', 'browser', 'import']
]) {
  const label = conditions.join('+');
  const target = resolveExport(serverEntry, conditions);
  if (!target || target === SERVER_TARGET) {
    fail(
      `${label}: ./start/server resolves to ${target}, not its browser stub`
    );
    continue;
  }
  const backend = [...moduleGraph(path.join(packageDir, target))].filter(
    (file) => /["']@clerk\/backend/.test(fs.readFileSync(file, 'utf8'))
  );
  if (backend.length) {
    fail(`${label}: ./start/server's browser stub reaches @clerk/backend`);
  } else {
    console.log(`PASS  ${label}: ./start/server is ${target}`);
  }
}
for (const conditions of [
  ['node', 'import'],
  ['workerd', 'worker', 'browser', 'import'],
  ['worker', 'browser', 'import'],
  ['edge-light', 'browser', 'import'],
  ['deno', 'import'],
  ['bun', 'node', 'import']
]) {
  const label = conditions.join('+');
  const target = resolveExport(serverEntry, conditions);
  if (target !== SERVER_TARGET) {
    fail(
      `${label}: ./start/server resolves to ${target}, not ${SERVER_TARGET}`
    );
  } else {
    console.log(`PASS  ${label}: ./start/server is the server entry`);
  }
}

// The precompiled ESM files must load in node. JSX files are compiled by the
// app's bundler, so they are not imported here, and neither is `./start`: it
// imports @solidjs/router, whose plain-node build is its DOM build, so only a
// Solid-aware bundler such as SolidStart's can load it.
for (const subpath of [
  '.',
  './legacy',
  './experimental',
  './internal',
  './errors',
  './server',
  './start/server',
  './webhooks'
]) {
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

// The browser stub loads, and says where to call what it stands in for.
{
  const target = resolveExport(serverEntry, ['browser', 'import']);
  try {
    const stub = await import(
      pathToFileURL(path.join(packageDir, target)).href
    );
    const real = await import(
      pathToFileURL(path.join(packageDir, SERVER_TARGET)).href
    );
    const missing = Object.keys(real).filter((name) => !(name in stub));
    if (missing.length) {
      fail(`./start/server's browser stub lacks ${missing.join(', ')}`);
    }
    let message = '';
    try {
      stub.auth();
    } catch (error) {
      message = error instanceof Error ? error.message : String(error);
    }
    if (!message.includes('only runs on the server')) {
      fail(`./start/server's browser stub auth() did not throw: ${message}`);
    } else {
      console.log(
        'PASS  ./start/server browser stub has every export and throws when called'
      );
    }
  } catch (error) {
    fail(
      `node could not import ./start/server's browser stub (${target}): ${error instanceof Error ? error.message : error}`
    );
  }
}

if (failures.length) {
  console.error(`\n${failures.length} problem(s):\n- ${failures.join('\n- ')}`);
  process.exit(1);
}
console.log('\ndist checks passed');
