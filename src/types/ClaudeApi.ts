export interface ClaudeMessage {
  role: 'user' | 'assistant';
  content: string;
}

export interface ClaudeRequest {
  model: string;
  max_tokens: number;
  temperature?: number;
  messages: ClaudeMessage[];
  stream?: boolean;
}

export interface ClaudeResponse {
  id: string;
  type: string;
  role: string;
  content: Array<{
    type: string;
    text: string;
  }>;
  model: string;
  stop_reason: string;
  stop_sequence: string | null;
  usage: {
    input_tokens: number;
    output_tokens: number;
  };
}

export interface ClaudeApiConfig {
  apiKey: string;
  model: string;
  maxTokens: number;
  temperature: number;
}

export interface ApiError {
  error: {
    type: string;
    message: string;
  };
}

export const CLAUDE_MODELS = {
  OPUS_4_5: 'claude-opus-4-5-20251101',
  OPUS_4_1: 'claude-opus-4-1-20250805',
  OPUS_4: 'claude-opus-4-20250514',
  SONNET_4_5: 'claude-sonnet-4-5-20250929',
  SONNET_4: 'claude-sonnet-4-20250514',
  SONNET_3_7: 'claude-3-7-sonnet-20250219',
  HAIKU_4_5: 'claude-haiku-4-5-20251001',
  HAIKU_3_5: 'claude-3-5-haiku-20241022',
  HAIKU_3: 'claude-3-haiku-20240307',
  OPUS_3: 'claude-3-opus-20240229'
} as const;

export const CLAUDE_MODEL_PICKER_OPTIONS = [
  CLAUDE_MODELS.OPUS_4_5,
  CLAUDE_MODELS.OPUS_4_1,
  CLAUDE_MODELS.OPUS_4,
  CLAUDE_MODELS.SONNET_4_5,
  CLAUDE_MODELS.SONNET_4,
  CLAUDE_MODELS.SONNET_3_7,
  CLAUDE_MODELS.HAIKU_4_5,
  CLAUDE_MODELS.HAIKU_3_5,
  CLAUDE_MODELS.OPUS_3,
  CLAUDE_MODELS.HAIKU_3
] as const;

export type ClaudeModel = typeof CLAUDE_MODEL_PICKER_OPTIONS[number];

export function isSupportedClaudeModel(model: string): model is ClaudeModel {
  return (CLAUDE_MODEL_PICKER_OPTIONS as readonly string[]).includes(model);
}

export function resolveSupportedClaudeModel(model: string | null | undefined): ClaudeModel {
  if (!model) return DEFAULT_CONFIG.model as ClaudeModel;

  if (isSupportedClaudeModel(model)) {
    const modelInfo = MODEL_INFO[model];
    if (modelInfo?.status !== 'retired') return model;
  }

  const normalized = model.toLowerCase();
  if (normalized.includes('opus')) return CLAUDE_MODELS.OPUS_4_5;
  if (normalized.includes('sonnet')) return CLAUDE_MODELS.SONNET_4_5;
  if (normalized.includes('haiku')) return CLAUDE_MODELS.HAIKU_4_5;

  return DEFAULT_CONFIG.model as ClaudeModel;
}

// Model information including display names and pricing
export const PRICING_AS_OF = '2026-02-05' as const;
export const PRICING_AS_OF_DISPLAY = 'Feb 5, 2026' as const;

export type ModelStatus = 'active' | 'deprecated' | 'retired';

export interface ModelTokenPricesPerMTok {
  baseInput: number;
  cacheWrite5m: number;
  cacheWrite1h: number;
  cacheHitRefresh: number;
  output: number;
}

export interface ModelInfo {
  id: string;
  name: string;
  status: ModelStatus;
  retiresOn?: string; // YYYY-MM-DD
  maxOutputTokens: number;
  tokenPricesPerMTok: ModelTokenPricesPerMTok;
}

function formatUsdPerMTok(value: number): string {
  const amount = value < 1 ? value.toFixed(2) : value.toString();
  return `$${amount} / MTok`;
}

