import React, { useState, useRef, useEffect } from 'react';
import { StyleSheet, View, Text, TextInput, TouchableOpacity, FlatList, KeyboardAvoidingView, Platform, ActivityIndicator, Switch } from 'react-native';
import { Stack, useRouter, useRootNavigationState } from 'expo-router';
import MaterialIcons from '@expo/vector-icons/MaterialIcons';
import Animated, { FadeIn, FadeInDown, SlideInRight, SlideInLeft } from 'react-native-reanimated';
import { Colors, Spacing, BorderRadius, Shadows } from '@/constants/theme';
import { useColorScheme } from '@/hooks/use-color-scheme';
import { useAiAssistantViewModel, Message } from '@/src/viewmodels/useAiAssistantViewModel';
import { useAuthViewModel } from '@/src/viewmodels/useAuthViewModel';
import { useTranslation } from 'react-i18next';

export default function AiChatScreen() {
  const colorScheme = useColorScheme() ?? 'light';
  const themeColors = Colors[colorScheme as 'light' | 'dark'];
  const router = useRouter();
  const { role } = useAuthViewModel();
  const { t } = useTranslation();
  const { messages, isLoading, isListening, voiceReplyEnabled, setVoiceReplyEnabled, sendMessage, startVoiceChat } = useAiAssistantViewModel();

  const navigationState = useRootNavigationState();
  const isNavReady = navigationState?.key;

  // --- Doctor Shield & Redirect ---
  useEffect(() => {
    if (isNavReady && role === 'doctor') {
      router.replace('/doctor-home');
    }
  }, [role, isNavReady]);

  const [inputText, setInputText] = useState('');
  const [showVoicePanel, setShowVoicePanel] = useState(false);

  const flatListRef = useRef<FlatList>(null);

  const handleSend = () => {
    if (inputText.trim()) {
      sendMessage(inputText);
      setInputText('');
    }
  };

  useEffect(() => {
    // Scroll to bottom when new messages arrive
    setTimeout(() => flatListRef.current?.scrollToEnd({ animated: true }), 100);
  }, [messages]);

  // Prevent UI flicker for doctors before redirect
  if (role === 'doctor') {
    return (
      <View style={{ flex: 1, backgroundColor: themeColors.background, justifyContent: 'center', alignItems: 'center' }}>
        <ActivityIndicator size="large" color={themeColors.tint} />
      </View>
    );
  }

  const renderMessage = ({ item }: { item: Message }) => {
    const isAssistant = item.sender === 'assistant';
    return (
      <Animated.View 
        entering={isAssistant ? SlideInLeft : SlideInRight}
        style={[
          styles.messageBubble, 
          isAssistant ? [styles.assistantBubble, { backgroundColor: themeColors.card, borderColor: themeColors.border }] 
                      : [styles.userBubble, { backgroundColor: themeColors.tint }]
        ]}
      >
        <Text style={[styles.messageText, { color: isAssistant ? themeColors.text : '#fff' }]}>
          {item.text}
        </Text>
      </Animated.View>
    );
  };

  return (
    <KeyboardAvoidingView 
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      keyboardVerticalOffset={Platform.OS === 'ios' ? 90 : 0}
      style={[styles.container, { backgroundColor: themeColors.background }]}
    >
      <Stack.Screen
        options={{
          title: t('ai.title'),
          headerShown: true,
          headerLeft: () => (
            <TouchableOpacity onPress={() => router.back()} style={{ marginLeft: 4 }}>
              <MaterialIcons name="arrow-back" size={24} color={themeColors.text} />
            </TouchableOpacity>
          ),
          headerRight: () => (
            <TouchableOpacity
              onPress={() => setShowVoicePanel(p => !p)}
              style={{ marginRight: 4, padding: 4 }}
            >
              <MaterialIcons
                name="record-voice-over"
                size={24}
                color={voiceReplyEnabled ? themeColors.tint : themeColors.muted}
              />
            </TouchableOpacity>
          ),
        }}
      />

      {/* Voice reply settings panel */}
      {showVoicePanel && (
        <Animated.View
          entering={FadeInDown.duration(220)}
          style={[styles.voicePanel, { backgroundColor: themeColors.card, borderColor: themeColors.border }]}
        >
          <View style={styles.voicePanelRow}>
            <View style={{ flex: 1 }}>
              <Text style={[styles.voicePanelTitle, { color: themeColors.text }]}>Voice Replies</Text>
              <Text style={[styles.voicePanelSub, { color: themeColors.muted }]}>
                AI speaks its response aloud after every message
              </Text>
            </View>
            <Switch
              value={voiceReplyEnabled}
              onValueChange={setVoiceReplyEnabled}
              trackColor={{ false: themeColors.border, true: themeColors.tint + '88' }}
              thumbColor={voiceReplyEnabled ? themeColors.tint : themeColors.muted}
            />
          </View>
          {voiceReplyEnabled && (
            <View style={[styles.voiceActiveBar, { backgroundColor: themeColors.tint + '15' }]}>
              <MaterialIcons name="volume-up" size={14} color={themeColors.tint} />
              <Text style={[styles.voiceActiveText, { color: themeColors.tint }]}>
                Voice replies are ON — AI will speak every response
              </Text>
            </View>
          )}
        </Animated.View>
      )}

      <FlatList
        ref={flatListRef}
        data={messages}
        keyExtractor={(item) => item.id}
        renderItem={renderMessage}
        contentContainerStyle={styles.chatContent}
        showsVerticalScrollIndicator={false}
      />

      {isLoading && (
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="small" color={themeColors.tint} />
          <Text style={{ color: themeColors.muted, fontSize: 12, marginLeft: 8 }}>{t('ai.thinking')}</Text>
        </View>
      )}

      <View style={[styles.inputContainer, { backgroundColor: themeColors.background, borderTopColor: themeColors.border }]}>
        <TouchableOpacity 
          style={[styles.voiceButton, { backgroundColor: isListening ? themeColors.emergency : themeColors.card, borderColor: themeColors.border }]}
          onPress={startVoiceChat}
        >
          <Text style={{ fontSize: 20 }}>{isListening ? '🛑' : '🎙️'}</Text>
        </TouchableOpacity>
        
        <TextInput
          style={[styles.input, { backgroundColor: themeColors.card, color: themeColors.text, borderColor: themeColors.border }]}
          placeholder={t('ai.placeholder')}
          placeholderTextColor={themeColors.muted}
          value={inputText}
          onChangeText={setInputText}
          multiline
        />

        <TouchableOpacity 
          style={[styles.sendButton, { backgroundColor: themeColors.tint }]}
          onPress={handleSend}
          disabled={!inputText.trim()}
        >
          <Text style={styles.sendButtonText}>{t('ai.send')}</Text>
        </TouchableOpacity>
      </View>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  chatContent: {
    padding: Spacing.lg,
    paddingBottom: Spacing.xl,
  },
  messageBubble: {
    maxWidth: '80%',
    padding: Spacing.md,
    borderRadius: BorderRadius.xl,
    marginBottom: Spacing.md,
    ...Shadows.light,
  },
  assistantBubble: {
    alignSelf: 'flex-start',
    borderBottomLeftRadius: 0,
    borderWidth: 1,
  },
  userBubble: {
    alignSelf: 'flex-end',
    borderBottomRightRadius: 0,
  },
  messageText: {
    fontSize: 16,
    lineHeight: 22,
  },
  loadingContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: Spacing.xl,
    paddingBottom: Spacing.sm,
  },
  inputContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: Spacing.md,
    borderTopWidth: 1,
    gap: Spacing.sm,
  },
  input: {
    flex: 1,
    minHeight: 44,
    maxHeight: 100,
    borderRadius: BorderRadius.lg,
    paddingHorizontal: Spacing.md,
    paddingTop: 10,
    paddingBottom: 10,
    borderWidth: 1,
    fontSize: 16,
  },
  voiceButton: {
    width: 44,
    height: 44,
    borderRadius: 22,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1,
  },
  sendButton: {
    paddingHorizontal: Spacing.md,
    height: 44,
    borderRadius: BorderRadius.lg,
    justifyContent: 'center',
    alignItems: 'center',
  },
  sendButtonText: {
    color: '#fff',
    fontWeight: '700',
  },
  voicePanel: {
    marginHorizontal: Spacing.md,
    marginTop: Spacing.sm,
    borderRadius: BorderRadius.lg,
    borderWidth: 1,
    padding: Spacing.md,
    gap: 10,
  },
  voicePanelRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  voicePanelTitle: {
    fontSize: 15,
    fontWeight: '700',
    marginBottom: 2,
  },
  voicePanelSub: {
    fontSize: 12,
    lineHeight: 16,
  },
  voiceActiveBar: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 8,
  },
  voiceActiveText: {
    fontSize: 12,
    fontWeight: '600',
  },
});
