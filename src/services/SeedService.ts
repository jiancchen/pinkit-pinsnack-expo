import AsyncStorage from '@react-native-async-storage/async-storage';
import { AppStorageService, StoredApp } from './AppStorageService';
import { Asset } from 'expo-asset';
import { SeedLogger as log } from '../utils/Logger';

// Import the chess HTML file
const chessHtmlAsset = require('../../assets/sample-apps/chess.html');

/**
 * Load chess HTML content from assets
 */
async function loadChessHtml(): Promise<string> {
  try {
    const asset = Asset.fromModule(chessHtmlAsset);
    await asset.downloadAsync();
    
    const response = await fetch(asset.localUri || asset.uri);
    const htmlContent = await response.text();
    
    return htmlContent;
  } catch (error) {
    log.error('Failed to load chess.html:', error);
    return '<html><body><h1>Error loading chess game</h1></body></html>';
  }
}
const SAMPLE_HTML_PLACEHOLDER = `
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Sample App</title>
    <style>
        body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; }
        .container { max-width: 400px; margin: 0 auto; padding: 20px; }
    </style>
</head>
<body>
    <div class="container">
        <h1>Sample App</h1>
        <p>This is a placeholder for sample apps. Full HTML files are in assets/sample-apps/</p>
    </div>
</body>
</html>
`;

export interface SampleApp {
  title: string;
  description: string;
  html: string;
  htmlFile?: string; // Optional filename to load from assets
  category: string;
  style: string;
  isSample: boolean;
}

export class SeedService {
  private static readonly SEED_VERSION_KEY = 'seed_version';
  private static readonly CURRENT_SEED_VERSION = 1;
  
  /**
   * Sample apps to seed the app with
   */
  private static readonly SAMPLE_APPS: SampleApp[] = [
    {
      title: 'Chess Game | Games',
      description: 'A fully featured chess game with AI opponent, move validation, check detection, and beautiful styling',
      html: '', // Will be loaded from assets
      htmlFile: 'chess.html',
      category: 'games',
      style: 'modern',
      isSample: true
    }
  ];

  /**
   * Check if seeding is needed
   */
  static async shouldSeed(): Promise<boolean> {
    try {
      // Check seed version to handle updates
      const storedVersion = await AsyncStorage.getItem(this.SEED_VERSION_KEY);
      const currentVersion = parseInt(storedVersion || '0', 10);
      
      if (currentVersion < this.CURRENT_SEED_VERSION) {
        log.info('Seeding needed - version update');
        return true;
      }
      
      // Check if any sample apps exist
      const existingApps = await AppStorageService.getAllApps();
      const sampleApps = existingApps.filter(app => app.isSample);
      
      if (sampleApps.length === 0) {
        log.info('Seeding needed - no sample apps found');
        return true;
      }
      
      log.debug('Seeding not needed');
      return false;
    } catch (error) {
      log.error('Error checking seed status:', error);
      return true; // Seed on error to be safe
    }
  }

  /**
   * Seed the app with sample apps
   */
  static async seedSampleApps(): Promise<void> {
    log.info('Starting sample app seeding...');
    
    try {
      // Remove existing sample apps first (in case of re-seeding)
      await this.removeSampleApps();
      
      // Create sample apps
      const createdApps: StoredApp[] = [];
      
      for (const sampleApp of this.SAMPLE_APPS) {
        log.debug(`Creating sample app: ${sampleApp.title}`);
        
        // Load HTML content from assets if htmlFile is specified
        let htmlContent = sampleApp.html;
        if (sampleApp.htmlFile) {
          try {
            htmlContent = await loadChessHtml();
            log.verbose(`Loaded HTML from ${sampleApp.htmlFile}`);
          } catch (error) {
            log.error(`Failed to load ${sampleApp.htmlFile}:`, error);
            htmlContent = `<html><body><h1>Error loading ${sampleApp.htmlFile}</h1></body></html>`;
          }
        }
        
        // Parse title and category
        const [title, category] = sampleApp.title.includes(' | ') 
          ? sampleApp.title.split(' | ')
          : [sampleApp.title, sampleApp.category];
        
        // Create the app with sample flag
        const storedApp: StoredApp = {
          id: `sample_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
          title: title.trim(),
          description: sampleApp.description,
          html: htmlContent,
          prompt: sampleApp.description,
          timestamp: new Date(),
          style: sampleApp.style,
          category: category.toLowerCase(),
          status: 'completed',
          favorite: false,
          accessCount: 0,
          baseUrl: '',
          isSample: true // Mark as sample app
        };
        
        storedApp.baseUrl = `https://sandbox/${storedApp.id}/`;
        createdApps.push(storedApp);
      }
      
      // Get existing apps and add sample apps to the end
      const existingApps = await AppStorageService.getAllApps();
      const allApps = [...existingApps, ...createdApps];
      
      // Save all apps
      await AsyncStorage.setItem('generated_apps', JSON.stringify(allApps));
      
      // Update seed version
      await AsyncStorage.setItem(this.SEED_VERSION_KEY, this.CURRENT_SEED_VERSION.toString());
      
      log.info(`Successfully seeded ${createdApps.length} sample apps`);
    } catch (error) {
      log.error('Error seeding sample apps:', error);
      throw new Error('Failed to seed sample apps');
    }
  }

  /**
   * Remove all sample apps
   */
  static async removeSampleApps(): Promise<void> {
    try {
      log.debug('Removing existing sample apps...');
      
      const existingApps = await AppStorageService.getAllApps();
      const nonSampleApps = existingApps.filter(app => !app.isSample);
      
      await AsyncStorage.setItem('generated_apps', JSON.stringify(nonSampleApps));
      
      log.info(`Removed ${existingApps.length - nonSampleApps.length} sample apps`);
    } catch (error) {
      log.error('Error removing sample apps:', error);
    }
  }

  /**
   * Re-seed sample apps (useful for updates or user request)
   */
  static async reseedSampleApps(): Promise<void> {
    log.info('Re-seeding sample apps...');
    
    // Reset seed version to force re-seeding
    await AsyncStorage.removeItem(this.SEED_VERSION_KEY);
    
    // Seed apps
    await this.seedSampleApps();
  }

  /**
   * Get information about sample apps
   */
  static getSampleAppsInfo(): { count: number; categories: string[] } {
    const categories = [...new Set(this.SAMPLE_APPS.map(app => app.category))];
    return {
      count: this.SAMPLE_APPS.length,
      categories
    };
  }

  /**
   * Check if an app is a sample app
   */
  static isSampleApp(app: StoredApp): boolean {
    return app.isSample === true || app.id.startsWith('sample_');
  }

  /**
   * Initialize seeding on app startup
   */
  static async initializeSeeding(): Promise<void> {
    log.debug('Initializing seeding...');
    
    try {
      const needsSeeding = await this.shouldSeed();
      
      if (needsSeeding) {
        await this.seedSampleApps();
        log.info('Seeding completed successfully');
      } else {
        log.debug('Seeding not needed');
      }
    } catch (error) {
      log.error('Failed to initialize seeding:', error);
      // Don't throw - app should still work without sample apps
    }
  }
}

// Note: In React Native, we'll need to use a different approach to load the HTML files
// This is a placeholder for the require statements above - we'll need to implement
// a proper asset loading mechanism
export default SeedService;