export function formatModelPricingShort(model: string): string | null {
  const modelInfo = MODEL_INFO[model];
  if (!modelInfo) return null;

  return `Input ${formatUsdPerMTok(modelInfo.tokenPricesPerMTok.baseInput)} • Output ${formatUsdPerMTok(modelInfo.tokenPricesPerMTok.output)}`;
}

export function formatModelPricingFull(model: string): string | null {
  const modelInfo = MODEL_INFO[model];
  if (!modelInfo) return null;

  const prices = modelInfo.tokenPricesPerMTok;
  const base = `Base input ${formatUsdPerMTok(prices.baseInput)} • Output ${formatUsdPerMTok(prices.output)}`;
  const cache = `Cache: 5m write ${formatUsdPerMTok(prices.cacheWrite5m)} • 1h write ${formatUsdPerMTok(prices.cacheWrite1h)} • Hit/refresh ${formatUsdPerMTok(prices.cacheHitRefresh)}`;
  const status =
    modelInfo.status === 'active'
      ? null
      : modelInfo.status === 'deprecated'
        ? modelInfo.retiresOn
          ? `Deprecated (retires ${modelInfo.retiresOn})`
          : 'Deprecated'
        : modelInfo.retiresOn
          ? `Retired (${modelInfo.retiresOn})`
          : 'Retired';

  return [base, cache, status].filter(Boolean).join('\n');
}

export const MODEL_INFO: Record<string, ModelInfo> = {
  [CLAUDE_MODELS.OPUS_4_5]: {
    id: CLAUDE_MODELS.OPUS_4_5,
    name: 'Claude Opus 4.5',
    status: 'active',
    maxOutputTokens: 64_000,
    tokenPricesPerMTok: {
      baseInput: 5,
      cacheWrite5m: 6.25,
      cacheWrite1h: 10,
      cacheHitRefresh: 0.5,
      output: 25
    }
  },
  [CLAUDE_MODELS.OPUS_4_1]: {
    id: CLAUDE_MODELS.OPUS_4_1,
    name: 'Claude Opus 4.1',
    status: 'active',
    maxOutputTokens: 32_000,
    tokenPricesPerMTok: {
      baseInput: 15,
      cacheWrite5m: 18.75,
      cacheWrite1h: 30,
      cacheHitRefresh: 1.5,
      output: 75
    }
  },
  [CLAUDE_MODELS.OPUS_4]: {
    id: CLAUDE_MODELS.OPUS_4,
    name: 'Claude Opus 4',
    status: 'active',
    maxOutputTokens: 32_000,
    tokenPricesPerMTok: {
      baseInput: 15,
      cacheWrite5m: 18.75,
      cacheWrite1h: 30,
      cacheHitRefresh: 1.5,
      output: 75
    }
  },
  [CLAUDE_MODELS.SONNET_4_5]: {
    id: CLAUDE_MODELS.SONNET_4_5,
    name: 'Claude Sonnet 4.5',
    status: 'active',
    maxOutputTokens: 64_000,
    tokenPricesPerMTok: {
      baseInput: 3,
      cacheWrite5m: 3.75,
      cacheWrite1h: 6,
      cacheHitRefresh: 0.3,
      output: 15
    }
  },
  [CLAUDE_MODELS.SONNET_4]: {
    id: CLAUDE_MODELS.SONNET_4,
    name: 'Claude Sonnet 4',
    status: 'active',
    maxOutputTokens: 64_000,
    tokenPricesPerMTok: {
      baseInput: 3,
      cacheWrite5m: 3.75,
      cacheWrite1h: 6,
      cacheHitRefresh: 0.3,
      output: 15
    }
  },
  [CLAUDE_MODELS.SONNET_3_7]: {
    id: CLAUDE_MODELS.SONNET_3_7,
    name: 'Claude Sonnet 3.7',
    status: 'deprecated',
    retiresOn: '2026-02-19',
    maxOutputTokens: 64_000,
    tokenPricesPerMTok: {
      baseInput: 3,
      cacheWrite5m: 3.75,
      cacheWrite1h: 6,
      cacheHitRefresh: 0.3,
      output: 15
    }
  },
  [CLAUDE_MODELS.HAIKU_4_5]: {
    id: CLAUDE_MODELS.HAIKU_4_5,
    name: 'Claude Haiku 4.5',
    status: 'active',
    maxOutputTokens: 64_000,
    tokenPricesPerMTok: {
      baseInput: 1,
      cacheWrite5m: 1.25,
      cacheWrite1h: 2,
      cacheHitRefresh: 0.1,
      output: 5
    }
  },
  [CLAUDE_MODELS.HAIKU_3_5]: {
    id: CLAUDE_MODELS.HAIKU_3_5,
    name: 'Claude Haiku 3.5',
    status: 'deprecated',
    retiresOn: '2026-02-19',
    maxOutputTokens: 4_000,
    tokenPricesPerMTok: {
      baseInput: 0.8,
      cacheWrite5m: 1,
      cacheWrite1h: 1.6,
      cacheHitRefresh: 0.08,
      output: 4
    }
  },
  [CLAUDE_MODELS.OPUS_3]: {
    id: CLAUDE_MODELS.OPUS_3,
    name: 'Claude Opus 3',
    status: 'retired',
    retiresOn: '2026-01-05',
    maxOutputTokens: 4_000,
    tokenPricesPerMTok: {
      baseInput: 15,
      cacheWrite5m: 18.75,
      cacheWrite1h: 30,
      cacheHitRefresh: 1.5,
      output: 75
    }
  },
  [CLAUDE_MODELS.HAIKU_3]: {
    id: CLAUDE_MODELS.HAIKU_3,
    name: 'Claude Haiku 3',
    status: 'active',
    maxOutputTokens: 4_000,
    tokenPricesPerMTok: {
      baseInput: 0.25,
      cacheWrite5m: 0.3,
      cacheWrite1h: 0.5,
      cacheHitRefresh: 0.03,
      output: 1.25
    }
  }
};

