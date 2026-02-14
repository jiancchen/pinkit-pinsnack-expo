import axios, { AxiosInstance, AxiosResponse } from 'axios';
import { 
  ClaudeRequest, 
  ClaudeResponse, 
  ClaudeApiConfig, 
  ApiError,
  ClaudeMessage,
  clampMaxOutputTokens,
  clampTemperature,
  resolveSupportedClaudeModel,
} from '../types/ClaudeApi';
import { SecureStorageService } from './SecureStorageService';
import { GeneratedAppConcept } from '../types/PromptHistory';
import { TokenTrackingService } from './TokenTrackingService';
import { ApiLogger as log } from '../utils/Logger';

export class ClaudeApiService {
  private static instance: ClaudeApiService;
  private axiosInstance: AxiosInstance;
  private config: ClaudeApiConfig | null = null;

  private normalizeHtmlResponse(raw: string): string {
    let content = raw.trim();

    // If Claude wraps HTML in Markdown code fences, strip them.
    if (content.startsWith('```')) {
      content = content.replace(/^```[a-zA-Z0-9_-]*\s*\n/, '').trim();
      content = content.replace(/```[\s]*$/, '').trim();
    }

    const lower = content.toLowerCase();
    const doctypeIndex = lower.indexOf('<!doctype html');
    const htmlIndex = lower.indexOf('<html');
    const startIndex = doctypeIndex !== -1 ? doctypeIndex : htmlIndex;

    if (startIndex > 0) {
      content = content.slice(startIndex).trim();
    }

    const endIndex = content.toLowerCase().lastIndexOf('</html>');
    if (endIndex !== -1) {
      content = content.slice(0, endIndex + '</html>'.length).trim();
    }

    return content;
  }

