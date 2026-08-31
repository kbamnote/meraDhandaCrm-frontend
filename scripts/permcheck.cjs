#!/usr/bin/env node
/**
 * Permission-catalog consistency check.
 *
 * Exists because adding TDS to PERMISSION_CATALOG without a matching
 * MODULE_LABELS entry crashed the ENTIRE permissions dialog with
 * "Cannot read properties of undefined (reading 'hinglish')" — admins could not
 * grant access to anyone. The label lookup is defensive now, but a missing
 * label still means a feature shows as a raw key like `tds`, so catch it here.
 *
 * Also flags gated-looking routes with no PERM_OF entry: isSectionHidden treats
 * an unmapped route as ungated and shows it to EVERY role, which is the wrong
 * default for anything financial.
 *
 *   node scripts/permcheck.cjs
 */
const fs = require('fs'); const path = require('path');
const root = path.join(__dirname, '..');
const acc = fs.readFileSync(path.join(root, 'src/config/access.js'), 'utf8');
const perm = fs.readFileSync(path.join(root, 'src/pages/PermissionsPage.jsx'), 'utf8');

const cat = acc.slice(acc.indexOf('export const PERMISSION_CATALOG'));
const featureKeys = [...new Set([...cat.matchAll(/\{\s*key:\s*'([a-zA-Z0-9_.-]+)'/g)].map((m) => m[1]))];
const groupKeys = [...new Set([...cat.matchAll(/group:\s*'([a-zA-Z0-9_-]+)'/g)].map((m) => m[1]))];

const block = (src, name) => {
  const i = src.indexOf(`const ${name} = {`);
  return i < 0 ? '' : src.slice(i, src.indexOf('\n};', i));
};
const keysOf = (name) => new Set(
  [...block(perm, name).matchAll(/^\s{2}'?([a-zA-Z0-9_.-]+)'?\s*:/gm)].map((m) => m[1])
);
const moduleLabels = keysOf('MODULE_LABELS');
const groupLabels = keysOf('GROUP_LABELS');

let problems = 0; let warnings = 0;
const fail = (list, msg) => list.forEach((k) => { problems++; console.log(`  ERROR  ${msg}: ${k}`); });
const warn = (list, msg) => list.forEach((k) => { warnings++; console.log(`  warn   ${msg}: ${k}`); });

fail(featureKeys.filter((k) => !moduleLabels.has(k)), 'catalog feature has NO MODULE_LABELS entry');
fail(groupKeys.filter((g) => !groupLabels.has(g)), 'catalog group has NO GROUP_LABELS entry');

// Accounting/HR routes are financial or personal; an unmapped one is public to
// every role. Flag them so the omission is deliberate rather than accidental.
const permOf = acc.slice(acc.indexOf('export const PERM_OF'), acc.indexOf('export const ROLE_READ_DEFAULTS'));
const mapped = new Set([...permOf.matchAll(/'([^']+)'\s*:\s*'[^']+'/g)].map((m) => m[1]));
const app = fs.readFileSync(path.join(root, 'src/App.jsx'), 'utf8');
const routes = [...new Set([...app.matchAll(/\['((?:accounting|hr)\/[a-z-]+)'/g)].map((m) => '/' + m[1]))];
// Warning, not an error: several of these predate the check and are reachable
// today. Gating one REMOVES access a role currently has, so that's a deliberate
// call rather than something a script should force.
warn(routes.filter((r) => !mapped.has(r)), 'route is UNGATED (visible to every role)');

console.log('');
if (problems) {
  console.log(`  ${problems} error(s)` + (warnings ? `, ${warnings} warning(s)` : ''));
} else {
  console.log(`  labels consistent (${featureKeys.length} features)`
    + (warnings ? `, ${warnings} ungated route(s) to review` : ''));
}
process.exit(problems ? 1 : 0);
