#!/usr/bin/env node
/**
 * Repo-root entry: runs backend/scripts/clearListings.js with cwd = backend so relative .env works.
 * Usage:
 *   CLEAR_LISTINGS_CONFIRM=DELETE_ALL_MARKETPLACE_LISTINGS node scripts/clearListings.js
 * Production requires additionally: --production or CLEAR_LISTINGS_ALLOW_PRODUCTION=1
 */

const { spawnSync } = require("child_process");
const path = require("path");

const backendDir = path.join(__dirname, "..", "backend");
const script = path.join(backendDir, "scripts", "clearListings.js");

const r = spawnSync(process.execPath, [script, ...process.argv.slice(2)], {
  cwd: backendDir,
  env: process.env,
  stdio: "inherit",
});

if (r.error) {
  console.error(r.error);
  process.exit(1);
}
process.exit(r.status === null ? 1 : r.status);
