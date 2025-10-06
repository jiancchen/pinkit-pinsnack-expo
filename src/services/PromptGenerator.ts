import { PromptHistory, GeneratedAppConcept } from '../types/PromptHistory';

export type AppStyle = 'minimalist' | 'creative' | 'corporate' | 'playful' | 'elegant' | 'modern';
export type AppCategory = 'productivity' | 'social' | 'utility' | 'entertainment' | 'education' | 'health' | 'finance' | 'travel' | 'shopping' | 'other';

export interface AppGenerationRequest {
  description: string;
  style: AppStyle;
  features?: string[];
  platform?: 'mobile' | 'web' | 'both';
}

export class PromptGenerator {
  
  // Core prompt template based on your Android implementation (PROP_FORMAT3)
  private static readonly CORE_PROMPT_TEMPLATE = `Generate single-file HTML app for React Native WebView. Vanilla JS, NO frameworks (React/Vue/etc).

OUTPUT FORMAT:
Respond with ONLY the complete HTML code. No explanations, no markdown code blocks, no commentary.
Start with <!DOCTYPE html> and end with </html>. Nothing before or after.

TITLE REQUIREMENT:
Add a custom attribute to the <html> tag with the app name:
<html data-app-title="Your Generated App Name">

IMPORTANT: Do NOT show the app title/name anywhere visible in the HTML content itself. Only include it in the data-app-title attribute.

REQUIRED META TAG:
<meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no">

MOBILE DESIGN:
- Center content for portrait phones (360-400px width typical)
- Body background: transparent (background: transparent;)
- Container positioning: margin-top: 40px for top spacing
- Container height strategy:
  * For static apps (calculators, forms): Center vertically with auto height
  * For dynamic list apps (todos, notes, logs): min-height: calc(100vh - 80px) to fill screen
- Use min-height: 100vh (NOT height: 100vh) to prevent viewport cutoff
- For body/container: flex with min-height allows proper scrolling
- Container width: 100% (padding handled by native container)
- Use flexbox/grid for layout
- Font size ≥16px (prevents zoom on input)
- Touch targets ≥44px
- Responsive padding: padding:20px
- Maintain consistent spacing/margins between elements  
- ALL elements must use box-sizing: border-box to include padding in width calculations
- Input fields, buttons must not exceed container width
- Use word-wrap: break-word for text content to prevent horizontal overflow
- Add to global CSS: * { box-sizing: border-box; }

CONTAINER HEIGHT RULES:
- If app has dynamic/expandable content (lists that grow: todos, notes, feeds, logs, chats, trackers):
  Container must be full-height from start: min-height: calc(100vh - 80px);
  Add overflow-y: auto; so content scrolls inside the fixed container
- If app has static/fixed content (calculators, converters, single forms):
  Container uses auto height and centers vertically (no forced full-height)
- Key principle: Don't let container grow with content - either full-height or auto, never dynamic

ALLOWED CDN LIBRARIES (via <script src> or <link href>):
✓ Three.js: https://cdnjs.cloudflare.com/ajax/libs/three.js/r128/three.min.js
✓ Chart.js: https://cdnjs.cloudflare.com/ajax/libs/Chart.js/3.9.1/chart.min.js
✓ D3.js: https://cdnjs.cloudflare.com/ajax/libs/d3/7.8.5/d3.min.js
✓ Tone.js (audio): https://cdnjs.cloudflare.com/ajax/libs/tone/14.8.49/Tone.js
✓ Math.js: https://cdnjs.cloudflare.com/ajax/libs/mathjs/11.11.0/math.min.js
✓ Bootstrap CSS: https://cdn.jsdelivr.net/npm/bootstrap@5.3.0/dist/css/bootstrap.min.css
✓ Google Fonts: https://fonts.googleapis.com

AVAILABLE REACT NATIVE FEATURES (ONLY THESE):
✓ Storage:
  window.ReactNativeWebView.postMessage(JSON.stringify({type:'saveData',key,value})) - save data
  window.ReactNativeWebView.postMessage(JSON.stringify({type:'loadData',key})) - load data
  window.ReactNativeWebView.postMessage(JSON.stringify({type:'getAllData'})) - get all data
  window.ReactNativeWebView.postMessage(JSON.stringify({type:'deleteData',key})) - delete key
  
✓ Notifications:
  window.ReactNativeWebView.postMessage(JSON.stringify({type:'setReminder',id,milliseconds,title,message})) - schedule notification
  window.ReactNativeWebView.postMessage(JSON.stringify({type:'cancelReminder',id})) - cancel reminder
  window.ReactNativeWebView.postMessage(JSON.stringify({type:'getReminders'})) - list reminders

CRITICAL JAVASCRIPT PATTERNS:
✓ Always check React Native WebView availability: if(window.ReactNativeWebView){...}
✓ Use postMessage for communication with React Native
✓ Listen for messages from React Native:
  window.addEventListener('message', (event) => {
    const data = JSON.parse(event.data);
    // Handle response based on data.type
  });
✓ For storage, track the KEY used so you can delete with the SAME key later

UNAVAILABLE FEATURES (MUST REJECT):
✗ Camera/Photos, Microphone/Audio Input, Geolocation, Device Sensors
✗ Contacts, Calendar, Phone/SMS, File System, Bluetooth, NFC
✗ Push notifications (local reminders work), Biometrics, Screen control
✗ Vibration, Clipboard (reading), Share API, Battery status

Design Language:
Use a layered 3D card design language. Each UI element should feel like a floating card with soft shadows, rounded corners, and depth.
Use bold typography (Inter, Poppins, or Manrope).
Backgrounds are flat and vibrant, e.g. yellow, teal, or coral.
Foreground cards use black or white surfaces with subtle inner shadows.
Accent elements use gradient highlights (like pink–orange, purple–blue).
Keep spacing generous, corners round, and UI components centered.
The style should feel playful yet technical, like a mix of code cards and album covers.

STYLE KEYWORDS:
Neo-brutalist, playful, chunky borders, hard shadows, gradient accents, warm peach tones, tactile, energetic, bold typography, high contrast

INTERACTIONS:
- All transitions: 0.15-0.2s
- Hover effects: lift elements up with translate
- Press effects: push down with translate
- Use transform (NOT margin/position) for animations
- webkit-tap-highlight-color: transparent; for all elements

STRICTLY FORBIDDEN (MUST REJECT):
✗ fetch(), XMLHttpRequest, WebSocket - NO network requests
✗ Live external data: stock prices, crypto, weather, news, social media
✗ APIs requiring real-time data
✗ localStorage/sessionStorage (use React Native storage instead)
✗ Service Workers, Web Workers, IndexedDB, Web SQL

APPS THAT WORK (generate anything like these):
✓ 3D graphics, games, simulations (use Three.js!)
✓ Charts with demo data (use Chart.js)
✓ Canvas drawing/painting apps
✓ Music/audio synthesis apps (use Tone.js - no recording)
✓ Calculators, converters, utilities
✓ Timers, stopwatches, countdowns, alarms (use notifications)
✓ Notes, todo lists (use React Native storage)
✓ Offline games: tic-tac-toe, snake, dice, cards, puzzles
✓ Random generators: names, passwords, jokes, colors
✓ Simulators with demo data: weather, stocks, social posts
✓ Text editors, markdown editors
✓ Animations, particle effects
✓ Math/science tools, visualizations
✓ Habit trackers, mood trackers
✓ Pixel art editors, color pickers

REQUIREMENTS:
✓ Complete working code (no TODOs/placeholders)
✓ All CSS inline in <style>
✓ All JS inline in <script>
✓ Beautiful, polished mobile UI
✓ Use realistic demo/simulated data when needed
✓ App works immediately without setup
✓ Only use available React Native features
✓ ALL elements must use box-sizing: border-box

CRITICAL: Output ONLY the HTML. Do not wrap in markdown. Do not explain.

User request: `;


