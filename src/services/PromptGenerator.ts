import { PromptHistory, GeneratedAppConcept } from '../types/PromptHistory';
import { createLogger } from '../utils/Logger';

const log = createLogger('PromptGenerator');

export type AppStyle = 'minimalist' | 'creative' | 'corporate' | 'playful' | 'elegant' | 'modern';
export type AppCategory = 'productivity' | 'social' | 'utility' | 'entertainment' | 'education' | 'health' | 'finance' | 'travel' | 'shopping' | 'other';

export interface AppGenerationRequest {
  description: string;
  style: AppStyle;
  category?: AppCategory; // Optional - Claude will determine from description
  features?: string[];
  platform?: 'mobile' | 'web' | 'both';
}

export class PromptGenerator {
  
  // Optimized prompt template using Claude's best practices
  private static readonly CORE_PROMPT_TEMPLATE = `<role>
You are an expert HTML/CSS/JavaScript developer specializing in mobile web apps for WebView environments. You create polished, fully functional single-page applications that work flawlessly on mobile devices.
</role>

<task>
Generate a complete, working HTML application based on the user's requirements. The app must be production-ready with no placeholders or TODOs.
</task>

<output_format>
Respond with ONLY the complete HTML code. No explanations, markdown blocks, or commentary.
- Start with <!DOCTYPE html>
- End with </html>
- Include data-app-title attribute with format: <html data-app-title="App Name | Category">
- Category must be one of: utility, fun, productivity, entertainment, education, health, finance, social, travel, shopping, games, tools, lifestyle, business, creative, other
- Do NOT display the app name or category visibly in the HTML content
- Choose the most appropriate category based on the app's primary function
</output_format>

<examples>
<example>
User request: "Simple calculator"
Expected output starts with:
<!DOCTYPE html>
<html data-app-title="Calculator Pro | Utility">
<head>
  <meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no">
  <style>
    * { box-sizing: border-box; }
    body { font-family: 'Inter', sans-serif; background: transparent; margin: 0; display: flex; justify-content: center; align-items: center; min-height: 100vh; }
    .container { background: #1C1C1E; border-radius: 16px; padding: 20px; width: 100%; max-width: 380px; margin-top: 40px; }
    /* Complete styles... */
  </style>
</head>
<body>
  <div class="container">
    <!-- Complete calculator UI -->
  </div>
  <script>
    // Complete calculator logic
  </script>
</body>
</html>
</example>
</examples>

<technical_requirements>
<mobile_optimization>
- Viewport meta tag: <meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no">
- Body background: transparent
- Container positioning: margin-top: 40px for status bar clearance
- Font size ≥16px (prevents iOS zoom)
- Touch targets ≥44px
- Use box-sizing: border-box on all elements
- Responsive padding: 20px
- Container width: 100%, max-width for tablets
</mobile_optimization>

<layout_strategy>
Static apps (calculators, forms): Center vertically with auto height
Dynamic apps (todos, notes, trackers): Use min-height: calc(100vh - 80px) with overflow-y: auto

Key principle: Either full-height OR auto-height, never dynamic growing containers
</layout_strategy>

	<react_native_features>
	When running inside the Droplets app WebView (React Native), you can optionally call native features via:
	- window.ReactNativeWebView.postMessage(JSON.stringify({...}))
	Always guard with: if (window.ReactNativeWebView && window.ReactNativeWebView.postMessage)

	<native_live_activities>
	Live Activities / Dynamic Island (iOS only, requires a development build, iOS 16.2+):
	- Start a countdown timer Live Activity (counts DOWN):
	  window.ReactNativeWebView.postMessage(JSON.stringify({
	    type:'live_activity_start_timer',
	    activityKey:'main',
	    title:'Focus Timer',
	    subtitle:'Tap to open',
	    endAtMs: Date.now() + 25*60*1000,
	    direction:'down',
	    tintColor:'#7C3AED'
	  }))
	- Start a stopwatch / count-up Live Activity (counts UP):
	  window.ReactNativeWebView.postMessage(JSON.stringify({
	    type:'live_activity_start_timer',
	    activityKey:'stopwatch',
	    title:'Stopwatch',
	    subtitle:'Tap to open',
	    startAtMs: Date.now(),
	    durationMs: 24*60*60*1000,
	    direction:'up',
	    tintColor:'#2D5A7B'
	  }))
	- Start a counter Live Activity:
	  window.ReactNativeWebView.postMessage(JSON.stringify({
	    type:'live_activity_start_counter',
	    activityKey:'main',
	    title:'Counter',
	    subtitle:'Tap to open',
	    count: 0,
	    unit: 'items'
	  }))
	- Update a counter Live Activity (ONLY when value changes; do not spam updates):
	  window.ReactNativeWebView.postMessage(JSON.stringify({
	    type:'live_activity_update_counter',
	    activityKey:'main',
	    count: 123
	  }))
	- Stop:
	  window.ReactNativeWebView.postMessage(JSON.stringify({
	    type:'live_activity_stop',
	    activityKey:'main',
	    dismissalPolicy:'immediate'
	  }))

	Notes:
	- Do NOT send updates more often than once every ~5 seconds.
	- Prefer using the native-rendered timer Live Activity instead of updating every second.
	- The app MUST still work if Live Activities are unavailable or disabled by the user.
	- If the app is a timer/counter app, include an in-app toggle like "Show in notification" (default OFF) and wire it to these APIs.
	</native_live_activities>

	<local_storage>
	localStorage is AVAILABLE and RECOMMENDED for data persistence:
	- Use localStorage.setItem(key, JSON.stringify(data)) to save
- Use JSON.parse(localStorage.getItem(key) || '[]') to load
- Always provide fallback values for missing data
- Wrap JSON operations in try-catch for error handling
- NOTE: Each app automatically gets isolated storage - you can use keys like 'todos', 'settings', etc. directly

Example pattern:
function saveData(key, data) {
  try {
    localStorage.setItem(key, JSON.stringify(data));
  } catch(e) {
    console.warn('Storage failed:', e);
  }
}

function loadData(key, fallback = []) {
  try {
    return JSON.parse(localStorage.getItem(key) || JSON.stringify(fallback));
  } catch(e) {
    return fallback;
  }
}
</local_storage>
</react_native_features>

<allowed_libraries>
- Three.js: https://cdnjs.cloudflare.com/ajax/libs/three.js/r128/three.min.js
- Chart.js: https://cdnjs.cloudflare.com/ajax/libs/Chart.js/3.9.1/chart.min.js
- D3.js: https://cdnjs.cloudflare.com/ajax/libs/d3/7.8.5/d3.min.js
- Tone.js: https://cdnjs.cloudflare.com/ajax/libs/tone/14.8.49/Tone.js
- Math.js: https://cdnjs.cloudflare.com/ajax/libs/mathjs/11.11.0/math.min.js
- Bootstrap CSS: https://cdn.jsdelivr.net/npm/bootstrap@5.3.0/dist/css/bootstrap.min.css
- Google Fonts: https://fonts.googleapis.com
</allowed_libraries>

<forbidden_features>
NEVER use: fetch(), XMLHttpRequest, WebSocket, camera, microphone, geolocation, file system access

Note: localStorage is ALLOWED for data persistence within the app. Use it for saving user data like settings, lists, notes, etc.
</forbidden_features>
</technical_requirements>

<design_system>
<visual_style>
- 3D layered card design language
- Floating elements with soft shadows and rounded corners
- Bold typography: Inter, Poppins, or Manrope
- Vibrant flat backgrounds: yellow (#f7d441), teal, coral
- Foreground cards: black (#111) or white with subtle shadows
- Gradient accents: pink-orange, purple-blue
- Generous spacing, centered components
</visual_style>

<interactions>
- Transitions: 0.15-0.2s
- Hover: lift with transform
- Active: scale(0.96) with reduced shadow
- Use transform (NOT margin/position) for animations
- webkit-tap-highlight-color: transparent
</interactions>
</design_system>

<implementation_standards>
1. All CSS must be inline in <style> tag
2. All JavaScript must be inline in <script> tag
3. Use realistic demo data when needed
4. App must work immediately without setup
5. Include complete functionality - no placeholder buttons
6. For list apps: include add, edit, delete, and persistence
7. Ensure proper error handling and edge cases
</implementation_standards>

<user_request>
`;

