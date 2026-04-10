import React, { useState, useEffect, useRef } from 'react';
import { StyleSheet, View, Text, TextInput, TouchableOpacity, FlatList, KeyboardAvoidingView, Platform, ActivityIndicator, Linking, Alert, Modal } from 'react-native';
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

export default function ChatRoomScreen() {
  const { partnerId, partnerName } = useLocalSearchParams<{ partnerId: string; partnerName: string }>();
  const { t } = useTranslation();
  const colorScheme = useColorScheme() ?? 'light';
  const themeColors = Colors[colorScheme as 'light' | 'dark'];
  const { session, role } = useAuthViewModel();
  const flatListRef = useRef<FlatList>(null);

  const [messages, setMessages] = useState<DirectMessage[]>([]);
  const [inputText, setInputText] = useState('');
  const [loading, setLoading] = useState(true);
  const [isPartnerActive, setIsPartnerActive] = useState(false);
  const [presenceLabel, setPresenceLabel] = useState('Checking...');
  const [recording, setRecording] = useState<Audio.Recording | null>(null);
  const [selectedImage, setSelectedImage] = useState<string | null>(null);
  const [isUploading, setIsUploading] = useState(false);
  const { i18n } = useTranslation();

  // Determines presence label based on last_seen timestamp
  const updatePresenceFromTimestamp = (lastSeen: string | null) => {
    if (!lastSeen) { setIsPartnerActive(false); setPresenceLabel('Offline'); return; }
    const diff = (Date.now() - new Date(lastSeen).getTime()) / 1000; // seconds
    if (diff < 90) { setIsPartnerActive(true); setPresenceLabel('Active Now'); }
    else if (diff < 300) { setIsPartnerActive(false); setPresenceLabel(`Active ${Math.round(diff / 60)}m ago`); }
    else if (diff < 3600) { setIsPartnerActive(false); setPresenceLabel(`Active ${Math.round(diff / 60)}m ago`); }
    else { setIsPartnerActive(false); setPresenceLabel('Offline'); }
  };

  const handleSpeak = (text: string) => {
    SpeechService.speak(text, i18n.language);
  };

  const userId = session?.user?.id;
  const chatId = userId ? ChatService.getChatId(userId, partnerId) : '';
  const isDemoChat = partnerId === 'demo-doctor-001';
  const isDoctor = (partnerId || '').startsWith('doc-') || isDemoChat;

  // --- Call State ---
  const [callStatus, setCallStatus] = useState<'idle' | 'calling' | 'connected'>('idle');
  const [callType, setCallType] = useState<'voice' | 'video'>('voice');
  const [callDuration, setCallDuration] = useState(0);
  const [isMuted, setIsMuted] = useState(false);
  const [isSpeakerOn, setIsSpeakerOn] = useState(false);

  const handlePhoneCall = () => {
    setCallType('voice');
    setCallStatus('calling');
    setTimeout(() => setCallStatus('connected'), 2000);
  };

  const handleVideoCall = () => {
    setCallType('video');
    setCallStatus('calling');
    setTimeout(() => setCallStatus('connected'), 2500);
  };

  const endCall = () => {
    setCallStatus('idle');
    setCallDuration(0);
  };

  useEffect(() => {
    let interval: any;
    if (callStatus === 'connected') {
      interval = setInterval(() => {
        setCallDuration(prev => prev + 1);
      }, 1000);
    }
    return () => clearInterval(interval);
  }, [callStatus]);

  const formatTime = (seconds: number) => {
    const min = Math.floor(seconds / 60);
    const sec = seconds % 60;
    return `${min}:${sec < 10 ? '0' : ''}${sec}`;
  };

  useEffect(() => {
    if (!session) return;

    if (isDemoChat) {
      setMessages([
        { 
          id: '1', 
          chat_id: 'demo', 
          sender_id: partnerId, 
          receiver_id: userId || '', 
          message_text: t('home.welcome') + "! I'm Dr. Sarah Wilson. How can I help you today?", 
          timestamp: new Date().toISOString() 
        }
      ]);
      setLoading(false);
      return;
    }

    if (!chatId) return;

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

    // 3. Fetch partner's last_seen from profiles for accurate presence
    const checkPresence = async () => {
      const { data } = await supabase.from('profiles').select('last_seen').eq('id', partnerId).single();
      updatePresenceFromTimestamp(data?.last_seen ?? null);
    };
    checkPresence();

    // 4. Subscribe to real-time changes on partner's profile row
    const presenceSub = supabase
      .channel(`profile_presence_${partnerId}`)
      .on('postgres_changes', {
        event: 'UPDATE',
        schema: 'public',
        table: 'profiles',
        filter: `id=eq.${partnerId}`,
      }, (payload: any) => {
        updatePresenceFromTimestamp(payload.new?.last_seen ?? null);
      })
      .subscribe();

    // Refresh presence every 60s as a fallback
    const presenceInterval = setInterval(checkPresence, 60000);

    return () => {
      subscription.unsubscribe();
      presenceSub.unsubscribe();
      clearInterval(presenceInterval);
    };
  }, [chatId, session, userId, partnerId]);

  const generateUUID = () => {
    return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function(c) {
      const r = Math.random() * 16 | 0, v = c === 'x' ? r : (r & 0x3 | 0x8);
      return v.toString(16);
    });
  };

  const pickImage = async () => {
    let result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images'],
      allowsEditing: true,
      quality: 0.7,
    });
    if (!result.canceled && result.assets && result.assets.length > 0) {
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
        const { recording: newRecording } = await Audio.Recording.createAsync(Audio.RecordingOptionsPresets.HIGH_QUALITY);
        setRecording(newRecording);
      }
    } catch (err) {
      console.error(err);
      setRecording(null);
      setIsUploading(false);
    }
  };

  const handleSend = async (attachmentUrl?: string, attachmentType?: 'image' | 'video' | 'audio') => {
    if (!inputText.trim() && !attachmentUrl) return;

    const newMsg: DirectMessage = {
      id: generateUUID(),
      chat_id: isDemoChat ? 'demo' : chatId,
      sender_id: userId || '',
      receiver_id: partnerId,
      message_text: inputText.trim() || (attachmentType === 'image' ? '📸 Image Sent' : '🎙️ Voice Note'),
      timestamp: new Date().toISOString(),
      attachment_url: attachmentUrl,
      attachment_type: attachmentType,
    };

    setInputText('');
    
    // INSTANT UI UPDATE (Optimistic)
    setMessages(prev => [...prev, newMsg]);
    setTimeout(() => flatListRef.current?.scrollToEnd({ animated: true }), 100);
    
    if (isDemoChat) {
      // Mock auto-reply
      setTimeout(() => {
        setMessages(prev => [...prev, {
          id: generateUUID(),
          chat_id: 'demo',
          sender_id: partnerId,
          receiver_id: userId || '',
          message_text: "Thank you for the update. I've noted this in your clinical record.",
          timestamp: new Date().toISOString()
        }]);
        setTimeout(() => flatListRef.current?.scrollToEnd({ animated: true }), 100);
      }, 1500);
      return;
    }

    try {
      await ChatService.sendMessage(newMsg);
    } catch (err) {
      console.error(err);
    }
  };

  const formatTimestamp = (dateStr?: string) => {
    if (!dateStr) return '';
    const date = new Date(dateStr);
    return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  };

  const renderMessage = ({ item }: { item: DirectMessage }) => {
    const isMe = item.sender_id === userId;
    const isImageOnly = item.attachment_type === 'image' && item.attachment_url;
    const isAudio = item.attachment_type === 'audio' && item.attachment_url;

    return (
      <Animated.View 
        entering={isMe ? SlideInRight : SlideInLeft}
        style={[
          styles.messageBubble, 
          isMe ? [styles.myBubble, { backgroundColor: themeColors.tint }] 
               : [styles.partnerBubble, { backgroundColor: themeColors.card, borderColor: themeColors.border }],
          (isImageOnly || isAudio) && { padding: isAudio ? 12 : 0, overflow: 'hidden', backgroundColor: isAudio ? (isMe ? themeColors.tint : themeColors.card) : 'transparent' }
        ]}
      >
        {/* IMAGE MESSAGE */}
        {isImageOnly && (
          <TouchableOpacity
            activeOpacity={0.9}
            onPress={() => setSelectedImage(item.attachment_url!)}
            style={styles.imageBubbleContainer}
          >
            <Image
              source={{ uri: item.attachment_url }}
              style={styles.chatImage}
              contentFit="cover"
              transition={200}
              onLoadStart={() => console.log(`[Image] Loading: ${item.attachment_url}`)}
              onLoad={() => console.log(`[Image] Success: ${item.attachment_url}`)}
              onError={(e) => console.error(`[Image] Failed: ${item.attachment_url}`, e)}
              placeholder={require('@/assets/images/icon.png')}
            />
            
            {/* Overlay timestamp */}
            <LinearGradient
              colors={['transparent', 'rgba(0,0,0,0.6)']}
              style={styles.imageOverlay}
            >
              <Text style={styles.imageTimestamp}>
                {formatTimestamp(item.timestamp)}
              </Text>
            </LinearGradient>
          </TouchableOpacity>
        )}

        {/* AUDIO MESSAGE */}
        {isAudio && (
          <AudioMessage 
            uri={item.attachment_url!} 
            isMe={isMe} 
            timestamp={formatTimestamp(item.timestamp)} 
          />
        )}

        {/* TEXT — hide if image-only or audio */}
        {!isImageOnly && !isAudio && (
          <View>
            <Text style={[styles.messageText, { color: isMe ? '#fff' : themeColors.text }]}>
              {item.message_text}
            </Text>
            <Text style={[styles.textTimestamp, { color: isMe ? 'rgba(255,255,255,0.7)' : themeColors.muted }]}>
              {formatTimestamp(item.timestamp)}
            </Text>
          </View>
        )}

        {!isMe && !isImageOnly && !isAudio && (
          <TouchableOpacity 
            style={styles.msgSpeakerBtn} 
            onPress={() => handleSpeak(item.message_text)}
          >
            <MaterialIcons name="volume-up" size={16} color={themeColors.muted} />
          </TouchableOpacity>
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
              <Text style={{ fontSize: 17, fontWeight: '600', color: themeColors.text }}>
                {role === 'doctor' ? `Patient ${partnerName || ''}` : (partnerName || t('common.call'))}
              </Text>
              <View style={{ flexDirection: 'row', alignItems: 'center', marginTop: 2 }}>
                <View style={{ width: 8, height: 8, borderRadius: 4, backgroundColor: isPartnerActive ? '#10B981' : '#9CA3AF', marginRight: 4 }} />
                <Text style={{ fontSize: 12, color: isPartnerActive ? '#10B981' : '#9CA3AF', fontWeight: '500' }}>
                  {presenceLabel}
                </Text>
              </View>
            </View>
          ),
          headerTitleAlign: 'center',
          headerShown: true,
          headerRight: () => (
            <View style={{ flexDirection: 'row', gap: 18, marginRight: 8 }}>
              <TouchableOpacity onPress={handlePhoneCall}>
                <MaterialIcons name="phone" size={24} color={themeColors.tint} />
              </TouchableOpacity>
              <TouchableOpacity onPress={handleVideoCall}>
                <MaterialIcons name="videocam" size={26} color={themeColors.tint} />
              </TouchableOpacity>
            </View>
          )
        }} 
      />
      
      {loading ? (
        <View style={styles.centered}><ActivityIndicator color={themeColors.tint} /></View>
      ) : (
        <FlatList
          ref={flatListRef}
          data={messages}
          keyExtractor={(item, index) => item.id || index.toString()}
          renderItem={renderMessage}
          contentContainerStyle={styles.chatContent}
        />
      )}

      <View style={[styles.inputContainer, { backgroundColor: themeColors.card, borderTopColor: themeColors.border }]}>
        <TouchableOpacity 
          style={styles.attachButton}
          onPress={pickImage}
          disabled={isUploading}
        >
          {isUploading ? <ActivityIndicator size="small" color={themeColors.tint} /> : <MaterialIcons name="add" size={26} color={themeColors.tint} />}
        </TouchableOpacity>
        
        <TextInput
          style={[styles.input, { color: themeColors.text }]}
          placeholder={recording ? 'Recording audio...' : (t('common.loading') === 'Loading...' ? 'Type a message...' : 'Kọ ọrọ rẹ nibi...')}
          placeholderTextColor={recording ? '#EF4444' : themeColors.muted}
          value={inputText}
          onChangeText={setInputText}
          multiline
          editable={!recording && !isUploading}
        />
        
        {inputText.trim() ? (
          <TouchableOpacity 
            style={[styles.sendButton, { backgroundColor: themeColors.tint }]}
            onPress={() => handleSend()}
          >
            <MaterialIcons name="send" size={20} color="#fff" />
          </TouchableOpacity>
        ) : (
          <TouchableOpacity 
            style={[styles.sendButton, { backgroundColor: recording ? '#EF4444' : themeColors.tint }]}
            onPress={handleRecord}
          >
            <MaterialIcons name={recording ? "stop" : "mic"} size={22} color="#fff" />
          </TouchableOpacity>
        )}
      </View>

      {/* --- In-App Call Overlay --- */}
      {callStatus !== 'idle' && session && (
        <Animated.View 
          entering={FadeIn}
          style={[StyleSheet.absoluteFill, { backgroundColor: '#0F172A', zIndex: 1000 }]}
        >
          {callType === 'video' && callStatus === 'connected' ? (
            <View style={StyleSheet.absoluteFill}>
              <LinearGradient colors={['#312E81', '#1E1B4B']} style={StyleSheet.absoluteFill} />
              <View style={[StyleSheet.absoluteFill, { justifyContent: 'center', alignItems: 'center' }]}>
                <MaterialIcons name="videocam" size={80} color="rgba(255,255,255,0.2)" />
                <Text style={{ color: 'rgba(255,255,255,0.5)', marginTop: 20, fontWeight: '600' }}>Secure Feed Active</Text>
              </View>
            </View>
          ) : (
            <LinearGradient colors={['#1E293B', '#0F172A']} style={StyleSheet.absoluteFill} />
          )}

          <View style={styles.callOverlayContent}>
            <View style={styles.callHeader}>
              <View style={styles.callInfo}>
                <Text style={styles.callName}>{partnerName || t('common.doctor')}</Text>
                <Text style={styles.callStatusText}>
                  {callStatus === 'calling' ? (t('common.loading') === 'Loading...' ? 'Calling...' : 'Ń pè...') : formatTime(callDuration)}
                </Text>
              </View>
              {callStatus === 'connected' && (
                <View style={styles.secureBadge}>
                  <MaterialIcons name="lock" size={12} color="#10B981" />
                  <Text style={styles.secureText}>SECURE</Text>
                </View>
              )}
            </View>

            {callStatus === 'calling' || callType === 'voice' ? (
              <View style={styles.callCenter}>
                <View style={[styles.callAvatar, { borderColor: themeColors.tint }]}>
                  <Text style={styles.callAvatarText}>{(partnerName || 'D').charAt(0)}</Text>
                </View>
              </View>
            ) : null}

            <View style={styles.callFooter}>
              <View style={styles.callActionsRow}>
                <TouchableOpacity 
                  style={[styles.secondaryCallAction, isMuted && { backgroundColor: 'rgba(239,68,68,0.3)' }]} 
                  onPress={() => setIsMuted(!isMuted)}
                >
                  <MaterialIcons name={isMuted ? "mic-off" : "mic"} size={24} color="#fff" />
                </TouchableOpacity>
                <TouchableOpacity 
                  style={[styles.secondaryCallAction, isSpeakerOn && { backgroundColor: themeColors.tint + '60' }]} 
                  onPress={() => setIsSpeakerOn(!isSpeakerOn)}
                >
                  <MaterialIcons name={isSpeakerOn ? "volume-up" : "volume-down"} size={24} color="#fff" />
                </TouchableOpacity>
                {callType === 'video' && (
                  <TouchableOpacity style={styles.secondaryCallAction} onPress={() => setCallType(callType === 'video' ? 'voice' : 'video')}>
                    <MaterialIcons name="switch-video" size={24} color="#fff" />
                  </TouchableOpacity>
                )}
              </View>
              
              <TouchableOpacity style={styles.endCallBtn} onPress={endCall}>
                <MaterialIcons name="call-end" size={32} color="#fff" />
              </TouchableOpacity>
            </View>
          </View>
        </Animated.View>
      )}
      {/* Full Screen Image Modal */}
      <Modal visible={!!selectedImage} transparent={true} animationType="fade">
        <View style={styles.modalContainer}>
          <TouchableOpacity 
            style={styles.modalCloseBtn} 
            onPress={() => setSelectedImage(null)}
          >
            <MaterialIcons name="close" size={32} color="#fff" />
          </TouchableOpacity>
          {selectedImage && (
            <Image 
              source={{ uri: selectedImage }} 
              style={styles.fullImage} 
              contentFit="contain" 
            />
          )}
        </View>
      </Modal>
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
  chatImage: { width: 240, height: 240, borderRadius: BorderRadius.xl },
  imageBubbleContainer: { width: 240, height: 240, borderRadius: BorderRadius.xl, backgroundColor: 'rgba(255,255,255,0.05)', overflow: 'hidden' },
  imageOverlay: { position: 'absolute', bottom: 0, left: 0, right: 0, height: 40, justifyContent: 'flex-end', padding: 8, borderRadius: BorderRadius.xl },
  imageTimestamp: { color: '#fff', fontSize: 10, alignSelf: 'flex-end', fontWeight: '600' },
  textTimestamp: { fontSize: 10, alignSelf: 'flex-end', marginTop: 4 },
  imageCaption: { paddingHorizontal: 10, paddingVertical: 5, alignItems: 'center' },
  inputContainer: { flexDirection: 'row', alignItems: 'center', padding: Spacing.sm, borderTopWidth: 1, gap: 10 },
  attachButton: { width: 44, height: 44, borderRadius: 22, justifyContent: 'center', alignItems: 'center', backgroundColor: 'transparent' },
  input: { flex: 1, minHeight: 44, maxHeight: 100, paddingHorizontal: 16, fontSize: 16 },
  sendButton: { width: 44, height: 44, borderRadius: 22, justifyContent: 'center', alignItems: 'center' },
  sendButtonText: { color: '#fff', fontWeight: '800' },

  // Call UI Styles
  callOverlayContent: { flex: 1, padding: 40, justifyContent: 'space-between', backgroundColor: 'rgba(0,0,0,0.4)', paddingBottom: 60 },
  callHeader: { alignItems: 'center', marginTop: 20 },
  callInfo: { alignItems: 'center', gap: 4 },
  callName: { color: '#fff', fontSize: 24, fontWeight: '900' },
  callStatusText: { color: 'rgba(255,255,255,0.7)', fontSize: 16, fontWeight: '600', letterSpacing: 1 },
  secureBadge: { flexDirection: 'row', alignItems: 'center', gap: 4, backgroundColor: 'rgba(16,185,129,0.15)', paddingHorizontal: 10, paddingVertical: 4, borderRadius: 12, marginTop: 12 },
  secureText: { color: '#10B981', fontSize: 10, fontWeight: '800' },
  callCenter: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  callAvatar: { width: 120, height: 120, borderRadius: 60, backgroundColor: 'rgba(255,255,255,0.1)', borderWidth: 4, justifyContent: 'center', alignItems: 'center' },
  callAvatarText: { color: '#fff', fontSize: 48, fontWeight: '800' },
  msgSpeakerBtn: {
    marginTop: 4,
    alignSelf: 'flex-start',
    padding: 4,
  },
  callFooter: { alignItems: 'center', gap: 30 },
  callActionsRow: { flexDirection: 'row', gap: 20 },
  secondaryCallAction: { width: 56, height: 56, borderRadius: 28, backgroundColor: 'rgba(255,255,255,0.15)', justifyContent: 'center', alignItems: 'center' },
  endCallBtn: { width: 80, height: 80, borderRadius: 40, backgroundColor: '#EF4444', justifyContent: 'center', alignItems: 'center', ...Shadows.medium },
  modalContainer: { flex: 1, backgroundColor: 'rgba(0,0,0,0.9)', justifyContent: 'center', alignItems: 'center' },
  modalCloseBtn: { position: 'absolute', top: 50, right: 20, zIndex: 10, padding: 10 },
  fullImage: { width: '100%', height: '100%' },
});
