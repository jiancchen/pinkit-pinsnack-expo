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
  isSample?: boolean;
  sampleKey?: string;
  generatedConcept?: GeneratedAppConcept;
}
