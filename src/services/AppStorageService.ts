import AsyncStorage from '@react-native-async-storage/async-storage';
import { PromptHistory, GeneratedAppConcept } from '../types/PromptHistory';
import { TopicClassificationMetadata, TopicSortHistoryEntry } from '../types/ProjectTopics';
import { AppGenerationRequest } from './PromptGenerator';
import { StorageLogger as log } from '../utils/Logger';

const APPS_STORAGE_KEY = 'generated_apps';
const APP_COUNTER_KEY = 'app_counter';

export interface StoredApp {
  id: string;
  title: string;
  titleEditedByUser?: boolean;
  description: string;
  html: string;
  prompt: string;
  generatedPrompt?: string;
  timestamp: Date;
  style: string;
  category: string;
  status: 'new' | 'generating' | 'completed' | 'error';
  favorite: boolean;
  accessCount: number;
  generatedConcept?: GeneratedAppConcept;
  request?: AppGenerationRequest;
  baseUrl: string; // For WebView persistence
  model?: string; // Claude model used for generation
  isSample?: boolean; // Mark as sample app for seeding
  primaryTopic?: string;
  topics?: string[];
  topicClassification?: TopicClassificationMetadata;
  topicSortHistory?: TopicSortHistoryEntry[];
  lastRevision?: {
    at: number;
    model: string;
    updatedPrompt: string;
    userNotes: string;
    fixSummary?: string[];
    parentRevisionId?: string | null;
  };
  revisions?: Array<{
    id: string;
    at: number;
    operation: 'create' | 'app_revision';
    status: 'generating' | 'completed' | 'error';
    model: string;
    updatedPrompt: string;
    userNotes: string;
    fixSummary?: string[];
    errorMessage?: string;
    parentRevisionId?: string | null;
  }>;
}

export interface UpdateAppOptions {
  skipTopicClassification?: boolean;
}

export class AppStorageService {
  private static readonly TOPIC_TRIGGER_FIELDS: Array<keyof StoredApp> = [
    'title',
    'description',
    'prompt',
    'generatedPrompt',
    'html',
    'category',
  ];

  private static shouldTriggerTopicClassification(
    currentApp: StoredApp,
    nextApp: StoredApp,
    updates: Partial<StoredApp>
  ): boolean {
    return this.TOPIC_TRIGGER_FIELDS.some((field) => {
      if (!(field in updates)) return false;
      const previous = currentApp[field];
      const next = nextApp[field];

      if (typeof previous === 'string' || typeof next === 'string') {
        const previousValue = typeof previous === 'string' ? previous.trim() : '';
        const nextValue = typeof next === 'string' ? next.trim() : '';
        return previousValue !== nextValue;
      }

      return previous !== next;
    });
  }

  private static scheduleTopicClassification(appId: string, reason: string): void {
    void import('./TopicClassificationService')
      .then(({ TopicClassificationService }) => {
        TopicClassificationService.scheduleForApp(appId, { reason });
      })
      .catch((error: unknown) => {
        log.warn('Failed to schedule topic classification:', { appId, reason, error });
      });
  }

  /**
   * Parse title and category from Claude's response format: "Title | Category"
   */
  private static parseTitleAndCategory(
    claudeTitle: string,
    fallbackCategory: string
  ): { title: string; category: string } {
    log.verbose('Parsing title and category from:', claudeTitle);
    
    // Check if title contains category separator
    if (claudeTitle.includes(' | ')) {
      const parts = claudeTitle.split(' | ');
      if (parts.length >= 2) {
        const title = parts[0].trim();
        const category = parts[1].trim().toLowerCase();
        
        // Validate category against known categories
        const validCategories = [
          'utility', 'fun', 'productivity', 'entertainment', 'education', 
          'health', 'finance', 'social', 'travel', 'shopping', 'games', 
          'tools', 'lifestyle', 'business', 'creative', 'other'
        ];
        
        const finalCategory = validCategories.includes(category) ? category : fallbackCategory;
        
        log.debug('Parsed - Title:', title, 'Category:', finalCategory);
        return { title, category: finalCategory };
      }
    }
    
    log.debug('No category found, using fallback:', fallbackCategory);
    return { title: claudeTitle, category: fallbackCategory };
  }