  private normalizeJsonResponse(raw: string): string {
    let content = raw.trim();

    if (content.startsWith('```')) {
      content = content.replace(/^```[a-zA-Z0-9_-]*\s*\n/, '').trim();
      content = content.replace(/```[\s]*$/, '').trim();
    }

    const firstBrace = content.indexOf('{');
    const lastBrace = content.lastIndexOf('}');
    if (firstBrace !== -1 && lastBrace !== -1 && lastBrace > firstBrace) {
      content = content.slice(firstBrace, lastBrace + 1).trim();
    }

    return content;
  }

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
        log.error('Claude API Error Details:', {
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
      log.error('Failed to initialize Claude API service:', error);
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
        const merged = { ...currentConfig, ...config };
        const model = resolveSupportedClaudeModel(typeof merged.model === 'string' ? merged.model : undefined);
        const maxTokens = clampMaxOutputTokens(model, merged.maxTokens as number);
        const temperature = clampTemperature(merged.temperature as number);
        await SecureStorageService.storeConfig({ model, maxTokens, temperature });
      }

      // Reinitialize with new config
      await this.initialize();
    } catch (error) {
      log.error('Failed to update configuration:', error);
      throw new Error('Failed to update API configuration');
    }
  }

  /**
   * Send a message to Claude API
   */
  private async sendMessage(
    messages: ClaudeMessage[],
    options: {
      maxTokens?: number;
      temperature?: number;
      model?: string;
      operation?: string;
      appId?: string;
    }
  ): Promise<{ content: string }> {
    log.debug('Starting sendMessage');
    log.verbose('Messages count:', messages.length);
    log.verbose('Options:', options);
    
    if (!this.config) {
      log.error('No config available');
      throw new Error('API not configured');
    }

    const resolvedModel = resolveSupportedClaudeModel(options.model || this.config.model);
    const resolvedMaxTokens = clampMaxOutputTokens(resolvedModel, options.maxTokens ?? this.config.maxTokens);
    const resolvedTemperature = clampTemperature(options.temperature ?? this.config.temperature);

    const requestBody: ClaudeRequest = {
      model: resolvedModel,
      max_tokens: resolvedMaxTokens,
      temperature: resolvedTemperature,
      messages
    };
    
    log.verbose('Request body prepared:', {
      model: requestBody.model,
      max_tokens: requestBody.max_tokens,
      temperature: requestBody.temperature,
      messagesCount: requestBody.messages.length
    });

    try {
      log.debug('Making HTTP request to Anthropic API...');
      const response: AxiosResponse<ClaudeResponse> = await this.axiosInstance.post('/messages', requestBody);
      
      log.debug('Received HTTP response');
      log.verbose('Response status:', response.status);
      log.verbose('Response data keys:', Object.keys(response.data || {}));
      
      if (response.data && response.data.content && response.data.content.length > 0) {
        const contentText = response.data.content[0].text;
        log.debug('Successfully extracted content text');
        log.verbose('Content length:', contentText?.length || 0);
        
        // Track token usage if available
        if (response.data.usage) {
          log.verbose('Token usage:', response.data.usage);
          await TokenTrackingService.trackTokenUsage(
            response.data.usage.input_tokens,
            response.data.usage.output_tokens,
            resolvedModel,
            options.operation || 'api_call',
            options.appId
          ).catch(err => log.warn('Failed to track tokens:', err));
        }
        
        return { content: contentText };
      } else {
        log.error('Invalid response structure:', response.data);
        throw new Error('Invalid response format from Claude API');
      }
    } catch (error: any) {
      log.error('HTTP request failed:', {
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
  async generateAppConcept(
    prompt: string,
    options?: {
      model?: string;
      maxTokens?: number;
      temperature?: number;
      operation?: string;
      appId?: string;
    }
  ): Promise<any> {
    const messages: ClaudeMessage[] = [
      {
        role: 'user',
        content: prompt
      }
    ];

    try {
      const response = await this.sendMessage(messages, {
        model: options?.model,
        maxTokens: options?.maxTokens,
        temperature: options?.temperature,
        operation: options?.operation || 'app_generation',
        appId: options?.appId
      });
      
      if (response.content && response.content.length > 0) {
        const rawContent = response.content;
        const content = this.normalizeHtmlResponse(rawContent);
        log.verbose('Response content preview:', content.substring(0, 500) + '...');
        
        // Check if this looks like HTML
        const trimmed = content.trim();
        const trimmedLower = trimmed.toLowerCase();
        if (trimmedLower.startsWith('<!doctype html>') || trimmedLower.startsWith('<html')) {
          log.debug('Received HTML response');
          
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
          
          log.info('Extracted app title:', appTitle);
          log.info('Extracted app category:', appCategory);
          
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
          
          log.verbose('Detected external libraries:', externalLibs);
          
          return {
            name: appTitle,
            category: appCategory,
            html: content,
            external_libs_used: externalLibs
          };
        }

        
        // If we get here, it's not valid HTML
        log.error('Response is not valid HTML');
        log.debug('Full response for debugging (raw):', rawContent);
        log.debug('Full response for debugging (normalized):', content);
        throw new Error('Claude API did not return valid HTML.');
      } else {
        throw new Error('Claude API returned an empty response.');
      }
    } catch (error: any) {
      log.error('Failed to generate app concept:', error);
      throw error;
    }
  }

  async classifyProjectTopics(args: {
    title: string;
    description: string;
    prompt: string;
    category: string;
    style: string;
    htmlSnippet: string;
    taxonomy: string[];
    model?: string;
    appId?: string;
  }): Promise<{
    topics: string[];
    primaryTopic: string;
    confidence: number;
    summary?: string;
    model?: string;
  }> {
    const taxonomy = args.taxonomy.join(', ');
    const model = resolveSupportedClaudeModel(args.model || this.config?.model);

    const messages: ClaudeMessage[] = [
      {
        role: 'user',
        content:
          `You classify app projects into high-level topics.\n` +
          `Return JSON only with keys: primaryTopic, topics, confidence, summary.\n` +
          `Constraints:\n` +
          `- primaryTopic must be one of: ${taxonomy}\n` +
          `- topics must be an array of 1-4 unique values from the same taxonomy\n` +
          `- confidence must be a number between 0 and 1\n` +
          `- summary must be <= 160 characters\n\n` +
          `Project:\n` +
          `title: ${args.title}\n` +
          `description: ${args.description}\n` +
          `prompt: ${args.prompt}\n` +
          `category: ${args.category}\n` +
          `style: ${args.style}\n` +
          `htmlSnippet: ${args.htmlSnippet}\n`,
      },
    ];

    const response = await this.sendMessage(messages, {
      model,
      maxTokens: 300,
      temperature: 0,
      operation: 'project_topic_classification',
      appId: args.appId,
    });

    const normalized = this.normalizeJsonResponse(response.content);
    const parsed = JSON.parse(normalized) as Partial<{
      primaryTopic: string;
      topics: string[];
      confidence: number;
      summary: string;
    }>;

    const allowed = new Set(args.taxonomy.map((topic) => topic.toLowerCase()));
    const primaryTopic = (parsed.primaryTopic || '').toLowerCase().trim();
    const parsedTopics = Array.isArray(parsed.topics)
      ? parsed.topics.map((topic) => String(topic).toLowerCase().trim()).filter((topic) => allowed.has(topic))
      : [];
    const normalizedPrimary = allowed.has(primaryTopic) ? primaryTopic : parsedTopics[0];
    const topics = [...new Set([normalizedPrimary, ...parsedTopics].filter(Boolean))].slice(0, 4);

    if (!normalizedPrimary || topics.length === 0) {
      throw new Error('Claude topic classification returned invalid taxonomy values');
    }

    return {
      primaryTopic: normalizedPrimary,
      topics,
      confidence:
        typeof parsed.confidence === 'number' && Number.isFinite(parsed.confidence)
          ? Math.max(0, Math.min(1, parsed.confidence))
          : 0.65,
      summary: typeof parsed.summary === 'string' ? parsed.summary.trim().slice(0, 160) : undefined,
      model,
    };
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
        temperature: 0,
        operation: 'connection_test'
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
      
      log.error('Test connection failed:', {
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
      log.error('Failed to sign out:', error);
      throw new Error('Failed to clear stored configuration');
    }
  }
}
