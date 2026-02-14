import { AppStorageService, StoredApp } from './AppStorageService';
import { ClaudeApiService } from './ClaudeApiService';
import { SecureStorageService } from './SecureStorageService';
import { createLogger } from '../utils/Logger';
import {
  PROJECT_TOPICS,
  ProjectTopic,
  TopicClassificationMetadata,
} from '../types/ProjectTopics';

const log = createLogger('TopicClassifier');

const CLASSIFICATION_VERSION = 1;
const DEFAULT_DEBOUNCE_MS = 900;

type ClassificationPayload = {
  title: string;
  description: string;
  prompt: string;
  category: string;
  style: string;
  htmlSnippet: string;
};

type ClassificationResult = {
  topics: ProjectTopic[];
  primaryTopic: ProjectTopic;
  confidence: number;
  source: TopicClassificationMetadata['source'];
  summary: string;
  model?: string;
};

type ClassifyOptions = {
  force?: boolean;
  reason?: string;
};

export class TopicClassificationService {
  private static timers = new Map<string, ReturnType<typeof setTimeout>>();
  private static inFlight = new Map<string, Promise<ClassificationResult | null>>();

  private static readonly KEYWORD_TOPIC_RULES: Array<{ topic: ProjectTopic; terms: string[] }> = [
    { topic: 'productivity', terms: ['todo', 'tasks', 'productivity', 'checklist', 'notes', 'calendar'] },
    { topic: 'education', terms: ['learn', 'quiz', 'study', 'flashcard', 'school', 'education'] },
    { topic: 'finance', terms: ['budget', 'expense', 'finance', 'money', 'invoice', 'accounting'] },
    { topic: 'health', terms: ['health', 'fitness', 'workout', 'habit', 'sleep', 'meditation'] },
    { topic: 'lifestyle', terms: ['routine', 'lifestyle', 'journal', 'wellness', 'home'] },
    { topic: 'social', terms: ['social', 'chat', 'community', 'friends', 'messaging'] },
    { topic: 'entertainment', terms: ['music', 'movie', 'stream', 'podcast', 'entertainment'] },
    { topic: 'gaming', terms: ['game', 'chess', 'arcade', 'puzzle', 'score', 'player'] },
    { topic: 'travel', terms: ['travel', 'trip', 'itinerary', 'flight', 'hotel', 'vacation'] },
    { topic: 'shopping', terms: ['shop', 'shopping', 'cart', 'wishlist', 'checkout'] },
    { topic: 'business', terms: ['business', 'crm', 'pipeline', 'sales', 'project', 'management'] },
    { topic: 'utilities', terms: ['calculator', 'timer', 'converter', 'utility', 'tool'] },
    { topic: 'creative', terms: ['design', 'draw', 'music', 'creative', 'art', 'generator'] },
    { topic: 'developer-tools', terms: ['developer', 'code', 'debug', 'api', 'json', 'terminal'] },
  ];

  private static readonly CATEGORY_TO_TOPIC: Record<string, ProjectTopic> = {
    productivity: 'productivity',
    education: 'education',
    finance: 'finance',
    health: 'health',
    social: 'social',
    entertainment: 'entertainment',
    games: 'gaming',
    travel: 'travel',
    shopping: 'shopping',
    business: 'business',
    utility: 'utilities',
    tools: 'utilities',
    lifestyle: 'lifestyle',
    creative: 'creative',
    fun: 'entertainment',
    other: 'other',
  };

  static scheduleForApp(
    appId: string,
    options: ClassifyOptions & { delayMs?: number } = {}
  ): void {
    const delayMs = Math.max(0, options.delayMs ?? DEFAULT_DEBOUNCE_MS);
    const existingTimer = this.timers.get(appId);
    if (existingTimer) {
      clearTimeout(existingTimer);
    }

    const timer = setTimeout(() => {
      this.timers.delete(appId);
      void this.classifyForApp(appId, options);
    }, delayMs);

    this.timers.set(appId, timer);
  }

  static async classifyAllApps(
    options: ClassifyOptions = {}
  ): Promise<{ processed: number; updated: number; skipped: number }> {
    const apps = await AppStorageService.getAllApps();
    let updated = 0;
    let skipped = 0;

    for (const app of apps) {
      const result = await this.classifyForApp(app.id, options);
      if (result) {
        updated += 1;
      } else {
        skipped += 1;
      }
    }

    return {
      processed: apps.length,
      updated,
      skipped,
    };
  }

  static async classifyForApp(appId: string, options: ClassifyOptions = {}): Promise<ClassificationResult | null> {
    const inFlightJob = this.inFlight.get(appId);
    if (inFlightJob) {
      return inFlightJob;
    }

    const classificationJob = this.classifyForAppInternal(appId, options)
      .catch((error: unknown) => {
        log.warn('Topic classification failed:', { appId, error });
        return null;
      })
      .finally(() => {
        this.inFlight.delete(appId);
      });

    this.inFlight.set(appId, classificationJob);
    return classificationJob;
  }

