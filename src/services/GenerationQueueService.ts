import AsyncStorage from '@react-native-async-storage/async-storage';
import { AppStorageService } from './AppStorageService';
import { ClaudeApiService } from './ClaudeApiService';
import { PromptGenerator, AppGenerationRequest } from './PromptGenerator';
import { PromptHistoryService } from './PromptHistoryService';
import { createLogger } from '../utils/Logger';
import {
  clampMaxOutputTokens,
  clampTemperature,
  estimateCost,
  estimateTokensFromText,
  resolveSupportedClaudeModel,
} from '../types/ClaudeApi';
import { NotificationService } from './NotificationService';
import { emitGenerationQueueUpdated } from '../stores/GenerationStatusStore';

const log = createLogger('GenerationQueue');

const QUEUE_STORAGE_KEY = 'generation_queue_v1';

export type GenerationJobStatus = 'queued' | 'running' | 'completed' | 'failed' | 'canceled';

export interface GenerationJob {
  id: string;
  appId: string;
  createdAt: number;
  updatedAt: number;
  status: GenerationJobStatus;
  request: AppGenerationRequest;
  generatedPrompt: string;
  model: string;
  maxTokens: number;
  temperature: number;
  estimatedInputTokens: number;
  estimatedMaxCostUsd: number;
  errorMessage?: string;
}

type EnqueueOptions = {
  model?: string;
  maxTokens?: number;
  temperature?: number;
};

function createJobId(): string {
  return `job_${Date.now()}_${Math.random().toString(36).slice(2, 10)}`;
}

export class GenerationQueueService {
  private static workerRunning = false;
  private static writeLock: Promise<void> = Promise.resolve();

  private static async withWriteLock<T>(fn: () => Promise<T>): Promise<T> {
    const previous = this.writeLock;
    let release!: () => void;
    this.writeLock = new Promise<void>((resolve) => {
      release = resolve;
    });

    await previous;
    try {
      return await fn();
    } finally {
      release();
    }
  }

  private static async readQueue(): Promise<GenerationJob[]> {
    try {
      const raw = await AsyncStorage.getItem(QUEUE_STORAGE_KEY);
      if (!raw) return [];
      const parsed = JSON.parse(raw);
      return Array.isArray(parsed) ? (parsed as GenerationJob[]) : [];
    } catch (error) {
      log.warn('Failed to read queue:', error);
      return [];
    }
  }

  private static async writeQueue(queue: GenerationJob[]): Promise<void> {
    await AsyncStorage.setItem(QUEUE_STORAGE_KEY, JSON.stringify(queue));
  }

  static async getJobs(): Promise<GenerationJob[]> {
    return await this.readQueue();
  }

  static async enqueue(
    request: AppGenerationRequest,
    options: EnqueueOptions = {}
  ): Promise<GenerationJob> {
    const model = resolveSupportedClaudeModel(options.model);
    const maxTokens = clampMaxOutputTokens(model, options.maxTokens ?? Number.NaN);
    const temperature = clampTemperature(options.temperature ?? Number.NaN);

    const generatedPrompt = PromptGenerator.generatePrompt(request, { maxOutputTokens: maxTokens });
    const estimatedInputTokens = estimateTokensFromText(generatedPrompt);
    const estimatedMaxCostUsd = estimateCost(estimatedInputTokens, maxTokens, model);

    const savedApp = await AppStorageService.saveApp(request, undefined, undefined, model, generatedPrompt);
    await AppStorageService.updateApp(savedApp.id, { status: 'generating' });
    try {
      await PromptHistoryService.add(request);
    } catch (error) {
      log.warn('Failed to save prompt history:', error);
    }

    const now = Date.now();
    const job: GenerationJob = {
      id: createJobId(),
      appId: savedApp.id,
      createdAt: now,
      updatedAt: now,
      status: 'queued',
      request,
      generatedPrompt,
      model,
      maxTokens,
      temperature,
      estimatedInputTokens,
      estimatedMaxCostUsd,
    };

    await this.withWriteLock(async () => {
      const queue = await this.readQueue();
      const nextQueue = [job, ...queue];
      await this.writeQueue(nextQueue);
      emitGenerationQueueUpdated(nextQueue);
    });

    log.info('Enqueued job', { jobId: job.id, appId: job.appId, model, maxTokens });

    // Kick worker in background (don’t await).
    void this.startWorker();

    return job;
  }