  private static createTemporaryTitle(description: string): string {
    const cleaned = description
      .replace(/[^\w\s-]/g, ' ')
      .replace(/\s+/g, ' ')
      .trim();

    if (!cleaned) return 'New App';

    const words = cleaned.split(' ').slice(0, 4);
    const title = words
      .map((word) => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
      .join(' ')
      .slice(0, 24)
      .trim();

    return title || 'New App';
  }

  /**
   * Generate a unique app ID
   */
  private static async generateAppId(): Promise<string> {
    try {
      const counterStr = await AsyncStorage.getItem(APP_COUNTER_KEY);
      const counter = counterStr ? parseInt(counterStr, 10) : 1;
      const newCounter = counter + 1;
      await AsyncStorage.setItem(APP_COUNTER_KEY, newCounter.toString());
      return `app_${newCounter}_${Date.now()}`;
    } catch (error) {
      log.error('Error generating app ID:', error);
      return `app_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    }
  }

  /**
   * Save a new generated app
   */
  static async saveApp(
    request: AppGenerationRequest,
    generatedConcept?: GeneratedAppConcept,
    html?: string,
    model?: string,
    generatedPrompt?: string
  ): Promise<StoredApp> {
    log.debug('Starting saveApp process');
    log.verbose('Request:', request);
    log.verbose('Model:', model);
    log.verbose('Has concept:', !!generatedConcept);
    log.verbose('Has custom HTML:', !!html);
    
    try {
      const appId = await this.generateAppId();
      log.debug('Generated app ID:', appId);
      
      const baseUrl = `https://sandbox/${appId}/`;
      log.verbose('Generated baseUrl:', baseUrl);
      
      // Parse title and category from Claude's response (format: "Title | Category")
      const temporaryTitle = this.createTemporaryTitle(request.description);
      const { title, category } = this.parseTitleAndCategory(
        generatedConcept?.title || temporaryTitle,
        'utility' // Default category
      );
      
      const newApp: StoredApp = {
        id: appId,
        title,
        description: request.description,
        html: html || this.generatePlaceholderHTML(request, generatedConcept),
        prompt: request.description,
        generatedPrompt,
        timestamp: new Date(),
        style: request.style,
        category,
        status: generatedConcept ? 'completed' : 'new',
        favorite: false,
        accessCount: 0,
        generatedConcept,
        request,
        baseUrl: `https://sandbox/${appId}/`,
        model: model || 'unknown',
        titleEditedByUser: false,
      };
      
      log.verbose('Created app object:', {
        id: newApp.id,
        title: newApp.title,
        status: newApp.status,
        model: newApp.model,
        htmlLength: newApp.html.length
      });

      // Get existing apps
      log.verbose('Fetching existing apps...');
      const existingApps = await this.getAllApps();
      log.verbose('Found', existingApps.length, 'existing apps');
      
      // Add new app to the beginning
      const updatedApps = [newApp, ...existingApps];
      log.verbose('Total apps after addition:', updatedApps.length);
      
      // Save to storage
      log.debug('Saving to AsyncStorage...');
      await AsyncStorage.setItem(APPS_STORAGE_KEY, JSON.stringify(updatedApps));
      log.debug('Successfully saved to storage');

      this.scheduleTopicClassification(appId, 'app_created');
      
      return newApp;
    } catch (error: any) {
      log.error('Error saving app:', {
        error: error?.message || error,
        stack: error?.stack,
        request
      });
      throw new Error('Failed to save generated app');
    }
  }

  /**
   * Generate placeholder HTML for apps being generated
   */
  private static generatePlaceholderHTML(
    request: AppGenerationRequest,
    concept?: GeneratedAppConcept
  ): string {
    const title = concept?.title || `${request.style} App`;
    const description = concept?.description || request.description;
    
    return `
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>${title}</title>
    <style>
        * {
            margin: 0;
            padding: 0;
            box-sizing: border-box;
        }
        body {
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
            background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
            min-height: 100vh;
            display: flex;
            align-items: center;
            justify-content: center;
            padding: 20px;
        }
        .container {
            background: white;
            border-radius: 20px;
            padding: 40px;
            max-width: 400px;
            width: 100%;
            text-align: center;
            box-shadow: 0 20px 40px rgba(0,0,0,0.1);
        }
        .spinner {
            width: 50px;
            height: 50px;
            border: 4px solid #f3f3f3;
            border-top: 4px solid #667eea;
            border-radius: 50%;
            animation: spin 1s linear infinite;
            margin: 0 auto 20px;
        }
        @keyframes spin {
            0% { transform: rotate(0deg); }
            100% { transform: rotate(360deg); }
        }
        h1 {
            color: #333;
            margin-bottom: 10px;
            font-size: 24px;
        }
        p {
            color: #666;
            line-height: 1.6;
            margin-bottom: 20px;
        }
        .features {
            text-align: left;
            margin-top: 20px;
        }
        .feature {
            display: flex;
            align-items: center;
            margin-bottom: 10px;
            padding: 8px;
            background: #f8f9fa;
            border-radius: 8px;
        }
        .feature-icon {
            width: 20px;
            height: 20px;
            background: #667eea;
            border-radius: 50%;
            margin-right: 12px;
        }
    </style>
</head>
<body>
    <div class="container">
        ${concept ? '' : '<div class="spinner"></div>'}
        <h1>${title}</h1>
        <p>${description}</p>
        
        ${concept ? `
        <div class="features">
            ${concept.features.map(feature => `
                <div class="feature">
                    <div class="feature-icon"></div>
                    <span>${feature}</span>
                </div>
            `).join('')}
        </div>
        ` : '<p>Generating your app with AI...</p>'}
    </div>
    
	    <script>
	        // Persistent storage demo
	        const appData = JSON.parse(localStorage.getItem('appData') || '{}');
	        
	        // Save some demo data
	        localStorage.setItem('appData', JSON.stringify({
	            id: '${request.description.slice(0, 20)}',
            visits: (appData.visits || 0) + 1,
            lastVisit: new Date().toISOString()
        }));
    </script>
</body>
</html>`;
  }

  /**
   * Get a specific app by ID
   */
  static async getApp(appId: string): Promise<StoredApp | null> {
    try {
      const apps = await this.getAllApps();
      return apps.find(app => app.id === appId) || null;
    } catch (error) {
      log.error('Error getting app:', error);
      return null;
    }
  }

  /**
   * Get all stored apps
   */
  static async getAllApps(): Promise<StoredApp[]> {
    try {
      const appsData = await AsyncStorage.getItem(APPS_STORAGE_KEY);
      if (!appsData) {
        return [];
      }
      
      const apps = JSON.parse(appsData);
      // Convert timestamp strings back to Date objects
      return apps.map((app: any) => ({
        ...app,
        timestamp: new Date(app.timestamp)
      }));
    } catch (error) {
      log.error('Error getting apps:', error);
      return [];
    }
  }

  static async getStorageStats(): Promise<{
    totalApps: number;
    favorites: number;
    estimatedSizeKB: number;
  }> {
    try {
      const raw = await AsyncStorage.getItem(APPS_STORAGE_KEY);
      if (!raw) return { totalApps: 0, favorites: 0, estimatedSizeKB: 0 };
      const parsed = JSON.parse(raw);
      const apps = Array.isArray(parsed) ? parsed : [];
      const totalApps = apps.length;
      const favorites = apps.filter((app: any) => app && app.favorite === true).length;
      const estimatedSizeKB = Math.round(raw.length / 1024);
      return { totalApps, favorites, estimatedSizeKB };
    } catch (error) {
      log.error('Error getting apps storage stats:', error);
      return { totalApps: 0, favorites: 0, estimatedSizeKB: 0 };
    }
  }

  static async clearAllApps(): Promise<void> {
    await AsyncStorage.removeItem(APPS_STORAGE_KEY);
  }

  /**
   * Get a specific app by ID
   */
  static async getAppById(appId: string): Promise<StoredApp | null> {
    try {
      const apps = await this.getAllApps();
      return apps.find(app => app.id === appId) || null;
    } catch (error) {
      log.error('Error getting app by ID:', error);
      return null;
    }
  }

  /**
   * Update an existing app
   */
  static async updateApp(
    appId: string,
    updates: Partial<StoredApp>,
    options: UpdateAppOptions = {}
  ): Promise<boolean> {
    try {
      const apps = await this.getAllApps();
      const appIndex = apps.findIndex(app => app.id === appId);
      
      if (appIndex === -1) {
        return false;
      }
      
      const currentApp = apps[appIndex];
      const nextApp = { ...currentApp, ...updates };
      apps[appIndex] = nextApp;
      await AsyncStorage.setItem(APPS_STORAGE_KEY, JSON.stringify(apps));

      if (!options.skipTopicClassification && this.shouldTriggerTopicClassification(currentApp, nextApp, updates)) {
        this.scheduleTopicClassification(appId, 'app_updated');
      }
      
      return true;
    } catch (error) {
      log.error('Error updating app:', error);
      return false;
    }
  }

  /**
   * Delete an app
   */
  static async deleteApp(appId: string): Promise<boolean> {
    try {
      const apps = await this.getAllApps();
      const filteredApps = apps.filter(app => app.id !== appId);
      
      await AsyncStorage.setItem(APPS_STORAGE_KEY, JSON.stringify(filteredApps));
      return true;
    } catch (error) {
      log.error('Error deleting app:', error);
      return false;
    }
  }

  /**
   * Increment access count for an app
   */
  static async incrementAccessCount(appId: string): Promise<void> {
    try {
      const apps = await this.getAllApps();
      const appIndex = apps.findIndex(app => app.id === appId);
      
      if (appIndex !== -1) {
        apps[appIndex].accessCount = (apps[appIndex].accessCount || 0) + 1;
        await AsyncStorage.setItem(APPS_STORAGE_KEY, JSON.stringify(apps));
      }
    } catch (error) {
      log.error('Error incrementing access count:', error);
    }
  }

  /**
   * Toggle favorite status
   */
  static async toggleFavorite(appId: string): Promise<boolean> {
    try {
      const apps = await this.getAllApps();
      const appIndex = apps.findIndex(app => app.id === appId);
      
      if (appIndex === -1) {
        return false;
      }
      
      apps[appIndex].favorite = !apps[appIndex].favorite;
      await AsyncStorage.setItem(APPS_STORAGE_KEY, JSON.stringify(apps));
      
      return apps[appIndex].favorite;
    } catch (error) {
      log.error('Error toggling favorite:', error);
      return false;
    }
  }

  /**
   * Update app HTML after generation
   */
  static async updateAppHTML(appId: string, html: string, concept?: GeneratedAppConcept, model?: string): Promise<boolean> {
    log.debug('Starting updateAppHTML process');
    log.verbose('App ID:', appId);
    log.verbose('HTML length:', html?.length || 0);
    log.verbose('Has concept:', !!concept);
    log.verbose('Model:', model);
    
    try {
      const currentApp = await this.getAppById(appId);
      const updateData: Partial<StoredApp> = {
        html,
        generatedConcept: concept,
        status: 'completed'
      };

      if (concept?.title) {
        const parsed = this.parseTitleAndCategory(concept.title, currentApp?.category || 'utility');
        if (!currentApp?.titleEditedByUser) {
          updateData.title = parsed.title;
        }
        updateData.category = parsed.category;
      }
      
      if (model) {
        updateData.model = model;
      }
      
      log.verbose('Update data prepared:', {
        hasHtml: !!updateData.html,
        hasGeneratedConcept: !!updateData.generatedConcept,
        status: updateData.status,
        model: updateData.model
      });
      
      const result = await this.updateApp(appId, updateData);
      log.debug('Update app result:', result);
      
      return result;
    } catch (error: any) {
      log.error('Error updating app HTML:', {
        error: error?.message || error,
        appId,
        htmlLength: html?.length || 0
      });
      return false;
    }
  }

  /**
   * Get apps statistics
   */
  static async getStats(): Promise<{
    total: number;
    favorites: number;
    totalAccess: number;
    recentlyCreated: number;
  }> {
    try {
      const apps = await this.getAllApps();
      const now = new Date();
      const dayAgo = new Date(now.getTime() - 24 * 60 * 60 * 1000);
      
      return {
        total: apps.length,
        favorites: apps.filter(app => app.favorite).length,
        totalAccess: apps.reduce((sum, app) => sum + (app.accessCount || 0), 0),
        recentlyCreated: apps.filter(app => new Date(app.timestamp) > dayAgo).length
      };
    } catch (error) {
      log.error('Error getting stats:', error);
      return { total: 0, favorites: 0, totalAccess: 0, recentlyCreated: 0 };
    }
  }

  /**
   * Convert StoredApp to PromptHistory format for backward compatibility
   */
  static storedAppToPromptHistory(app: StoredApp): PromptHistory {
    return {
      id: app.id,
      prompt: app.prompt,
      html: app.html,
      title: app.title,
      favorite: app.favorite,
      accessCount: app.accessCount,
      timestamp: app.timestamp,
      style: app.style,
      category: app.category,
      status: app.status,
      generatedConcept: app.generatedConcept
    };
  }
}