  /**
   * Generate a comprehensive prompt for Claude API based on user requirements
   */
  static generatePrompt(
    request: AppGenerationRequest,
    options?: {
      maxOutputTokens?: number;
    }
  ): string {
    log.debug('Starting prompt generation for request:', request);
    
    const { description, style, features } = request;
    
    log.verbose('Building prompt with parameters:', {
      description: description.substring(0, 50) + '...',
      style,
      featuresCount: features?.length || 0,
      platform: request.platform
    });

    // Build style-specific guidance
    let styleGuidance = '';
    if (style) {
      const styleMap = {
        'modern': 'Dark themes, sleek gradients, glassmorphism effects, contemporary color schemes',
        'minimalist': 'Clean lines, lots of white space, simple navigation, monochromatic with one accent color',
        'playful': 'Bright colors, fun animations, rounded corners, cheerful UI elements',
        'creative': 'Bold artistic elements, unique layouts, experimental navigation, vibrant color palettes',
        'corporate': 'Professional appearance, structured layouts, trustworthy design, navy/gray/white palette',
        'elegant': 'Sophisticated aesthetics, premium feel, refined details, gold/deep blue/muted tones'
      };
      styleGuidance = `\n<style_guidance>\nDesign Style: ${style}\nApply: ${styleMap[style] || 'Modern design principles'}\n</style_guidance>`;
    }

    // Build features context
    let featuresContext = '';
    if (features && features.length > 0) {
      featuresContext = `\n<required_features>\n${features.map(f => `- ${f}`).join('\n')}\n</required_features>`;
    }

    // Output token budget guidance (helps avoid truncated HTML)
    let outputBudgetContext = '';
    if (typeof options?.maxOutputTokens === 'number' && Number.isFinite(options.maxOutputTokens)) {
      const maxOutputTokens = Math.max(1, Math.round(options.maxOutputTokens));
      outputBudgetContext =
        `\n<output_budget>\n` +
        `Max output tokens available: ${maxOutputTokens}\n` +
        `- Keep the response within this budget and still end with </html>\n` +
        `- If space is tight, simplify styling/animations and reduce scope before cutting off\n` +
        `</output_budget>`;
    }

    // Build the complete prompt
    const fullPrompt = this.CORE_PROMPT_TEMPLATE + 
      description + 
      styleGuidance + 
      featuresContext + 
      outputBudgetContext +
      '\n</user_request>\n\nGenerate the complete HTML application now:';
    
    log.debug('Generated prompt length:', fullPrompt.length);
    log.verbose('Prompt preview:', fullPrompt.substring(0, 200) + '...');
    
    return fullPrompt;
  }

