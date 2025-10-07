import AsyncStorage from '@react-native-async-storage/async-storage';

/**
 * Service for managing screenshots - simplified to remove external capture methods
 * Focus on WebView-based html2canvas approach which is the most reliable
 */
export class ScreenshotService {
  private static readonly SCREENSHOT_PREFIX = 'app_screenshot_';
  private static readonly SCREENSHOT_WIDTH = 200; // Half resolution for storage efficiency
  private static readonly SCREENSHOT_HEIGHT = 300;
  private static readonly SCREENSHOT_QUALITY = 0.7; // 70% quality for smaller file size

  /**
   * External capture method deprecated - use WebViewScreenshotService instead
   * This method is kept for backwards compatibility but always returns null
   */
  static async captureAndStoreScreenshot(
    viewRef: any,
    appId: string
  ): Promise<string | null> {
    console.warn('⚠️ [Screenshot] External capture method deprecated - use WebViewScreenshotService.generateScreenshotScript() instead');
    console.log('� [Screenshot] Redirecting to WebView-based screenshot for app:', appId);
    return null;
  }

  /**
   * Creates a simple fallback screenshot when WebView capture fails
   */
  static async createFallbackScreenshot(appId: string, appTitle: string, appStyle?: string): Promise<string | null> {
    try {
      console.log('🎨 [Screenshot] Creating fallback screenshot for app:', appId);
      
      // Generate a consistent color based on app title
      const colors = this.generateAppColors(appTitle);
      
      // Create a simple SVG-based fallback image
      const svgContent = `
        <svg width="200" height="300" xmlns="http://www.w3.org/2000/svg">
          <defs>
            <linearGradient id="grad" x1="0%" y1="0%" x2="100%" y2="100%">
              <stop offset="0%" style="stop-color:${colors.primary};stop-opacity:1" />
              <stop offset="100%" style="stop-color:${colors.secondary};stop-opacity:1" />
            </linearGradient>
          </defs>
          <rect width="100%" height="100%" fill="url(#grad)" />
          <text x="50%" y="50%" text-anchor="middle" dominant-baseline="middle" 
                fill="white" font-family="Arial, sans-serif" font-size="16" font-weight="bold">
            ${appTitle.substring(0, 20)}
          </text>
          <text x="50%" y="70%" text-anchor="middle" dominant-baseline="middle" 
                fill="white" font-family="Arial, sans-serif" font-size="12" opacity="0.8">
            ${appStyle || 'App'}
          </text>
        </svg>
      `;
      
      const base64Svg = btoa(svgContent);
      const dataUri = `data:image/svg+xml;base64,${base64Svg}`;
      
      // Store the fallback screenshot
      const fallbackData = {
        appId,
        base64: base64Svg,
        timestamp: new Date().toISOString(),
        dimensions: { width: 200, height: 300 },
        isFallback: true,
        appTitle,
        colors,
        format: 'svg'
      };

      const key = this.SCREENSHOT_PREFIX + appId;
      await AsyncStorage.setItem(key, JSON.stringify(fallbackData));
      
      console.log('✅ [Screenshot] Fallback screenshot created for app:', appId);
      return dataUri;
    } catch (error) {
      console.error('💥 [Screenshot] Fallback creation failed:', error);
      return null;
    }
  }

  /**
   * Generate consistent colors for an app based on its title
   */
  private static generateAppColors(appTitle: string): { primary: string; secondary: string } {
    // Simple hash of the app title to generate consistent colors
    let hash = 0;
    for (let i = 0; i < appTitle.length; i++) {
      const char = appTitle.charCodeAt(i);
      hash = ((hash << 5) - hash) + char;
      hash = hash & hash; // Convert to 32-bit integer
    }
    
    // Generate RGB values from hash with good contrast
    const hue = Math.abs(hash) % 360;
    const saturation = 70 + (Math.abs(hash >> 8) % 30); // 70-100%
    const lightness = 45 + (Math.abs(hash >> 16) % 20); // 45-65%
    
    const primary = `hsl(${hue}, ${saturation}%, ${lightness}%)`;
    const secondary = `hsl(${(hue + 30) % 360}, ${saturation - 20}%, ${lightness + 20}%)`;
    
    console.log(`🎨 [Screenshot] Generated colors for "${appTitle}": ${primary}, ${secondary}`);
    
    return { primary, secondary };
  }

