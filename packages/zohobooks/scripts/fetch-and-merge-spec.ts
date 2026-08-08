#!/usr/bin/env node

/**
 * Downloads the ZohoBooks OpenAPI spec bundle (ZIP of individual YAML files)
 * and merges them into a single openapi.yaml.
 */

import { execSync } from 'node:child_process';
import { mkdtempSync, readFileSync, readdirSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import yaml from 'js-yaml';

const SPEC_ZIP_URL = 'https://www.zoho.com/books/api/v3/openapi-all.zip';
const OUTPUT_FILE = resolve(import.meta.dirname, '..', 'openapi.yaml');

interface OpenApiSpec {
  openapi: string;
  info: Record<string, unknown>;
  servers: unknown[];
  tags: Array<{ name: string; description: string }>;
  paths: Record<string, unknown>;
  components: {
    schemas: Record<string, unknown>;
    parameters?: Record<string, unknown>;
  };
}

async function main(): Promise<void> {
  const tmpDir = mkdtempSync(join(tmpdir(), 'zohobooks-spec-'));
  const zipPath = join(tmpDir, 'openapi-all.zip');
  const extractDir = join(tmpDir, 'extracted');

  try {
    console.log(`Downloading spec from ${SPEC_ZIP_URL}...`);
    const response = await fetch(SPEC_ZIP_URL);
    if (!response.ok) {
      throw new Error(`Failed to download: ${response.status} ${response.statusText}`);
    }
    const buffer = Buffer.from(await response.arrayBuffer());
    writeFileSync(zipPath, buffer);

    console.log('Extracting ZIP...');
    execSync(`unzip -o "${zipPath}" -d "${extractDir}"`, { stdio: 'pipe' });

    const files = readdirSync(extractDir)
      .filter((f) => f.endsWith('.yml') || f.endsWith('.yaml'))
      .sort();
    console.log(`Found ${files.length} spec files`);

    const merged: OpenApiSpec = {
      openapi: '3.0.0',
      info: {
        title: 'ZohoBooks API',
        description: 'Merged OpenAPI spec for ZohoBooks API v3',
        version: '3.0.0',
      },
      servers: [{ url: 'https://www.zohoapis.com/books/v3', description: 'API Endpoint' }],
      tags: [],
      paths: {},
      components: { schemas: {}, parameters: {} },
    };

    const seenTags = new Set<string>();

    for (const file of files) {
      const content = readFileSync(join(extractDir, file), 'utf-8');
      const spec = yaml.load(content) as OpenApiSpec;

      // Merge tags
      for (const tag of spec.tags ?? []) {
        if (!seenTags.has(tag.name)) {
          seenTags.add(tag.name);
          merged.tags.push(tag);
        }
      }

      // Merge paths
      for (const [path, methods] of Object.entries(spec.paths ?? {})) {
        if (merged.paths[path]) {
          // Merge methods into existing path
          Object.assign(
            merged.paths[path] as Record<string, unknown>,
            methods as Record<string, unknown>,
          );
        } else {
          merged.paths[path] = methods;
        }
      }

      // Merge schemas (first definition wins for duplicates)
      const schemas = spec.components?.schemas ?? {};
      for (const [name, schema] of Object.entries(schemas)) {
        if (!merged.components.schemas[name]) {
          merged.components.schemas[name] = schema;
        }
      }

      // Merge parameters (first definition wins for duplicates)
      const parameters = spec.components?.parameters ?? {};
      for (const [name, param] of Object.entries(parameters)) {
        if (!merged.components.parameters![name]) {
          merged.components.parameters![name] = param;
        }
      }
    }

    console.log(
      `Merged: ${Object.keys(merged.paths).length} paths, ${merged.tags.length} tags, ${Object.keys(merged.components.schemas).length} schemas, ${Object.keys(merged.components.parameters!).length} parameters`,
    );

    const output = yaml.dump(merged, {
      lineWidth: -1,
      noRefs: true,
      sortKeys: false,
    });
    writeFileSync(OUTPUT_FILE, output, 'utf-8');
    console.log(`Written to ${OUTPUT_FILE}`);
  } finally {
    rmSync(tmpDir, { recursive: true, force: true });
  }
}

main().catch((error: unknown) => {
  console.error('Error:', error);
  process.exit(1);
});
