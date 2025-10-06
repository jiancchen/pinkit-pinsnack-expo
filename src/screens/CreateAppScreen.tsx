import React, { useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, TextInput, ScrollView, Alert, StatusBar } from 'react-native';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { Ionicons } from '@expo/vector-icons';
import { RootStackParamList } from './MyAppScreen';
import { AppColors } from '../types/PromptHistory';
import { PromptGenerator, AppStyle, AppCategory, AppGenerationRequest } from '../services/PromptGenerator';
import { ClaudeApiService } from '../services/ClaudeApiService';

type Props = NativeStackScreenProps<RootStackParamList, 'CreateApp'>;

const styles = {
  minimalist: { name: 'Minimalist', emoji: '🎨' },
  creative: { name: 'Creative', emoji: '🎯' },
  corporate: { name: 'Corporate', emoji: '💼' },
  playful: { name: 'Playful', emoji: '🎪' },
  elegant: { name: 'Elegant', emoji: '✨' },
  modern: { name: 'Modern', emoji: '🚀' },
};

const categories = {
  productivity: { name: 'Productivity', emoji: '⚡' },
  social: { name: 'Social', emoji: '👥' },
  utility: { name: 'Utility', emoji: '🔧' },
  entertainment: { name: 'Entertainment', emoji: '🎮' },
  education: { name: 'Education', emoji: '📚' },
  health: { name: 'Health', emoji: '🏥' },
  finance: { name: 'Finance', emoji: '💰' },
  travel: { name: 'Travel', emoji: '✈️' },
  shopping: { name: 'Shopping', emoji: '🛍️' },
  other: { name: 'Other', emoji: '📱' },
};

const templates = [
  {
    emoji: '✅',
    name: 'Todo List',
    description: 'Simple task management',
    prompt: 'Create a todo list app with add, delete, and mark complete functionality',
    style: 'minimalist' as AppStyle,
    category: 'productivity' as AppCategory
  },
  {
    emoji: '🎯',
    name: 'Habit Tracker',
    description: 'Track daily habits',
    prompt: 'Create a habit tracker that lets me check off daily habits and shows streaks',
    style: 'modern' as AppStyle,
    category: 'health' as AppCategory
  },
  {
    emoji: '📝',
    name: 'Note Taking',
    description: 'Quick notes and memos',
    prompt: 'Create a simple note-taking app where I can add, edit, and delete notes',
    style: 'minimalist' as AppStyle,
    category: 'productivity' as AppCategory
  },
  {
    emoji: '🧮',
    name: 'Calculator',
    description: 'Basic calculator',
    prompt: 'Create a calculator app with basic arithmetic operations',
    style: 'modern' as AppStyle,
    category: 'utility' as AppCategory
  },
  {
    emoji: '⏰',
    name: 'Timer',
    description: 'Countdown timer',
    prompt: 'Create a countdown timer app with start, pause, and reset functionality',
    style: 'minimalist' as AppStyle,
    category: 'utility' as AppCategory
  }
];

