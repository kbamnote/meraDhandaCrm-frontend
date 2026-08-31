#!/usr/bin/env node
/**
 * Scope check: unbound identifiers AND temporal-dead-zone reads.
 *
 * Exists because a real bug shipped to production that every other check passed:
 * `NewInvoiceModal` read `forParty`, a parameter of the OUTER `CreateInvoiceFlow`
 * component. Different function scope, so the name resolved to nothing and the
 * invoice form threw a ReferenceError before it rendered.
 *
 * That is valid syntax. `@babel/parser`, `node --check` and a successful Vite
 * build all accept it — the failure only appears when the component renders.
 * It walks the scope chain and reports two runtime failures that every other
 * check accepts:
 *   UNBOUND  an identifier referenced but never bound anywhere above it
 *   TDZ      a const/let read BEFORE its declaration in the same function —
 *            "Cannot access 'x' before initialization". A React component that
 *            derives a value from a useState declared further down crashes on
 *            every render; both of those shipped to production before this
 *            script existed.
 *
 *   node scripts/scopecheck.cjs                # every .js/.jsx under src
 *   node scripts/scopecheck.cjs path/to/file   # specific files
 *
 * Exits non-zero when anything is unbound, so it can gate a commit or CI.
 */
const parser = require('@babel/parser');
const traverse = require('@babel/traverse').default;
const fs = require('fs');
const path = require('path');

// Ambient names that are legitimately unbound in module scope.
const GLOBALS = new Set([
  'window', 'document', 'console', 'process', 'navigator', 'location', 'globalThis',
  'Math', 'JSON', 'Object', 'Array', 'String', 'Number', 'Boolean', 'Date', 'RegExp',
  'Promise', 'Set', 'Map', 'WeakMap', 'WeakSet', 'Symbol', 'BigInt', 'Proxy', 'Reflect',
  'Error', 'TypeError', 'RangeError', 'SyntaxError', 'Intl', 'URL', 'URLSearchParams',
  'isNaN', 'isFinite', 'parseInt', 'parseFloat', 'Infinity', 'NaN', 'undefined',
  'setTimeout', 'clearTimeout', 'setInterval', 'clearInterval', 'queueMicrotask',
  'requestAnimationFrame', 'cancelAnimationFrame', 'structuredClone',
  'fetch', 'Headers', 'Request', 'Response', 'AbortController', 'WebSocket', 'EventSource',
  'localStorage', 'sessionStorage', 'indexedDB', 'crypto', 'atob', 'btoa',
  'FormData', 'Blob', 'File', 'FileReader', 'Image', 'Audio', 'Notification',
  'TextEncoder', 'TextDecoder', 'encodeURIComponent', 'decodeURIComponent',
  'encodeURI', 'decodeURI', 'alert', 'confirm', 'prompt',
  'React', 'require', 'module', 'exports', '__dirname', '__filename',
]);

function walk(dir, out = []) {
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, e.name);
    if (e.isDirectory()) { if (e.name !== 'node_modules') walk(p, out); }
    else if (/\.(jsx?|mjs)$/.test(e.name)) out.push(p);
  }
  return out;
}

const args = process.argv.slice(2);
const files = args.length ? args : walk(path.join(__dirname, '..', 'src'));

let problems = 0;
for (const file of files) {
  let ast;
  try {
    ast = parser.parse(fs.readFileSync(file, 'utf8'), { sourceType: 'module', plugins: ['jsx'] });
  } catch (e) {
    problems++;
    console.log(`  PARSE ERROR  ${file}  ${e.message}`);
    continue;
  }
  const rel = path.relative(process.cwd(), file);
  traverse(ast, {
    ReferencedIdentifier(p) {
      const name = p.node.name;
      if (GLOBALS.has(name)) return;
      // `true` walks the whole scope chain, not just the local scope.
      if (!p.scope.hasBinding(name, true)) {
        problems++;
        console.log(`  UNBOUND  ${rel}:${p.node.loc.start.line}  ${name}`);
        return;
      }

      // Temporal dead zone: reading a const/let/class BEFORE its declaration
      // throws "Cannot access 'x' before initialization" at runtime. It parses,
      // the name is bound, and a production build accepts it — so nothing else
      // here catches it. A React component that reads a later useState in a
      // derived const crashes on every render.
      //
      // Only flagged when the reference and the declaration share a function:
      // inside a nested function or callback the read is deferred to call time,
      // which is legitimate and extremely common.
      const binding = p.scope.getBinding(name);
      if (!binding || !['const', 'let', 'class'].includes(binding.kind)) return;
      const declNode = binding.path.node;
      if (declNode.start == null || p.node.start == null) return;
      if (p.node.start >= declNode.start) return;
      if (p.getFunctionParent() !== binding.path.getFunctionParent()) return;
      problems++;
      console.log(`  TDZ      ${rel}:${p.node.loc.start.line}  '${name}' used before its `
        + `${binding.kind} declaration on line ${declNode.loc.start.line}`);
    },
  });
}

console.log(problems
  ? `\n  ${problems} problem(s) across ${files.length} file(s)`
  : `  clean — no unbound identifiers or TDZ reads (${files.length} files)`);
process.exit(problems ? 1 : 0);
