import AsyncStorage from '@react-native-async-storage/async-storage';

/**
 * Service for handling WebView app data storage with unlimited size
 * Replaces localStorage limitations with React Native AsyncStorage
 */
export class AsyncStorageService {
  private static readonly WEBVIEW_STORAGE_PREFIX = 'webview_storage_';

  /**
   * Store data for a WebView app
   */
  static async setItem(key: string, value: string): Promise<void> {
    try {
      const storageKey = this.WEBVIEW_STORAGE_PREFIX + key;
      await AsyncStorage.setItem(storageKey, value);
      console.log('💾 AsyncStorage.setItem:', key, 'size:', value.length);
    } catch (error) {
      console.error('Failed to store WebView data:', error);
      throw error;
    }
  }

  /**
   * Retrieve data for a WebView app
   */
  static async getItem(key: string): Promise<string | null> {
    try {
      const storageKey = this.WEBVIEW_STORAGE_PREFIX + key;
      const value = await AsyncStorage.getItem(storageKey);
      console.log('📖 AsyncStorage.getItem:', key, 'found:', value !== null);
      return value;
    } catch (error) {
      console.error('Failed to retrieve WebView data:', error);
      return null;
    }
  }

  /**
   * Remove data for a WebView app
   */
  static async removeItem(key: string): Promise<void> {
    try {
      const storageKey = this.WEBVIEW_STORAGE_PREFIX + key;
      await AsyncStorage.removeItem(storageKey);
      console.log('🗑️ AsyncStorage.removeItem:', key);
    } catch (error) {
      console.error('Failed to remove WebView data:', error);
    }
  }

  /**
   * Clear all data for a specific app
   */
  static async clearAppData(appId: string): Promise<void> {
    try {
      const allKeys = await AsyncStorage.getAllKeys();
      const appKeys = allKeys.filter(key => 
        key.startsWith(this.WEBVIEW_STORAGE_PREFIX + appId + '_')
      );
      
      if (appKeys.length > 0) {
        await AsyncStorage.multiRemove(appKeys);
        console.log('🧹 Cleared', appKeys.length, 'storage items for app:', appId);
      }
    } catch (error) {
      console.error('Failed to clear app data:', error);
    }
  }

  /**
   * Get storage usage statistics
   */
  static async getStorageStats(): Promise<{
    totalKeys: number;
    webViewKeys: number;
    estimatedSize: number;
  }> {
    try {
      const allKeys = await AsyncStorage.getAllKeys();
      const webViewKeys = allKeys.filter(key => 
        key.startsWith(this.WEBVIEW_STORAGE_PREFIX)
      );

      // Estimate size by sampling some values
      let estimatedSize = 0;
      const sampleKeys = webViewKeys.slice(0, Math.min(10, webViewKeys.length));
      
      for (const key of sampleKeys) {
        const value = await AsyncStorage.getItem(key);
        if (value) {
          estimatedSize += key.length + value.length;
        }
      }

      // Extrapolate total size
      const totalEstimatedSize = webViewKeys.length > 0 
        ? (estimatedSize / sampleKeys.length) * webViewKeys.length 
        : 0;

      return {
        totalKeys: allKeys.length,
        webViewKeys: webViewKeys.length,
        estimatedSize: totalEstimatedSize
      };
    } catch (error) {
      console.error('Failed to get storage stats:', error);
      return { totalKeys: 0, webViewKeys: 0, estimatedSize: 0 };
    }
  }

  /**
   * Clean up old or large storage items
   */
  static async cleanup(maxSizeBytes: number = 50 * 1024 * 1024): Promise<void> {
    try {
      const stats = await this.getStorageStats();
      
      if (stats.estimatedSize > maxSizeBytes) {
        console.warn('WebView storage approaching limits, cleaning up...');
        
        const allKeys = await AsyncStorage.getAllKeys();
        const webViewKeys = allKeys.filter(key => 
          key.startsWith(this.WEBVIEW_STORAGE_PREFIX)
        );

        // Remove oldest items (simple strategy: remove first alphabetically)
        const keysToRemove = webViewKeys.slice(0, Math.floor(webViewKeys.length * 0.1));
        await AsyncStorage.multiRemove(keysToRemove);
        
        console.log('🧽 Cleaned up', keysToRemove.length, 'storage items');
      }
    } catch (error) {
      console.error('Failed to cleanup storage:', error);
    }
  }
}