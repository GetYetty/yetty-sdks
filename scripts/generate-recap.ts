#!/usr/bin/env node

/**
 * Generate human-readable release notes for an OpenAPI spec update.
 *
 * Usage: node scripts/generate-recap.ts --spec-git-path <path> --repo-url <url>
 *
 * Strategy:
 *  - The FACTS (breaking changes, full changelog) come from `oasdiff`.
 *  - The PROSE (a short "Highlights" intro) comes from Mistral AI (best-effort).
 *  - If the LLM call fails, the deterministic notes still ship.
 */

import { Mistral } from '@mistralai/mistralai';
import { execFileSync, execSync } from 'node:child_process';
import { mkdtempSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';

const MISTRAL_MODEL = process.env.MISTRAL_MODEL ?? 'mistral-medium-2505';
const MAX_BUFFER = 64 * 1024 * 1024;

function parseArgs(): { specGitPath: string; specFilePath: string; repoUrl: string } {
  const args = process.argv.slice(2);
  let specGitPath = '';
  let repoUrl = '';

  for (let i = 0; i < args.length; i++) {
    switch (args[i]) {
      case '--spec-git-path':
        specGitPath = args[++i]!;
        break;
      case '--repo-url':
        repoUrl = args[++i]!;
        break;
    }
  }

  if (!specGitPath || !repoUrl) {
    console.error('Usage: generate-recap.ts --spec-git-path <path> --repo-url <url>');
    process.exit(1);
  }

  return { specGitPath, specFilePath: resolve(specGitPath), repoUrl };
}

function sleep(ms: number): Promise<void> {
  return new Promise((r) => setTimeout(r, ms));
}

function run(cmd: string, args: string[], allowFailure = false): string {
  try {
    return execFileSync(cmd, args, { encoding: 'utf-8', maxBuffer: MAX_BUFFER }).toString();
  } catch (error) {
    const stdout = (error as { stdout?: Buffer | string }).stdout;
    if (allowFailure && stdout != null) {
      return stdout.toString();
    }
    throw error;
  }
}

function readBaseSpec(specGitPath: string): string | null {
  try {
    return execSync(`git show HEAD:${specGitPath}`, {
      encoding: 'utf-8',
      maxBuffer: MAX_BUFFER,
    }).toString();
  } catch {
    return null;
  }
}

function ensureOasdiff(): void {
  try {
    execSync('oasdiff --version', { stdio: 'ignore' });
  } catch {
    console.error('oasdiff is not installed or not on PATH.');
    process.exit(1);
  }
}

function cleanOasdiff(report: string): string {
  return report
    .replace(/^#\s*API Changelog.*$/im, '')
    .replace(/^##\s*API Changes\s*$/im, '')
    .trim();
}

function isEmptyReport(cleaned: string): boolean {
  return cleaned === '' || /^no changes detected/i.test(cleaned);
}

type ChangeGroup = { header: string; bullets: string[] };

function parseGroups(md: string): ChangeGroup[] {
  const groups: ChangeGroup[] = [];
  let current: ChangeGroup | null = null;
  for (const raw of md.split('\n')) {
    const line = raw.trimEnd();
    if (line.startsWith('### ')) {
      current = { header: line, bullets: [] };
      groups.push(current);
    } else if (line.startsWith('- ') && current) {
      current.bullets.push(line);
    }
  }
  return groups;
}

function nonBreakingChanges(changelog: string, breaking: string): string {
  const breakingByHeader = new Map<string, Set<string>>();
  for (const group of parseGroups(breaking)) {
    const set = breakingByHeader.get(group.header) ?? new Set<string>();
    group.bullets.forEach((b) => set.add(b));
    breakingByHeader.set(group.header, set);
  }

  const out: string[] = [];
  for (const group of parseGroups(changelog)) {
    const breakingHere = breakingByHeader.get(group.header);
    const kept = breakingHere ? group.bullets.filter((b) => !breakingHere.has(b)) : group.bullets;
    if (kept.length > 0) {
      out.push(group.header, ...kept, '');
    }
  }
  return out.join('\n').trim();
}

async function generateHighlights(changelog: string): Promise<string> {
  const apiKey = process.env.MISTRAL_API_KEY;
  if (!apiKey) {
    console.error('MISTRAL_API_KEY is not set; skipping highlights prose.');
    return '';
  }

  const client = new Mistral({ apiKey });
  const prompt = `You are a technical writer for a TypeScript SDK auto-generated from an OpenAPI spec.
Below is a deterministic changelog of API changes (produced by oasdiff).
Write a SHORT plain-language summary (1-3 sentences, no bullet list, no heading) that tells SDK consumers what changed and whether they need to take action. Be factual; do not invent changes that are not listed. Do not add any preamble like "Here is the summary".

Changelog:
${changelog}`;

  const transient = new Set([408, 409, 429, 500, 502, 503, 504]);
  const maxAttempts = 3;
  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    try {
      const response = await client.chat.complete({
        model: MISTRAL_MODEL,
        messages: [{ role: 'user', content: prompt }],
        temperature: 0.1,
      });
      const content = response.choices?.[0]?.message?.content;
      return typeof content === 'string' ? content.trim() : '';
    } catch (error) {
      const status = (error as { statusCode?: number }).statusCode;
      const retryable = status == null || transient.has(status);
      if (attempt < maxAttempts && retryable) {
        const backoff = 1000 * 2 ** (attempt - 1);
        console.error(
          `Mistral call failed (attempt ${attempt}/${maxAttempts}), retrying in ${backoff}ms:`,
          error,
        );
        await sleep(backoff);
        continue;
      }
      console.error('Mistral call failed; shipping notes without highlights:', error);
      return '';
    }
  }
  return '';
}

async function main(): Promise<void> {
  const { specGitPath, specFilePath, repoUrl } = parseArgs();

  const baseSpec = readBaseSpec(specGitPath);
  if (baseSpec == null) {
    console.log('Initial release.');
    return;
  }

  ensureOasdiff();

  const tmp = mkdtempSync(join(tmpdir(), 'oasdiff-'));
  const basePath = join(tmp, 'base' + (specGitPath.endsWith('.json') ? '.json' : '.yaml'));
  writeFileSync(basePath, baseSpec, 'utf-8');

  const changelog = cleanOasdiff(
    run('oasdiff', ['changelog', basePath, specFilePath, '--format', 'markdown']),
  );
  const breaking = cleanOasdiff(
    run('oasdiff', ['breaking', basePath, specFilePath, '--format', 'markdown'], true),
  );

  if (isEmptyReport(changelog)) {
    console.log('Minor spec update with no functional API changes.');
    return;
  }

  const highlights = await generateHighlights(changelog);

  const sections: string[] = [];
  if (highlights) sections.push(highlights);

  if (isEmptyReport(breaking)) {
    sections.push('## ⚠️ Breaking changes\n\n_None._');
    sections.push(`## Changes\n\n${changelog}`);
  } else {
    sections.push(`## ⚠️ Breaking changes\n\n${breaking}`);
    const other = nonBreakingChanges(changelog, breaking);
    if (other) sections.push(`## Other changes\n\n${other}`);
  }

  const prevVersion = process.env.PREV_VERSION?.trim();
  const newVersion = process.env.NEW_VERSION?.trim();
  if (prevVersion && newVersion) {
    sections.push(`**Full Changelog**: ${repoUrl}/compare/v${prevVersion}...v${newVersion}`);
  } else if (newVersion) {
    sections.push(`**Release**: ${repoUrl}/releases/tag/v${newVersion}`);
  }

  console.log(sections.join('\n\n'));
}

main().catch((error: unknown) => {
  console.error('Unhandled error:', error);
  process.exit(1);
});