  private static async classifyForAppInternal(
    appId: string,
    options: ClassifyOptions
  ): Promise<ClassificationResult | null> {
    const app = await AppStorageService.getApp(appId);
    if (!app) {
      return null;
    }

    const payload = this.buildPayload(app);
    const signature = this.buildSignature(payload);
    const existingSignature = app.topicClassification?.signature;
    const hasExistingTopics = Array.isArray(app.topics) && app.topics.length > 0 && !!app.primaryTopic;

    if (!options.force && hasExistingTopics && existingSignature === signature) {
      return null;
    }

    const fallback = this.classifyHeuristically(payload);
    let resolved = fallback;

    const hasApiKey = await SecureStorageService.hasApiKey();
    if (hasApiKey) {
      try {
        const claudeService = ClaudeApiService.getInstance();
        const initialized = await claudeService.initialize();
        if (initialized) {
          const claudeResult = await claudeService.classifyProjectTopics({
            ...payload,
            taxonomy: [...PROJECT_TOPICS],
            appId: app.id,
          });
          resolved = this.mergeWithFallback(claudeResult, fallback);
        }
      } catch (error: unknown) {
        log.warn('Claude topic classification failed; using heuristic fallback', {
          appId: app.id,
          error,
        });
      }
    }

    const metadata: TopicClassificationMetadata = {
      source: resolved.source,
      confidence: resolved.confidence,
      classifiedAt: Date.now(),
      model: resolved.model,
      summary: resolved.summary,
      version: CLASSIFICATION_VERSION,
      signature,
      reason: options.reason,
    };

    await AppStorageService.updateApp(
      app.id,
      {
        primaryTopic: resolved.primaryTopic,
        topics: resolved.topics,
        topicClassification: metadata,
      },
      { skipTopicClassification: true }
    );

    return resolved;
  }

  private static buildPayload(app: StoredApp): ClassificationPayload {
    const htmlSnippet = (app.html || '')
      .replace(/\s+/g, ' ')
      .slice(0, 800)
      .trim();

    return {
      title: (app.title || '').trim(),
      description: (app.description || '').trim(),
      prompt: (app.prompt || '').trim(),
      category: (app.category || 'other').trim().toLowerCase(),
      style: (app.style || '').trim().toLowerCase(),
      htmlSnippet,
    };
  }

  private static buildSignature(payload: ClassificationPayload): string {
    const source = [
      payload.title,
      payload.description,
      payload.prompt,
      payload.category,
      payload.style,
      payload.htmlSnippet,
    ].join('|');
    return this.hashString(source);
  }

  private static classifyHeuristically(payload: ClassificationPayload): ClassificationResult {
    const combinedText = [
      payload.title,
      payload.description,
      payload.prompt,
      payload.category,
      payload.style,
      payload.htmlSnippet,
    ]
      .join(' ')
      .toLowerCase();

    const topicScores = new Map<ProjectTopic, number>();
    for (const topic of PROJECT_TOPICS) {
      topicScores.set(topic, 0);
    }

    for (const { topic, terms } of this.KEYWORD_TOPIC_RULES) {
      let score = 0;
      for (const term of terms) {
        if (combinedText.includes(term)) {
          score += 1;
        }
      }
      if (score > 0) {
        topicScores.set(topic, (topicScores.get(topic) || 0) + score);
      }
    }

    const mappedCategory = this.CATEGORY_TO_TOPIC[payload.category];
    if (mappedCategory) {
      topicScores.set(mappedCategory, (topicScores.get(mappedCategory) || 0) + 2);
    }

    const sortedTopics = [...topicScores.entries()]
      .sort((a, b) => b[1] - a[1])
      .map(([topic]) => topic)
      .filter((topic, index, arr) => index === 0 || topicScores.get(topic)! > 0 || index < 2);

    const primaryTopic = sortedTopics[0] || mappedCategory || 'other';
    const topics = this.uniqueTopics([
      primaryTopic,
      ...sortedTopics.slice(1, 3),
      mappedCategory || 'other',
    ]);
    const topScore = topicScores.get(primaryTopic) || 1;
    const confidence = Math.min(0.88, 0.45 + topScore * 0.08);

    return {
      topics,
      primaryTopic,
      confidence,
      source: 'heuristic',
      summary: 'Assigned with local keyword fallback.',
    };
  }

  private static mergeWithFallback(
    claudeResult: {
      topics: string[];
      primaryTopic: string;
      confidence: number;
      summary?: string;
      model?: string;
    },
    fallback: ClassificationResult
  ): ClassificationResult {
    const claudePrimary = this.normalizeTopic(claudeResult.primaryTopic);
    const claudeTopics = this.uniqueTopics([
      claudePrimary || fallback.primaryTopic,
      ...claudeResult.topics.map((topic) => this.normalizeTopic(topic)),
    ]);

    if (claudeTopics.length === 0) {
      return fallback;
    }

    return {
      topics: claudeTopics,
      primaryTopic: claudePrimary || claudeTopics[0] || fallback.primaryTopic,
      confidence: this.normalizeConfidence(claudeResult.confidence, fallback.confidence),
      source: 'claude',
      summary: (claudeResult.summary || 'Assigned via Claude topic classifier.').trim(),
      model: claudeResult.model,
    };
  }

  private static normalizeTopic(topic: string | null | undefined): ProjectTopic {
    if (!topic) return 'other';
    const normalized = topic.toLowerCase().trim().replace(/\s+/g, '-');
    if ((PROJECT_TOPICS as readonly string[]).includes(normalized)) {
      return normalized as ProjectTopic;
    }
    return 'other';
  }

  private static uniqueTopics(topics: Array<ProjectTopic | null | undefined>): ProjectTopic[] {
    const seen = new Set<ProjectTopic>();
    for (const topic of topics) {
      if (!topic) continue;
      if (!seen.has(topic)) {
        seen.add(topic);
      }
    }
    if (seen.size === 0) {
      seen.add('other');
    }
    return [...seen].slice(0, 4);
  }

  private static normalizeConfidence(value: number, fallback: number): number {
    if (!Number.isFinite(value)) return fallback;
    return Math.max(0, Math.min(1, Number(value)));
  }

  private static hashString(input: string): string {
    let hash = 0;
    for (let i = 0; i < input.length; i += 1) {
      hash = (hash << 5) - hash + input.charCodeAt(i);
      hash |= 0;
    }
    return Math.abs(hash).toString(16);
  }
}

