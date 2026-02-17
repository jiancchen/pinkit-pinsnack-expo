import AsyncStorage from '@react-native-async-storage/async-storage';
import { Asset } from 'expo-asset';
import { BUNDLED_SAMPLE_APPS, SampleStyle } from '../constants/SampleAppCatalog.generated';
import { AppStorageService, StoredApp } from './AppStorageService';
import { SeedLogger as log } from '../utils/Logger';

const APPS_STORAGE_KEY = 'generated_apps';

const VALID_STYLES = new Set<SampleStyle>(['minimalist', 'creative', 'corporate', 'playful', 'elegant', 'modern']);

function buildSampleId(slug: string): string {
  return `sample_${slug}`;
}

function normalizeStyle(value: unknown, fallback: SampleStyle = 'modern'): SampleStyle {
  const lowered = typeof value === 'string' ? value.trim().toLowerCase() : '';
  return VALID_STYLES.has(lowered as SampleStyle) ? (lowered as SampleStyle) : fallback;
}

function normalizeCategory(value: unknown, fallback = 'utility'): string {
  const lowered = typeof value === 'string' ? value.trim().toLowerCase() : '';
  return lowered || fallback;
}

function parseTitleAndCategory(rawTitle: string, fallbackCategory: string): { title: string; category: string } {
  const titleValue = String(rawTitle || '').trim();
  if (!titleValue) return { title: 'Sample App', category: fallbackCategory };

  if (!titleValue.includes(' | ')) {
    return { title: titleValue, category: fallbackCategory };
  }

  const [titlePart, categoryPart] = titleValue.split(' | ');
  return {
    title: titlePart?.trim() || 'Sample App',
    category: normalizeCategory(categoryPart, fallbackCategory),
  };
}

async function loadAssetText(assetModule: number): Promise<string> {
  const asset = Asset.fromModule(assetModule);
  await asset.downloadAsync();
  const uri = asset.localUri || asset.uri;
  const response = await fetch(uri);
  return response.text();
}

interface SampleDefinition {
  slug: string;
  title: string;
  description: string;
  html: string;
  category: string;
  style: SampleStyle;
}

export class SeedService {
  private static readonly SEED_VERSION_KEY = 'seed_version';
  private static readonly SEED_SIGNATURE_KEY = 'seed_signature';
  private static readonly CURRENT_SEED_VERSION = 2;
  private static initializationPromise: Promise<void> | null = null;
  private static initialized = false;

  private static hashString(input: string): string {
    let hash = 2166136261;
    for (let index = 0; index < input.length; index += 1) {
      hash ^= input.charCodeAt(index);
      hash = (hash * 16777619) >>> 0;
    }
    return hash.toString(16).padStart(8, '0');
  }

  private static buildSeedSignature(definitions: SampleDefinition[]): string {
    const normalized = definitions
      .map((definition) => ({
        slug: definition.slug,
        title: definition.title,
        description: definition.description,
        category: definition.category,
        style: definition.style,
        htmlHash: this.hashString(definition.html),
      }))
      .sort((a, b) => a.slug.localeCompare(b.slug));

    return this.hashString(JSON.stringify(normalized));
  }

  private static async loadSampleDefinitions(): Promise<SampleDefinition[]> {
    const definitions: SampleDefinition[] = [];

    for (const entry of BUNDLED_SAMPLE_APPS) {
      try {
        const html = await loadAssetText(entry.htmlAsset);

        let meta: Record<string, unknown> = {};
        if (entry.metaAsset) {
          try {
            if (typeof entry.metaAsset === 'number') {
              const rawMeta = await loadAssetText(entry.metaAsset);
              const parsedMeta = JSON.parse(rawMeta);
              if (parsedMeta && typeof parsedMeta === 'object') {
                meta = parsedMeta as Record<string, unknown>;
              }
            } else if (typeof entry.metaAsset === 'object') {
              meta = entry.metaAsset as Record<string, unknown>;
            }
          } catch (error) {
            log.warn(`Failed to parse sample meta for ${entry.slug}:`, error);
          }
        }

        const fallbackCategory = normalizeCategory(entry.fallback.category, 'utility');
        const fallbackStyle = normalizeStyle(entry.fallback.style, 'modern');
        const titleSource =
          typeof meta.title === 'string' && meta.title.trim().length > 0
            ? meta.title
            : entry.fallback.title;

        const parsed = parseTitleAndCategory(titleSource, fallbackCategory);
        const description =
          typeof meta.description === 'string' && meta.description.trim().length > 0
            ? meta.description.trim()
            : typeof meta.prompt === 'string' && meta.prompt.trim().length > 0
              ? meta.prompt.trim()
              : entry.fallback.description;

        definitions.push({
          slug: entry.slug,
          title: parsed.title,
          description,
          html,
          category: normalizeCategory(meta.category, parsed.category),
          style: normalizeStyle(meta.style, fallbackStyle),
        });
      } catch (error) {
        log.error(`Failed to load sample app ${entry.slug}:`, error);
      }
    }

    return definitions;
  }

