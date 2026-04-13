import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
  StyleSheet, View, Text, TextInput, TouchableOpacity, FlatList,
  KeyboardAvoidingView, Platform, ActivityIndicator, Alert, Modal,
} from 'react-native';
import MaterialIcons from '@expo/vector-icons/MaterialIcons';
import { Stack, useLocalSearchParams } from 'expo-router';
import { LinearGradient } from 'expo-linear-gradient';
import Animated, { SlideInRight, SlideInLeft, FadeIn } from 'react-native-reanimated';
import { Colors, Spacing, BorderRadius, Shadows } from '@/constants/theme';
import { useColorScheme } from '@/hooks/use-color-scheme';
import { ChatService, DirectMessage } from '@/src/services/ChatService';
import { useAuthViewModel } from '@/src/viewmodels/useAuthViewModel';
import { supabase } from '@/src/services/SupabaseService';
import { useTranslation } from 'react-i18next';
import { SpeechService } from '@/src/services/SpeechService';
import * as ImagePicker from 'expo-image-picker';
import { Audio } from 'expo-av';
import { AudioMessage } from '@/src/components/AudioMessage';
import { Image } from 'expo-image';

// ─── helpers ─────────────────────────────────────────────────────────────────

const formatTimestamp = (dateStr?: string) => {
  if (!dateStr) return '';
  return new Date(dateStr).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
};

const formatDateLabel = (dateStr?: string) => {
  if (!dateStr) return '';
  const d = new Date(dateStr);
  const today = new Date();
  const yesterday = new Date(today);
  yesterday.setDate(yesterday.getDate() - 1);
  if (d.toDateString() === today.toDateString()) return 'Today';
  if (d.toDateString() === yesterday.toDateString()) return 'Yesterday';
  return d.toLocaleDateString([], { weekday: 'long', month: 'short', day: 'numeric' });
};

const isSameDay = (a: string, b: string) =>
  new Date(a).toDateString() === new Date(b).toDateString();

type ChatItem = DirectMessage | { type: 'date_separator'; label: string; key: string };

const buildChatItems = (msgs: DirectMessage[]): ChatItem[] => {
  const items: ChatItem[] = [];
  msgs.forEach((msg, i) => {
    const prev = msgs[i - 1];
    if (!prev || !isSameDay(prev.timestamp!, msg.timestamp!)) {
      items.push({ type: 'date_separator', label: formatDateLabel(msg.timestamp), key: `sep_${msg.timestamp}` });
    }
    items.push(msg);
  });
  return items;
};

// ─── component ───────────────────────────────────────────────────────────────