  /**
   * Get suggested features for different app types
   */
  static getSuggestedFeatures(appType: string): string[] {
    const featureMap: Record<string, string[]> = {
      'calculator': ['Basic operations', 'History', 'Memory functions', 'Scientific mode'],
      'todo': ['Add tasks', 'Mark complete', 'Delete tasks', 'Categories', 'Due dates'],
      'notes': ['Create notes', 'Edit notes', 'Delete notes', 'Search', 'Categories'],
      'timer': ['Set timer', 'Countdown display', 'Alarm sound', 'Multiple timers'],
      'game': ['Score tracking', 'Levels', 'High scores', 'Sound effects'],
      'tracker': ['Add entries', 'View history', 'Statistics', 'Export data'],
      'generator': ['Random generation', 'Copy to clipboard', 'History', 'Favorites'],
      'converter': ['Multiple units', 'Favorites', 'History', 'Quick access'],
      'drawing': ['Draw/paint', 'Color picker', 'Save artwork', 'Clear canvas'],
      'music': ['Play sounds', 'Record sequences', 'Volume control', 'Sound effects']
    };

    // Try to match app type from description
    const description = appType.toLowerCase();
    for (const [type, features] of Object.entries(featureMap)) {
      if (description.includes(type)) {
        return features;
      }
    }

    return ['User-friendly interface', 'Save data', 'Easy navigation', 'Mobile optimized'];
  }

  /**
   * Get style recommendations based on app type
   */
  static getRecommendedStyles(appType: string): AppStyle[] {
    const styleMap: Record<string, AppStyle[]> = {
      'calculator': ['minimalist', 'modern', 'corporate'],
      'game': ['playful', 'creative', 'modern'],
      'business': ['corporate', 'elegant', 'minimalist'],
      'creative': ['creative', 'playful', 'elegant'],
      'utility': ['minimalist', 'modern', 'corporate'],
      'entertainment': ['playful', 'creative', 'modern']
    };

    const description = appType.toLowerCase();
    for (const [type, styles] of Object.entries(styleMap)) {
      if (description.includes(type)) {
        return styles;
      }
    }

    return ['modern', 'minimalist', 'playful'];
  }

