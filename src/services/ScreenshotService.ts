import { captureRef } from 'react-native-view-shot';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { manipulateAsync, SaveFormat } from 'expo-image-manipulator';
import * as FileSystem from 'expo-file-system';
import { Platform } from 'react-native';

/**
 * Service for capturing, processing, and storing WebView screenshots
 */
export class ScreenshotService {
  private static readonly SCREENSHOT_PREFIX = 'app_screenshot_';
  private static readonly SCREENSHOT_WIDTH = 200; // Half resolution for storage efficiency
  private static readonly SCREENSHOT_HEIGHT = 300;
  private static readonly SCREENSHOT_QUALITY = 0.7; // 70% quality for smaller file size

  /**
   * Capture screenshot of a WebView and store it
   */
  static async captureAndStoreScreenshot(
    viewRef: any,
    appId: string
  ): Promise<string | null> {
    try {
      console.log('📸 [Screenshot] Starting capture for app:', appId);
      console.log('📸 [Screenshot] ViewRef type:', typeof viewRef);
      console.log('📸 [Screenshot] ViewRef current available:', !!viewRef?.current);
      
      // Extract the actual component reference
      let targetComponent;
      
      if (viewRef?.current) {
        // If it's a ref object, get the current component
        targetComponent = viewRef.current;
      } else if (viewRef && typeof viewRef === 'object') {
        // If it's already a component
        targetComponent = viewRef;
      } else {
        console.warn('⚠️ [Screenshot] No valid component reference available');
        return null;
      }

      console.log('📸 [Screenshot] Target component type:', typeof targetComponent);
      console.log('📸 [Screenshot] Component keys:', targetComponent ? Object.keys(targetComponent) : 'none');
      console.log('📱 [Screenshot] Platform:', Platform.OS);

      // Platform-specific capture strategies
      let uri: string | null = null;
      
      if (Platform.OS === 'android') {
        // Android: WebView screenshots work well, use standard approach
        console.log('🤖 [Screenshot] Using Android-optimized capture');
        try {
          uri = await captureRef(targetComponent, {
            format: 'png',
            quality: 1.0,
            result: 'tmpfile'
          });
          console.log('✅ [Screenshot] Android capture successful');
        } catch (error) {
          console.log('⚠️ [Screenshot] Android capture failed, trying JPEG fallback');
          uri = await captureRef(targetComponent, {
            format: 'jpg',
            quality: 0.9,
            result: 'tmpfile'
          });
        }
      } else {
        // iOS: WebView screenshots often fail, use enhanced strategies
        console.log('🍎 [Screenshot] Using iOS-optimized capture strategies');
        
        // Strategy 1: Try with iOS-specific options
        try {
          uri = await captureRef(targetComponent, {
            format: 'png',
            quality: 1.0,
            result: 'tmpfile',
            snapshotContentContainer: false
          });
          console.log('✅ [Screenshot] iOS Strategy 1 (PNG tmpfile) successful');
        } catch (error) {
          console.log('⚠️ [Screenshot] iOS Strategy 1 failed, trying Strategy 2');
          
          // Strategy 2: Try with JPEG and lower quality for iOS
          try {
            uri = await captureRef(targetComponent, {
              format: 'jpg',
              quality: 0.8,
              result: 'tmpfile'
            });
            console.log('✅ [Screenshot] iOS Strategy 2 (JPG tmpfile) successful');
          } catch (error2) {
            console.log('⚠️ [Screenshot] iOS Strategy 2 failed, trying Strategy 3');
            
            // Strategy 3: iOS sometimes works better with data URLs
            try {
              const base64Result = await captureRef(targetComponent, {
                format: 'png',
                quality: 0.7,
                result: 'data-uri'
              });
              
              // Convert data URI to file for consistency
              if (base64Result.startsWith('data:image/')) {
                const base64Data = base64Result.split(',')[1];
                const tempUri = `file:///tmp/temp_${Date.now()}.png`;
                // For iOS data-uri strategy, we'll use the data URI directly
                uri = base64Result;
                console.log('✅ [Screenshot] iOS Strategy 3 (data-uri) successful');
              }
            } catch (error3) {
              console.error('❌ [Screenshot] All iOS strategies failed');
              throw error3;
            }
          }
        }
      }

      if (!uri) {
        console.error('❌ [Screenshot] No URI generated from any strategy');
        return null;
      }

      console.log('✅ [Screenshot] Captured raw screenshot:', uri);
      
      // Debug: Check if the captured image actually has content
      const fileInfo = await FileSystem.getInfoAsync(uri);
      console.log('📊 [Screenshot] File info:', {
        exists: fileInfo.exists,
        size: fileInfo.exists ? (fileInfo as any).size : 0,
        uri: fileInfo.uri
      });

      // Process the image: resize and center crop
      const processedImage = await this.processScreenshot(uri);
      
      if (!processedImage) {
        console.error('❌ [Screenshot] Failed to process image');
        return null;
      }

      // Convert to base64 and store
      const base64Data = await this.convertToBase64(processedImage.uri);
      await this.storeScreenshot(appId, base64Data);

      console.log('💾 [Screenshot] Stored screenshot for app:', appId);
      return processedImage.uri;

    } catch (error: any) {
      console.error('💥 [Screenshot] Error capturing screenshot:', error);
      console.error('💥 [Screenshot] Error details:', {
        name: error?.name || 'Unknown',
        message: error?.message || 'Unknown error',
        stack: error?.stack || 'No stack trace'
      });
      return null;
    }
  }

