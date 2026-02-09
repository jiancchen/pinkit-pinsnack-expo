import * as FileSystem from 'expo-file-system/legacy';
import * as MailComposer from 'expo-mail-composer';
import * as Sharing from 'expo-sharing';
import JSZip from 'jszip';
import { createLogger } from '../utils/Logger';
import { StoredApp } from './AppStorageService';
import { PromptGenerator } from './PromptGenerator';

const log = createLogger('ExportService');

export interface ExportDebugBundleOptions {
  recipientEmail?: string;
  preferEmail?: boolean;
  injectedHtml?: string;
}

type ExportBundleResult = {
  zipUri: string;
  fileName: string;
};

function safeFileName(input: string): string {
  return input
    .trim()
    .replace(/[^\w\s.-]/g, '')
    .replace(/\s+/g, '_')
    .replace(/_+/g, '_')
    .slice(0, 80) || 'droplets_app';
}

function pad2(value: number): string {
  return String(value).padStart(2, '0');
}

function timestampForFile(date: Date): string {
  return `${date.getFullYear()}-${pad2(date.getMonth() + 1)}-${pad2(date.getDate())}_${pad2(date.getHours())}${pad2(date.getMinutes())}${pad2(date.getSeconds())}`;
}

function buildPromptText(app: StoredApp, fullPrompt?: string): string {
  const lines: string[] = [];
  lines.push('Droplets Debug Bundle');
  lines.push('');
  lines.push(`App ID: ${app.id}`);
  lines.push(`Title: ${app.title}`);
  lines.push(`Model: ${app.model || 'unknown'}`);
  lines.push(`Style: ${app.style}`);
  lines.push(`Category: ${app.category}`);
  lines.push(`Status: ${app.status}`);
  lines.push(`Created: ${new Date(app.timestamp).toISOString()}`);
  lines.push('');
  lines.push('User Prompt (stored):');
  lines.push(app.prompt || app.description || '');
  lines.push('');
  if (fullPrompt && fullPrompt.trim() && fullPrompt.trim() !== (app.prompt || '').trim()) {
    lines.push('Full Prompt (generated):');
    lines.push(fullPrompt);
    lines.push('');
  }
  if (app.request) {
    lines.push('Request JSON:');
    lines.push(JSON.stringify(app.request, null, 2));
    lines.push('');
  }
  return lines.join('\n');
}

function buildMeta(app: StoredApp): Record<string, unknown> {
  return {
    id: app.id,
    title: app.title,
    description: app.description,
    prompt: app.prompt,
    timestamp: new Date(app.timestamp).toISOString(),
    style: app.style,
    category: app.category,
    status: app.status,
    favorite: app.favorite,
    accessCount: app.accessCount,
    baseUrl: app.baseUrl,
    model: app.model,
    request: app.request,
    generatedPromptPresent: Boolean(app.generatedPrompt),
    htmlLength: app.html?.length || 0,
  };
}

async function ensureDirExists(dirUri: string): Promise<void> {
  try {
    await FileSystem.makeDirectoryAsync(dirUri, { intermediates: true });
  } catch (error: any) {
    // Ignore if it already exists.
    if (error?.message?.includes('exists')) return;
    throw error;
  }
}

export class ExportService {
  private static async buildZipBundle(app: StoredApp, options: ExportDebugBundleOptions = {}): Promise<ExportBundleResult> {
    const now = new Date();
    const fileBase = safeFileName(`${app.title || 'app'}_${app.id}_${timestampForFile(now)}`);

    const baseDir = FileSystem.cacheDirectory || FileSystem.documentDirectory;
    if (!baseDir) {
      throw new Error('File system unavailable on this device');
    }

    const exportDir = `${baseDir}exports/`;
    await ensureDirExists(exportDir);

    const zipUri = `${exportDir}${fileBase}.zip`;

    const fullPrompt =
      app.generatedPrompt ||
      (app.request ? PromptGenerator.generatePrompt(app.request) : undefined);

    const zip = new JSZip();
    zip.file('app.html', app.html || '');
    zip.file('prompt.txt', buildPromptText(app, fullPrompt));
    zip.file('meta.json', JSON.stringify(buildMeta(app), null, 2));

    if (options.injectedHtml) {
      zip.file('webview_injected.html', options.injectedHtml);
    }

    const zipBase64 = await zip.generateAsync({ type: 'base64' });
    await FileSystem.writeAsStringAsync(zipUri, zipBase64, { encoding: FileSystem.EncodingType.Base64 });

    return { zipUri, fileName: `${fileBase}.zip` };
  }

  static async exportDebugBundle(app: StoredApp, options: ExportDebugBundleOptions = {}): Promise<string> {
    log.debug('Preparing debug bundle export', { appId: app.id });

    const { zipUri, fileName } = await this.buildZipBundle(app, options);

    const subject = `Droplets Debug Export: ${app.title} (${app.id})`;
    const body =
      `Attached is a Droplets debug export bundle.\n\n` +
      `App ID: ${app.id}\n` +
      `Title: ${app.title}\n` +
      `Model: ${app.model || 'unknown'}\n` +
      `Created: ${new Date(app.timestamp).toISOString()}\n`;

    const preferEmail = options.preferEmail !== false;

    if (preferEmail) {
      try {
        const available = await MailComposer.isAvailableAsync();
        if (available) {
          const recipients = options.recipientEmail ? [options.recipientEmail] : [];
          const result = await MailComposer.composeAsync({
            recipients,
            subject,
            body,
            attachments: [zipUri],
          });
          log.debug('Mail composer result', result);
          return zipUri;
        }
        log.warn('Mail composer not available, falling back to share sheet');
      } catch (error) {
        log.warn('Mail composer failed, falling back to share sheet', error);
      }
    }

    const sharingAvailable = await Sharing.isAvailableAsync();
    if (!sharingAvailable) {
      throw new Error(`Sharing unavailable. Bundle saved at: ${zipUri}`);
    }

    await Sharing.shareAsync(zipUri, {
      dialogTitle: 'Share Droplets Debug Bundle',
      mimeType: 'application/zip',
      UTI: 'public.zip-archive',
    });

    log.debug('Shared debug bundle', { fileName, zipUri });
    return zipUri;
  }
}
