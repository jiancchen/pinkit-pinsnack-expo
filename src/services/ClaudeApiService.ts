import axios, { AxiosInstance, AxiosResponse } from 'axios';
import { 
  ClaudeRequest, 
  ClaudeResponse, 
  ClaudeApiConfig, 
  ApiError,
  ClaudeMessage 
} from '../types/ClaudeApi';
import { SecureStorageService } from './SecureStorageService';
import { GeneratedAppConcept } from '../types/PromptHistory';

export class ClaudeApiService {
  private static instance: ClaudeApiService;
  private axiosInstance: AxiosInstance;
  private config: ClaudeApiConfig | null = null;

  private constructor() {
    this.axiosInstance = axios.create({
      baseURL: 'https://api.anthropic.com/v1',
      timeout: 60000, // 60 seconds timeout
      headers: {
        'Content-Type': 'application/json',
        'anthropic-version': '2023-06-01'
      }
    });

    // Response interceptor for error handling
    this.axiosInstance.interceptors.response.use(
      (response) => response,
      (error) => {
        console.error('Claude API Error Details:', {
          status: error.response?.status,
          statusText: error.response?.statusText,
          data: error.response?.data,
          url: error.config?.url,
          method: error.config?.method,
          message: error.message
        });
        return Promise.reject(error);
      }
    );
  }

  static getInstance(): ClaudeApiService {
    if (!ClaudeApiService.instance) {
      ClaudeApiService.instance = new ClaudeApiService();
    }
    return ClaudeApiService.instance;
  }

  /**
   * Initialize the service with stored configuration
   */
  async initialize(): Promise<boolean> {
    try {
      this.config = await SecureStorageService.getFullConfig();
      if (this.config) {
        this.axiosInstance.defaults.headers['x-api-key'] = this.config.apiKey;
        return true;
      }
      return false;
    } catch (error) {
      console.error('Failed to initialize Claude API service:', error);
      return false;
    }
  }

  /**
   * Check if the service is properly configured
   */
  isConfigured(): boolean {
    return this.config !== null && this.config.apiKey.length > 0;
  }

  /**
   * Update the API configuration
   */
  async updateConfig(apiKey: string, config?: Partial<ClaudeApiConfig>): Promise<void> {
    try {
      // Store the API key securely
      await SecureStorageService.storeApiKey(apiKey);
      
      // Store additional config if provided
      if (config) {
        const currentConfig = await SecureStorageService.getConfig();
        const newConfig = { ...currentConfig, ...config };
        await SecureStorageService.storeConfig(newConfig);
      }

      // Reinitialize with new config
      await this.initialize();
    } catch (error) {
      console.error('Failed to update configuration:', error);
      throw new Error('Failed to update API configuration');
    }
  }

  /**
   * Send a message to Claude API
   */
  private async sendMessage(
    messages: ClaudeMessage[],
    options: {
      maxTokens: number;
      temperature: number;
    }
  ): Promise<{ content: string }> {
    console.log('📨 [ClaudeAPI] Starting sendMessage');
    console.log('📝 [ClaudeAPI] Messages count:', messages.length);
    console.log('🎯 [ClaudeAPI] Options:', options);
    
    if (!this.config) {
      console.log('❌ [ClaudeAPI] No config available');
      throw new Error('API not configured');
    }

    const requestBody: ClaudeRequest = {
      model: this.config.model,
      max_tokens: options.maxTokens,
      temperature: options.temperature,
      messages
    };
    
    console.log('📦 [ClaudeAPI] Request body prepared:', {
      model: requestBody.model,
      max_tokens: requestBody.max_tokens,
      temperature: requestBody.temperature,
      messagesCount: requestBody.messages.length
    });

    try {
      console.log('🌐 [ClaudeAPI] Making HTTP request to Anthropic API...');
      const response: AxiosResponse<ClaudeResponse> = await this.axiosInstance.post('/messages', requestBody);
      
      console.log('✅ [ClaudeAPI] Received HTTP response');
      console.log('📊 [ClaudeAPI] Response status:', response.status);
      console.log('📊 [ClaudeAPI] Response data keys:', Object.keys(response.data || {}));
      
      if (response.data && response.data.content && response.data.content.length > 0) {
        const contentText = response.data.content[0].text;
        console.log('✅ [ClaudeAPI] Successfully extracted content text');
        console.log('📊 [ClaudeAPI] Content length:', contentText?.length || 0);
        return { content: contentText };
      } else {
        console.error('❌ [ClaudeAPI] Invalid response structure:', response.data);
        throw new Error('Invalid response format from Claude API');
      }
    } catch (error: any) {
      console.error('💥 [ClaudeAPI] HTTP request failed:', {
        message: error?.message,
        status: error?.response?.status,
        statusText: error?.response?.statusText,
        data: error?.response?.data,
        url: error?.config?.url
      });
      throw error;
    }
  }