  /**
   * Generate a simple fallback base64 image
   */
  private static generateFallbackBase64(appTitle: string, appStyle?: string): string {
    // This creates a very simple solid color rectangle
    // In a real implementation, you might use Canvas or SVG to create a proper fallback
    
    // Simple hash of the app title to generate a consistent color
    let hash = 0;
    for (let i = 0; i < appTitle.length; i++) {
      const char = appTitle.charCodeAt(i);
      hash = ((hash << 5) - hash) + char;
      hash = hash & hash; // Convert to 32-bit integer
    }
    
    // Generate RGB values from hash
    const r = Math.abs(hash) % 156 + 100; // Keep colors reasonably bright
    const g = Math.abs(hash >> 8) % 156 + 100;
    const b = Math.abs(hash >> 16) % 156 + 100;
    
    console.log(`🎨 [Screenshot] Generated color for ${appTitle}: rgb(${r}, ${g}, ${b})`);
    
    // Return a minimal base64 encoded image (this is a placeholder - ideally we'd generate an actual image)
    // For now, return empty string - the display will handle missing screenshots gracefully
    return '';
  }

  /**
   * Retrieve screenshot for an app - handles both WebView and fallback formats
   */
  static async getScreenshot(appId: string): Promise<string | null> {
    try {
      const key = this.SCREENSHOT_PREFIX + appId;
      const data = await AsyncStorage.getItem(key);
      
      if (!data) {
        console.log('📷 [Screenshot] No screenshot found for app:', appId);
        return null;
      }

      const screenshotData = JSON.parse(data);
      
      // Handle different formats
      if (screenshotData.format === 'svg') {
        return `data:image/svg+xml;base64,${screenshotData.base64}`;
      } else {
        // Legacy JPEG format or WebView format
        return `data:image/jpeg;base64,${screenshotData.base64}`;
      }

    } catch (error) {
      console.error('💥 [Screenshot] Error retrieving screenshot:', error);
      return null;
    }
  }

  /**
   * Delete screenshot for an app
   */
  static async deleteScreenshot(appId: string): Promise<void> {
    try {
      const key = this.SCREENSHOT_PREFIX + appId;
      await AsyncStorage.removeItem(key);
      console.log('🗑️ [Screenshot] Deleted screenshot for app:', appId);
    } catch (error) {
      console.error('💥 [Screenshot] Error deleting screenshot:', error);
    }
  }

  /**
   * Get all screenshot metadata
   */
  static async getAllScreenshots(): Promise<Array<{
    appId: string;
    timestamp: string;
    dimensions: { width: number; height: number };
  }>> {
    try {
      const allKeys = await AsyncStorage.getAllKeys();
      const screenshotKeys = allKeys.filter(key => key.startsWith(this.SCREENSHOT_PREFIX));
      
      const screenshots = await Promise.all(
        screenshotKeys.map(async (key) => {
          try {
            const data = await AsyncStorage.getItem(key);
            if (data) {
              const parsed = JSON.parse(data);
              return {
                appId: parsed.appId,
                timestamp: parsed.timestamp,
                dimensions: parsed.dimensions
              };
            }
          } catch (error) {
            console.warn('Failed to parse screenshot data for key:', key);
          }
          return null;
        })
      );

      return screenshots.filter(Boolean) as Array<{
        appId: string;
        timestamp: string;
        dimensions: { width: number; height: number };
      }>;

    } catch (error) {
      console.error('💥 [Screenshot] Error getting all screenshots:', error);
      return [];
    }
  }

  /**
   * Clean up old screenshots (keep only latest 50)
   */
  static async cleanupOldScreenshots(): Promise<void> {
    try {
      const screenshots = await this.getAllScreenshots();
      
      if (screenshots.length <= 50) {
        return; // No cleanup needed
      }

      // Sort by timestamp and keep only the 50 most recent
      const sorted = screenshots.sort((a, b) => 
        new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime()
      );
      
      const toDelete = sorted.slice(50); // Everything after the first 50
      
      await Promise.all(
        toDelete.map(screenshot => this.deleteScreenshot(screenshot.appId))
      );

      console.log('🧹 [Screenshot] Cleaned up', toDelete.length, 'old screenshots');

    } catch (error) {
      console.error('💥 [Screenshot] Error during cleanup:', error);
    }
  }

  /**
   * Get storage usage statistics
   */
  static async getStorageStats(): Promise<{
    totalScreenshots: number;
    estimatedSizeKB: number;
  }> {
    try {
      const allKeys = await AsyncStorage.getAllKeys();
      const screenshotKeys = allKeys.filter(key => key.startsWith(this.SCREENSHOT_PREFIX));
      
      let totalSize = 0;
      for (const key of screenshotKeys.slice(0, 5)) { // Sample first 5 for estimation
        const data = await AsyncStorage.getItem(key);
        if (data) {
          totalSize += data.length;
        }
      }

      const avgSize = screenshotKeys.length > 0 ? totalSize / Math.min(5, screenshotKeys.length) : 0;
      const estimatedTotalSize = avgSize * screenshotKeys.length;

      return {
        totalScreenshots: screenshotKeys.length,
        estimatedSizeKB: Math.round(estimatedTotalSize / 1024)
      };

    } catch (error) {
      console.error('💥 [Screenshot] Error getting storage stats:', error);
      return { totalScreenshots: 0, estimatedSizeKB: 0 };
    }
  }
}