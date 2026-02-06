import AsyncStorage from '@react-native-async-storage/async-storage';
import { estimateCost as calculateCost } from '../types/ClaudeApi';
import { TokenLogger as log } from '../utils/Logger';

export interface TokenUsage {
  input_tokens: number;
  output_tokens: number;
  timestamp: number;
  model: string;
  appId?: string;
  operation: string; // 'app_generation', 'app_recreation', 'concept_generation', etc.
}

export interface TokenStats {
  totalInputTokens: number;
  totalOutputTokens: number;
  totalTokens: number;
  totalRequests: number;
  usageByModel: Record<string, {
    inputTokens: number;
    outputTokens: number;
    requests: number;
  }>;
  usageByOperation: Record<string, {
    inputTokens: number;
    outputTokens: number;
    requests: number;
  }>;
  recentUsage: TokenUsage[];
}

export class TokenTrackingService {
  private static readonly STORAGE_KEY = 'token_usage_history';
  private static readonly MAX_RECENT_ENTRIES = 100;

  /**
   * Track token usage from Claude API responses
   */
  static async trackTokenUsage(
    inputTokens: number,
    outputTokens: number,
    model: string,
    operation: string,
    appId?: string
  ): Promise<void> {
    try {
      const usage: TokenUsage = {
        input_tokens: inputTokens,
        output_tokens: outputTokens,
        timestamp: Date.now(),
        model,
        operation,
        appId
      };

      log.verbose('Recording token usage:', {
        input: inputTokens,
        output: outputTokens,
        total: inputTokens + outputTokens,
        model,
        operation
      });

      // Get existing usage history
      const existingHistory = await this.getTokenHistory();
      
      // Add new usage
      const updatedHistory = [usage, ...existingHistory];
      
      // Keep only the most recent entries
      const trimmedHistory = updatedHistory.slice(0, this.MAX_RECENT_ENTRIES);
      
      // Save back to storage
      await AsyncStorage.setItem(this.STORAGE_KEY, JSON.stringify(trimmedHistory));
      
      log.debug('Token usage saved successfully');
    } catch (error) {
      log.error('Failed to track token usage:', error);
    }
  }

  /**
   * Get raw token usage history
   */
  static async getTokenHistory(): Promise<TokenUsage[]> {
    try {
      const historyJson = await AsyncStorage.getItem(this.STORAGE_KEY);
      if (!historyJson) {
        return [];
      }
      
      const history = JSON.parse(historyJson) as TokenUsage[];
      return Array.isArray(history) ? history : [];
    } catch (error) {
      log.error('Failed to get token history:', error);
      return [];
    }
  }

  /**
   * Get comprehensive token statistics
   */
  static async getTokenStats(): Promise<TokenStats> {
    try {
      const history = await this.getTokenHistory();
      
      const stats: TokenStats = {
        totalInputTokens: 0,
        totalOutputTokens: 0,
        totalTokens: 0,
        totalRequests: history.length,
        usageByModel: {},
        usageByOperation: {},
        recentUsage: history.slice(0, 20) // Most recent 20 entries
      };

      // Calculate totals and breakdowns
      history.forEach(usage => {
        stats.totalInputTokens += usage.input_tokens;
        stats.totalOutputTokens += usage.output_tokens;
        
        // By model
        if (!stats.usageByModel[usage.model]) {
          stats.usageByModel[usage.model] = {
            inputTokens: 0,
            outputTokens: 0,
            requests: 0
          };
        }
        stats.usageByModel[usage.model].inputTokens += usage.input_tokens;
        stats.usageByModel[usage.model].outputTokens += usage.output_tokens;
        stats.usageByModel[usage.model].requests += 1;
        
        // By operation
        if (!stats.usageByOperation[usage.operation]) {
          stats.usageByOperation[usage.operation] = {
            inputTokens: 0,
            outputTokens: 0,
            requests: 0
          };
        }
        stats.usageByOperation[usage.operation].inputTokens += usage.input_tokens;
        stats.usageByOperation[usage.operation].outputTokens += usage.output_tokens;
        stats.usageByOperation[usage.operation].requests += 1;
      });

      stats.totalTokens = stats.totalInputTokens + stats.totalOutputTokens;
      
      log.verbose('Generated stats:', {
        totalTokens: stats.totalTokens,
        totalRequests: stats.totalRequests,
        modelCount: Object.keys(stats.usageByModel).length
      });

      return stats;
    } catch (error) {
      log.error('Failed to get token stats:', error);
      return {
        totalInputTokens: 0,
        totalOutputTokens: 0,
        totalTokens: 0,
        totalRequests: 0,
        usageByModel: {},
        usageByOperation: {},
        recentUsage: []
      };
    }
  }

  /**
   * Get token usage for a specific app
   */
  static async getAppTokenUsage(appId: string): Promise<TokenUsage[]> {
    try {
      const history = await this.getTokenHistory();
      return history.filter(usage => usage.appId === appId);
    } catch (error) {
      log.error('Failed to get app token usage:', error);
      return [];
    }
  }

  /**
   * Clear all token usage history
   */
  static async clearTokenHistory(): Promise<void> {
    try {
      await AsyncStorage.removeItem(this.STORAGE_KEY);
      log.info('Token history cleared');
    } catch (error) {
      log.error('Failed to clear token history:', error);
    }
  }

  /**
   * Get estimated cost based on token usage (approximate)
   * These are rough estimates and actual costs may vary
   * @deprecated Use estimateCost from ClaudeApi.ts instead
   */
  static estimateCost(inputTokens: number, outputTokens: number, model: string): number {
    return calculateCost(inputTokens, outputTokens, model);
  }

  /**
   * Get total estimated cost for all usage
   */
  static async getTotalEstimatedCost(): Promise<number> {
    try {
      const history = await this.getTokenHistory();
      let totalCost = 0;

      history.forEach(usage => {
        const cost = this.estimateCost(usage.input_tokens, usage.output_tokens, usage.model);
        totalCost += cost;
      });

      return totalCost;
    } catch (error) {
      log.error('Failed to calculate total cost:', error);
      return 0;
    }
  }
}