  /**
   * Generate an app concept using Claude API
   */
  async generateAppConcept(prompt: string): Promise<any> {
    const messages: ClaudeMessage[] = [
      {
        role: 'user',
        content: prompt
      }
    ];

    try {
      const response = await this.sendMessage(messages, {
        maxTokens: this.config!.maxTokens,
        temperature: this.config!.temperature
      });
      
      if (response.content && response.content.length > 0) {
        const content = response.content;
        console.log('📄 [ClaudeAPI] Raw response content:', content.substring(0, 500) + '...');
        
        // Check if this looks like HTML
        if (content.trim().startsWith('<!DOCTYPE html>') || content.trim().startsWith('<html')) {
          console.log('✅ [ClaudeAPI] Received HTML response');
          
          // Extract app title and category from data-app-title attribute (format: "Title | Category")
          const titleMatch = content.match(/data-app-title="([^"]*)"/i);
          const fullTitle = titleMatch ? titleMatch[1] : 'Generated App';
          
          // Parse title and category
          let appTitle = fullTitle;
          let appCategory = 'utility'; // default category
          
          if (fullTitle.includes(' | ')) {
            const parts = fullTitle.split(' | ');
            if (parts.length >= 2) {
              appTitle = parts[0].trim();
              const extractedCategory = parts[1].trim().toLowerCase();
              
              // Validate category
              const validCategories = [
                'utility', 'fun', 'productivity', 'entertainment', 'education', 
                'health', 'finance', 'social', 'travel', 'shopping', 'games', 
                'tools', 'lifestyle', 'business', 'creative', 'other'
              ];
              
              if (validCategories.includes(extractedCategory)) {
                appCategory = extractedCategory;
              }
            }
          }
          
          console.log('🏷️ [ClaudeAPI] Extracted app title:', appTitle);
          console.log('📂 [ClaudeAPI] Extracted app category:', appCategory);
          
          // Extract external libraries used
          const libMatches = content.match(/<(?:script|link)[^>]*(?:src|href)="([^"]*(?:cdnjs|jsdelivr|fonts\.googleapis)[^"]*)"/gi) || [];
          const externalLibs = libMatches.map(match => {
            const urlMatch = match.match(/(?:src|href)="([^"]*)"/i);
            if (urlMatch) {
              // Extract library name from URL
              const url = urlMatch[1];
              if (url.includes('three.js')) return 'Three.js';
              if (url.includes('chart.js')) return 'Chart.js';
              if (url.includes('d3')) return 'D3.js';
              if (url.includes('tone.js')) return 'Tone.js';
              if (url.includes('math.js')) return 'Math.js';
              if (url.includes('bootstrap')) return 'Bootstrap CSS';
              if (url.includes('fonts.googleapis')) return 'Google Fonts';
              return url.split('/').pop()?.split('.')[0] || 'Unknown Library';
            }
            return 'Unknown Library';
          });
          
          console.log('📚 [ClaudeAPI] Detected external libraries:', externalLibs);
          
          return {
            name: appTitle,
            category: appCategory,
            html: content,
            external_libs_used: externalLibs
          };
        }

        
        // If we get here, it's not valid HTML
        console.error('❌ [ClaudeAPI] Response is not valid HTML');
        console.log('📄 [ClaudeAPI] Full response for debugging:', content);
        throw new Error('Claude API did not return valid HTML.');
      } else {
        throw new Error('Claude API returned an empty response.');
      }
    } catch (error: any) {
      console.error('💥 [ClaudeAPI] Failed to generate app concept:', error);
      throw error;
    }
  }

  /**
   * Test the API connection and configuration
   */
  async testConnection(): Promise<{ success: boolean; message: string }> {
    if (!this.isConfigured()) {
      return {
        success: false,
        message: 'API key not configured'
      };
    }

    try {
      const testMessages: ClaudeMessage[] = [
        {
          role: 'user',
          content: 'Hello! Please respond with just "Connection successful" to test the API.'
        }
      ];

      const response = await this.sendMessage(testMessages, {
        maxTokens: 50,
        temperature: 0
      });

      if (response.content && response.content.length > 0) {
        return {
          success: true,
          message: 'Connection successful'
        };
      } else {
        return {
          success: false,
          message: 'Empty response from API'
        };
      }
    } catch (error: any) {
      const errorMessage = error.response?.data?.error?.message || 
                          error.response?.statusText || 
                          error.message || 
                          'Connection failed';
      
      console.error('Test connection failed:', {
        status: error.response?.status,
        statusText: error.response?.statusText,
        data: error.response?.data,
        message: error.message
      });

      return {
        success: false,
        message: `Connection failed: ${errorMessage}`
      };
    }
  }

  /**
   * Get current configuration (without API key)
   */
  getCurrentConfig(): Omit<ClaudeApiConfig, 'apiKey'> | null {
    if (!this.config) {
      return null;
    }

    return {
      model: this.config.model,
      maxTokens: this.config.maxTokens,
      temperature: this.config.temperature
    };
  }

  /**
   * Clear the configuration and sign out
   */
  async signOut(): Promise<void> {
    try {
      await SecureStorageService.clearAll();
      this.config = null;
      delete this.axiosInstance.defaults.headers['x-api-key'];
    } catch (error) {
      console.error('Failed to sign out:', error);
      throw new Error('Failed to clear stored configuration');
    }
  }
}