  static async startWorker(): Promise<void> {
    if (this.workerRunning) return;
    this.workerRunning = true;

    try {
      // Keep the UI in sync with any persisted queue on app start.
      emitGenerationQueueUpdated(await this.readQueue());

      // Recover jobs left in "running" (e.g., app killed mid-generation).
      await this.withWriteLock(async () => {
        const queue = await this.readQueue();
        const hasStuckRunning = queue.some((j) => j.status === 'running');
        if (!hasStuckRunning) return;

        const recoveredQueue = queue.map((j) =>
          j.status === 'running' ? { ...j, status: 'queued' as const, updatedAt: Date.now() } : j
        );
        await this.writeQueue(recoveredQueue);
        emitGenerationQueueUpdated(recoveredQueue);
      });

      while (true) {
        const nextJob = await this.withWriteLock(async () => {
          const queue = await this.readQueue();
          const queuedJobs = queue.filter((j) => j.status === 'queued');
          const job =
            queuedJobs.length === 0
              ? null
              : queuedJobs.reduce((oldest, current) =>
                    current.createdAt < oldest.createdAt ? current : oldest
                  );
          if (!job) return null;

          const updatedQueue = queue.map((j) =>
            j.id === job.id ? { ...j, status: 'running' as GenerationJobStatus, updatedAt: Date.now() } : j
          );
          await this.writeQueue(updatedQueue);
          emitGenerationQueueUpdated(updatedQueue);
          return { ...job, status: 'running' as const, updatedAt: Date.now() };
        });

        if (!nextJob) break;

        await this.runJob(nextJob);
      }
    } catch (error) {
      log.error('Worker crashed:', error);
    } finally {
      this.workerRunning = false;
    }
  }

  private static async markJob(jobId: string, patch: Partial<GenerationJob>): Promise<void> {
    await this.withWriteLock(async () => {
      const queue = await this.readQueue();
      const updated = queue.map((j) => (j.id === jobId ? { ...j, ...patch, updatedAt: Date.now() } : j));
      await this.writeQueue(updated);
      emitGenerationQueueUpdated(updated);
    });
  }

  private static async runJob(job: GenerationJob): Promise<void> {
    const jobTitle = job.request?.description?.slice(0, 80) || 'New app';
    log.info('Running job', { jobId: job.id, appId: job.appId });

    await NotificationService.notifyGenerationStarted({
      appId: job.appId,
      jobId: job.id,
      title: jobTitle,
    });

    try {
      const claudeService = ClaudeApiService.getInstance();
      await claudeService.initialize();

      const response = await claudeService.generateAppConcept(job.generatedPrompt, {
        model: job.model,
        maxTokens: job.maxTokens,
        temperature: job.temperature,
        operation: 'app_generation',
        appId: job.appId,
      });

      await AppStorageService.updateAppHTML(
        job.appId,
        response.html,
        {
          title: response.name,
          description: `Generated ${job.request.style} app`,
          features: response.external_libs_used || [],
          userInterface: { screens: [], navigation: '', colorScheme: '', typography: '' },
          technicalSpecs: {
            architecture: '',
            dataStorage: '',
            integrations: response.external_libs_used || [],
            platforms: ['mobile'],
          },
          marketingCopy: { tagline: '', elevator_pitch: '', key_benefits: [] },
        },
        job.model
      );

      if (typeof response.category === 'string' && response.category.trim()) {
        await AppStorageService.updateApp(job.appId, { category: response.category.trim().toLowerCase() });
      }

      await this.markJob(job.id, { status: 'completed', errorMessage: undefined });

      await NotificationService.notifyGenerationCompleted({
        appId: job.appId,
        jobId: job.id,
        title: response.name || jobTitle,
      });
    } catch (error: any) {
      const errorMessage = error?.message || String(error);
      log.error('Job failed', { jobId: job.id, appId: job.appId, errorMessage });

      await AppStorageService.updateApp(job.appId, { status: 'error' });
      await this.markJob(job.id, { status: 'failed', errorMessage });

      await NotificationService.notifyGenerationFailed({
        appId: job.appId,
        jobId: job.id,
        title: jobTitle,
        errorMessage,
      });
    }
  }
}
