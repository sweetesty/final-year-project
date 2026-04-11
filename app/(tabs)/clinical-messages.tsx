import React, { useState, useEffect, useCallback } from 'react';
import { StyleSheet, View, Text, FlatList, TouchableOpacity, ActivityIndicator, RefreshControl } from 'react-native';
import MaterialIcons from '@expo/vector-icons/MaterialIcons';
import { Stack, useRouter } from 'expo-router';
import { Colors, Spacing, BorderRadius, Shadows } from '@/constants/theme';
import { useColorScheme } from '@/hooks/use-color-scheme';
import { useAuthViewModel } from '@/src/viewmodels/useAuthViewModel';
import { DoctorService } from '@/src/services/DoctorService';
import { ChatService } from '@/src/services/ChatService';
import { useTranslation } from 'react-i18next';
import Animated, { FadeInDown } from 'react-native-reanimated';

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
      // Use the safe DoctorService to get patients and their profiles
      const patients = await DoctorService.getLinkedPatients(session.user.id);
      
      const convs = patients.map(p => ({
        id: p.id,
        full_name: p.full_name,
        lastMessage: 'Clinical channel active',
        lastMessageTime: 'Now',
        unreadCount: 0,
      }));

      setConversations(convs);
    } catch (e) {
      console.error('[ClinicalMessages] Load error:', e);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [session]);

  useEffect(() => {
    loadConversations();
  }, [loadConversations]);

  const onRefresh = () => {
    setRefreshing(true);
    loadConversations();
  };

  const renderConversation = ({ item, index }: { item: any, index: number }) => (
    <Animated.View entering={FadeInDown.delay(index * 100).duration(400)}>
      <TouchableOpacity 
        style={[styles.convoCard, { backgroundColor: themeColors.card, borderBottomColor: themeColors.border }]}
        onPress={() => router.push({ 
          pathname: '/chat-room', 
          params: { partnerId: item.id, partnerName: item.full_name } 
        })}
      >
        <View style={[styles.avatar, { backgroundColor: themeColors.tint + '20' }]}>
          <Text style={[styles.avatarText, { color: themeColors.tint }]}>
            {item.full_name.charAt(0)}
          </Text>
          <View style={styles.onlineBadge} />
        </View>

        <View style={styles.convoInfo}>
          <View style={styles.convoHeader}>
            <Text style={[styles.patientName, { color: themeColors.text }]} numberOfLines={1}>
              {item.full_name}
            </Text>
            <Text style={[styles.timestamp, { color: themeColors.muted }]}>
              {item.lastMessageTime}
            </Text>
          </View>
          
          <View style={styles.messageRow}>
            <Text style={[styles.lastMessage, { color: themeColors.muted }]} numberOfLines={1}>
              {item.lastMessage}
            </Text>
            {item.unreadCount > 0 && (
              <View style={[styles.unreadBadge, { backgroundColor: themeColors.tint }]}>
                <Text style={styles.unreadText}>{item.unreadCount}</Text>
              </View>
            )}
          </View>
        </View>

        <MaterialIcons name="chevron-right" size={20} color={themeColors.muted} />
      </TouchableOpacity>
    </Animated.View>
  );

  return (
    <View style={[styles.container, { backgroundColor: themeColors.background }]}>
      <Stack.Screen options={{ title: t('doctor.messages_title'), headerShown: true }} />
      
      {loading ? (
        <View style={styles.centered}>
          <ActivityIndicator size="large" color={themeColors.tint} />
          <Text style={{ marginTop: 12, color: themeColors.muted }}>{t('doctor.loading_conversations')}</Text>
        </View>
      ) : (
        <FlatList
          data={conversations}
          renderItem={renderConversation}
          keyExtractor={item => item.id}
          contentContainerStyle={styles.listContent}
          refreshControl={
            <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={themeColors.tint} />
          }
          ListEmptyComponent={
            <View style={styles.emptyState}>
              <MaterialIcons name="chat-bubble-outline" size={64} color={themeColors.muted} />
              <Text style={[styles.emptyTitle, { color: themeColors.text }]}>{t('doctor.no_conversations')}</Text>
              <Text style={[styles.emptySubtitle, { color: themeColors.muted }]}>
                {t('doctor.no_conversations_sub')}
              </Text>
            </View>
          }
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  centered: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  listContent: {
    paddingVertical: Spacing.sm,
  },
  convoCard: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: Spacing.md,
    paddingHorizontal: Spacing.lg,
    borderBottomWidth: 1,
  },
  avatar: {
    width: 56,
    height: 56,
    borderRadius: 28,
    justifyContent: 'center',
    alignItems: 'center',
    position: 'relative',
  },
  avatarText: {
    fontSize: 20,
    fontWeight: '700',
  },
  onlineBadge: {
    position: 'absolute',
    bottom: 2,
    right: 2,
    width: 14,
    height: 14,
    borderRadius: 7,
    backgroundColor: '#10B981',
    borderWidth: 2,
    borderColor: '#fff',
  },
  convoInfo: {
    flex: 1,
    marginLeft: Spacing.md,
    marginRight: Spacing.sm,
    gap: 2,
  },
  convoHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  patientName: {
    fontSize: 16,
    fontWeight: '700',
    flex: 1,
    marginRight: 8,
  },
  timestamp: {
    fontSize: 12,
  },
  messageRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  lastMessage: {
    fontSize: 14,
    flex: 1,
  },
  unreadBadge: {
    minWidth: 20,
    height: 20,
    borderRadius: 10,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 6,
    marginLeft: 8,
  },
  unreadText: {
    color: '#fff',
    fontSize: 10,
    fontWeight: '700',
  },
  emptyState: {
    flex: 1,
    padding: 40,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 100,
  },
  emptyTitle: {
    fontSize: 20,
    fontWeight: '800',
    marginTop: 20,
  },
  emptySubtitle: {
    textAlign: 'center',
    marginTop: 8,
    lineHeight: 20,
  },
});
