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

export const DEFAULT_CONFIG: Omit<ClaudeApiConfig, 'apiKey'> = {
  model: CLAUDE_MODELS.HAIKU_3,
  maxTokens: 4000,
  temperature: 0.3
};