export default function ChatRoomScreen() {
  const { partnerId, partnerName } = useLocalSearchParams<{ partnerId: string; partnerName: string }>();
  const { t } = useTranslation();
  const colorScheme = useColorScheme() ?? 'light';
  const themeColors = Colors[colorScheme as 'light' | 'dark'];
  const { session, role } = useAuthViewModel();
  const flatListRef = useRef<FlatList>(null);
  const { i18n } = useTranslation();

  const [messages, setMessages] = useState<DirectMessage[]>([]);
  const [inputText, setInputText] = useState('');
  const [loading, setLoading] = useState(true);
  const [isPartnerActive, setIsPartnerActive] = useState(false);
  const [presenceLabel, setPresenceLabel] = useState(t('common.checking'));
  const [recording, setRecording] = useState<Audio.Recording | null>(null);
  const [selectedImage, setSelectedImage] = useState<string | null>(null);
  const [isUploading, setIsUploading] = useState(false);
  const [readMessageIds, setReadMessageIds] = useState<Set<string>>(new Set());

  const userId = session?.user?.id ?? '';
  const chatId = userId ? ChatService.getChatId(userId, partnerId) : '';

  // ── Presence ──────────────────────────────────────────────────────────────

  const updatePresence = useCallback((lastSeen: string | null) => {
    if (!lastSeen) { setIsPartnerActive(false); setPresenceLabel(t('common.offline')); return; }
    const diff = (Date.now() - new Date(lastSeen).getTime()) / 1000;
    if (diff < 90) { setIsPartnerActive(true); setPresenceLabel(t('common.active_now')); }
    else if (diff < 3600) {
      setIsPartnerActive(false);
      setPresenceLabel(t('common.active_ago', { m: Math.round(diff / 60) }));
    } else { setIsPartnerActive(false); setPresenceLabel(t('common.offline')); }
  }, [t]);

  // ── Load + subscribe ───────────────────────────────────────────────────────

  useEffect(() => {
    if (!session || !chatId) return;

    const load = async () => {
      try {
        const msgs = await ChatService.getMessages(chatId);
        setMessages(msgs);
        // Mark received messages as read
        await ChatService.markAsRead(chatId, userId);
      } catch (err) {
        console.error(err);
      } finally {
        setLoading(false);
        setTimeout(() => flatListRef.current?.scrollToEnd({ animated: true }), 300);
      }
    };
    load();

    // New message subscription
    const msgSub = ChatService.subscribeToChat(chatId, (newMsg) => {
      setMessages(prev => {
        if (prev.find(m => m.id === newMsg.id)) return prev;
        return [...prev, newMsg];
      });
      setTimeout(() => flatListRef.current?.scrollToEnd({ animated: true }), 100);
      // Mark as read immediately if it's a received message
      if (newMsg.receiver_id === userId) {
        ChatService.markAsRead(chatId, userId);
      }
    });

    // Read receipt subscription
    const readSub = ChatService.subscribeToReadReceipts(chatId, userId, (ids) => {
      setReadMessageIds(prev => new Set([...prev, ...ids]));
    });

    // Presence
    const checkPresence = async () => {
      const { data } = await supabase.from('profiles').select('last_seen').eq('id', partnerId).single();
      updatePresence(data?.last_seen ?? null);
    };
    checkPresence();
    const presenceSub = supabase
      .channel(`profile_presence_${partnerId}`)
      .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'profiles', filter: `id=eq.${partnerId}` },
        (payload: any) => updatePresence(payload.new?.last_seen ?? null))
      .subscribe();
    const presenceInterval = setInterval(checkPresence, 60_000);

    return () => {
      msgSub.unsubscribe();
      readSub.unsubscribe();
      presenceSub.unsubscribe();
      clearInterval(presenceInterval);
    };
  }, [chatId, session, userId, partnerId, updatePresence]);

  // ── Call state ─────────────────────────────────────────────────────────────

  const [callStatus, setCallStatus] = useState<'idle' | 'calling' | 'connected'>('idle');
  const [callType, setCallType] = useState<'voice' | 'video'>('voice');
  const [callDuration, setCallDuration] = useState(0);
  const [isMuted, setIsMuted] = useState(false);
  const [isSpeakerOn, setIsSpeakerOn] = useState(false);

  useEffect(() => {
    let interval: ReturnType<typeof setInterval>;
    if (callStatus === 'connected') interval = setInterval(() => setCallDuration(p => p + 1), 1000);
    return () => clearInterval(interval);
  }, [callStatus]);

  const formatCallTime = (s: number) => `${Math.floor(s / 60)}:${(s % 60).toString().padStart(2, '0')}`;

  // ── Media ──────────────────────────────────────────────────────────────────

  const pickImage = async () => {
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images'], allowsEditing: true, quality: 0.7,
    });
    if (!result.canceled && result.assets[0]) {
      setIsUploading(true);
      const url = await ChatService.uploadMedia(result.assets[0].uri, chatId, userId || 'anon', 'image');
      setIsUploading(false);
      if (url) handleSend(url, 'image');
    }
  };

  const handleRecord = async () => {
    try {
      if (recording) {
        await recording.stopAndUnloadAsync();
        const uri = recording.getURI();
        setRecording(null);
        if (uri) {
          setIsUploading(true);
          const url = await ChatService.uploadMedia(uri, chatId, userId || 'anon', 'audio');
          setIsUploading(false);
          if (url) handleSend(url, 'audio');
        }
      } else {
        await Audio.requestPermissionsAsync();
        await Audio.setAudioModeAsync({ allowsRecordingIOS: true, playsInSilentModeIOS: true });
        const { recording: r } = await Audio.Recording.createAsync(Audio.RecordingOptionsPresets.HIGH_QUALITY);
        setRecording(r);
      }
    } catch (err) {
      console.error(err);
      setRecording(null);
      setIsUploading(false);
    }
  };

  // ── Send ───────────────────────────────────────────────────────────────────

  const generateUUID = () =>
    'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, c => {
      const r = Math.random() * 16 | 0;
      return (c === 'x' ? r : (r & 0x3 | 0x8)).toString(16);
    });

  const handleSend = async (attachmentUrl?: string, attachmentType?: 'image' | 'video' | 'audio') => {
    if (!inputText.trim() && !attachmentUrl) return;
    const newMsg: DirectMessage = {
      id: generateUUID(),
      chat_id: chatId,
      sender_id: userId,
      receiver_id: partnerId,
      message_text: inputText.trim() || (attachmentType === 'image' ? '📸 Image' : '🎙️ Voice Note'),
      timestamp: new Date().toISOString(),
      attachment_url: attachmentUrl,
      attachment_type: attachmentType,
    };
    setInputText('');
    setMessages(prev => [...prev, newMsg]);
    setTimeout(() => flatListRef.current?.scrollToEnd({ animated: true }), 100);
    try {
      const senderName = session?.user?.user_metadata?.full_name ?? 'Someone';
      await ChatService.sendMessage(newMsg, senderName);
    } catch (err) { console.error(err); }
  };

  // ── Render message ─────────────────────────────────────────────────────────

  const renderItem = ({ item }: { item: ChatItem }) => {
    // Date separator
    if ('type' in item && item.type === 'date_separator') {
      return (
        <View style={styles.dateSepRow}>
          <View style={[styles.dateSepLine, { backgroundColor: themeColors.border }]} />
          <Text style={[styles.dateSepLabel, { color: themeColors.muted, backgroundColor: themeColors.background }]}>
            {item.label}
          </Text>
          <View style={[styles.dateSepLine, { backgroundColor: themeColors.border }]} />
        </View>
      );
    }

    const msg = item as DirectMessage;
    const isMe = msg.sender_id === userId;
    const isRead = isMe && (msg.read_at || readMessageIds.has(msg.id ?? ''));
    const isImageOnly = msg.attachment_type === 'image' && msg.attachment_url;
    const isAudio = msg.attachment_type === 'audio' && msg.attachment_url;

    return (
      <Animated.View
        entering={isMe ? SlideInRight.duration(250) : SlideInLeft.duration(250)}
        style={[
          styles.bubble,
          isMe
            ? [styles.myBubble, { backgroundColor: themeColors.tint }]
            : [styles.partnerBubble, { backgroundColor: themeColors.card, borderColor: themeColors.border }],
          (isImageOnly || isAudio) && { padding: isAudio ? 10 : 0, overflow: 'hidden', backgroundColor: isAudio ? (isMe ? themeColors.tint : themeColors.card) : 'transparent' },
        ]}
      >
        {/* Image */}
        {isImageOnly && (
          <TouchableOpacity activeOpacity={0.9} onPress={() => setSelectedImage(msg.attachment_url!)}>
            <View style={styles.imageBubbleWrap}>
              <Image source={{ uri: msg.attachment_url }} style={styles.chatImage} contentFit="cover" transition={200} />
              <LinearGradient colors={['transparent', 'rgba(0,0,0,0.55)']} style={styles.imageOverlay}>
                <Text style={styles.imageTimestamp}>{formatTimestamp(msg.timestamp)}</Text>
              </LinearGradient>
            </View>
          </TouchableOpacity>
        )}

        {/* Audio */}
        {isAudio && (
          <AudioMessage uri={msg.attachment_url!} isMe={isMe} timestamp={formatTimestamp(msg.timestamp)} />
        )}

        {/* Text */}
        {!isImageOnly && !isAudio && (
          <View>
            <Text style={[styles.msgText, { color: isMe ? '#fff' : themeColors.text }]}>
              {msg.message_text}
            </Text>
            <View style={styles.msgMeta}>
              {!isMe && (
                <TouchableOpacity onPress={() => SpeechService.speak(msg.message_text, i18n.language)} style={styles.speakerBtn}>
                  <MaterialIcons name="volume-up" size={14} color={themeColors.muted} />
                </TouchableOpacity>
              )}
              <Text style={[styles.msgTime, { color: isMe ? 'rgba(255,255,255,0.65)' : themeColors.muted }]}>
                {formatTimestamp(msg.timestamp)}
              </Text>
              {/* Delivery / read ticks */}
              {isMe && (
                <MaterialIcons
                  name={isRead ? 'done-all' : 'done'}
                  size={14}
                  color={isRead ? '#60A5FA' : 'rgba(255,255,255,0.5)'}
                />
              )}
            </View>
          </View>
        )}
      </Animated.View>
    );
  };

  if (!session) {
    return (
      <View style={[styles.container, styles.centered, { backgroundColor: themeColors.background }]}>
        <ActivityIndicator color={themeColors.tint} size="large" />
      </View>
    );
  }

  const chatItems = buildChatItems(messages);

  return (
    <KeyboardAvoidingView
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      keyboardVerticalOffset={Platform.OS === 'ios' ? 90 : 0}
      style={[styles.container, { backgroundColor: themeColors.background }]}
    >
      <Stack.Screen
        options={{
          headerTitle: () => (
            <View style={{ alignItems: Platform.OS === 'ios' ? 'center' : 'flex-start' }}>
              <Text style={{ fontSize: 16, fontWeight: '700', color: themeColors.text }}>
                {role === 'doctor' ? `Patient ${partnerName ?? ''}` : (partnerName ?? '')}
              </Text>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4, marginTop: 1 }}>
                <View style={{ width: 7, height: 7, borderRadius: 4, backgroundColor: isPartnerActive ? '#10B981' : '#9CA3AF' }} />
                <Text style={{ fontSize: 11, color: isPartnerActive ? '#10B981' : '#9CA3AF', fontWeight: '600' }}>
                  {presenceLabel}
                </Text>
              </View>
            </View>
          ),
          headerTitleAlign: 'center',
          headerShown: true,
          headerRight: () => (
            <View style={{ flexDirection: 'row', gap: 18, marginRight: 8 }}>
              <TouchableOpacity onPress={() => { setCallType('voice'); setCallStatus('calling'); setTimeout(() => setCallStatus('connected'), 2000); }}>
                <MaterialIcons name="phone" size={24} color={themeColors.tint} />
              </TouchableOpacity>
              <TouchableOpacity onPress={() => { setCallType('video'); setCallStatus('calling'); setTimeout(() => setCallStatus('connected'), 2500); }}>
                <MaterialIcons name="videocam" size={26} color={themeColors.tint} />
              </TouchableOpacity>
            </View>
          ),
        }}
      />

      {loading ? (
        <View style={styles.centered}><ActivityIndicator color={themeColors.tint} /></View>
      ) : messages.length === 0 ? (
        <View style={styles.emptyState}>
          <View style={[styles.emptyIcon, { backgroundColor: themeColors.tint + '15' }]}>
            <MaterialIcons name="chat-bubble-outline" size={36} color={themeColors.tint} />
          </View>
          <Text style={[styles.emptyTitle, { color: themeColors.text }]}>Start the conversation</Text>
          <Text style={[styles.emptySub, { color: themeColors.muted }]}>
            Send a message to {partnerName ?? 'your contact'}
          </Text>
        </View>
      ) : (
        <FlatList
          ref={flatListRef}
          data={chatItems}
          keyExtractor={(item, i) => ('type' in item ? item.key : (item.id ?? i.toString()))}
          renderItem={renderItem}
          contentContainerStyle={styles.chatContent}
        />
      )}

      {/* Input bar */}
      <View style={[styles.inputBar, { backgroundColor: themeColors.card, borderTopColor: themeColors.border }]}>
        <TouchableOpacity style={styles.iconBtn} onPress={pickImage} disabled={isUploading}>
          {isUploading
            ? <ActivityIndicator size="small" color={themeColors.tint} />
            : <MaterialIcons name="add-photo-alternate" size={24} color={themeColors.tint} />
          }
        </TouchableOpacity>

        <TextInput
          style={[styles.input, { color: themeColors.text }]}
          placeholder={recording ? 'Recording…' : 'Type a message…'}
          placeholderTextColor={recording ? '#EF4444' : themeColors.muted}
          value={inputText}
          onChangeText={setInputText}
          multiline
          editable={!recording && !isUploading}
        />

        {inputText.trim() ? (
          <TouchableOpacity style={[styles.sendBtn, { backgroundColor: themeColors.tint }]} onPress={() => handleSend()}>
            <MaterialIcons name="send" size={20} color="#fff" />
          </TouchableOpacity>
        ) : (
          <TouchableOpacity
            style={[styles.sendBtn, { backgroundColor: recording ? '#EF4444' : themeColors.tint }]}
            onPress={handleRecord}
          >
            <MaterialIcons name={recording ? 'stop' : 'mic'} size={22} color="#fff" />
          </TouchableOpacity>
        )}
      </View>

      {/* ── Call overlay ── */}
      {callStatus !== 'idle' && (
        <Animated.View entering={FadeIn} style={[StyleSheet.absoluteFill, { backgroundColor: '#0F172A', zIndex: 1000 }]}>
          {callType === 'video' && callStatus === 'connected' ? (
            <LinearGradient colors={['#312E81', '#1E1B4B']} style={StyleSheet.absoluteFill} />
          ) : (
            <LinearGradient colors={['#1E293B', '#0F172A']} style={StyleSheet.absoluteFill} />
          )}
          <View style={styles.callContent}>
            <View style={styles.callTop}>
              <Text style={styles.callName}>{partnerName ?? t('common.doctor')}</Text>
              <Text style={styles.callState}>
                {callStatus === 'calling' ? 'Calling…' : formatCallTime(callDuration)}
              </Text>
              {callStatus === 'connected' && (
                <View style={styles.secureBadge}>
                  <MaterialIcons name="lock" size={11} color="#10B981" />
                  <Text style={styles.secureText}>SECURE</Text>
                </View>
              )}
            </View>
            <View style={styles.callCenter}>
              <View style={[styles.callAvatar, { borderColor: themeColors.tint }]}>
                <Text style={styles.callAvatarText}>{(partnerName ?? 'D').charAt(0)}</Text>
              </View>
            </View>
            <View style={styles.callBottom}>
              <View style={styles.callActions}>
                <TouchableOpacity style={[styles.callAction, isMuted && { backgroundColor: 'rgba(239,68,68,0.3)' }]} onPress={() => setIsMuted(p => !p)}>
                  <MaterialIcons name={isMuted ? 'mic-off' : 'mic'} size={24} color="#fff" />
                </TouchableOpacity>
                <TouchableOpacity style={[styles.callAction, isSpeakerOn && { backgroundColor: themeColors.tint + '60' }]} onPress={() => setIsSpeakerOn(p => !p)}>
                  <MaterialIcons name={isSpeakerOn ? 'volume-up' : 'volume-down'} size={24} color="#fff" />
                </TouchableOpacity>
              </View>
              <TouchableOpacity style={styles.endCallBtn} onPress={() => { setCallStatus('idle'); setCallDuration(0); }}>
                <MaterialIcons name="call-end" size={32} color="#fff" />
              </TouchableOpacity>
            </View>
          </View>
        </Animated.View>
      )}

      {/* Full-screen image modal */}
      <Modal visible={!!selectedImage} transparent animationType="fade">
        <View style={styles.modalBg}>
          <TouchableOpacity style={styles.modalClose} onPress={() => setSelectedImage(null)}>
            <MaterialIcons name="close" size={32} color="#fff" />
          </TouchableOpacity>
          {selectedImage && <Image source={{ uri: selectedImage }} style={styles.fullImage} contentFit="contain" />}
        </View>
      </Modal>
    </KeyboardAvoidingView>
  );
}

