import { useMemo } from 'react';
import { AppLanguage, useUISettingsStore } from '../stores/UISettingsStore';

type StringMap = Record<string, string>;

const EN_US: StringMap = {
  // Home
  'home.brand': 'PINSNACKS',
  'home.search.placeholder': 'Search your apps...',
  'home.favorites.title': 'Favorite Apps',
  'home.mostUsed.title': 'Most Used Apps',
  'home.favorites.empty': 'No favorite apps yet',
  'home.mostUsed.empty': 'No usage data yet',
  'home.generating.wait': 'Item is still generating, please wait...',
  // Create
  'create.header': 'Create',
  'create.describe': 'Describe Your App',
  'create.describe.placeholder': 'Describe what kind of app you want to create...',
  'create.designTags': 'Design Tags',
  'create.designTags.placeholder': 'Add a custom tag',
  'create.designTags.add': 'Add',
  'create.designTags.common': 'Common tags',
  'create.designTags.saved': 'Your tags',
  'create.templates': 'Quick Templates',
  'create.history.title': 'Previous Prompts',
  'create.history.subtitle': 'Tap a prompt to load it into the editor.',
  'create.history.empty': 'No saved prompts yet.',
  'create.history.loading': 'Loading…',
  'create.advanced.title': 'Advanced',
  'create.advanced.subtitle': 'Tune model, token budget, and creativity for this run.',
  'create.advanced.model': 'Model',
  'create.advanced.maxTokens': 'Max Output Tokens',
  'create.advanced.temperature': 'Temperature',
  'create.advanced.estimate': 'Estimate',
  'create.actions.done': 'Done',
  'create.actions.clear': 'Clear',
  'create.actions.reset': 'Reset',
  'create.actions.cancel': 'Cancel',
  'create.actions.create': 'Create',
  'create.error.emptyPrompt': 'Please enter an app description.',
  'create.confirm.title': 'Confirm App Generation',
  'create.confirm.estimatedCost': 'Estimated max cost',
  'create.confirm.model': 'Model',
  'create.confirm.inputTokens': 'Input tokens (~)',
  'create.confirm.outputTokens': 'Output tokens (max)',
  'create.confirm.disclaimer':
    'Charges are billed to your Claude API account. Continue only if you agree to proceed with this estimated usage.',
  'create.apiRequired.title': 'API Key Required',
  'create.apiRequired.body':
    'You need to set up your Claude API key to generate apps. Would you like to add one now?',
  'create.apiRequired.cta': 'Go to Settings',
  // Settings
  'settings.language.title': 'App Language',
  'settings.language.helper': 'Changes apply immediately to supported screens.',
  'settings.language.english': 'English (US)',
  'settings.language.spanish': 'Spanish (Spain)',
};

const ES_ES: StringMap = {
  // Home
  'home.brand': 'PINSNACKS',
  'home.search.placeholder': 'Buscar tus apps...',
  'home.favorites.title': 'Apps favoritas',
  'home.mostUsed.title': 'Más usadas',
  'home.favorites.empty': 'Todavía no hay favoritas',
  'home.mostUsed.empty': 'Aún no hay datos de uso',
  'home.generating.wait': 'La app aún se está generando, espera un momento...',
  // Create
  'create.header': 'Crear nueva app',
  'create.describe': 'Describe tu app',
  'create.describe.placeholder': 'Describe qué tipo de app quieres crear...',
  'create.designTags': 'Etiquetas de diseño',
  'create.designTags.placeholder': 'Añadir etiqueta personalizada',
  'create.designTags.add': 'Añadir',
  'create.designTags.common': 'Etiquetas comunes',
  'create.designTags.saved': 'Tus etiquetas',
  'create.templates': 'Plantillas rápidas',
  'create.history.title': 'Prompts anteriores',
  'create.history.subtitle': 'Toca un prompt para cargarlo en el editor.',
  'create.history.empty': 'Todavía no hay prompts guardados.',
  'create.history.loading': 'Cargando…',
  'create.advanced.title': 'Avanzado',
  'create.advanced.subtitle': 'Ajusta modelo, tokens y creatividad para esta ejecución.',
  'create.advanced.model': 'Modelo',
  'create.advanced.maxTokens': 'Tokens máximos de salida',
  'create.advanced.temperature': 'Temperatura',
  'create.advanced.estimate': 'Estimación',
  'create.actions.done': 'Listo',
  'create.actions.clear': 'Borrar',
  'create.actions.reset': 'Restablecer',
  'create.actions.cancel': 'Cancelar',
  'create.actions.create': 'Crear',
  'create.error.emptyPrompt': 'Escribe una descripción de la app.',
  'create.confirm.title': 'Confirmar generación de app',
  'create.confirm.estimatedCost': 'Coste máximo estimado',
  'create.confirm.model': 'Modelo',
  'create.confirm.inputTokens': 'Tokens de entrada (~)',
  'create.confirm.outputTokens': 'Tokens de salida (máx.)',
  'create.confirm.disclaimer':
    'Los cargos se facturan a tu cuenta de API de Claude. Continúa solo si aceptas este uso estimado.',
  'create.apiRequired.title': 'Se requiere API key',
  'create.apiRequired.body':
    'Necesitas configurar tu API key de Claude para generar apps. ¿Quieres añadirla ahora?',
  'create.apiRequired.cta': 'Ir a Ajustes',
  // Settings
  'settings.language.title': 'Idioma de la app',
  'settings.language.helper': 'Los cambios se aplican al instante en pantallas compatibles.',
  'settings.language.english': 'Inglés (EE. UU.)',
  'settings.language.spanish': 'Español (España)',
};

const STRINGS: Record<AppLanguage, StringMap> = {
  'en-US': EN_US,
  'es-ES': ES_ES,
};

export function getString(
  language: AppLanguage,
  key: string,
  variables?: Record<string, string | number>
): string {
  const table = STRINGS[language] || EN_US;
  const fallback = EN_US[key] || key;
  let template = table[key] || fallback;

  if (!variables) return template;
  for (const [name, value] of Object.entries(variables)) {
    template = template.replace(new RegExp(`\\{${name}\\}`, 'g'), String(value));
  }
  return template;
}

export function useStrings() {
  const language = useUISettingsStore((s) => s.appLanguage);
  return useMemo(
    () => ({
      language,
      t: (key: string, variables?: Record<string, string | number>) =>
        getString(language, key, variables),
    }),
    [language]
  );
}
