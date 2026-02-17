#!/usr/bin/env node

import fs from 'node:fs';
import path from 'node:path';

const projectRoot = process.cwd();
const samplesRoot = path.join(projectRoot, 'assets', 'sample-apps');
const outputFile = path.join(projectRoot, 'src', 'constants', 'SampleAppCatalog.generated.ts');

const VALID_STYLES = new Set(['minimalist', 'creative', 'corporate', 'playful', 'elegant', 'modern']);

function titleFromSlug(slug) {
  return slug
    .split(/[-_\s]+/g)
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(' ')
    .trim();
}

function guessCategory(slug) {
  const value = slug.toLowerCase();
  if (value.includes('chess') || value.includes('game')) return 'games';
  if (value.includes('todo') || value.includes('note') || value.includes('task')) return 'productivity';
  if (value.includes('weather') || value.includes('calc') || value.includes('timer')) return 'utility';
  if (value.includes('palette') || value.includes('design') || value.includes('art')) return 'creative';
  return 'utility';
}

function guessStyle(slug) {
  const value = slug.toLowerCase();
  if (value.includes('palette') || value.includes('art')) return 'creative';
  if (value.includes('todo') || value.includes('note')) return 'minimalist';
  return 'modern';
}

function normalizeStyle(value, fallback) {
  const lowered = typeof value === 'string' ? value.trim().toLowerCase() : '';
  return VALID_STYLES.has(lowered) ? lowered : fallback;
}

function readJsonSafe(filePath) {
  try {
    const raw = fs.readFileSync(filePath, 'utf8');
    const parsed = JSON.parse(raw);
    return parsed && typeof parsed === 'object' ? parsed : null;
  } catch {
    return null;
  }
}

function toPosixPath(relativePath) {
  return relativePath.split(path.sep).join('/');
}

function collectEntries() {
  if (!fs.existsSync(samplesRoot)) {
    return [];
  }

  const dirEntries = fs.readdirSync(samplesRoot, { withFileTypes: true });
  const entriesBySlug = new Map();

  const directories = dirEntries
    .filter((entry) => !entry.name.startsWith('.') && entry.isDirectory())
    .sort((a, b) => a.name.localeCompare(b.name));

  for (const entry of directories) {
    const slug = entry.name;
    const appHtmlPath = path.join(samplesRoot, slug, 'app.html');
    if (!fs.existsSync(appHtmlPath)) continue;

    const metaPath = path.join(samplesRoot, slug, 'meta.json');
    const hasMeta = fs.existsSync(metaPath);
    const meta = hasMeta ? readJsonSafe(metaPath) : null;

    const fallbackTitle = titleFromSlug(slug);
    const fallbackCategory = guessCategory(slug);
    const fallbackStyle = guessStyle(slug);

    const title =
      typeof meta?.title === 'string' && meta.title.trim()
        ? meta.title.trim()
        : fallbackTitle;
    const description =
      typeof meta?.description === 'string' && meta.description.trim()
        ? meta.description.trim()
        : typeof meta?.prompt === 'string' && meta.prompt.trim()
          ? meta.prompt.trim()
          : `Sample ${fallbackTitle} app`;
    const category =
      typeof meta?.category === 'string' && meta.category.trim()
        ? meta.category.trim().toLowerCase()
        : fallbackCategory;
    const style = normalizeStyle(meta?.style, fallbackStyle);

    entriesBySlug.set(slug, {
      slug,
      htmlRequirePath: `../../assets/sample-apps/${slug}/app.html`,
      metaRequirePath: hasMeta ? `../../assets/sample-apps/${slug}/meta.json` : null,
      fallback: {
        title,
        description,
        category,
        style,
      },
    });
  }

  const htmlFiles = dirEntries
    .filter((entry) => !entry.name.startsWith('.') && entry.isFile() && entry.name.toLowerCase().endsWith('.html'))
    .sort((a, b) => a.name.localeCompare(b.name));

  for (const entry of htmlFiles) {
    const slug = entry.name.replace(/\.html$/i, '');
    if (entriesBySlug.has(slug)) {
      continue;
    }

    const fallbackTitle = titleFromSlug(slug);
    entriesBySlug.set(slug, {
      slug,
      htmlRequirePath: `../../assets/sample-apps/${entry.name}`,
      metaRequirePath: null,
      fallback: {
        title: fallbackTitle,
        description: `Sample ${fallbackTitle} app`,
        category: guessCategory(slug),
        style: guessStyle(slug),
      },
    });
  }

  return Array.from(entriesBySlug.values()).sort((a, b) => a.slug.localeCompare(b.slug));
}

function generateTs(entries) {
  const header = `/* eslint-disable */\n` +
    `// AUTO-GENERATED FILE.\n` +
    `// Source: scripts/generate-sample-catalog.mjs\n` +
    `// Do not edit manually. Run: yarn samples:refresh\n\n` +
    `export type SampleStyle = 'minimalist' | 'creative' | 'corporate' | 'playful' | 'elegant' | 'modern';\n\n` +
    `export interface BundledSampleAppAsset {\n` +
    `  slug: string;\n` +
    `  htmlAsset: number;\n` +
    `  metaAsset?: number | Record<string, unknown>;\n` +
    `  fallback: {\n` +
    `    title: string;\n` +
    `    description: string;\n` +
    `    category: string;\n` +
    `    style: SampleStyle;\n` +
    `  };\n` +
    `}\n\n` +
    `export const BUNDLED_SAMPLE_APPS: BundledSampleAppAsset[] = [\n`;

  const body = entries
    .map((entry) => {
      const metaLine = entry.metaRequirePath
        ? `\n    metaAsset: require('${toPosixPath(entry.metaRequirePath)}'),`
        : '';

      return (
        `  {\n` +
        `    slug: '${entry.slug}',\n` +
        `    htmlAsset: require('${toPosixPath(entry.htmlRequirePath)}'),` +
        `${metaLine}\n` +
        `    fallback: {\n` +
        `      title: ${JSON.stringify(entry.fallback.title)},\n` +
        `      description: ${JSON.stringify(entry.fallback.description)},\n` +
        `      category: ${JSON.stringify(entry.fallback.category)},\n` +
        `      style: ${JSON.stringify(entry.fallback.style)} as SampleStyle,\n` +
        `    },\n` +
        `  }`
      );
    })
    .join(',\n');

  const footer = `\n];\n`;
  return header + body + footer;
}

function main() {
  const entries = collectEntries();

  const output = generateTs(entries);
  fs.writeFileSync(outputFile, output, 'utf8');

  console.log(`Generated ${path.relative(projectRoot, outputFile)} with ${entries.length} sample app entries.`);
}

main();
