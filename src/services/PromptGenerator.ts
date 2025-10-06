import { PromptHistory, GeneratedAppConcept } from '../types/PromptHistory';

export type AppStyle = 'minimalist' | 'creative' | 'corporate' | 'playful' | 'elegant' | 'modern';
export type AppCategory = 'productivity' | 'social' | 'utility' | 'entertainment' | 'education' | 'health' | 'finance' | 'travel' | 'shopping' | 'other';

export interface AppGenerationRequest {
  description: string;
  style: AppStyle;
  category: AppCategory;
  features?: string[];
  targetAudience?: string;
  platform?: 'mobile' | 'web' | 'both';
}

export class PromptGenerator {
  private static readonly STYLE_TEMPLATES = {
    minimalist: {
      design_principles: ['Clean lines', 'White space utilization', 'Simple navigation', 'Monochromatic color schemes'],
      ui_elements: ['Flat design', 'Minimal typography', 'Subtle animations', 'Grid-based layouts'],
      color_guidance: 'Use neutral colors with one accent color for important actions'
    },
    creative: {
      design_principles: ['Bold colors', 'Artistic elements', 'Unique layouts', 'Experimental navigation'],
      ui_elements: ['Custom illustrations', 'Gradient backgrounds', 'Organic shapes', 'Dynamic typography'],
      color_guidance: 'Use vibrant color palettes with artistic gradients and creative combinations'
    },
    corporate: {
      design_principles: ['Professional appearance', 'Consistent branding', 'Clear hierarchy', 'Trustworthy design'],
      ui_elements: ['Clean typography', 'Professional imagery', 'Structured layouts', 'Subtle animations'],
      color_guidance: 'Use professional color schemes like navy, gray, and white with branded accent colors'
    },
    playful: {
      design_principles: ['Fun interactions', 'Bright colors', 'Engaging animations', 'Friendly interfaces'],
      ui_elements: ['Rounded corners', 'Colorful icons', 'Bouncy animations', 'Casual typography'],
      color_guidance: 'Use bright, cheerful colors with high contrast and playful combinations'
    },
    elegant: {
      design_principles: ['Sophisticated aesthetics', 'Premium feel', 'Refined details', 'Graceful interactions'],
      ui_elements: ['Elegant typography', 'Subtle shadows', 'Smooth transitions', 'Luxurious spacing'],
      color_guidance: 'Use sophisticated color palettes with gold, deep blues, or muted tones'
    },
    modern: {
      design_principles: ['Contemporary design', 'Latest trends', 'Cutting-edge UX', 'Tech-forward approach'],
      ui_elements: ['Glassmorphism', 'Neumorphism', 'Dark mode support', 'Micro-interactions'],
      color_guidance: 'Use contemporary color schemes with dark themes and neon accents'
    }
  };

  private static readonly CATEGORY_TEMPLATES = {
    productivity: {
      core_features: ['Task management', 'Calendar integration', 'File organization', 'Collaboration tools'],
      target_users: 'Professionals, students, teams looking to optimize their workflow',
      key_metrics: 'Task completion rate, time saved, user engagement',
      monetization: 'Freemium model with premium features for power users'
    },
    social: {
      core_features: ['User profiles', 'Social feeds', 'Messaging', 'Content sharing'],
      target_users: 'Social media users, communities, content creators',
      key_metrics: 'Daily active users, engagement rate, content creation',
      monetization: 'Ad-supported with premium subscriptions for enhanced features'
    },
    utility: {
      core_features: ['Problem-solving tools', 'System optimization', 'Quick actions', 'Efficiency improvements'],
      target_users: 'General users seeking practical solutions for daily tasks',
      key_metrics: 'Usage frequency, problem resolution rate, user satisfaction',
      monetization: 'One-time purchase or subscription for advanced features'
    },
    entertainment: {
      core_features: ['Content consumption', 'Interactive experiences', 'Media playback', 'Gaming elements'],
      target_users: 'Entertainment seekers, gamers, media consumers',
      key_metrics: 'Session duration, content engagement, user retention',
      monetization: 'Freemium with in-app purchases and premium content'
    },
    education: {
      core_features: ['Learning modules', 'Progress tracking', 'Interactive lessons', 'Assessment tools'],
      target_users: 'Students, educators, lifelong learners',
      key_metrics: 'Learning outcomes, completion rates, knowledge retention',
      monetization: 'Subscription-based or institutional licensing'
    },
    health: {
      core_features: ['Health tracking', 'Wellness monitoring', 'Goal setting', 'Data visualization'],
      target_users: 'Health-conscious individuals, patients, fitness enthusiasts',
      key_metrics: 'Health improvements, user adherence, goal achievement',
      monetization: 'Freemium with premium health insights and professional features'
    },
    finance: {
      core_features: ['Budget tracking', 'Investment monitoring', 'Financial planning', 'Transaction management'],
      target_users: 'Financial planners, investors, budget-conscious individuals',
      key_metrics: 'Financial goal achievement, user engagement, portfolio performance',
      monetization: 'Subscription-based with tiered pricing for different user levels'
    },
    travel: {
      core_features: ['Trip planning', 'Booking integration', 'Travel guides', 'Expense tracking'],
      target_users: 'Travelers, vacation planners, business travelers',
      key_metrics: 'Trip completion, booking conversions, user satisfaction',
      monetization: 'Commission-based bookings with premium planning features'
    },
    shopping: {
      core_features: ['Product discovery', 'Price comparison', 'Wishlist management', 'Purchase tracking'],
      target_users: 'Online shoppers, deal hunters, brand loyalists',
      key_metrics: 'Purchase conversion, user engagement, savings achieved',
      monetization: 'Affiliate commissions and premium shopping features'
    },
    other: {
      core_features: ['Custom functionality', 'Unique value proposition', 'Specialized tools', 'Niche solutions'],
      target_users: 'Varied based on specific use case and market needs',
      key_metrics: 'User satisfaction, problem resolution, market adoption',
      monetization: 'Flexible model based on value proposition and market fit'
    }
  };

