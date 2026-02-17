import { estimateCost } from '../types/ClaudeApi';
import { AppStorageService, StoredApp } from './AppStorageService';
import { AppStyle } from './PromptGenerator';
import { PromptHistoryService } from './PromptHistoryService';
import { ScreenshotService } from './ScreenshotService';
import { TokenTrackingService } from './TokenTrackingService';
import { WebViewScreenshotService } from './WebViewScreenshotService';

const VALID_APP_STYLES: AppStyle[] = ['minimalist', 'creative', 'corporate', 'playful', 'elegant', 'modern'];

export type ScanSortBy = 'recent' | 'most_used' | 'favorites';

export interface AssistantAppSummary {
  id: string;
  title: string;
  status: StoredApp['status'];
  category: string;
  favorite: boolean;
  accessCount: number;
  createdAt: number;
  model?: string;
  primaryTopic?: string;
  topics?: string[];
}

export interface AssistantUsageByAppRow {
  appId: string;
  title: string;
  requests: number;
  inputTokens: number;
  outputTokens: number;
  totalTokens: number;
  estimatedCostUsd: number;
  lastUsedAt: number;
}

export interface AssistantUsageSummary {
  totals: {
    requests: number;
    inputTokens: number;
    outputTokens: number;
    totalTokens: number;
    estimatedCostUsd: number;
  };
  apps: AssistantUsageByAppRow[];
}

function toUnixMs(value: unknown): number {
  if (value instanceof Date) return value.getTime();
  const date = new Date(value as any);
  return Number.isFinite(date.getTime()) ? date.getTime() : 0;
}

function normalizeStyle(raw: unknown): AppStyle {
  const value = String(raw || '').trim().toLowerCase() as AppStyle;
  return VALID_APP_STYLES.includes(value) ? value : 'modern';
}

function normalizeStyleTags(input: unknown): string[] {
  if (!Array.isArray(input)) return [];
  return input
    .map((tag) => (typeof tag === 'string' ? tag.trim().toLowerCase().replace(/\s+/g, '-') : ''))
    .filter(Boolean)
    .slice(0, 20);
}

export class AssistantToolsService {
  static normalizeCreateArgs(rawArgs: unknown): {
    description: string;
    style: AppStyle;
    styleTags: string[];
  } {
    const args = rawArgs && typeof rawArgs === 'object' ? (rawArgs as Record<string, unknown>) : {};
    const description = String(args.description || '').trim();
    return {
      description,
      style: normalizeStyle(args.style),
      styleTags: normalizeStyleTags(args.styleTags),
    };
  }

  static async scanApps(args?: { limit?: number; sortBy?: ScanSortBy }): Promise<AssistantAppSummary[]> {
    const limit = Math.max(1, Math.min(100, Math.round(Number(args?.limit || 20))));
    const sortBy = args?.sortBy || 'recent';

    const apps = await AppStorageService.getAllApps();
    const list = [...apps];

    if (sortBy === 'most_used') {
      list.sort((a, b) => b.accessCount - a.accessCount || toUnixMs(b.timestamp) - toUnixMs(a.timestamp));
    } else if (sortBy === 'favorites') {
      list.sort((a, b) => Number(b.favorite) - Number(a.favorite) || toUnixMs(b.timestamp) - toUnixMs(a.timestamp));
    } else {
      list.sort((a, b) => toUnixMs(b.timestamp) - toUnixMs(a.timestamp));
    }

    return list.slice(0, limit).map((app) => ({
      id: app.id,
      title: app.title,
      status: app.status,
      category: app.category || 'other',
      favorite: app.favorite,
      accessCount: app.accessCount || 0,
      createdAt: toUnixMs(app.timestamp),
      model: app.model,
      primaryTopic: app.primaryTopic,
      topics: app.topics || [],
    }));
  }

  static async getUsageSummaryByApp(args?: { limit?: number }): Promise<AssistantUsageSummary> {
    const limit = Math.max(1, Math.min(100, Math.round(Number(args?.limit || 20))));
    const [apps, usageHistory] = await Promise.all([
      AppStorageService.getAllApps(),
      TokenTrackingService.getTokenHistory(),
    ]);

    const appById = new Map(apps.map((app) => [app.id, app]));
    const buckets = new Map<string, AssistantUsageByAppRow>();

    for (const row of usageHistory) {
      const key = row.appId || 'unattributed';
      const existing = buckets.get(key);
      const app = row.appId ? appById.get(row.appId) : undefined;
      const title = app?.title || (row.appId ? `Unknown app (${row.appId})` : 'Unattributed');
      const cost = estimateCost(row.input_tokens, row.output_tokens, row.model);

      if (!existing) {
        buckets.set(key, {
          appId: key,
          title,
          requests: 1,
          inputTokens: row.input_tokens,
          outputTokens: row.output_tokens,
          totalTokens: row.input_tokens + row.output_tokens,
          estimatedCostUsd: cost,
          lastUsedAt: row.timestamp,
        });
        continue;
      }

      existing.requests += 1;
      existing.inputTokens += row.input_tokens;
      existing.outputTokens += row.output_tokens;
      existing.totalTokens += row.input_tokens + row.output_tokens;
      existing.estimatedCostUsd += cost;
      existing.lastUsedAt = Math.max(existing.lastUsedAt, row.timestamp);
    }

    const allRows = [...buckets.values()].sort((a, b) => b.totalTokens - a.totalTokens || b.lastUsedAt - a.lastUsedAt);
    const rows = allRows.slice(0, limit);

    const totals = allRows.reduce(
      (acc, row) => {
        acc.requests += row.requests;
        acc.inputTokens += row.inputTokens;
        acc.outputTokens += row.outputTokens;
        acc.totalTokens += row.totalTokens;
        acc.estimatedCostUsd += row.estimatedCostUsd;
        return acc;
      },
      {
        requests: 0,
        inputTokens: 0,
        outputTokens: 0,
        totalTokens: 0,
        estimatedCostUsd: 0,
      }
    );

    return { totals, apps: rows };
  }

