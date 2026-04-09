import React, { useState, useEffect, useRef } from 'react';
import { StyleSheet, View, Text, TextInput, TouchableOpacity, FlatList, KeyboardAvoidingView, Platform, ActivityIndicator } from 'react-native';
import { Stack, useLocalSearchParams } from 'expo-router';
import Animated, { SlideInRight, SlideInLeft } from 'react-native-reanimated';
import { Colors, Spacing, BorderRadius, Shadows } from '@/constants/theme';
import { useColorScheme } from '@/hooks/use-color-scheme';
import { ChatService, DirectMessage } from '@/src/services/ChatService';
import { useAuthViewModel } from '@/src/viewmodels/useAuthViewModel';

export default function ChatRoomScreen() {
  const { partnerId, partnerName } = useLocalSearchParams<{ partnerId: string; partnerName: string }>();
  const colorScheme = useColorScheme() ?? 'light';
  const themeColors = Colors[colorScheme as 'light' | 'dark'];
  const { session } = useAuthViewModel();
  const flatListRef = useRef<FlatList>(null);

  const [messages, setMessages] = useState<DirectMessage[]>([]);
  const [inputText, setInputText] = useState('');
  const [loading, setLoading] = useState(true);

  const chatId = ChatService.getChatId(session!.user.id, partnerId);

  useEffect(() => {
    // 1. Fetch initial messages
    const loadMessages = async () => {
      try {
        const msgs = await ChatService.getMessages(chatId);
        setMessages(msgs);
      } catch (err) {
        console.error(err);
      } finally {
        setLoading(false);
        setTimeout(() => flatListRef.current?.scrollToEnd({ animated: true }), 300);
      }
    };
    loadMessages();

    // 2. Subscribe to real-time updates
    const subscription = ChatService.subscribeToChat(chatId, (newMsg) => {
      setMessages(prev => {
        if (prev.find(m => m.id === newMsg.id)) return prev;
        return [...prev, newMsg];
      });
      setTimeout(() => flatListRef.current?.scrollToEnd({ animated: true }), 100);
    });

    return () => {
      subscription.unsubscribe();
    };
  }, [chatId]);

  const handleSend = async () => {
    if (!inputText.trim()) return;

    const newMsg: DirectMessage = {
      chat_id: chatId,
      sender_id: session!.user.id,
      receiver_id: partnerId,
      message_text: inputText,
    };

    setInputText('');
    try {
      await ChatService.sendMessage(newMsg);
    } catch (err) {
      console.error(err);
    }
  };

  const renderMessage = ({ item }: { item: DirectMessage }) => {
    const isMe = item.sender_id === session!.user.id;
    return (
      <Animated.View 
        entering={isMe ? SlideInRight : SlideInLeft}
        style={[
          styles.messageBubble, 
          isMe ? [styles.myBubble, { backgroundColor: themeColors.tint }] 
               : [styles.partnerBubble, { backgroundColor: themeColors.card, borderColor: themeColors.border }]
        ]}
      >
        <Text style={[styles.messageText, { color: isMe ? '#fff' : themeColors.text }]}>
          {item.message_text}
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
      <Stack.Screen options={{ title: partnerName || 'Clinical Chat', headerShown: true }} />
      
      {loading ? (
        <View style={styles.centered}><ActivityIndicator color={themeColors.tint} /></View>
      ) : (
        <FlatList
          ref={flatListRef}
          data={messages}
          keyExtractor={(item, index) => item.id || index.toString()}
          renderItem={renderMessage}
          contentContainerStyle={styles.chatContent}
          showsVerticalScrollIndicator={false}
        />
      )}

      <View style={[styles.inputContainer, { backgroundColor: themeColors.card, borderTopColor: themeColors.border }]}>
        <TextInput
          style={[styles.input, { color: themeColors.text }]}
          placeholder="Type a message..."
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
          <Text style={styles.sendButtonText}>Send</Text>
        </TouchableOpacity>
      </View>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  centered: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  chatContent: { padding: Spacing.md, paddingBottom: Spacing.xl },
  messageBubble: { maxWidth: '80%', padding: Spacing.md, borderRadius: BorderRadius.xl, marginBottom: Spacing.sm, ...Shadows.light },
  myBubble: { alignSelf: 'flex-end', borderBottomRightRadius: 0 },
  partnerBubble: { alignSelf: 'flex-start', borderBottomLeftRadius: 0, borderWidth: 1 },
  messageText: { fontSize: 16, lineHeight: 22 },
  inputContainer: { flexDirection: 'row', alignItems: 'center', padding: Spacing.sm, borderTopWidth: 1, gap: 10 },
  input: { flex: 1, minHeight: 44, maxHeight: 100, paddingHorizontal: 16, fontSize: 16 },
  sendButton: { paddingHorizontal: 16, height: 44, borderRadius: 22, justifyContent: 'center', alignItems: 'center' },
  sendButtonText: { color: '#fff', fontWeight: '800' },
});
