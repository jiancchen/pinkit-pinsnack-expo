import React, { useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, TextInput, ScrollView, Alert, StatusBar } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { useFocusEffect } from '@react-navigation/native';
import { Ionicons } from '@expo/vector-icons';
import { RootStackParamList } from './MyAppScreen';
import { AppColors } from '../constants/AppColors';
import { PromptGenerator, AppStyle, AppCategory, AppGenerationRequest } from '../services/PromptGenerator';
import { ClaudeApiService } from '../services/ClaudeApiService';
import { AppStorageService } from '../services/AppStorageService';
import { SecureStorageService } from '../services/SecureStorageService';

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
  const [isLoading, setIsLoading] = useState(false);
  const [hasApiKey, setHasApiKey] = useState(false);
  const [isCheckingApiKey, setIsCheckingApiKey] = useState(true);

  const checkApiKeyStatus = async () => {
    try {
      const hasKey = await SecureStorageService.hasApiKey();
      setHasApiKey(hasKey);
    } catch (error) {
      console.error('Error checking API key status:', error);
      setHasApiKey(false);
    } finally {
      setIsCheckingApiKey(false);
    }
  };

  useFocusEffect(
    React.useCallback(() => {
      checkApiKeyStatus();
    }, [])
  );

  const handleSubmit = async () => {
    console.log('🚀 [CreateApp] Starting app generation process');
    
    if (!prompt.trim()) {
      console.log('❌ [CreateApp] Empty prompt provided');
      Alert.alert('Error', 'Please enter an app description');
      return;
    }

    if (!hasApiKey) {
      console.log('❌ [CreateApp] No API key configured');
      Alert.alert(
        'API Key Required',
        'You need to set up your Claude API key to generate apps. Would you like to add one now?',
        [
          { text: 'Add API Key', onPress: () => navigation.navigate('Settings') },
          { text: 'Cancel', style: 'cancel' }
        ]
      );
      return;
    }

    const request: AppGenerationRequest = {
      description: prompt.trim(),
      style: selectedStyle,
      platform: 'mobile'
    };
    
    console.log('📝 [CreateApp] Generation request:', request);

    // Validate the request
    const validation = PromptGenerator.validateRequest(request);
    if (!validation.isValid) {
      console.log('❌ [CreateApp] Request validation failed:', validation.errors);
      Alert.alert('Validation Error', validation.errors.join('\n'));
      return;
    }
    
    console.log('✅ [CreateApp] Request validation passed');

    setIsLoading(true);
    
    try {
      console.log('🔧 [CreateApp] Initializing Claude service...');
      const claudeService = ClaudeApiService.getInstance();
      
      if (!claudeService.isConfigured()) {
        console.log('❌ [CreateApp] Claude service not configured');
        Alert.alert(
          'Configuration Error',
          'There was an issue with your API configuration. Please check your settings.',
          [{ text: 'Check Settings', onPress: () => navigation.navigate('Settings') }]
        );
        return;
      }
      
      console.log('✅ [CreateApp] Claude service configured');

      // Get the current model being used
      const currentConfig = claudeService.getCurrentConfig();
      const modelUsed = currentConfig?.model || 'unknown';
      console.log('🤖 [CreateApp] Using model:', modelUsed);
      
      // First, save the app with placeholder content
      console.log('💾 [CreateApp] Saving app with placeholder content...');
      const savedApp = await AppStorageService.saveApp(request, undefined, undefined, modelUsed);
      console.log('✅ [CreateApp] App saved with ID:', savedApp.id);

      // Generate the prompt
      console.log('📝 [CreateApp] Generating prompt...');
      const generatedPrompt = PromptGenerator.generatePrompt(request);
      console.log('📝 [CreateApp] Generated prompt length:', generatedPrompt.length);
      console.log('📝 [CreateApp] Generated prompt preview:', generatedPrompt.substring(0, 200) + '...');
      
      // Call Claude API
      console.log('🌐 [CreateApp] Calling Claude API...');
      const generatedResponse = await claudeService.generateAppConcept(generatedPrompt);
      console.log('✅ [CreateApp] Received response from Claude API');
      console.log('📊 [CreateApp] Generated response:', {
        name: generatedResponse.name,
        category: generatedResponse.category,
        htmlLength: generatedResponse.html?.length || 0,
        externalLibs: generatedResponse.external_libs_used || []
      });
      
      // Update the app with the generated content
      console.log('🔄 [CreateApp] Updating app with generated content...');
      const updateResult = await AppStorageService.updateAppHTML(
        savedApp.id,
        generatedResponse.html, // Use the actual generated HTML
        {
          title: generatedResponse.name,
          description: `Generated ${selectedStyle} app`,
          features: generatedResponse.external_libs_used || [],
          userInterface: { screens: [], navigation: '', colorScheme: '', typography: '' },
          technicalSpecs: { architecture: '', dataStorage: '', integrations: generatedResponse.external_libs_used || [], platforms: ['mobile'] },
          marketingCopy: { tagline: '', elevator_pitch: '', key_benefits: [] }
        },
        modelUsed
      );
      console.log('✅ [CreateApp] App update result:', updateResult);
      
      Alert.alert(
        'App Generated Successfully!',
        `"${generatedResponse.name}" has been created and is ready to use!`,
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
            },
            style: 'cancel'
          }
        ]
      );
    } catch (error: any) {
      console.error('💥 [CreateApp] App generation error:', {
        message: error.message,
        stack: error.stack,
        name: error.name,
        response: error.response?.data
      });
      Alert.alert(
        'Generation Failed',
        error.message || 'Failed to generate app. Please try again.',
        [{ text: 'OK' }]
      );
    } finally {
      console.log('🏁 [CreateApp] Generation process completed');
      setIsLoading(false);
    }
  };

  const handleTemplateSelect = (template: typeof templates[0]) => {
    setPrompt(template.prompt);
    setSelectedStyle(template.style);
  };

  return (
    <SafeAreaView style={styleSheet.container} edges={[]}>
      <StatusBar translucent backgroundColor="transparent" />
      
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
          </View>
        </View>

        {/* Style Selection Section */}
        <View style={styleSheet.section}>
          <Text style={styleSheet.sectionTitle}>Pick a Design Style</Text>
          
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

        {/* Generate Button Section */}
        <View style={styleSheet.section}>
          {!hasApiKey && !isCheckingApiKey && (
            <View style={styleSheet.warningCard}>
              <Ionicons name="warning" size={20} color="#F59E0B" />
              <Text style={styleSheet.warningText}>
                You need to set up your Claude API key to generate apps
              </Text>
              <TouchableOpacity 
                style={styleSheet.settingsButton}
                onPress={() => navigation.navigate('Settings')}
              >
                <Text style={styleSheet.settingsButtonText}>Go to Settings</Text>
              </TouchableOpacity>
            </View>
          )}
          
          <TouchableOpacity
            style={[
              styleSheet.generateButton,
              { opacity: (!prompt.trim() || isLoading || !hasApiKey) ? 0.6 : 1 }
            ]}
            onPress={handleSubmit}
            disabled={!prompt.trim() || isLoading || !hasApiKey}
          >
            {isLoading ? (
              <View style={styleSheet.loadingContainer}>
                <Text style={styleSheet.generateButtonText}>Generating with Claude AI...</Text>
              </View>
            ) : (
              <View style={styleSheet.buttonContent}>
                <Ionicons name="sparkles" size={20} color="white" />
                <Text style={styleSheet.generateButtonText}>
                  {hasApiKey ? 'Generate App with AI' : 'API Key Required'}
                </Text>
              </View>
            )}
          </TouchableOpacity>
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
    </SafeAreaView>
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
  warningCard: {
    backgroundColor: '#FEF3C7',
    borderRadius: 12,
    padding: 16,
    marginBottom: 16,
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#F59E0B',
  },
  warningText: {
    flex: 1,
    marginLeft: 8,
    fontSize: 14,
    color: '#92400E',
  },
  settingsButton: {
    backgroundColor: '#F59E0B',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 8,
    marginLeft: 8,
  },
  settingsButtonText: {
    color: 'white',
    fontSize: 12,
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