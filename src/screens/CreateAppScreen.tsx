import React, { useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, TextInput, ScrollView, Alert, StatusBar } from 'react-native';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { Ionicons } from '@expo/vector-icons';
import { RootStackParamList } from './MyAppScreen';
import { AppColors } from '../types/PromptHistory';

type Props = NativeStackScreenProps<RootStackParamList, 'CreateApp'>;

const styles = {
  DEFAULT: { name: 'Default', emoji: '🎨' },
  FUN: { name: 'Fun', emoji: '🎯' },
  SIMPLE: { name: 'Simple', emoji: '✨' },
};

const templates = [
  {
    emoji: '✅',
    name: 'Todo List',
    description: 'Simple task management',
    prompt: 'Create a todo list app with add, delete, and mark complete functionality'
  },
  {
    emoji: '🎯',
    name: 'Habit Tracker',
    description: 'Track daily habits',
    prompt: 'Create a habit tracker that lets me check off daily habits and shows streaks'
  },
  {
    emoji: '📝',
    name: 'Note Taking',
    description: 'Quick notes and memos',
    prompt: 'Create a simple note-taking app where I can add, edit, and delete notes'
  },
  {
    emoji: '🧮',
    name: 'Calculator',
    description: 'Basic calculator',
    prompt: 'Create a calculator app with basic arithmetic operations'
  },
  {
    emoji: '⏰',
    name: 'Timer',
    description: 'Countdown timer',
    prompt: 'Create a countdown timer app with start, pause, and reset functionality'
  }
];

export default function CreateAppScreen({ navigation }: Props) {
  const [prompt, setPrompt] = useState('');
  const [selectedStyle, setSelectedStyle] = useState('DEFAULT');
  const [customStyle, setCustomStyle] = useState('');
  const [isLoading, setIsLoading] = useState(false);

  const handleSubmit = () => {
    if (!prompt.trim()) {
      Alert.alert('Error', 'Please enter an app description');
      return;
    }

    setIsLoading(true);
    
    // Simulate app generation
    setTimeout(() => {
      setIsLoading(false);
      Alert.alert(
        'App Generated!',
        `Your app has been created successfully!`,
        [
          {
            text: 'OK',
            onPress: () => navigation.navigate('MyApp'),
          },
        ]
      );
    }, 2000);
  };

  const handleTemplateSelect = (templatePrompt: string) => {
    setPrompt(templatePrompt);
  };

  return (
    <View style={styleSheet.container}>
      <StatusBar barStyle="dark-content" backgroundColor={AppColors.Primary} />
      
      {/* Header */}
      <View style={styleSheet.header}>
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
            <View style={styleSheet.stylesContainer}>
              {Object.entries(styles).map(([key, style]) => (
                <StyleCard
                  key={key}
                  style={key}
                  emoji={style.emoji}
                  name={style.name}
                  isSelected={selectedStyle === key}
                  onSelect={() => setSelectedStyle(key)}
                />
              ))}
              <StyleCard
                style="CUSTOM"
                emoji="✨"
                name="Custom"
                isSelected={selectedStyle === 'CUSTOM'}
                onSelect={() => setSelectedStyle('CUSTOM')}
              />
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
                  <Text style={styleSheet.generateButtonText}>Generating...</Text>
                </View>
              ) : (
                <View style={styleSheet.buttonContent}>
                  <Ionicons name="send" size={20} color="white" />
                  <Text style={styleSheet.generateButtonText}>Generate App</Text>
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
                onSelect={() => handleTemplateSelect(template.prompt)}
              />
            ))}
          </View>
        )}
      </ScrollView>
    </View>
  );
}

interface StyleCardProps {
  style: string;
  emoji: string;
  name: string;
  isSelected: boolean;
  onSelect: () => void;
}

function StyleCard({ emoji, name, isSelected, onSelect }: StyleCardProps) {
  return (
    <TouchableOpacity
      style={[
        styleSheet.styleCard,
        isSelected && styleSheet.styleCardSelected
      ]}
      onPress={onSelect}
    >
      <Text style={styleSheet.styleEmoji}>{emoji}</Text>
      <Text style={[
        styleSheet.styleName,
        isSelected && styleSheet.styleNameSelected
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
  stylesContainer: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    flexWrap: 'wrap',
    gap: 12,
  },
  styleCard: {
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
  },
  styleCardSelected: {
    backgroundColor: '#FFF3C4',
    borderColor: AppColors.FABMain,
    borderWidth: 2,
    elevation: 6,
    shadowOpacity: 0.2,
    shadowRadius: 4,
  },
  styleEmoji: {
    fontSize: 24,
    marginBottom: 4,
  },
  styleName: {
    fontSize: 12,
    fontWeight: '600',
    color: 'rgba(0, 0, 0, 0.8)',
    textAlign: 'center',
  },
  styleNameSelected: {
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