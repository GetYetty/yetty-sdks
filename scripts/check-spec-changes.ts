#!/usr/bin/env node

/**
 * Detect changes in an OpenAPI spec.
 *
 * Supports two modes:
 *   Remote: --spec-url <url>  --hash-file <path>  --output <path>
 *   Local:  --spec-file <path> --hash-file <path>
 *
 * Computes SHA256 of the spec content and compares with the stored hash.
 * Exit 0 = changes detected (proceed with publish).
 * Exit 1 = no changes (skip publish in CI).
 * Exit 2 = error.
 */

import { createHash } from 'node:crypto';
import { readFileSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';

function parseArgs(): { specUrl?: string; specFile?: string; hashFile: string; output?: string } {
  const args = process.argv.slice(2);
  let specUrl: string | undefined;
  let specFile: string | undefined;
  let hashFile = '';
  let output: string | undefined;

  for (let i = 0; i < args.length; i++) {
    switch (args[i]) {
      case '--spec-url':
        specUrl = args[++i];
        break;
      case '--spec-file':
        specFile = args[++i];
        break;
      case '--hash-file':
        hashFile = args[++i]!;
        break;
      case '--output':
        output = args[++i];
        break;
    }
  }

  if (!hashFile) {
    console.error('Missing required --hash-file');
    process.exit(2);
  }
  if (!specUrl && !specFile) {
    console.error('Provide either --spec-url or --spec-file');
    process.exit(2);
  }

  return { specUrl, specFile, hashFile: resolve(hashFile), output: output ? resolve(output) : undefined };
}

async function main(): Promise<void> {
  const { specUrl, specFile, hashFile, output } = parseArgs();

  let specContent: string;

  if (specUrl) {
    console.log(`Fetching OpenAPI spec from ${specUrl}...`);
    const response = await fetch(specUrl);
    if (!response.ok) {
      console.error(`Failed to fetch spec: ${response.status} ${response.statusText}`);
      process.exit(2);
    }
    specContent = await response.text();
  } else {
    console.log(`Reading OpenAPI spec from ${specFile}...`);
    try {
      specContent = readFileSync(resolve(specFile!), 'utf-8');
    } catch (error) {
      console.error(`Failed to read spec file: ${error}`);
      process.exit(2);
    }
  }

  const newHash = createHash('sha256').update(specContent).digest('hex');
  console.log(`New spec hash: ${newHash}`);

  let oldHash = '';
  try {
    oldHash = readFileSync(hashFile, 'utf-8').trim();
    console.log(`Old spec hash: ${oldHash}`);
  } catch {
    console.log('No previous hash found, treating as new spec');
  }

  if (newHash === oldHash) {
    console.log('No changes detected in OpenAPI spec');
    process.exit(1);
  }

  console.log('Changes detected! Updating files...');

  if (output) {
    writeFileSync(output, specContent, 'utf-8');
  }
  writeFileSync(hashFile, newHash, 'utf-8');

  console.log('Files updated');
  process.exit(0);
}

main().catch((error: unknown) => {
  console.error('Error:', error);
  process.exit(2);
});