  static async getAggregateStats(args?: { limit?: number }): Promise<{
    apps: {
      total: number;
      favorites: number;
      byStatus: Record<string, number>;
      topRecent: AssistantAppSummary[];
      mostUsed: AssistantAppSummary[];
    };
    storage: {
      appsKB: number;
      promptHistoryKB: number;
      screenshotsKB: number;
      totalKB: number;
    };
    tokens: {
      requests: number;
      totalTokens: number;
      inputTokens: number;
      outputTokens: number;
      estimatedCostUsd: number;
    };
    usageByApp: AssistantUsageSummary;
    topicCounts: Array<{ topic: string; count: number }>;
  }> {
    const limit = Math.max(1, Math.min(50, Math.round(Number(args?.limit || 10))));

    const [
      allApps,
      appsStorage,
      promptsStorage,
      screenshotStorage,
      webviewScreenshotStorage,
      tokenStats,
      estimatedCost,
      usageByApp,
    ] = await Promise.all([
      AppStorageService.getAllApps(),
      AppStorageService.getStorageStats(),
      PromptHistoryService.getStats(),
      ScreenshotService.getStorageStats(),
      WebViewScreenshotService.getStorageStats(),
      TokenTrackingService.getTokenStats(),
      TokenTrackingService.getTotalEstimatedCost(),
      this.getUsageSummaryByApp({ limit }),
    ]);

    const byStatus = allApps.reduce<Record<string, number>>((acc, app) => {
      const key = app.status || 'unknown';
      acc[key] = (acc[key] || 0) + 1;
      return acc;
    }, {});

    const topRecent = [...allApps]
      .sort((a, b) => toUnixMs(b.timestamp) - toUnixMs(a.timestamp))
      .slice(0, limit)
      .map((app) => ({
        id: app.id,
        title: app.title,
        status: app.status,
        category: app.category || 'other',
        favorite: app.favorite,
        accessCount: app.accessCount || 0,
        createdAt: toUnixMs(app.timestamp),
        model: app.model,
        primaryTopic: app.primaryTopic,
        topics: app.topics || [],
      }));

    const mostUsed = [...allApps]
      .sort((a, b) => b.accessCount - a.accessCount || toUnixMs(b.timestamp) - toUnixMs(a.timestamp))
      .slice(0, limit)
      .map((app) => ({
        id: app.id,
        title: app.title,
        status: app.status,
        category: app.category || 'other',
        favorite: app.favorite,
        accessCount: app.accessCount || 0,
        createdAt: toUnixMs(app.timestamp),
        model: app.model,
        primaryTopic: app.primaryTopic,
        topics: app.topics || [],
      }));

    const topicCountsMap = new Map<string, number>();
    for (const app of allApps) {
      const topics = app.topics?.length ? app.topics : [app.primaryTopic || app.category || 'other'];
      for (const topic of topics) {
        const normalized = String(topic || 'other').trim().toLowerCase();
        if (!normalized) continue;
        topicCountsMap.set(normalized, (topicCountsMap.get(normalized) || 0) + 1);
      }
    }
    const topicCounts = [...topicCountsMap.entries()]
      .map(([topic, count]) => ({ topic, count }))
      .sort((a, b) => b.count - a.count)
      .slice(0, limit);

    const screenshotsKB = (screenshotStorage.estimatedSizeKB || 0) + (webviewScreenshotStorage.estimatedSizeKB || 0);
    const appsKB = appsStorage.estimatedSizeKB || 0;
    const promptHistoryKB = promptsStorage.estimatedSizeKB || 0;

    return {
      apps: {
        total: allApps.length,
        favorites: allApps.filter((app) => app.favorite).length,
        byStatus,
        topRecent,
        mostUsed,
      },
      storage: {
        appsKB,
        promptHistoryKB,
        screenshotsKB,
        totalKB: appsKB + promptHistoryKB + screenshotsKB,
      },
      tokens: {
        requests: tokenStats.totalRequests,
        totalTokens: tokenStats.totalTokens,
        inputTokens: tokenStats.totalInputTokens,
        outputTokens: tokenStats.totalOutputTokens,
        estimatedCostUsd: estimatedCost,
      },
      usageByApp,
      topicCounts,
    };
  }
}
