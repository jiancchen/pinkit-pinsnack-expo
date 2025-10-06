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
  async sendMessage(
    messages: ClaudeMessage[],
    options?: {
      model?: string;
      maxTokens?: number;
      temperature?: number;
      stream?: boolean;
    }
  ): Promise<ClaudeResponse> {
    if (!this.isConfigured()) {
      throw new Error('Claude API service is not configured. Please set up your API key.');
    }

    try {
      const request: ClaudeRequest = {
        model: options?.model || this.config!.model,
        max_tokens: options?.maxTokens || this.config!.maxTokens,
        temperature: options?.temperature || this.config!.temperature,
        messages: messages,
        stream: options?.stream || false
      };

      const response: AxiosResponse<ClaudeResponse> = await this.axiosInstance.post(
        '/messages',
        request
      );

      return response.data;
    } catch (error: any) {
      if (error.response?.status === 401) {
        throw new Error('Invalid API key. Please check your Claude API key.');
      } else if (error.response?.status === 429) {
        throw new Error('Rate limit exceeded. Please try again later.');
      } else if (error.response?.status === 400) {
        const apiError: ApiError = error.response.data;
        throw new Error(apiError.error.message || 'Invalid request to Claude API.');
      } else {
        throw new Error('Failed to communicate with Claude API. Please check your connection.');
      }
    }
  }

  /**
   * Generate an app concept using Claude API
   */
  async generateAppConcept(prompt: string): Promise<GeneratedAppConcept> {
    const messages: ClaudeMessage[] = [
      {
        role: 'user',
        content: prompt
      }
    ];

    try {
      const response = await this.sendMessage(messages);
      
      if (response.content && response.content.length > 0) {
        const content = response.content[0].text;
        
        // Extract JSON from the response
        const jsonMatch = content.match(/```json\n([\s\S]*?)\n```/);
        if (jsonMatch) {
          const jsonString = jsonMatch[1];
          const generatedConcept: GeneratedAppConcept = JSON.parse(jsonString);
          return generatedConcept;
        } else {
          // Fallback: try to parse the entire content as JSON
          try {
            const generatedConcept: GeneratedAppConcept = JSON.parse(content);
            return generatedConcept;
          } catch {
            throw new Error('Claude API returned an invalid response format.');
          }
        }
      } else {
        throw new Error('Claude API returned an empty response.');
      }
    } catch (error: any) {
      console.error('Failed to generate app concept:', error);
      if (error.message.includes('JSON')) {
        throw new Error('Failed to parse the app concept from Claude API response.');
      }
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