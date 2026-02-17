/* eslint-disable */
// AUTO-GENERATED FILE.
// Source: scripts/generate-sample-catalog.mjs
// Do not edit manually. Run: yarn samples:refresh

export type SampleStyle = 'minimalist' | 'creative' | 'corporate' | 'playful' | 'elegant' | 'modern';

export interface BundledSampleAppAsset {
  slug: string;
  htmlAsset: number;
  metaAsset?: number | Record<string, unknown>;
  fallback: {
    title: string;
    description: string;
    category: string;
    style: SampleStyle;
  };
}

export const BUNDLED_SAMPLE_APPS: BundledSampleAppAsset[] = [
  {
    slug: 'calculator',
    htmlAsset: require('../../assets/sample-apps/calculator.html'),
    fallback: {
      title: "Calculator",
      description: "Sample Calculator app",
      category: "utility",
      style: "modern" as SampleStyle,
    },
  },
  {
    slug: 'chess',
    htmlAsset: require('../../assets/sample-apps/chess.html'),
    fallback: {
      title: "Chess",
      description: "Sample Chess app",
      category: "games",
      style: "modern" as SampleStyle,
    },
  },
  {
    slug: 'color-palette-generator',
    htmlAsset: require('../../assets/sample-apps/color-palette-generator.html'),
    fallback: {
      title: "Color Palette Generator",
      description: "Sample Color Palette Generator app",
      category: "creative",
      style: "creative" as SampleStyle,
    },
  },
  {
    slug: 'quick-notes',
    htmlAsset: require('../../assets/sample-apps/quick-notes.html'),
    fallback: {
      title: "Quick Notes",
      description: "Sample Quick Notes app",
      category: "productivity",
      style: "minimalist" as SampleStyle,
    },
  },
  {
    slug: 'todo-app',
    htmlAsset: require('../../assets/sample-apps/todo-app.html'),
    fallback: {
      title: "Todo App",
      description: "Sample Todo App app",
      category: "productivity",
      style: "minimalist" as SampleStyle,
    },
  },
  {
    slug: 'weather-dashboard',
    htmlAsset: require('../../assets/sample-apps/weather-dashboard.html'),
    fallback: {
      title: "Weather Dashboard",
      description: "Sample Weather Dashboard app",
      category: "utility",
      style: "modern" as SampleStyle,
    },
  }
];
