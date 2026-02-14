export const PROJECT_TOPICS = [
  'productivity',
  'education',
  'finance',
  'health',
  'lifestyle',
  'social',
  'entertainment',
  'gaming',
  'travel',
  'shopping',
  'business',
  'utilities',
  'creative',
  'developer-tools',
  'other',
] as const;

export type ProjectTopic = typeof PROJECT_TOPICS[number];

export interface TopicClassificationMetadata {
  source: 'claude' | 'heuristic';
  confidence: number;
  classifiedAt: number;
  model?: string;
  summary?: string;
  version: number;
  signature: string;
  reason?: string;
}

export interface TopicSortHistoryEntry {
  sortedAt: number;
  source: 'claude' | 'heuristic';
  confidence: number;
  primaryTopic: string;
  topics: string[];
  model?: string;
  summary?: string;
  reason?: string;
}