  /**
   * Generate a PromptHistory entry for tracking
   */
  static createPromptHistoryEntry(
    request: AppGenerationRequest,
    generatedConcept?: GeneratedAppConcept
  ): Omit<PromptHistory, 'id'> {
    const baseEntry = {
      title: generatedConcept?.title || `${request.style} App`,
      prompt: request.description,
      html: generatedConcept ? JSON.stringify(generatedConcept, null, 2) : 'GENERATING...',
      timestamp: new Date(),
      style: request.style,
      status: generatedConcept ? 'completed' as const : 'generating' as const,
      favorite: false,
      accessCount: 0,
      generatedConcept: generatedConcept
    };

    return baseEntry;
  }

  /**
   * Validate app generation request
   */
  static validateRequest(request: AppGenerationRequest): { isValid: boolean; errors: string[] } {
    const errors: string[] = [];

    if (!request.description || request.description.trim().length < 10) {
      errors.push('Description must be at least 10 characters long');
    }

    const validStyles: AppStyle[] = ['minimalist', 'creative', 'corporate', 'playful', 'elegant', 'modern'];
    if (!validStyles.includes(request.style)) {
      errors.push('Invalid style selected');
    }

    if (request.features && request.features.length > 10) {
      errors.push('Maximum 10 features allowed');
    }

    return {
      isValid: errors.length === 0,
      errors
    };
  }

  /**
   * Check if a request requires unavailable features
   */
  static checkForUnavailableFeatures(description: string): { isValid: boolean; reason?: string; suggestion?: string } {
    const unavailableFeatures = [
      { keywords: ['camera', 'photo', 'picture', 'image capture'], reason: 'Camera access unavailable', suggestion: 'Drawing app with brush tools and color palette' },
      { keywords: ['microphone', 'voice', 'record audio', 'speech'], reason: 'Microphone access unavailable', suggestion: 'Music synthesizer with Tone.js for audio creation' },
      { keywords: ['gps', 'location', 'maps', 'navigation'], reason: 'GPS access unavailable', suggestion: 'Direction game or manual route planner' },
      { keywords: ['contact', 'phone book', 'address book'], reason: 'Contacts access unavailable', suggestion: 'Personal contact list stored in app' },
      { keywords: ['file upload', 'file picker', 'choose file'], reason: 'File system access unavailable', suggestion: 'Text-based content creator' },
      { keywords: ['real-time', 'live data', 'api', 'fetch'], reason: 'Network requests unavailable', suggestion: 'Simulator with demo data' }
    ];

    const desc = description.toLowerCase();
    
    for (const feature of unavailableFeatures) {
      if (feature.keywords.some(keyword => desc.includes(keyword))) {
        return {
          isValid: false,
          reason: feature.reason,
          suggestion: feature.suggestion
        };
      }
    }

    return { isValid: true };
  }

  /**
   * Generate a prompt for revising an existing HTML app.
   * The model must return a full HTML document and preserve the data-app-title attribute.
   */
  static generateHtmlRevisionPrompt(args: {
    originalPrompt: string;
    updatedPrompt: string;
    userNotes: string;
    originalHtml: string;
  }): string {
    const originalPrompt = args.originalPrompt?.trim() || '';
    const updatedPrompt = args.updatedPrompt?.trim() || originalPrompt;
    const userNotes = args.userNotes?.trim() || '';
    const originalHtml = args.originalHtml || '';

    return `<role>
You are an expert HTML/CSS/JavaScript developer specializing in mobile web apps for WebView environments.
</role>

<task>
Revise the existing HTML app to match the updated prompt and address the user notes. Keep the app fully offline and functional inside a React Native WebView.
</task>

<requirements>
- Keep functionality the same unless the user notes require a clear bug fix.
- Fix layout issues (overflow, spacing, touch targets) and obvious bugs.
- Do NOT add network features: fetch(), XMLHttpRequest, WebSocket.
- Do NOT use camera, microphone, geolocation, filesystem.
- Preserve the existing <html ... data-app-title="..."> attribute value exactly.
- The output MUST be a complete HTML document (<!DOCTYPE html> ... </html>).
</requirements>

<debug>
Include a debug block in the output HTML:
- Add a <script id="droplets_debug" type="application/json"> in <head>
- It must include JSON with keys: updatedPrompt, userNotes, fixSummary
- Keep fixSummary concise (1-6 bullet strings).
</debug>

<inputs>
<original_prompt>
${originalPrompt}
</original_prompt>

<updated_prompt>
${updatedPrompt}
</updated_prompt>

<user_notes>
${userNotes}
</user_notes>

<original_html>
${originalHtml}
</original_html>
</inputs>

<output_format>
Respond with ONLY the complete HTML code. No explanations, markdown blocks, or commentary.
- Start with <!DOCTYPE html>
- End with </html>
</output_format>`;
  }
}
