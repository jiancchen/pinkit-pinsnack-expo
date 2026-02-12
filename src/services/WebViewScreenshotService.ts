/**
 * WebView Screenshot Service - Captures screenshots from within the WebView using JavaScript
 * This bypasses React Native's external screenshot limitations by capturing DOM content directly
 */

import AsyncStorage from '@react-native-async-storage/async-storage';
import { manipulateAsync, SaveFormat } from 'expo-image-manipulator';
import { createLogger } from '../utils/Logger';

const log = createLogger('WebViewScreenshot');

export class WebViewScreenshotService {
  private static readonly SCREENSHOT_PREFIX = 'webview_screenshot_';
  private static readonly SCREENSHOT_WIDTH = 400;
  private static readonly SCREENSHOT_HEIGHT = 600;
  private static readonly SCREENSHOT_QUALITY = 0.7;

  /**
   * Generate JavaScript code to inject into WebView for screenshot capture
   */
  static generateScreenshotScript(appId: string): string {
    const debugLogging = __DEV__;
    return `
      (function() {
        const DEBUG = ${debugLogging ? 'true' : 'false'};
        const debugLog = (...args) => { if (DEBUG) console.log(...args); };
        const debugWarn = (...args) => { if (DEBUG) console.warn(...args); };

        debugLog('🎯 [WebView] Screenshot script loaded for app: ${appId}');
        
        // Function to capture screenshot using canvas
        function captureWebViewScreenshot() {
          try {
            debugLog('📸 [WebView] Starting DOM screenshot capture...');
            
            // Create a canvas element
            const canvas = document.createElement('canvas');
            const ctx = canvas.getContext('2d');
            
            if (!ctx) {
              throw new Error('Could not get canvas context');
            }
            
            // Set canvas size to match viewport
            const rect = document.documentElement.getBoundingClientRect();
            canvas.width = Math.max(rect.width, window.innerWidth);
            canvas.height = Math.max(rect.height, window.innerHeight);
            
            debugLog('📐 [WebView] Canvas size:', canvas.width, 'x', canvas.height);
            
            // Try to capture the current state of the document
            // Method 1: Try html2canvas if available
            if (window.html2canvas) {
              debugLog('🎨 [WebView] Using html2canvas method');
              window.html2canvas(document.body).then(function(canvas) {
                const dataURL = canvas.toDataURL('image/png', 0.8);
                window.ReactNativeWebView.postMessage(JSON.stringify({
                  type: 'screenshot_captured',
                  appId: '${appId}',
                  dataURL: dataURL,
                  method: 'html2canvas'
                }));
              }).catch(function(error) {
                console.error('❌ [WebView] html2canvas failed:', error);
                fallbackScreenshot();
              });
            } else {
              // Method 2: Manual canvas rendering fallback
              debugLog('🔧 [WebView] Using manual canvas method');
              fallbackScreenshot();
            }
            
            function fallbackScreenshot() {
              // Create a simple screenshot representation
              ctx.fillStyle = getComputedStyle(document.body).backgroundColor || '#ffffff';
              ctx.fillRect(0, 0, canvas.width, canvas.height);
              
              // Try to capture visible text content
              const textElements = document.querySelectorAll('h1, h2, h3, h4, h5, h6, p, div, span');
              ctx.fillStyle = '#333333';
              ctx.font = '16px Arial, sans-serif';
              
              let yPosition = 50;
              for (let i = 0; i < Math.min(textElements.length, 10); i++) {
                const element = textElements[i];
                const text = element.textContent?.trim().substring(0, 50);
                if (text && text.length > 3) {
                  ctx.fillText(text, 20, yPosition);
                  yPosition += 25;
                }
              }
              
              // Add app title
              ctx.font = 'bold 20px Arial, sans-serif';
              ctx.fillStyle = '#000000';
              ctx.fillText('${appId}', 20, 25);
              
              const dataURL = canvas.toDataURL('image/png', 0.8);
              
              window.ReactNativeWebView.postMessage(JSON.stringify({
                type: 'screenshot_captured',
                appId: '${appId}',
                dataURL: dataURL,
                method: 'fallback'
              }));
              
              debugLog('✅ [WebView] Fallback screenshot captured');
            }
            
          } catch (error) {
            console.error('💥 [WebView] Screenshot capture failed:', error);
            window.ReactNativeWebView.postMessage(JSON.stringify({
              type: 'screenshot_error',
              appId: '${appId}',
              error: error.message
            }));
          }
        }
        
        // Load html2canvas library dynamically
        function loadHtml2Canvas() {
          if (window.html2canvas) {
            captureWebViewScreenshot();
            return;
          }
          
          const script = document.createElement('script');
          script.src = 'https://cdn.jsdelivr.net/npm/html2canvas@1.4.1/dist/html2canvas.min.js';
          script.onload = function() {
            debugLog('✅ [WebView] html2canvas loaded successfully');
            setTimeout(captureWebViewScreenshot, 100);
          };
          script.onerror = function() {
            debugWarn('⚠️ [WebView] html2canvas failed to load, using fallback');
            captureWebViewScreenshot();
          };
          document.head.appendChild(script);
        }
        
        // Wait for page to be fully loaded
        if (document.readyState === 'complete') {
          setTimeout(loadHtml2Canvas, 500);
        } else {
          window.addEventListener('load', function() {
            setTimeout(loadHtml2Canvas, 500);
          });
        }
        
      })();
    `;
  }

