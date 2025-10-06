export interface GeneratedAppConcept {
  title: string;
  description: string;
  features: string[];
  userInterface: {
    screens: string[];
    navigation: string;
    colorScheme: string;
    typography: string;
  };
  technicalSpecs: {
    architecture: string;
    dataStorage: string;
    integrations: string[];
    platforms: string[];
  };
  marketingCopy: {
    tagline: string;
    elevator_pitch: string;
    key_benefits: string[];
  };
}

export interface PromptHistory {
  id: string;
  prompt: string;
  html: string;
  title?: string;
  favorite?: boolean;
  accessCount?: number;
  timestamp?: Date;
  style?: string;
  category?: string;
  status?: 'new' | 'generating' | 'completed' | 'error';
  generatedConcept?: GeneratedAppConcept;
}

export const AppColors = {
  // App Primary Colors
  Primary: '#FFD84E',      // Main yellow background
  PrimaryDark: '#FFC107',  // Darker yellow
  PrimaryDeep: '#FF9800',  // Deepest yellow

  // FAB Colors (Orange variations)
  FABMain: '#FFB74D',      // Golden yellow for main FAB
  FABDarkOrange: '#E5A800', // Dark orange for menu items
  FABDarkerOrange: '#4FC21A', // Darker orange (green)
  FABDeepOrange: '#19A3E3',   // Deep orange (blue)

  // 3D Stack Card Background Colors
  StackColors: [
    '#E91E63', // Pink
    '#9C27B0', // Purple
    '#673AB7', // Deep Purple
    '#3F51B5', // Indigo
    '#2196F3', // Blue
    '#00BCD4', // Cyan
    '#009688', // Teal
    '#4CAF50', // Green
    '#8BC34A', // Light Green
    '#FF9800', // Orange
    '#FF5722', // Deep Orange
    '#F44336'  // Red
  ],

  // Common UI Colors
  White: '#FFFFFF',
  Black: '#000000',
  Transparent: 'transparent',

  // Overlay Colors
  BackdropOverlay: 'rgba(0, 0, 0, 0.3)',
};

export const samplePromptHistory: PromptHistory[] = [
  {
    id: 'sample1',
    prompt: 'Create a beautiful weather app with animated backgrounds',
    html: '',
    title: 'Weather Pro',
    favorite: true,
    accessCount: 5
  },
  {
    id: 'sample2',
    prompt: 'Build a task management app with drag and drop functionality',
    html: '',
    title: 'TaskMaster',
    favorite: false,
    accessCount: 3
  },
  {
    id: 'sample3',
    prompt: 'Design a social media app for photographers',
    html: '',
    title: 'PhotoShare',
    favorite: true,
    accessCount: 8
  },
  {
    id: 'sample4',
    prompt: 'Create a fitness tracking app with workout plans',
    html: '',
    title: 'FitTracker',
    favorite: false,
    accessCount: 2
  },
  {
    id: 'sample5',
    prompt: 'Build a recipe sharing app with meal planning',
    html: '',
    title: 'CookBook',
    favorite: false,
    accessCount: 0
  },
  {
    id: 'sample6',
    prompt: 'Design a music streaming app with playlist creation',
    html: 'GENERATING...',
    title: 'TuneStream',
    favorite: false,
    accessCount: 0
  },
  {
    id: 'sample7',
    prompt: 'Create a travel planning app with itinerary builder',
    html: '',
    title: 'TravelPlan',
    favorite: true,
    accessCount: 12
  },
  {
    id: 'sample8',
    prompt: 'Build an expense tracking app with budget analysis',
    html: '',
    title: 'MoneyTrack',
    favorite: false,
    accessCount: 6
  }
];