import AsyncStorage from '@react-native-async-storage/async-storage';
import { PROJECT_TOPICS } from '../types/ProjectTopics';
import { createLogger } from '../utils/Logger';

const log = createLogger('TopicPrefs');

const TOPIC_PREFERENCES_STORAGE_KEY = 'topic_preferences_v1';

type TopicPreferenceState = {
  customTopics: string[];
  updatedAt: number;
};

const DEFAULT_STATE: TopicPreferenceState = {
  customTopics: [],
  updatedAt: 0,
};

function dedupe(items: string[]): string[] {
  return [...new Set(items)];
}

export class TopicPreferencesService {
  private static sanitizeTopic(raw: string): string | null {
    const normalized = raw
      .trim()
      .toLowerCase()
      .replace(/[^a-z0-9\s-]/g, '')
      .replace(/\s+/g, '-')
      .replace(/-+/g, '-')
      .replace(/^-|-$/g, '');

    if (normalized.length < 2 || normalized.length > 28) {
      return null;
    }

    if ((PROJECT_TOPICS as readonly string[]).includes(normalized)) {
      return null;
    }

    return normalized;
  }

  private static async readState(): Promise<TopicPreferenceState> {
    try {
      const raw = await AsyncStorage.getItem(TOPIC_PREFERENCES_STORAGE_KEY);
      if (!raw) return DEFAULT_STATE;
      const parsed = JSON.parse(raw) as Partial<TopicPreferenceState>;
      const customTopics = Array.isArray(parsed.customTopics)
        ? dedupe(
            parsed.customTopics
              .map((topic) => this.sanitizeTopic(String(topic)) || '')
              .filter(Boolean)
          )
        : [];
      return {
        customTopics,
        updatedAt: typeof parsed.updatedAt === 'number' ? parsed.updatedAt : 0,
      };
    } catch (error) {
      log.warn('Failed to read topic preferences:', error);
      return DEFAULT_STATE;
    }
  }

  private static async writeState(state: TopicPreferenceState): Promise<void> {
    await AsyncStorage.setItem(TOPIC_PREFERENCES_STORAGE_KEY, JSON.stringify(state));
  }

  static async getCustomTopics(): Promise<string[]> {
    const state = await this.readState();
    return state.customTopics;
  }

  static async getTaxonomy(): Promise<string[]> {
    const customTopics = await this.getCustomTopics();
    return dedupe([...PROJECT_TOPICS, ...customTopics]);
  }

  static async addCustomTopic(rawTopic: string): Promise<{ ok: boolean; topic?: string; reason?: string }> {
    const topic = this.sanitizeTopic(rawTopic);
    if (!topic) {
      return {
        ok: false,
        reason: 'Topic must be 2-28 characters and not duplicate a built-in topic.',
      };
    }

    const state = await this.readState();
    if (state.customTopics.includes(topic)) {
      return { ok: false, reason: 'Topic already exists.' };
    }

    const nextState: TopicPreferenceState = {
      customTopics: dedupe([...state.customTopics, topic]),
      updatedAt: Date.now(),
    };
    await this.writeState(nextState);

    return { ok: true, topic };
  }

  static async removeCustomTopic(topic: string): Promise<void> {
    const state = await this.readState();
    const nextState: TopicPreferenceState = {
      customTopics: state.customTopics.filter((item) => item !== topic),
      updatedAt: Date.now(),
    };
    await this.writeState(nextState);
  }
}