  /**
   * Generate a comprehensive prompt for Claude API based on user requirements
   */
  static generatePrompt(request: AppGenerationRequest): string {
    const styleTemplate = this.STYLE_TEMPLATES[request.style];
    const categoryTemplate = this.CATEGORY_TEMPLATES[request.category];

    const prompt = `# Mobile App Concept Generator

Create a comprehensive mobile app concept based on the following requirements:

## App Requirements
- **Description**: ${request.description}
- **Style**: ${request.style}
- **Category**: ${request.category}
- **Target Platform**: ${request.platform || 'mobile'}
${request.features ? `- **Requested Features**: ${request.features.join(', ')}` : ''}
${request.targetAudience ? `- **Target Audience**: ${request.targetAudience}` : ''}

## Style Guidelines (${request.style})
- **Design Principles**: ${styleTemplate.design_principles.join(', ')}
- **UI Elements**: ${styleTemplate.ui_elements.join(', ')}
- **Color Guidance**: ${styleTemplate.color_guidance}

## Category Context (${request.category})
- **Core Features**: ${categoryTemplate.core_features.join(', ')}
- **Target Users**: ${categoryTemplate.target_users}
- **Key Metrics**: ${categoryTemplate.key_metrics}
- **Monetization**: ${categoryTemplate.monetization}

## Required Output Format
Please provide a detailed app concept in the following JSON structure:

\`\`\`json
{
  "title": "App Name",
  "description": "Comprehensive app description (2-3 sentences)",
  "features": [
    "Feature 1",
    "Feature 2",
    "Feature 3",
    "Feature 4",
    "Feature 5"
  ],
  "userInterface": {
    "screens": ["Screen 1", "Screen 2", "Screen 3", "Screen 4"],
    "navigation": "Navigation pattern description",
    "colorScheme": "Color scheme description",
    "typography": "Typography choices"
  },
  "technicalSpecs": {
    "architecture": "Recommended architecture pattern",
    "dataStorage": "Data storage approach",
    "integrations": ["Integration 1", "Integration 2"],
    "platforms": ["Platform 1", "Platform 2"]
  },
  "marketingCopy": {
    "tagline": "Catchy tagline",
    "elevator_pitch": "30-second elevator pitch",
    "key_benefits": ["Benefit 1", "Benefit 2", "Benefit 3"]
  }
}
\`\`\`

## Additional Guidelines
1. Ensure the app concept is innovative yet practical
2. Consider current market trends and user needs
3. Make the concept technically feasible for modern mobile development
4. Include specific details that align with the chosen style and category
5. Provide actionable insights for development and marketing
6. Consider accessibility and inclusive design principles
7. Think about scalability and future feature expansion

Please generate a creative, detailed, and market-ready mobile app concept.`;

    return prompt;
  }

  /**
   * Generate a PromptHistory entry for tracking
   */
  static createPromptHistoryEntry(
    request: AppGenerationRequest,
    generatedConcept?: GeneratedAppConcept
  ): Omit<PromptHistory, 'id'> {
    const baseEntry = {
      title: generatedConcept?.title || `${request.style} ${request.category} App`,
      prompt: request.description,
      html: generatedConcept ? JSON.stringify(generatedConcept, null, 2) : 'GENERATING...',
      timestamp: new Date(),
      style: request.style,
      category: request.category,
      status: generatedConcept ? 'completed' as const : 'generating' as const,
      favorite: false,
      accessCount: 0,
      generatedConcept: generatedConcept
    };

    return baseEntry;
  }

  /**
   * Get style recommendations based on category
   */
  static getRecommendedStyles(category: AppCategory): AppStyle[] {
    const recommendations: Record<AppCategory, AppStyle[]> = {
      productivity: ['minimalist', 'modern', 'corporate'],
      social: ['playful', 'modern', 'creative'],
      utility: ['minimalist', 'modern', 'corporate'],
      entertainment: ['playful', 'creative', 'modern'],
      education: ['playful', 'elegant', 'modern'],
      health: ['minimalist', 'elegant', 'modern'],
      finance: ['corporate', 'minimalist', 'elegant'],
      travel: ['creative', 'elegant', 'modern'],
      shopping: ['playful', 'elegant', 'modern'],
      other: ['modern', 'minimalist', 'creative']
    };

    return recommendations[category] || ['modern', 'minimalist'];
  }

  /**
   * Get suggested features based on category
   */
  static getSuggestedFeatures(category: AppCategory): string[] {
    return this.CATEGORY_TEMPLATES[category].core_features;
  }

  /**
   * Validate app generation request
   */
  static validateRequest(request: AppGenerationRequest): { isValid: boolean; errors: string[] } {
    const errors: string[] = [];

    if (!request.description || request.description.trim().length < 10) {
      errors.push('Description must be at least 10 characters long');
    }

    if (!Object.keys(this.STYLE_TEMPLATES).includes(request.style)) {
      errors.push('Invalid style selected');
    }

    if (!Object.keys(this.CATEGORY_TEMPLATES).includes(request.category)) {
      errors.push('Invalid category selected');
    }

    if (request.features && request.features.length > 10) {
      errors.push('Maximum 10 features allowed');
    }

    return {
      isValid: errors.length === 0,
      errors
    };
  }
}