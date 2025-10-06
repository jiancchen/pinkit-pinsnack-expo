import AsyncStorage from '@react-native-async-storage/async-storage';
import { PromptHistory, GeneratedAppConcept } from '../types/PromptHistory';
import { AppGenerationRequest } from './PromptGenerator';

const APPS_STORAGE_KEY = 'generated_apps';
const APP_COUNTER_KEY = 'app_counter';

export interface StoredApp {
  id: string;
  title: string;
  description: string;
  html: string;
  prompt: string;
  timestamp: Date;
  style: string;
  category: string;
  status: 'new' | 'generating' | 'completed' | 'error';
  favorite: boolean;
  accessCount: number;
  generatedConcept?: GeneratedAppConcept;
  request?: AppGenerationRequest;
  baseUrl: string; // For WebView persistence
}

export class AppStorageService {
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
      console.error('Error generating app ID:', error);
      return `app_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    }
  }

  /**
   * Save a new generated app
   */
  static async saveApp(
    request: AppGenerationRequest,
    generatedConcept?: GeneratedAppConcept,
    html?: string
  ): Promise<StoredApp> {
    try {
      const appId = await this.generateAppId();
      const baseUrl = `https://sandbox/${appId}/`;
      
      const newApp: StoredApp = {
        id: appId,
        title: generatedConcept?.title || `${request.style} ${request.category} App`,
        description: request.description,
        html: html || this.generatePlaceholderHTML(request, generatedConcept),
        prompt: request.description,
        timestamp: new Date(),
        style: request.style,
        category: request.category,
        status: generatedConcept ? 'completed' : 'generating',
        favorite: false,
        accessCount: 0,
        generatedConcept,
        request,
        baseUrl
      };

      // Get existing apps
      const existingApps = await this.getAllApps();
      
      // Add new app to the beginning
      const updatedApps = [newApp, ...existingApps];
      
      // Save to storage
      await AsyncStorage.setItem(APPS_STORAGE_KEY, JSON.stringify(updatedApps));
      
      return newApp;
    } catch (error) {
      console.error('Error saving app:', error);
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
    const title = concept?.title || `${request.style} ${request.category} App`;
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
        console.log('App data loaded:', appData);
        
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
      console.error('Error getting apps:', error);
      return [];
    }
  }

  /**
   * Get a specific app by ID
   */
  static async getAppById(appId: string): Promise<StoredApp | null> {
    try {
      const apps = await this.getAllApps();
      return apps.find(app => app.id === appId) || null;
    } catch (error) {
      console.error('Error getting app by ID:', error);
      return null;
    }
  }

  /**
   * Update an existing app
   */
  static async updateApp(appId: string, updates: Partial<StoredApp>): Promise<boolean> {
    try {
      const apps = await this.getAllApps();
      const appIndex = apps.findIndex(app => app.id === appId);
      
      if (appIndex === -1) {
        return false;
      }
      
      apps[appIndex] = { ...apps[appIndex], ...updates };
      await AsyncStorage.setItem(APPS_STORAGE_KEY, JSON.stringify(apps));
      
      return true;
    } catch (error) {
      console.error('Error updating app:', error);
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
      console.error('Error deleting app:', error);
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
      console.error('Error incrementing access count:', error);
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
      console.error('Error toggling favorite:', error);
      return false;
    }
  }

  /**
   * Update app HTML after generation
   */
  static async updateAppHTML(appId: string, html: string, concept?: GeneratedAppConcept): Promise<boolean> {
    try {
      return await this.updateApp(appId, {
        html,
        generatedConcept: concept,
        status: 'completed'
      });
    } catch (error) {
      console.error('Error updating app HTML:', error);
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
      console.error('Error getting stats:', error);
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