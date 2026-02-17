import AsyncStorage from '@react-native-async-storage/async-storage';
import type { AppGenerationRequest } from './PromptGenerator';
import { createLogger } from '../utils/Logger';

const log = createLogger('PromptHistory');

const STORAGE_KEY = 'prompt_history_v1';
const MAX_ENTRIES = 200;

export type PromptHistoryEntry = {
  id: string;
  createdAt: number;
  request: AppGenerationRequest;
};

function createEntryId(): string {
  return `prompt_${Date.now()}_${Math.random().toString(36).slice(2, 10)}`;
}

function normalizeDescription(description: string): string {
  return description.trim().replace(/\s+/g, ' ');
}

async function readEntries(): Promise<PromptHistoryEntry[]> {
  try {
    const raw = await AsyncStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed as PromptHistoryEntry[];
  } catch (error) {
    log.warn('Failed to read prompt history:', error);
    return [];
  }
}

async function writeEntries(entries: PromptHistoryEntry[]): Promise<void> {
  await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(entries));
}

export class PromptHistoryService {
  static async list(limit: number = 60): Promise<PromptHistoryEntry[]> {
    const entries = await readEntries();
    return entries
      .slice()
      .sort((a, b) => b.createdAt - a.createdAt)
      .slice(0, Math.max(0, Math.floor(limit)));
  }

  static async add(request: AppGenerationRequest): Promise<void> {
    const normalizedDescription = normalizeDescription(request.description || '');
    if (!normalizedDescription) return;

    const entry: PromptHistoryEntry = {
      id: createEntryId(),
      createdAt: Date.now(),
      request: {
        ...request,
        description: normalizedDescription,
      },
    };

    const entries = await readEntries();

    const deduped = entries.filter((existing) => {
      const existingDesc = normalizeDescription(existing.request?.description || '');
      return !(
        existingDesc === entry.request.description &&
        existing.request?.style === entry.request.style &&
        existing.request?.platform === entry.request.platform
      );
    });

    const next = [entry, ...deduped].slice(0, MAX_ENTRIES);
    await writeEntries(next);
  }

  static async clear(): Promise<void> {
    await AsyncStorage.removeItem(STORAGE_KEY);
  }

  static async getStats(): Promise<{ total: number; estimatedSizeKB: number }> {
    try {
      const raw = await AsyncStorage.getItem(STORAGE_KEY);
      const entries = raw ? (JSON.parse(raw) as unknown[]) : [];
      const total = Array.isArray(entries) ? entries.length : 0;
      const estimatedSizeKB = raw ? Math.round(raw.length / 1024) : 0;
      return { total, estimatedSizeKB };
    } catch (error) {
      log.warn('Failed to read prompt history stats:', error);
      return { total: 0, estimatedSizeKB: 0 };
    }
  }
}

