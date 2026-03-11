jest.mock('../../src/utils/Logger', () => ({
  createLogger: () => ({
    error: jest.fn(),
    warn: jest.fn(),
    info: jest.fn(),
    debug: jest.fn(),
    verbose: jest.fn(),
  }),
}));

const { PromptGenerator } = require('../../src/services/PromptGenerator');

describe('PromptGenerator functional behavior', () => {
  it('builds a prompt with style, tags, features, and token budget', () => {
    const result = PromptGenerator.generatePrompt(
      {
        description: 'Build a workout tracker with streaks and reminders',
        style: 'modern',
        styleTags: ['glassmorphism', 'vibrant'],
        features: ['Daily check-in', 'Progress chart'],
        platform: 'mobile',
      },
      { maxOutputTokens: 4096 }
    );

    expect(result).toContain('<style_guidance>');
    expect(result).toContain('Design Style: modern');
    expect(result).toContain('<style_tags>');
    expect(result).toContain('- glassmorphism');
    expect(result).toContain('<required_features>');
    expect(result).toContain('- Daily check-in');
    expect(result).toContain('Max output tokens available: 4096');
    expect(result).toContain('</user_request>');
    expect(result.trim().endsWith('Generate the complete HTML application now:')).toBe(true);
  });

  it('omits style_tags and required_features sections when not provided', () => {
    const result = PromptGenerator.generatePrompt({
      description: 'Create a basic calculator for quick arithmetic',
      style: 'minimalist',
      styleTags: ['   ', ''],
      platform: 'mobile',
    });

    expect(result).not.toContain('<style_tags>');
    expect(result).not.toContain('<required_features>');
  });

  it('validates generation requests', () => {
    const valid = PromptGenerator.validateRequest({
      description: 'Create a personal expense tracker with weekly summaries',
      style: 'modern',
      features: ['Add expense'],
      styleTags: ['clean'],
    });
    expect(valid.isValid).toBe(true);
    expect(valid.errors).toHaveLength(0);

    const invalid = PromptGenerator.validateRequest({
      description: 'short',
      style: 'not-a-style',
      features: new Array(11).fill('feature'),
      styleTags: new Array(21).fill('tag'),
    });
    expect(invalid.isValid).toBe(false);
    expect(invalid.errors).toContain('Description must be at least 10 characters long');
    expect(invalid.errors).toContain('Invalid style selected');
    expect(invalid.errors).toContain('Maximum 10 features allowed');
    expect(invalid.errors).toContain('Maximum 20 style tags allowed');
  });

  it('flags unavailable native/network features and provides suggestions', () => {
    const blocked = PromptGenerator.checkForUnavailableFeatures('Build a camera app with live API fetch');
    expect(blocked.isValid).toBe(false);
    expect(blocked.reason).toBeDefined();
    expect(blocked.suggestion).toBeDefined();

    const allowed = PromptGenerator.checkForUnavailableFeatures(
      'Build an offline habit tracker that stores progress locally'
    );
    expect(allowed).toEqual({ isValid: true });
  });

  it('creates prompt history entries with generating/completed status', () => {
    const baseRequest = {
      description: 'Create a note app with tags and search',
      style: 'minimalist',
      platform: 'mobile',
    };

    const generatingEntry = PromptGenerator.createPromptHistoryEntry(baseRequest);
    expect(generatingEntry.status).toBe('generating');
    expect(generatingEntry.html).toBe('GENERATING...');

    const concept = {
      title: 'Tag Notes',
      description: 'Simple note app',
      features: ['Tag notes', 'Search notes'],
      userInterface: {
        screens: ['Home', 'Editor'],
        navigation: 'tab',
        colorScheme: 'light',
        typography: 'Inter',
      },
      technicalSpecs: {
        architecture: 'single-page',
        dataStorage: 'localStorage',
        integrations: [],
        platforms: ['mobile'],
      },
      marketingCopy: {
        tagline: 'Capture ideas quickly',
        elevator_pitch: 'Fast, focused notes',
        key_benefits: ['Offline first', 'Simple search'],
      },
    };
    const completedEntry = PromptGenerator.createPromptHistoryEntry(baseRequest, concept);
    expect(completedEntry.status).toBe('completed');
    expect(completedEntry.title).toBe('Tag Notes');
    expect(completedEntry.generatedConcept).toEqual(concept);
  });

  it('builds revision prompts with required sections and values', () => {
    const revisionPrompt = PromptGenerator.generateHtmlRevisionPrompt({
      originalPrompt: 'Create a timer app',
      updatedPrompt: 'Create a timer app with lap history',
      userNotes: 'Fix overflow on small screens',
      originalHtml: '<!DOCTYPE html><html data-app-title="Timer | Utility"></html>',
    });

    expect(revisionPrompt).toContain('<task>');
    expect(revisionPrompt).toContain('<debug>');
    expect(revisionPrompt).toContain('<original_prompt>');
    expect(revisionPrompt).toContain('Create a timer app with lap history');
    expect(revisionPrompt).toContain('Fix overflow on small screens');
    expect(revisionPrompt).toContain('<original_html>');
    expect(revisionPrompt).toContain('data-app-title="Timer | Utility"');
    expect(revisionPrompt).toContain('Respond with ONLY the complete HTML code');
  });
});
