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
  SONNET_3_5: 'claude-3-5-sonnet-20240620',
  HAIKU_3: 'claude-3-haiku-20240307',
  OPUS_3: 'claude-3-opus-20240229'
} as const;

export type ClaudeModel = typeof CLAUDE_MODELS[keyof typeof CLAUDE_MODELS];

// Model information including display names and pricing
export interface ModelInfo {
  id: string;
  name: string;
  inputPricePer1K: number;  // USD per 1K tokens
  outputPricePer1K: number; // USD per 1K tokens
  displayPricing: string;   // Formatted pricing string
}

export const MODEL_INFO: Record<string, ModelInfo> = {
  [CLAUDE_MODELS.HAIKU_3]: {
    id: CLAUDE_MODELS.HAIKU_3,
    name: 'Claude 3 Haiku',
    inputPricePer1K: 0.00025,
    outputPricePer1K: 0.00125,
    displayPricing: '$0.25/$1.25 per million tokens'
  },
  [CLAUDE_MODELS.SONNET_3_5]: {
    id: CLAUDE_MODELS.SONNET_3_5,
    name: 'Claude 3.5 Sonnet',
    inputPricePer1K: 0.003,
    outputPricePer1K: 0.015,
    displayPricing: '$3/$15 per million tokens'
  },
  [CLAUDE_MODELS.OPUS_3]: {
    id: CLAUDE_MODELS.OPUS_3,
    name: 'Claude 3 Opus',
    inputPricePer1K: 0.015,
    outputPricePer1K: 0.075,
    displayPricing: '$15/$75 per million tokens'
  }
};

/**
 * Estimate the cost of API usage based on token counts
 */
export function estimateCost(inputTokens: number, outputTokens: number, model: string): number {
  const modelInfo = MODEL_INFO[model];
  
  if (!modelInfo) {
    // Default to Haiku pricing if model not found
    const defaultInfo = MODEL_INFO[CLAUDE_MODELS.HAIKU_3];
    const inputCost = (inputTokens / 1000) * defaultInfo.inputPricePer1K;
    const outputCost = (outputTokens / 1000) * defaultInfo.outputPricePer1K;
    return inputCost + outputCost;
  }
  
  const inputCost = (inputTokens / 1000) * modelInfo.inputPricePer1K;
  const outputCost = (outputTokens / 1000) * modelInfo.outputPricePer1K;
  
  return inputCost + outputCost;
}

export const DEFAULT_CONFIG: Omit<ClaudeApiConfig, 'apiKey'> = {
  model: CLAUDE_MODELS.HAIKU_3,
  maxTokens: 4000,
  temperature: 0.3
};