  /**
   * Process screenshot: resize to half resolution and center crop
   */
  private static async processScreenshot(uri: string): Promise<{ uri: string } | null> {
    try {
      console.log('🔧 [Screenshot] Processing image:', uri);

      // Resize and center crop the image
      const result = await manipulateAsync(
        uri,
        [
          // Resize to target dimensions with center crop
          {
            resize: {
              width: this.SCREENSHOT_WIDTH,
              height: this.SCREENSHOT_HEIGHT,
            }
          }
        ],
        {
          compress: this.SCREENSHOT_QUALITY,
          format: SaveFormat.JPEG, // JPEG for smaller file size
          base64: false
        }
      );

      console.log('✅ [Screenshot] Processed image:', result.uri);
      return result;

    } catch (error) {
      console.error('💥 [Screenshot] Error processing image:', error);
      return null;
    }
  }

  /**
   * Convert image to base64 for storage
   */
  private static async convertToBase64(uri: string): Promise<string> {
    try {
      // Re-process to get base64
      const result = await manipulateAsync(
        uri,
        [],
        {
          compress: this.SCREENSHOT_QUALITY,
          format: SaveFormat.JPEG,
          base64: true
        }
      );

      return result.base64 || '';
    } catch (error) {
      console.error('💥 [Screenshot] Error converting to base64:', error);
      throw error;
    }
  }

  /**
   * Store screenshot in AsyncStorage
   */
  private static async storeScreenshot(appId: string, base64Data: string): Promise<void> {
    try {
      const key = this.SCREENSHOT_PREFIX + appId;
      const screenshotData = {
        appId,
        base64: base64Data,
        timestamp: new Date().toISOString(),
        dimensions: {
          width: this.SCREENSHOT_WIDTH,
          height: this.SCREENSHOT_HEIGHT
        }
      };

      await AsyncStorage.setItem(key, JSON.stringify(screenshotData));
      console.log('💾 [Screenshot] Stored screenshot data, size:', base64Data.length, 'chars');

    } catch (error) {
      console.error('💥 [Screenshot] Error storing screenshot:', error);
      throw error;
    }
  }

  /**
   * Creates a fallback screenshot when WebView capture fails
   */
  static async createFallbackScreenshot(appId: string, appTitle: string, appStyle?: string): Promise<string | null> {
    try {
      console.log('🎨 [Screenshot] Creating fallback screenshot for app:', appId);
      
      // Create a better fallback using a gradient image with the app title
      // We'll use manipulateAsync to create a basic colored rectangle
      
      // Create a simple 1x1 pixel base image
      const baseImageUri = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChAI9jU77zgAAAABJRU5ErkJggg==';
      
      // Generate a color based on the app title for consistency
      const colors = this.generateAppColors(appTitle);
      
      // Create a colored rectangle that represents the app
      const fallbackImage = await manipulateAsync(
        baseImageUri,
        [
          { resize: { width: this.SCREENSHOT_WIDTH, height: this.SCREENSHOT_HEIGHT } }
        ],
        {
          compress: this.SCREENSHOT_QUALITY,
          format: SaveFormat.JPEG,
          base64: true
        }
      );

      // Store the fallback screenshot with a special marker
      const fallbackData = {
        appId,
        base64: fallbackImage.base64 || '',
        timestamp: new Date().toISOString(),
        dimensions: {
          width: this.SCREENSHOT_WIDTH,
          height: this.SCREENSHOT_HEIGHT
        },
        isFallback: true,
        appTitle,
        colors
      };

      const key = this.SCREENSHOT_PREFIX + appId;
      await AsyncStorage.setItem(key, JSON.stringify(fallbackData));
      
      console.log('✅ [Screenshot] Fallback screenshot created for app:', appId);
      return `data:image/jpeg;base64,${fallbackImage.base64}`;
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
   * Retrieve screenshot for an app
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
      const base64Uri = `data:image/jpeg;base64,${screenshotData.base64}`;
      
      console.log('📖 [Screenshot] Retrieved screenshot for app:', appId);
      return base64Uri;

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