export default function CreateAppScreen({ navigation }: Props) {
  const [prompt, setPrompt] = useState('');
  const [selectedStyle, setSelectedStyle] = useState<AppStyle>('modern');
  const [selectedCategory, setSelectedCategory] = useState<AppCategory>('productivity');
  const [isLoading, setIsLoading] = useState(false);

  const handleSubmit = async () => {
    if (!prompt.trim()) {
      Alert.alert('Error', 'Please enter an app description');
      return;
    }

    const request: AppGenerationRequest = {
      description: prompt.trim(),
      style: selectedStyle,
      category: selectedCategory,
      platform: 'mobile'
    };

    // Validate the request
    const validation = PromptGenerator.validateRequest(request);
    if (!validation.isValid) {
      Alert.alert('Validation Error', validation.errors.join('\n'));
      return;
    }

    setIsLoading(true);
    
    try {
      const claudeService = ClaudeApiService.getInstance();
      
      if (!claudeService.isConfigured()) {
        Alert.alert(
          'API Key Required',
          'To generate apps with AI, you need to configure your Claude API key. You can set this up in Settings.',
          [
            { text: 'Go to Settings', onPress: () => navigation.navigate('Settings') },
            { text: 'Cancel', style: 'cancel' }
          ]
        );
        return;
      }

      // Generate the prompt
      const generatedPrompt = PromptGenerator.generatePrompt(request);
      
      // Call Claude API
      const generatedConcept = await claudeService.generateAppConcept(generatedPrompt);
      
      // TODO: Save the generated concept to app history
      // For now, just show success
      Alert.alert(
        'App Generated Successfully!',
        `"${generatedConcept.title}" has been created with ${generatedConcept.features.length} features and detailed specifications.`,
        [
          {
            text: 'View Apps',
            onPress: () => navigation.navigate('MyApp'),
          },
          {
            text: 'Create Another',
            onPress: () => {
              setPrompt('');
              setSelectedStyle('modern');
              setSelectedCategory('productivity');
            },
            style: 'cancel'
          }
        ]
      );
    } catch (error: any) {
      console.error('App generation error:', error);
      Alert.alert(
        'Generation Failed',
        error.message || 'Failed to generate app. Please try again.',
        [{ text: 'OK' }]
      );
    } finally {
      setIsLoading(false);
    }
  };

  const handleTemplateSelect = (template: typeof templates[0]) => {
    setPrompt(template.prompt);
    setSelectedStyle(template.style);
    setSelectedCategory(template.category);
  };

  return (
    <View style={styleSheet.container}>
      <StatusBar barStyle="dark-content" backgroundColor={AppColors.Primary} />
      
      {/* Header */}
      <View style={styleSheet.header}>
        <TouchableOpacity
          style={styleSheet.backButton}
          onPress={() => navigation.goBack()}
        >
          <Ionicons name="arrow-back" size={24} color="rgba(0, 0, 0, 0.8)" />
        </TouchableOpacity>
        <Text style={styleSheet.headerTitle}>Create New App</Text>
      </View>

      <ScrollView 
        style={styleSheet.scrollView}
        contentContainerStyle={styleSheet.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        {/* Style Selection Section */}
        <View style={styleSheet.section}>
          <Text style={styleSheet.sectionTitle}>Pick a Style</Text>
          
          <View style={styleSheet.card}>
            <View style={styleSheet.optionsContainer}>
              {Object.entries(styles).map(([key, style]) => (
                <OptionCard
                  key={key}
                  id={key as AppStyle}
                  emoji={style.emoji}
                  name={style.name}
                  isSelected={selectedStyle === key}
                  onSelect={() => setSelectedStyle(key as AppStyle)}
                />
              ))}
            </View>
          </View>
        </View>

        {/* Category Selection Section */}
        <View style={styleSheet.section}>
          <Text style={styleSheet.sectionTitle}>Select Category</Text>
          
          <View style={styleSheet.card}>
            <View style={styleSheet.optionsContainer}>
              {Object.entries(categories).map(([key, category]) => (
                <OptionCard
                  key={key}
                  id={key as AppCategory}
                  emoji={category.emoji}
                  name={category.name}
                  isSelected={selectedCategory === key}
                  onSelect={() => setSelectedCategory(key as AppCategory)}
                />
              ))}
            </View>
          </View>
        </View>

        {/* Main Input Section */}
        <View style={styleSheet.section}>
          <View style={styleSheet.card}>
            <View style={styleSheet.inputHeader}>
              <Text style={styleSheet.sectionTitle}>Describe Your App</Text>
              {prompt.length > 0 && (
                <TouchableOpacity onPress={() => setPrompt('')}>
                  <Ionicons name="close" size={20} color="#666" />
                </TouchableOpacity>
              )}
            </View>
            
            <TextInput
              style={styleSheet.textInput}
              value={prompt}
              onChangeText={setPrompt}
              placeholder="Describe what kind of app you want to create..."
              placeholderTextColor="#999"
              multiline
              numberOfLines={5}
              textAlignVertical="top"
              editable={!isLoading}
            />

            <TouchableOpacity
              style={[
                styleSheet.generateButton,
                { opacity: (!prompt.trim() || isLoading) ? 0.6 : 1 }
              ]}
              onPress={handleSubmit}
              disabled={!prompt.trim() || isLoading}
            >
              {isLoading ? (
                <View style={styleSheet.loadingContainer}>
                  <Text style={styleSheet.generateButtonText}>Generating with Claude AI...</Text>
                </View>
              ) : (
                <View style={styleSheet.buttonContent}>
                  <Ionicons name="sparkles" size={20} color="white" />
                  <Text style={styleSheet.generateButtonText}>Generate App with AI</Text>
                </View>
              )}
            </TouchableOpacity>
          </View>
        </View>

        {/* Templates Section */}
        {!isLoading && (
          <View style={styleSheet.section}>
            <Text style={styleSheet.sectionTitle}>Quick Templates</Text>
            
            {templates.map((template, index) => (
              <TemplateCard
                key={index}
                emoji={template.emoji}
                name={template.name}
                description={template.description}
                style={template.style}
                category={template.category}
                onSelect={() => handleTemplateSelect(template)}
              />
            ))}
          </View>
        )}
      </ScrollView>
    </View>
  );
}

interface OptionCardProps {
  id: string;
  emoji: string;
  name: string;
  isSelected: boolean;
  onSelect: () => void;
}

function OptionCard({ emoji, name, isSelected, onSelect }: OptionCardProps) {
  return (
    <TouchableOpacity
      style={[
        styleSheet.optionCard,
        isSelected && styleSheet.optionCardSelected
      ]}
      onPress={onSelect}
    >
      <Text style={styleSheet.optionEmoji}>{emoji}</Text>
      <Text style={[
        styleSheet.optionName,
        isSelected && styleSheet.optionNameSelected
      ]}>
        {name}
      </Text>
    </TouchableOpacity>
  );
}

interface TemplateCardProps {
  emoji: string;
  name: string;
  description: string;
  style: AppStyle;
  category: AppCategory;
  onSelect: () => void;
}

function TemplateCard({ emoji, name, description, onSelect }: TemplateCardProps) {
  return (
    <TouchableOpacity style={styleSheet.templateCard} onPress={onSelect}>
      <Text style={styleSheet.templateEmoji}>{emoji}</Text>
      <View style={styleSheet.templateContent}>
        <Text style={styleSheet.templateName}>{name}</Text>
        <Text style={styleSheet.templateDescription}>{description}</Text>
      </View>
    </TouchableOpacity>
  );
}

const styleSheet = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: AppColors.Primary,
  },
  header: {
    paddingTop: 60,
    paddingHorizontal: 16,
    paddingBottom: 20,
    flexDirection: 'row',
    alignItems: 'center',
  },
  backButton: {
    padding: 8,
    marginRight: 8,
  },
  headerTitle: {
    fontSize: 24,
    fontWeight: 'bold',
    color: 'rgba(0, 0, 0, 0.8)',
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    padding: 16,
    paddingBottom: 32,
  },
  section: {
    marginBottom: 20,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: 'rgba(0, 0, 0, 0.8)',
    marginBottom: 12,
  },
  card: {
    backgroundColor: 'rgba(255, 255, 255, 0.95)',
    borderRadius: 16,
    padding: 20,
    elevation: 4,
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 2,
    },
    shadowOpacity: 0.1,
    shadowRadius: 4,
  },
  optionsContainer: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    flexWrap: 'wrap',
    gap: 8,
  },
  optionCard: {
    width: 80,
    height: 80,
    backgroundColor: '#fff',
    borderRadius: 12,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: 'rgba(128, 128, 128, 0.3)',
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 1,
    },
    shadowOpacity: 0.1,
    shadowRadius: 2,
    margin: 4,
  },
  optionCardSelected: {
    backgroundColor: '#FFF3C4',
    borderColor: AppColors.FABMain,
    borderWidth: 2,
    elevation: 6,
    shadowOpacity: 0.2,
    shadowRadius: 4,
  },
  optionEmoji: {
    fontSize: 20,
    marginBottom: 4,
  },
  optionName: {
    fontSize: 10,
    fontWeight: '600',
    color: 'rgba(0, 0, 0, 0.8)',
    textAlign: 'center',
  },
  optionNameSelected: {
    color: 'rgba(0, 0, 0, 0.8)',
    fontWeight: 'bold',
  },
  inputHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  textInput: {
    borderWidth: 1,
    borderColor: 'rgba(128, 128, 128, 0.5)',
    borderRadius: 12,
    padding: 15,
    fontSize: 16,
    color: 'rgba(0, 0, 0, 0.8)',
    backgroundColor: '#fff',
    minHeight: 120,
    marginBottom: 16,
  },
  generateButton: {
    backgroundColor: AppColors.FABMain,
    borderRadius: 12,
    paddingVertical: 15,
    paddingHorizontal: 20,
    alignItems: 'center',
    justifyContent: 'center',
  },
  buttonContent: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  loadingContainer: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  generateButtonText: {
    color: 'white',
    fontSize: 16,
    fontWeight: '600',
  },
  templateCard: {
    backgroundColor: 'rgba(255, 255, 255, 0.95)',
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
    flexDirection: 'row',
    alignItems: 'center',
    elevation: 4,
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 2,
    },
    shadowOpacity: 0.1,
    shadowRadius: 4,
  },
  templateEmoji: {
    fontSize: 24,
    marginRight: 12,
  },
  templateContent: {
    flex: 1,
  },
  templateName: {
    fontSize: 14,
    fontWeight: '600',
    color: 'rgba(0, 0, 0, 0.8)',
    marginBottom: 2,
  },
  templateDescription: {
    fontSize: 12,
    color: 'rgba(0, 0, 0, 0.6)',
  },
});