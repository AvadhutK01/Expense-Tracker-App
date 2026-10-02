import React, { useState, useRef } from 'react';
import { View, Text, TextInput, TouchableOpacity, ScrollView, SafeAreaView, ActivityIndicator, StyleSheet } from 'react-native';
import Markdown from 'react-native-markdown-display';
import tw from 'tailwind-react-native-classnames';
import apiClient from '../axios/axiosInterceptor';
import MaterialIcons from '@expo/vector-icons/MaterialIcons';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { RootStackParamList } from '../router/MainRoutes';

type Props = NativeStackScreenProps<RootStackParamList, 'Chat'>;

type Message = {
  role: 'user' | 'model';
  parts: { text: string }[];
};

export default function ChatScreen({ navigation }: Props) {
  const [messages, setMessages] = useState<Message[]>([
    { role: 'model', parts: [{ text: 'Hello! I am your AI financial assistant. How can I help you today?' }] }
  ]);
  const [inputText, setInputText] = useState('');
  const [loading, setLoading] = useState(false);
  const scrollViewRef = useRef<ScrollView>(null);

  const sendMessage = async () => {
    if (!inputText.trim()) return;

    const userMessage: Message = { role: 'user', parts: [{ text: inputText.trim() }] };
    const newHistory = [...messages, userMessage];
    setMessages(newHistory);
    setInputText('');
    setLoading(true);

    try {
      const response = await apiClient.post('/chat', {
        message: userMessage.parts[0].text,
        history: messages.filter(m => m.parts[0].text !== 'Hello! I am your AI financial assistant. How can I help you today?')
      });

      setMessages([...newHistory, { role: 'model', parts: [{ text: response.data.text }] }]);
    } catch (error) {
      console.error('Chat error:', error);
      setMessages([...newHistory, { role: 'model', parts: [{ text: 'Sorry, I encountered an error. Please try again.' }] }]);
    } finally {
      setLoading(false);
    }
  };

  const getSummary = async () => {
    setLoading(true);
    setMessages([...messages, { role: 'user', parts: [{ text: 'Please summarize my financial data.' }] }]);
    try {
      const response = await apiClient.get('/chat/summary');
      setMessages(prev => [...prev, { role: 'model', parts: [{ text: response.data.summary }] }]);
    } catch (error) {
      console.error('Summary error:', error);
      setMessages(prev => [...prev, { role: 'model', parts: [{ text: 'Failed to fetch summary.' }] }]);
    } finally {
      setLoading(false);
    }
  };

  return (
    <SafeAreaView style={tw`flex-1 bg-white`}>
      <View style={tw`flex-row items-center p-4 border-b border-gray-200`}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={tw`mr-3`}>
          <MaterialIcons name="arrow-back" size={24} color="black" />
        </TouchableOpacity>
        <Text style={tw`text-lg font-bold flex-1`}>AI Assistant</Text>
        <TouchableOpacity onPress={getSummary} style={tw`bg-blue-100 px-3 py-1 rounded-full`}>
          <Text style={tw`text-blue-600 font-semibold text-sm`}>Summarize</Text>
        </TouchableOpacity>
      </View>

      <ScrollView
        ref={scrollViewRef}
        onContentSizeChange={() => scrollViewRef.current?.scrollToEnd({ animated: true })}
        style={tw`flex-1 p-4`}
      >
        {messages.map((msg, index) => (
          <View
            key={index}
            style={[
              tw`p-3 rounded-2xl mb-3`,
              { maxWidth: '85%' },
              msg.role === 'user' ? tw`bg-blue-500 self-end` : tw`bg-gray-100 self-start border border-gray-200`
            ]}
          >
            {msg.role === 'user' ? (
              <Text style={tw`text-white text-base`}>
                {msg.parts[0].text}
              </Text>
            ) : (
              <Markdown style={markdownStyles}>
                {msg.parts[0].text}
              </Markdown>
            )}
          </View>
        ))}
        {loading && (
          <View style={tw`self-start bg-gray-200 p-3 rounded-2xl mb-3`}>
            <ActivityIndicator size="small" color="#000" />
          </View>
        )}
      </ScrollView>

      <View style={tw`flex-row p-3 border-t border-gray-200 items-center`}>
        <TextInput
          style={tw`flex-1 bg-gray-100 p-3 rounded-full mr-3 text-base`}
          placeholder="Type a message..."
          value={inputText}
          onChangeText={setInputText}
          onSubmitEditing={sendMessage}
        />
        <TouchableOpacity
          onPress={sendMessage}
          style={tw`bg-blue-500 p-3 rounded-full`}
        >
          <MaterialIcons name="send" size={24} color="white" />
        </TouchableOpacity>
      </View>
    </SafeAreaView>
  );
}

const markdownStyles = StyleSheet.create({
  body: {
    color: '#1F2937',
    fontSize: 15,
    lineHeight: 22,
  },
  strong: {
    fontWeight: 'bold',
    color: '#111827',
  },
  em: {
    fontStyle: 'italic',
  },
  heading1: {
    fontSize: 20,
    fontWeight: 'bold',
    marginTop: 10,
    marginBottom: 5,
    color: '#111827',
  },
  heading2: {
    fontSize: 18,
    fontWeight: 'bold',
    marginTop: 8,
    marginBottom: 4,
    color: '#111827',
  },
  bullet_list: {
    marginTop: 5,
    marginBottom: 5,
  },
  ordered_list: {
    marginTop: 5,
    marginBottom: 5,
  },
  paragraph: {
    marginTop: 4,
    marginBottom: 4,
  },
});
