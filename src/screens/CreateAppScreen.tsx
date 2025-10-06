import React, { useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, TextInput, ScrollView, Alert } from 'react-native';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { RootStackParamList } from './MyAppScreen';

type Props = NativeStackScreenProps<RootStackParamList, 'CreateApp'>;

export default function CreateAppScreen({ navigation }: Props) {
  const [appName, setAppName] = useState('');
  const [appDescription, setAppDescription] = useState('');
  const [selectedTemplate, setSelectedTemplate] = useState<string | null>(null);

  const templates = [
    { id: 'blank', name: 'Blank App', description: 'Start with a minimal setup' },
    { id: 'navigation', name: 'Navigation App', description: 'Pre-configured with navigation' },
    { id: 'tabs', name: 'Tab Navigation', description: 'Bottom tab navigation setup' },
    { id: 'drawer', name: 'Drawer Navigation', description: 'Side drawer navigation' },
  ];

  const handleCreateApp = () => {
    if (!appName.trim()) {
      Alert.alert('Error', 'Please enter an app name');
      return;
    }
    
    if (!selectedTemplate) {
      Alert.alert('Error', 'Please select a template');
      return;
    }

    Alert.alert(
      'App Created!',
      `Your app "${appName}" has been created with the ${templates.find(t => t.id === selectedTemplate)?.name} template.`,
      [
        {
          text: 'OK',
          onPress: () => navigation.navigate('MyApp'),
        },
      ]
    );
  };

  return (
    <ScrollView style={styles.container} showsVerticalScrollIndicator={false}>
      <Text style={styles.title}>Create New App</Text>
      
      <View style={styles.form}>
        <View style={styles.inputGroup}>
          <Text style={styles.label}>App Name</Text>
          <TextInput
            style={styles.input}
            value={appName}
            onChangeText={setAppName}
            placeholder="Enter your app name"
            placeholderTextColor="#999"
          />
        </View>

        <View style={styles.inputGroup}>
          <Text style={styles.label}>Description (Optional)</Text>
          <TextInput
            style={[styles.input, styles.textArea]}
            value={appDescription}
            onChangeText={setAppDescription}
            placeholder="Describe your app"
            placeholderTextColor="#999"
            multiline
            numberOfLines={3}
          />
        </View>

        <View style={styles.inputGroup}>
          <Text style={styles.label}>Choose Template</Text>
          {templates.map((template) => (
            <TouchableOpacity
              key={template.id}
              style={[
                styles.templateCard,
                selectedTemplate === template.id && styles.selectedTemplate,
              ]}
              onPress={() => setSelectedTemplate(template.id)}
            >
              <View style={styles.templateInfo}>
                <Text style={[
                  styles.templateName,
                  selectedTemplate === template.id && styles.selectedText,
                ]}>
                  {template.name}
                </Text>
                <Text style={[
                  styles.templateDescription,
                  selectedTemplate === template.id && styles.selectedText,
                ]}>
                  {template.description}
                </Text>
              </View>
              <View style={[
                styles.radio,
                selectedTemplate === template.id && styles.radioSelected,
              ]} />
            </TouchableOpacity>
          ))}
        </View>
      </View>

      <View style={styles.buttonContainer}>
        <TouchableOpacity
          style={styles.createButton}
          onPress={handleCreateApp}
        >
          <Text style={styles.createButtonText}>Create App</Text>
        </TouchableOpacity>
        
        <TouchableOpacity
          style={styles.cancelButton}
          onPress={() => navigation.goBack()}
        >
          <Text style={styles.cancelButtonText}>Cancel</Text>
        </TouchableOpacity>
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f5f5f5',
    padding: 20,
  },
  title: {
    fontSize: 32,
    fontWeight: 'bold',
    color: '#333',
    marginBottom: 30,
    marginTop: 20,
  },
  form: {
    flex: 1,
  },
  inputGroup: {
    marginBottom: 25,
  },
  label: {
    fontSize: 16,
    fontWeight: '600',
    color: '#333',
    marginBottom: 8,
  },
  input: {
    backgroundColor: 'white',
    borderRadius: 10,
    padding: 15,
    fontSize: 16,
    borderWidth: 1,
    borderColor: '#ddd',
  },
  textArea: {
    height: 80,
    textAlignVertical: 'top',
  },
  templateCard: {
    backgroundColor: 'white',
    borderRadius: 12,
    padding: 15,
    marginBottom: 10,
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 2,
    borderColor: '#ddd',
  },
  selectedTemplate: {
    borderColor: '#007AFF',
    backgroundColor: '#f0f8ff',
  },
  templateInfo: {
    flex: 1,
  },
  templateName: {
    fontSize: 18,
    fontWeight: '600',
    color: '#333',
    marginBottom: 4,
  },
  templateDescription: {
    fontSize: 14,
    color: '#666',
  },
  selectedText: {
    color: '#007AFF',
  },
  radio: {
    width: 20,
    height: 20,
    borderRadius: 10,
    borderWidth: 2,
    borderColor: '#ddd',
  },
  radioSelected: {
    borderColor: '#007AFF',
    backgroundColor: '#007AFF',
  },
  buttonContainer: {
    marginTop: 30,
    gap: 15,
  },
  createButton: {
    backgroundColor: '#007AFF',
    paddingVertical: 15,
    paddingHorizontal: 30,
    borderRadius: 10,
    alignItems: 'center',
  },
  createButtonText: {
    color: 'white',
    fontSize: 16,
    fontWeight: '600',
  },
  cancelButton: {
    backgroundColor: 'transparent',
    paddingVertical: 15,
    paddingHorizontal: 30,
    borderRadius: 10,
    alignItems: 'center',
    borderWidth: 2,
    borderColor: '#007AFF',
  },
  cancelButtonText: {
    color: '#007AFF',
    fontSize: 16,
    fontWeight: '600',
  },
});