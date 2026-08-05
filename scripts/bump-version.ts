#!/usr/bin/env node

/**
 * CalVer version bumping script.
 *
 * Usage: node scripts/bump-version.ts <package-path>
 *
 * Version format: YYYY.M.D or YYYY.M.D-BUILD
 * - First release of the day: 2026.8.5
 * - Subsequent releases: 2026.8.5-1, 2026.8.5-2, etc.
 *
 * Outputs the new version to stdout for use in CI.
 */

import { readFileSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';

const packageDir = process.argv[2];
if (!packageDir) {
  console.error('Usage: bump-version.ts <package-path>');
  process.exit(1);
}

const packageJsonPath = resolve(packageDir, 'package.json');

function getDateVersion(): string {
  const today = new Date();
  return `${today.getFullYear()}.${today.getMonth() + 1}.${today.getDate()}`;
}

function bumpVersion(): string {
  const packageJson = JSON.parse(readFileSync(packageJsonPath, 'utf-8'));
  const currentVersion: string = packageJson.version || '0.0.0';
  const dateVersion = getDateVersion();

  let newVersion: string;

  if (currentVersion.startsWith(dateVersion)) {
    const parts = currentVersion.split('-');
    const buildNum = parts.length > 1 ? parseInt(parts[1] as string, 10) + 1 : 1;
    newVersion = `${dateVersion}-${buildNum}`;
  } else {
    newVersion = dateVersion;
  }

  packageJson.version = newVersion;
  writeFileSync(packageJsonPath, JSON.stringify(packageJson, null, 2) + '\n', 'utf-8');

  return newVersion;
}

const newVersion = bumpVersion();
console.log(newVersion);
