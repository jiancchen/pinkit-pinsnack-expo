const {
  CLAUDE_MODELS,
  DEFAULT_CONFIG,
  MODEL_INFO,
  clampMaxOutputTokens,
  clampTemperature,
  estimateCost,
  estimateTokensFromText,
  formatModelPricingFull,
  formatModelPricingShort,
  getModelMaxOutputTokens,
  resolveSupportedClaudeModel,
} = require('../../src/types/ClaudeApi');

describe('ClaudeApi unit helpers', () => {
  it('resolves unsupported model names to current families', () => {
    expect(resolveSupportedClaudeModel(undefined)).toBe(DEFAULT_CONFIG.model);
    expect(resolveSupportedClaudeModel('legacy-opus-model')).toBe(CLAUDE_MODELS.OPUS_4_5);
    expect(resolveSupportedClaudeModel('old-sonnet-v1')).toBe(CLAUDE_MODELS.SONNET_4_5);
    expect(resolveSupportedClaudeModel('haiku-beta')).toBe(CLAUDE_MODELS.HAIKU_4_5);
  });

  it('does not return retired models when resolving', () => {
    expect(resolveSupportedClaudeModel(CLAUDE_MODELS.OPUS_3)).toBe(CLAUDE_MODELS.OPUS_4_5);
  });

  it('clamps max output tokens to valid ranges', () => {
    expect(clampMaxOutputTokens(CLAUDE_MODELS.HAIKU_3, Number.NaN)).toBe(
      getModelMaxOutputTokens(CLAUDE_MODELS.HAIKU_3)
    );
    expect(clampMaxOutputTokens(CLAUDE_MODELS.HAIKU_3, -5)).toBe(256);
    expect(clampMaxOutputTokens(CLAUDE_MODELS.HAIKU_3, 999_999)).toBe(
      getModelMaxOutputTokens(CLAUDE_MODELS.HAIKU_3)
    );
  });

  it('clamps temperature to [0, 1] and defaults for invalid inputs', () => {
    expect(clampTemperature(Number.NaN)).toBe(DEFAULT_CONFIG.temperature);
    expect(clampTemperature(-0.1)).toBe(0);
    expect(clampTemperature(1.8)).toBe(1);
    expect(clampTemperature(0.55)).toBe(0.55);
  });

  it('estimates tokens from text length', () => {
    expect(estimateTokensFromText('')).toBe(0);
    expect(estimateTokensFromText('abcd')).toBe(1);
    expect(estimateTokensFromText('abcde')).toBe(2);
  });

  it('estimates cost based on model pricing and falls back on unknown model', () => {
    const model = CLAUDE_MODELS.HAIKU_4_5;
    const inputTokens = 12_000;
    const outputTokens = 8_000;
    const prices = MODEL_INFO[model].tokenPricesPerMTok;

    const expected =
      (inputTokens / 1_000_000) * prices.baseInput +
      (outputTokens / 1_000_000) * prices.output;

    expect(estimateCost(inputTokens, outputTokens, model)).toBeCloseTo(expected, 10);
    expect(estimateCost(inputTokens, outputTokens, 'unknown-model')).toBeCloseTo(
      estimateCost(inputTokens, outputTokens, DEFAULT_CONFIG.model),
      10
    );
  });

  it('formats pricing summaries for known models', () => {
    expect(formatModelPricingShort(CLAUDE_MODELS.SONNET_4_5)).toContain('Input');
    expect(formatModelPricingFull(CLAUDE_MODELS.SONNET_4_5)).toContain('Base input');
    expect(formatModelPricingShort('unknown-model')).toBeNull();
    expect(formatModelPricingFull('unknown-model')).toBeNull();
  });
});