  static async shouldSeed(): Promise<boolean> {
    try {
      const storedVersion = await AsyncStorage.getItem(this.SEED_VERSION_KEY);
      const currentVersion = parseInt(storedVersion || '0', 10);
      if (currentVersion < this.CURRENT_SEED_VERSION) {
        log.info('Seeding needed - version update');
        return true;
      }

      const definitions = await this.loadSampleDefinitions();
      const currentSignature = this.buildSeedSignature(definitions);
      const storedSignature = await AsyncStorage.getItem(this.SEED_SIGNATURE_KEY);
      if (!storedSignature || storedSignature !== currentSignature) {
        log.info('Seeding needed - sample signature changed');
        return true;
      }

      const expectedSampleIds = new Set(definitions.map((definition) => buildSampleId(definition.slug)));

      const existingApps = await AppStorageService.getAllApps();
      const sampleApps = existingApps.filter((app) => this.isSampleApp(app));

      if (sampleApps.length !== expectedSampleIds.size) {
        log.info('Seeding needed - sample count mismatch');
        return true;
      }

      const existingSampleIds = new Set(sampleApps.map((app) => app.id));
      for (const expectedId of expectedSampleIds) {
        if (!existingSampleIds.has(expectedId)) {
          log.info('Seeding needed - missing sample app', expectedId);
          return true;
        }
      }

      return false;
    } catch (error) {
      log.error('Error checking seed status:', error);
      return true;
    }
  }

  static async seedSampleApps(): Promise<void> {
    log.info('Starting sample app seeding...');

    try {
      await this.removeSampleApps();

      const [definitions, existingApps] = await Promise.all([
        this.loadSampleDefinitions(),
        AppStorageService.getAllApps(),
      ]);

      const timestampBase = Date.now();
      const createdApps: StoredApp[] = definitions.map((definition, index) => {
        const id = buildSampleId(definition.slug);
        return {
          id,
          title: definition.title,
          description: definition.description,
          html: definition.html,
          prompt: definition.description,
          timestamp: new Date(timestampBase + index),
          style: definition.style,
          category: definition.category,
          status: 'completed',
          favorite: false,
          accessCount: 0,
          baseUrl: `https://sandbox/${id}/`,
          model: 'sample',
          isSample: true,
          sampleKey: definition.slug,
        };
      });

      const allApps = [...existingApps, ...createdApps];
      await AsyncStorage.setItem(APPS_STORAGE_KEY, JSON.stringify(allApps));
      await AsyncStorage.setItem(this.SEED_VERSION_KEY, this.CURRENT_SEED_VERSION.toString());
      await AsyncStorage.setItem(this.SEED_SIGNATURE_KEY, this.buildSeedSignature(definitions));

      log.info(`Successfully seeded ${createdApps.length} sample apps`);
    } catch (error) {
      log.error('Error seeding sample apps:', error);
      throw new Error('Failed to seed sample apps');
    }
  }

  static async removeSampleApps(): Promise<void> {
    try {
      const existingApps = await AppStorageService.getAllApps();
      const nonSampleApps = existingApps.filter((app) => !this.isSampleApp(app));
      await AsyncStorage.setItem(APPS_STORAGE_KEY, JSON.stringify(nonSampleApps));
      log.info(`Removed ${existingApps.length - nonSampleApps.length} sample apps`);
    } catch (error) {
      log.error('Error removing sample apps:', error);
    }
  }

  static async reseedSampleApps(): Promise<void> {
    log.info('Re-seeding sample apps...');
    await AsyncStorage.removeItem(this.SEED_VERSION_KEY);
    await AsyncStorage.removeItem(this.SEED_SIGNATURE_KEY);
    await this.seedSampleApps();
  }

  static getSampleAppsInfo(): { count: number; categories: string[] } {
    const categories = [...new Set(BUNDLED_SAMPLE_APPS.map((entry) => normalizeCategory(entry.fallback.category)))];
    return {
      count: BUNDLED_SAMPLE_APPS.length,
      categories,
    };
  }

  static isSampleApp(app: StoredApp): boolean {
    return app.isSample === true || typeof app.sampleKey === 'string' || app.id.startsWith('sample_');
  }

  static async initializeSeeding(): Promise<void> {
    if (this.initialized) {
      return;
    }

    if (this.initializationPromise) {
      await this.initializationPromise;
      return;
    }

    this.initializationPromise = (async () => {
      log.debug('Initializing seeding...');
      let didRunSuccessfully = false;

      try {
        const needsSeeding = await this.shouldSeed();
        if (needsSeeding) {
          await this.seedSampleApps();
          log.info('Seeding completed successfully');
        } else {
          log.debug('Seeding not needed');
        }
        didRunSuccessfully = true;
      } catch (error) {
        log.error('Failed to initialize seeding:', error);
      } finally {
        this.initialized = didRunSuccessfully;
        this.initializationPromise = null;
      }
    })();

    await this.initializationPromise;
  }
}

export default SeedService;