  /**
   * Process screenshot data received from WebView
   */
  static async processWebViewScreenshot(
    appId: string, 
    dataURL: string, 
    method: string
  ): Promise<string | null> {
    try {
      log.debug(`Processing ${method} screenshot for app:`, appId);
      
      // Convert data URL to processable format
      if (!dataURL.startsWith('data:image/')) {
        throw new Error('Invalid data URL format');
      }

      // Process the image: resize and compress
      const processedImage = await manipulateAsync(
        dataURL,
        [
          {
            resize: {
              width: this.SCREENSHOT_WIDTH,
              height: this.SCREENSHOT_HEIGHT,
            }
          }
        ],
        {
          compress: this.SCREENSHOT_QUALITY,
          format: SaveFormat.JPEG,
          base64: true
        }
      );

      if (!processedImage.base64) {
        throw new Error('Failed to process image to base64');
      }

      // Store the screenshot
      await this.storeWebViewScreenshot(appId, processedImage.base64, method);
      
      const resultDataURL = `data:image/jpeg;base64,${processedImage.base64}`;
      log.debug('Processed and stored screenshot for app:', appId);
      
      return resultDataURL;

    } catch (error) {
      log.error('Processing failed:', error);
      return null;
    }
  }

  /**
   * Store WebView screenshot in AsyncStorage
   */
  private static async storeWebViewScreenshot(
    appId: string, 
    base64Data: string, 
    method: string
  ): Promise<void> {
    try {
      const key = this.SCREENSHOT_PREFIX + appId;
      const screenshotData = {
        appId,
        base64: base64Data,
        timestamp: new Date().toISOString(),
        method,
        dimensions: {
          width: this.SCREENSHOT_WIDTH,
          height: this.SCREENSHOT_HEIGHT
        },
        source: 'webview_js'
      };

      await AsyncStorage.setItem(key, JSON.stringify(screenshotData));
      log.debug('Stored screenshot data, method:', method, 'size:', base64Data.length, 'chars');

    } catch (error) {
      log.error('Error storing screenshot:', error);
      throw error;
    }
  }

  /**
   * Retrieve WebView screenshot for an app
   */
  static async getWebViewScreenshot(appId: string): Promise<string | null> {
    try {
      const key = this.SCREENSHOT_PREFIX + appId;
      const data = await AsyncStorage.getItem(key);
      
      if (!data) {
        log.debug('No screenshot found for app:', appId);
        return null;
      }

      const screenshotData = JSON.parse(data);
      const base64Uri = `data:image/jpeg;base64,${screenshotData.base64}`;
      
      log.debug('Retrieved screenshot for app:', appId, 'method:', screenshotData.method);
      return base64Uri;

    } catch (error) {
      log.error('Error retrieving screenshot:', error);
      return null;
    }
  }

  /**
   * Delete WebView screenshot for an app
   */
  static async deleteWebViewScreenshot(appId: string): Promise<void> {
    try {
      const key = this.SCREENSHOT_PREFIX + appId;
      await AsyncStorage.removeItem(key);
      log.debug('Deleted screenshot for app:', appId);
    } catch (error) {
      log.error('Error deleting screenshot:', error);
    }
  }

  static async getStorageStats(): Promise<{
    totalScreenshots: number;
    estimatedSizeKB: number;
  }> {
    try {
      const allKeys = await AsyncStorage.getAllKeys();
      const screenshotKeys = allKeys.filter((key) => key.startsWith(this.SCREENSHOT_PREFIX));

      let totalSize = 0;
      for (const key of screenshotKeys.slice(0, 5)) {
        const data = await AsyncStorage.getItem(key);
        if (data) {
          totalSize += data.length;
        }
      }

      const avgSize = screenshotKeys.length > 0 ? totalSize / Math.min(5, screenshotKeys.length) : 0;
      const estimatedTotalSize = avgSize * screenshotKeys.length;

      return {
        totalScreenshots: screenshotKeys.length,
        estimatedSizeKB: Math.round(estimatedTotalSize / 1024),
      };
    } catch (error) {
      log.error('Error getting storage stats:', error);
      return { totalScreenshots: 0, estimatedSizeKB: 0 };
    }
  }
}