// ─── styles ───────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  container: { flex: 1 },
  centered: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  chatContent: { padding: Spacing.md, paddingBottom: Spacing.xl },

  // Date separator
  dateSepRow: { flexDirection: 'row', alignItems: 'center', marginVertical: 10, paddingHorizontal: 4 },
  dateSepLine: { flex: 1, height: 1 },
  dateSepLabel: { fontSize: 11, fontWeight: '700', paddingHorizontal: 10, textTransform: 'uppercase', letterSpacing: 0.5 },

  // Message bubbles
  bubble: { maxWidth: '80%', padding: Spacing.md, borderRadius: BorderRadius.xl, marginBottom: Spacing.sm, ...Shadows.light },
  myBubble: { alignSelf: 'flex-end', borderBottomRightRadius: 4 },
  partnerBubble: { alignSelf: 'flex-start', borderBottomLeftRadius: 4, borderWidth: 1 },
  msgText: { fontSize: 15, lineHeight: 21 },
  msgMeta: { flexDirection: 'row', alignItems: 'center', justifyContent: 'flex-end', gap: 4, marginTop: 4 },
  msgTime: { fontSize: 10 },
  speakerBtn: { marginRight: 2 },

  // Images
  imageBubbleWrap: { width: 220, height: 220, borderRadius: BorderRadius.xl, overflow: 'hidden', backgroundColor: 'rgba(0,0,0,0.05)' },
  chatImage: { width: 220, height: 220 },
  imageOverlay: { position: 'absolute', bottom: 0, left: 0, right: 0, height: 36, justifyContent: 'flex-end', padding: 6 },
  imageTimestamp: { color: '#fff', fontSize: 10, alignSelf: 'flex-end', fontWeight: '600' },

  // Empty state
  emptyState: { flex: 1, justifyContent: 'center', alignItems: 'center', gap: 12, paddingHorizontal: 40 },
  emptyIcon: { width: 72, height: 72, borderRadius: 36, justifyContent: 'center', alignItems: 'center' },
  emptyTitle: { fontSize: 18, fontWeight: '700' },
  emptySub: { fontSize: 14, textAlign: 'center', lineHeight: 20 },

  // Input bar
  inputBar: { flexDirection: 'row', alignItems: 'center', padding: Spacing.sm, borderTopWidth: 1, gap: 8 },
  iconBtn: { width: 40, height: 40, justifyContent: 'center', alignItems: 'center' },
  input: { flex: 1, minHeight: 40, maxHeight: 100, paddingHorizontal: 12, fontSize: 15 },
  sendBtn: { width: 42, height: 42, borderRadius: 21, justifyContent: 'center', alignItems: 'center' },

  // Call overlay
  callContent: { flex: 1, padding: 40, justifyContent: 'space-between', paddingBottom: 60 },
  callTop: { alignItems: 'center', marginTop: 20, gap: 6 },
  callName: { color: '#fff', fontSize: 24, fontWeight: '900' },
  callState: { color: 'rgba(255,255,255,0.65)', fontSize: 15, fontWeight: '600' },
  secureBadge: { flexDirection: 'row', alignItems: 'center', gap: 4, backgroundColor: 'rgba(16,185,129,0.15)', paddingHorizontal: 10, paddingVertical: 4, borderRadius: 12 },
  secureText: { color: '#10B981', fontSize: 10, fontWeight: '800' },
  callCenter: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  callAvatar: { width: 110, height: 110, borderRadius: 55, backgroundColor: 'rgba(255,255,255,0.1)', borderWidth: 3, justifyContent: 'center', alignItems: 'center' },
  callAvatarText: { color: '#fff', fontSize: 44, fontWeight: '800' },
  callBottom: { alignItems: 'center', gap: 28 },
  callActions: { flexDirection: 'row', gap: 20 },
  callAction: { width: 54, height: 54, borderRadius: 27, backgroundColor: 'rgba(255,255,255,0.15)', justifyContent: 'center', alignItems: 'center' },
  endCallBtn: { width: 72, height: 72, borderRadius: 36, backgroundColor: '#EF4444', justifyContent: 'center', alignItems: 'center' },

  // Image modal
  modalBg: { flex: 1, backgroundColor: 'rgba(0,0,0,0.92)', justifyContent: 'center', alignItems: 'center' },
  modalClose: { position: 'absolute', top: 52, right: 20, zIndex: 10, padding: 8 },
  fullImage: { width: '100%', height: '100%' },
});
