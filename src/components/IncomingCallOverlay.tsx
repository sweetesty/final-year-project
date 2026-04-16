import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Modal, Dimensions } from 'react-native';
import MaterialIcons from '@expo/vector-icons/MaterialIcons';
import Animated, { FadeIn, FadeOut, withRepeat, withSequence, withTiming, useAnimatedStyle, useSharedValue } from 'react-native-reanimated';
import { ConsultationService, CallSession } from '../services/ConsultationService';
import { Colors } from '../../constants/theme';
import { useColorScheme } from '../../hooks/use-color-scheme';
import { Image } from 'expo-image';
import { LinearGradient } from 'expo-linear-gradient';

const { width } = Dimensions.get('window');

export function IncomingCallOverlay({ userId }: { userId: string | undefined }) {
  const [activeCall, setActiveCall] = useState<CallSession | null>(null);
  const colorScheme = useColorScheme() ?? 'light';
  const themeColors = Colors[colorScheme as 'light' | 'dark'];
  
  // Animation for the pulsing avatar
  const pulseScale = useSharedValue(1);

  useEffect(() => {
    if (!userId) return;

    const subscription = ConsultationService.subscribeToIncomingCalls(userId, (call) => {
      console.log('[Ringer] Incoming call detected!', call.id);
      setActiveCall(call);
      
      // Start pulsing animation
      pulseScale.value = withRepeat(
        withSequence(
          withTiming(1.15, { duration: 800 }),
          withTiming(1, { duration: 800 })
        ),
        -1, // infinite
        true
      );
    });

    return () => {
      subscription.unsubscribe();
    };
  }, [userId]);

  const animatedAvatarStyle = useAnimatedStyle(() => ({
    transform: [{ scale: pulseScale.value }],
  }));

  const handleDecline = async () => {
    if (activeCall) {
      await ConsultationService.updateCallStatus(activeCall.id, 'declined');
      setActiveCall(null);
    }
  };

  const handleAccept = async () => {
    if (activeCall) {
      await ConsultationService.updateCallStatus(activeCall.id, 'accepted');
      const mid = activeCall.meeting_id;
      setActiveCall(null);
      // Join the Jitsi room
      await ConsultationService.openConference(mid);
    }
  };

  if (!activeCall) return null;

  return (
    <Modal visible={!!activeCall} transparent animationType="none">
      <View style={styles.container}>
        <Animated.View 
          entering={FadeIn.duration(400)} 
          exiting={FadeOut.duration(300)}
          style={styles.overlay}
        >
          <LinearGradient 
            colors={['#1E293B', '#0F172A']} 
            style={styles.gradient}
          >
            <View style={styles.content}>
              <View style={styles.header}>
                <View style={styles.badge}>
                  <MaterialIcons name="security" size={12} color="#10B981" />
                  <Text style={styles.badgeText}>SECURE MEDICAL CALL</Text>
                </View>
                <Text style={styles.statusText}>{activeCall.type === 'video' ? 'VIDEO CALL' : 'VOICE CALL'}</Text>
              </View>

              <View style={styles.center}>
                <Animated.View style={[styles.avatarContainer, animatedAvatarStyle]}>
                  {activeCall.caller?.avatar_url ? (
                    <Image source={{ uri: activeCall.caller.avatar_url }} style={styles.avatar} />
                  ) : (
                    <View style={[styles.avatarPlaceholder, { backgroundColor: themeColors.tint }]}>
                      <Text style={styles.avatarInitial}>{(activeCall.caller?.full_name || 'D').charAt(0)}</Text>
                    </View>
                  )}
                </Animated.View>
                <Text style={styles.callerName}>{activeCall.caller?.full_name || 'Doctor'}</Text>
                <Text style={styles.ringingText}>Incoming...</Text>
              </View>

              <View style={styles.footer}>
                <View style={styles.actionRow}>
                  <View style={styles.actionItem}>
                    <TouchableOpacity 
                      style={[styles.actionBtn, styles.declineBtn]} 
                      onPress={handleDecline}
                    >
                      <MaterialIcons name="call-end" size={32} color="#fff" />
                    </TouchableOpacity>
                    <Text style={styles.actionLabel}>Decline</Text>
                  </View>

                  <View style={styles.actionItem}>
                    <TouchableOpacity 
                      style={[styles.actionBtn, styles.acceptBtn]} 
                      onPress={handleAccept}
                    >
                      <MaterialIcons name={activeCall.type === 'video' ? 'videocam' : 'call'} size={32} color="#fff" />
                    </TouchableOpacity>
                    <Text style={styles.actionLabel}>Accept</Text>
                  </View>
                </View>
              </View>
            </View>
          </LinearGradient>
        </Animated.View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  overlay: { flex: 1 },
  gradient: { flex: 1 },
  content: { flex: 1, padding: 40, justifyContent: 'space-between', alignItems: 'center' },
  header: { alignItems: 'center', marginTop: 40, gap: 10 },
  badge: { flexDirection: 'row', alignItems: 'center', gap: 6, backgroundColor: 'rgba(16,185,129,0.1)', paddingHorizontal: 12, paddingVertical: 6, borderRadius: 20 },
  badgeText: { color: '#10B981', fontSize: 10, fontWeight: '800', letterSpacing: 1 },
  statusText: { color: 'rgba(255,255,255,0.5)', fontSize: 12, fontWeight: '700', letterSpacing: 2 },
  center: { alignItems: 'center', gap: 20 },
  avatarContainer: { width: 140, height: 140, borderRadius: 70, padding: 4, backgroundColor: 'rgba(255,255,255,0.1)', justifyContent: 'center', alignItems: 'center' },
  avatar: { width: 130, height: 130, borderRadius: 65 },
  avatarPlaceholder: { width: 130, height: 130, borderRadius: 65, justifyContent: 'center', alignItems: 'center' },
  avatarInitial: { color: '#fff', fontSize: 50, fontWeight: '800' },
  callerName: { color: '#fff', fontSize: 28, fontWeight: '900', textAlign: 'center' },
  ringingText: { color: 'rgba(255,255,255,0.4)', fontSize: 16, fontWeight: '600' },
  footer: { width: '100%', marginBottom: 40 },
  actionRow: { flexDirection: 'row', justifyContent: 'space-around', alignItems: 'center' },
  actionItem: { alignItems: 'center', gap: 10 },
  actionBtn: { width: 72, height: 72, borderRadius: 36, justifyContent: 'center', alignItems: 'center', elevation: 5, shadowColor: '#000', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.3, shadowRadius: 5 },
  declineBtn: { backgroundColor: '#EF4444' },
  acceptBtn: { backgroundColor: '#10B981' },
  actionLabel: { color: '#fff', fontSize: 14, fontWeight: '700' },
});