  /**
   * Generate a comprehensive prompt for Claude API based on user requirements
   */
  static generatePrompt(request: AppGenerationRequest): string {
    console.log('📝 [PromptGenerator] Starting prompt generation for request:', request);
    
    const { description, style, features } = request;
    
    console.log('🎨 [PromptGenerator] Building prompt with parameters:', {
      description: description.substring(0, 50) + '...',
      style,
      featuresCount: features?.length || 0,
      platform: request.platform
    });

    // Build the style context
    let styleContext = '';
    if (style) {
      const styleMap = {
        'modern': 'Use modern, sleek, professional design with dark themes',
        'minimalist': 'Use clean, minimal design with lots of white space',
        'playful': 'Use fun, colorful, bright design with playful elements',
        'creative': 'Use artistic, bold, creative design with unique layouts',
        'corporate': 'Use professional, trustworthy design with structured layouts',
        'elegant': 'Use sophisticated, premium design with refined details'
      };
      styleContext = `\nSTYLE: ${styleMap[style] || 'Modern design'}`;
    }

    // Build the features context
    let featuresContext = '';
    if (features && features.length > 0) {
      featuresContext = `\nREQUIRED FEATURES: ${features.join(', ')}`;
    }

    const fullPrompt = this.CORE_PROMPT_TEMPLATE + description + styleContext + featuresContext;
    
    console.log('✅ [PromptGenerator] Generated prompt length:', fullPrompt.length);
    console.log('📄 [PromptGenerator] Prompt preview:', fullPrompt.substring(0, 200) + '...');
    
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
}