const FALLBACK_MAX_OUTPUT_TOKENS = 4_000;
const MIN_OUTPUT_TOKENS = 256;

export function getModelMaxOutputTokens(model: string): number {
  return MODEL_INFO[model]?.maxOutputTokens ?? FALLBACK_MAX_OUTPUT_TOKENS;
}

export function clampMaxOutputTokens(model: string, requestedMaxTokens: number): number {
  const maxForModel = getModelMaxOutputTokens(model);
  if (!Number.isFinite(requestedMaxTokens)) return Math.min(DEFAULT_CONFIG.maxTokens, maxForModel);
  return Math.max(MIN_OUTPUT_TOKENS, Math.min(maxForModel, Math.round(requestedMaxTokens)));
}

export function clampTemperature(requestedTemperature: number): number {
  if (!Number.isFinite(requestedTemperature)) return DEFAULT_CONFIG.temperature;
  return Math.max(0, Math.min(1, requestedTemperature));
}

export function estimateTokensFromText(text: string): number {
  if (!text) return 0;
  return Math.ceil(text.length / 4);
}

/**
 * Estimate the cost of API usage based on token counts
 */
export function estimateCost(inputTokens: number, outputTokens: number, model: string): number {
  const modelInfo = MODEL_INFO[model];
  
  if (!modelInfo) {
    return estimateCost(inputTokens, outputTokens, DEFAULT_CONFIG.model);
  }
  
  const inputCost = (inputTokens / 1_000_000) * modelInfo.tokenPricesPerMTok.baseInput;
  const outputCost = (outputTokens / 1_000_000) * modelInfo.tokenPricesPerMTok.output;
  
  return inputCost + outputCost;
}

export const DEFAULT_CONFIG: Omit<ClaudeApiConfig, 'apiKey'> = {
  model: CLAUDE_MODELS.HAIKU_4_5,
  maxTokens: 16_000,
  temperature: 0.3
};
