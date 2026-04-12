import React, { useState, useEffect, useCallback } from 'react';
import { StyleSheet, View, Text, FlatList, TouchableOpacity, ActivityIndicator, RefreshControl } from 'react-native';
import MaterialIcons from '@expo/vector-icons/MaterialIcons';
import { Stack, useRouter } from 'expo-router';
import { Colors, Spacing } from '@/constants/theme';
import { useColorScheme } from '@/hooks/use-color-scheme';
import { useAuthViewModel } from '@/src/viewmodels/useAuthViewModel';
import { ChatService } from '@/src/services/ChatService';
import { useTranslation } from 'react-i18next';
import Animated, { FadeInDown } from 'react-native-reanimated';
import { LinearGradient } from 'expo-linear-gradient';

export default function ClinicalMessagesScreen() {
  const colorScheme = useColorScheme() ?? 'light';
  const themeColors = Colors[colorScheme as 'light' | 'dark'];
  const { session } = useAuthViewModel();
  const { t } = useTranslation();
  const router = useRouter();

  const [conversations, setConversations] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const loadConversations = useCallback(async () => {
    if (!session?.user?.id) return;
    try {
      const convs = await ChatService.getConversations(session.user.id);
      setConversations(convs);
    } catch (e) {
      console.error('[ClinicalMessages] Load error:', e);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [session]);

  useEffect(() => { loadConversations(); }, [loadConversations]);
  const onRefresh = () => { setRefreshing(true); loadConversations(); };

  const getInitials = (name: string) =>
    name.split(' ').map(n => n[0]).slice(0, 2).join('').toUpperCase();

  const isOnline = (lastSeen: string | null) =>
    lastSeen ? Date.now() - new Date(lastSeen).getTime() < 5 * 60 * 1000 : false;

  const formatTime = (ts: string | null) => {
    if (!ts) return '';
    const d = new Date(ts);
    const today = new Date();
    if (d.toDateString() === today.toDateString()) {
      return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    }
    return d.toLocaleDateString([], { month: 'short', day: 'numeric' });
  };

  const renderConversation = ({ item, index }: { item: any; index: number }) => {
    const online = isOnline(item.partnerLastSeen);
    return (
      <Animated.View entering={FadeInDown.delay(index * 90).duration(400)}>
        <TouchableOpacity
          style={styles.convoCard}
          onPress={() => router.push({ pathname: '/chat-room', params: { partnerId: item.partnerId, partnerName: item.partnerName } })}
          activeOpacity={0.8}
        >
          {/* Avatar */}
          <View style={styles.avatarWrapper}>
            <LinearGradient colors={['#4338CA', '#6366F1']} style={styles.avatar}>
              <Text style={styles.avatarText}>{getInitials(item.partnerName)}</Text>
            </LinearGradient>
            {online && <View style={styles.onlineDot} />}
          </View>

          {/* Info */}
          <View style={styles.convoInfo}>
            <View style={styles.convoHeaderRow}>
              <Text style={styles.patientName} numberOfLines={1}>{item.partnerName}</Text>
              <Text style={styles.timestamp}>{formatTime(item.lastMessageTime)}</Text>
            </View>
            <View style={styles.messageRow}>
              <Text style={styles.lastMessage} numberOfLines={1}>{item.lastMessage}</Text>
              {item.unreadCount > 0 && (
                <View style={styles.unreadBadge}>
                  <Text style={styles.unreadText}>{item.unreadCount}</Text>
                </View>
              )}
            </View>
          </View>

          <MaterialIcons name="chevron-right" size={20} color="rgba(255,255,255,0.2)" />
        </TouchableOpacity>
      </Animated.View>
    );
  };

  return (
    <View style={styles.container}>
      <Stack.Screen options={{ headerShown: false }} />

      {/* Premium Header */}
      <LinearGradient colors={['#1E1B4B', '#312E81', '#4338CA']} style={styles.header}>
        <View style={StyleSheet.absoluteFill} pointerEvents="none">
          {[...Array(6)].map((_, i) => (
            <View key={i} style={[styles.gridLine, { top: i * 28 }]} />
          ))}
        </View>

        <View style={styles.headerTop}>
          <View>
            <Text style={styles.headerLabel}>SECURE MESSAGING</Text>
            <Text style={styles.headerTitle}>{t('doctor.messages_title')}</Text>
          </View>
          <View style={styles.encryptedChip}>
            <MaterialIcons name="lock" size={12} color="#10B981" />
            <Text style={styles.encryptedText}>ENCRYPTED</Text>
          </View>
        </View>

        <View style={styles.statsBar}>
          <View style={styles.statItem}>
            <MaterialIcons name="people" size={18} color="rgba(255,255,255,0.6)" />
            <Text style={styles.statText}>{conversations.length} {conversations.length === 1 ? 'conversation' : 'conversations'}</Text>
          </View>
          <View style={styles.statItem}>
            <View style={styles.activeDot} />
            <Text style={styles.statText}>Channel active</Text>
          </View>
        </View>
      </LinearGradient>

      {loading ? (
        <View style={styles.centered}>
          <ActivityIndicator size="large" color="#6366F1" />
          <Text style={styles.loadingText}>{t('doctor.loading_conversations')}</Text>
        </View>
      ) : (
        <FlatList
          data={conversations}
          renderItem={renderConversation}
          keyExtractor={item => item.id}
          contentContainerStyle={styles.listContent}
          refreshControl={
            <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor="#6366F1" />
          }
          ListEmptyComponent={
            <View style={styles.emptyState}>
              <View style={styles.emptyIconBox}>
                <MaterialIcons name="chat-bubble-outline" size={36} color="rgba(99,102,241,0.6)" />
              </View>
              <Text style={styles.emptyTitle}>{t('doctor.no_conversations')}</Text>
              <Text style={styles.emptySubtitle}>{t('doctor.no_conversations_sub')}</Text>
            </View>
          }
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#0F0F1A' },

  // Header
  header: {
    paddingTop: 56,
    paddingBottom: 24,
    paddingHorizontal: 20,
    overflow: 'hidden',
  },
  gridLine: {
    position: 'absolute',
    left: 0,
    right: 0,
    height: 1,
    backgroundColor: 'rgba(255,255,255,0.04)',
  },
  headerTop: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    marginBottom: 16,
  },
  headerLabel: {
    fontSize: 11,
    fontWeight: '700',
    color: 'rgba(255,255,255,0.5)',
    letterSpacing: 2,
    marginBottom: 4,
  },
  headerTitle: { fontSize: 26, fontWeight: '800', color: '#fff' },
  encryptedChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    backgroundColor: '#10B98115',
    borderWidth: 1,
    borderColor: '#10B981',
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 20,
  },
  encryptedText: { fontSize: 10, color: '#10B981', fontWeight: '800', letterSpacing: 1 },
  statsBar: {
    flexDirection: 'row',
    gap: 20,
    backgroundColor: 'rgba(255,255,255,0.07)',
    borderRadius: 12,
    padding: 12,
  },
  statItem: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  statText: { color: 'rgba(255,255,255,0.6)', fontSize: 13, fontWeight: '600' },
  activeDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: '#10B981',
  },

  // List
  listContent: { paddingVertical: 12, paddingHorizontal: 16 },
  convoCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(255,255,255,0.05)',
    borderRadius: 16,
    padding: 14,
    marginBottom: 10,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.08)',
    gap: 12,
  },
  avatarWrapper: { position: 'relative' },
  avatar: {
    width: 52,
    height: 52,
    borderRadius: 26,
    justifyContent: 'center',
    alignItems: 'center',
  },
  avatarText: { fontSize: 18, fontWeight: '800', color: '#fff' },
  onlineDot: {
    position: 'absolute',
    bottom: 1,
    right: 1,
    width: 13,
    height: 13,
    borderRadius: 7,
    backgroundColor: '#10B981',
    borderWidth: 2,
    borderColor: '#0F0F1A',
  },
  convoInfo: { flex: 1, gap: 4 },
  convoHeaderRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  patientName: { fontSize: 15, fontWeight: '700', color: '#fff', flex: 1, marginRight: 8 },
  timestamp: { fontSize: 12, color: 'rgba(255,255,255,0.35)' },
  messageRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  channelBadge: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  lastMessage: { fontSize: 13, color: 'rgba(255,255,255,0.4)', flex: 1 },
  unreadBadge: {
    minWidth: 20,
    height: 20,
    borderRadius: 10,
    backgroundColor: '#6366F1',
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 5,
  },
  unreadText: { color: '#fff', fontSize: 11, fontWeight: '700' },

  // States
  centered: { flex: 1, justifyContent: 'center', alignItems: 'center', gap: 12 },
  loadingText: { color: 'rgba(255,255,255,0.4)', fontSize: 14 },
  emptyState: { alignItems: 'center', paddingTop: 80, gap: 12 },
  emptyIconBox: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: 'rgba(99,102,241,0.1)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  emptyTitle: { fontSize: 20, fontWeight: '700', color: '#fff' },
  emptySubtitle: {
    fontSize: 14,
    color: 'rgba(255,255,255,0.4)',
    textAlign: 'center',
    paddingHorizontal: 40,
  },
});
