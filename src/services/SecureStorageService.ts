import * as SecureStore from 'expo-secure-store';
import { ClaudeApiConfig, DEFAULT_CONFIG, resolveSupportedClaudeModel } from '../types/ClaudeApi';

const API_KEY_STORAGE_KEY = 'claude_api_key';
const CONFIG_STORAGE_KEY = 'claude_api_config';

export class SecureStorageService {
  /**
   * Store the Claude API key securely
   */
  static async storeApiKey(apiKey: string): Promise<void> {
    try {
      await SecureStore.setItemAsync(API_KEY_STORAGE_KEY, apiKey);
    } catch (error) {
      console.error('Failed to store API key:', error);
      throw new Error('Failed to save API key securely');
    }
  }

  /**
   * Retrieve the stored Claude API key
   */
  static async getApiKey(): Promise<string | null> {
    try {
      const apiKey = await SecureStore.getItemAsync(API_KEY_STORAGE_KEY);
      return apiKey;
    } catch (error) {
      console.error('Failed to retrieve API key:', error);
      return null;
    }
  }

  /**
   * Remove the stored API key
   */
  static async removeApiKey(): Promise<void> {
    try {
      await SecureStore.deleteItemAsync(API_KEY_STORAGE_KEY);
    } catch (error) {
      console.error('Failed to remove API key:', error);
      throw new Error('Failed to remove API key');
    }
  }

  /**
   * Check if an API key is stored
   */
  static async hasApiKey(): Promise<boolean> {
    try {
      const apiKey = await SecureStore.getItemAsync(API_KEY_STORAGE_KEY);
      return apiKey !== null && apiKey.length > 0;
    } catch (error) {
      console.error('Failed to check API key:', error);
      return false;
    }
  }

  /**
   * Store the Claude API configuration
   */
  static async storeConfig(config: Omit<ClaudeApiConfig, 'apiKey'>): Promise<void> {
    try {
      await SecureStore.setItemAsync(CONFIG_STORAGE_KEY, JSON.stringify(config));
    } catch (error) {
      console.error('Failed to store config:', error);
      throw new Error('Failed to save configuration');
    }
  }

  /**
   * Retrieve the stored Claude API configuration
   */
  static async getConfig(): Promise<Omit<ClaudeApiConfig, 'apiKey'>> {
    try {
      const configString = await SecureStore.getItemAsync(CONFIG_STORAGE_KEY);
      if (configString) {
        const parsed = JSON.parse(configString) as Partial<Omit<ClaudeApiConfig, 'apiKey'>>;
        const model = resolveSupportedClaudeModel(typeof parsed.model === 'string' ? parsed.model : undefined);
        const maxTokens = typeof parsed.maxTokens === 'number' ? parsed.maxTokens : DEFAULT_CONFIG.maxTokens;
        const temperature = typeof parsed.temperature === 'number' ? parsed.temperature : DEFAULT_CONFIG.temperature;

        return { model, maxTokens, temperature };
      }
      return DEFAULT_CONFIG;
    } catch (error) {
      console.error('Failed to retrieve config:', error);
      return DEFAULT_CONFIG;
    }
  }

  /**
   * Get the complete API configuration including the API key
   */
  static async getFullConfig(): Promise<ClaudeApiConfig | null> {
    try {
      const apiKey = await this.getApiKey();
      if (!apiKey) {
        return null;
      }

      const config = await this.getConfig();
      return {
        ...config,
        apiKey
      };
    } catch (error) {
      console.error('Failed to get full config:', error);
      return null;
    }
  }

  /**
   * Clear all stored data
   */
  static async clearAll(): Promise<void> {
    try {
      await Promise.all([
        SecureStore.deleteItemAsync(API_KEY_STORAGE_KEY),
        SecureStore.deleteItemAsync(CONFIG_STORAGE_KEY)
      ]);
    } catch (error) {
      console.error('Failed to clear all data:', error);
      throw new Error('Failed to clear stored data');
    }
  }

  /**
   * Validate an API key format (basic validation)
   */
  static validateApiKey(apiKey: string): boolean {
    // Claude API keys start with 'sk-ant-' and are typically 100+ characters
    return apiKey.startsWith('sk-ant-') && apiKey.length >= 50;
  }
}
