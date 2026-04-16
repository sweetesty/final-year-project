import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Modal } from 'react-native';
import MaterialIcons from '@expo/vector-icons/MaterialIcons';
import Animated, {
  FadeIn, FadeOut, withRepeat, withSequence, withTiming,
  useAnimatedStyle, useSharedValue,
} from 'react-native-reanimated';
import { LinearGradient } from 'expo-linear-gradient';
import { NotificationService } from '../services/NotificationService';
import { CallType } from '../services/AgoraCallService';
import AgoraCallScreen from './AgoraCallScreen';

interface IncomingCall {
  channelName: string;
  callType: CallType;
  callerName: string;
}

export function IncomingCallOverlay({ userId }: { userId: string | undefined }) {
  const [ringing, setRinging] = useState<IncomingCall | null>(null);
  const [accepted, setAccepted] = useState(false);

  const pulseScale = useSharedValue(1);
  const animatedAvatarStyle = useAnimatedStyle(() => ({
    transform: [{ scale: pulseScale.value }],
  }));

  // Listen for incoming_call push notification taps / foreground payloads
  useEffect(() => {
    if (!userId) return;

    const unsubscribe = NotificationService.addNotificationListeners(
      // foreground notification received
      (notification) => {
        const data = notification.request.content.data as any;
        if (data?.type === 'incoming_call' && data?.channelName) {
          setRinging({
            channelName: data.channelName,
            callType: (data.callType as CallType) ?? 'voice',
            callerName: data.callerName ?? 'Unknown',
          });
          pulseScale.value = withRepeat(
            withSequence(withTiming(1.15, { duration: 700 }), withTiming(1, { duration: 700 })),
            -1,
            true,
          );
        }
      },
      // notification response (user tapped banner)
      (response) => {
        const data = response.notification.request.content.data as any;
        if (data?.type === 'incoming_call' && data?.channelName) {
          setRinging({
            channelName: data.channelName,
            callType: (data.callType as CallType) ?? 'voice',
            callerName: data.callerName ?? 'Unknown',
          });
          // Auto-accept when tapped from banner
          setAccepted(true);
        }
      },
    );

    return () => unsubscribe();
  }, [userId]);

  const handleDecline = () => {
    pulseScale.value = 1;
    setRinging(null);
    setAccepted(false);
  };

  const handleAccept = () => {
    setAccepted(true);
  };

  // Nothing to show
  if (!ringing) return null;

  // Show the full Agora call screen once accepted
  if (accepted) {
    return (
      <Modal visible transparent animationType="none">
        <AgoraCallScreen
          channelName={ringing.channelName}
          callType={ringing.callType}
          partnerName={ringing.callerName}
          onEnd={handleDecline}
        />
      </Modal>
    );
  }

  // Ringing / incoming call UI
  return (
    <Modal visible transparent animationType="none">
      <View style={styles.container}>
        <Animated.View entering={FadeIn.duration(350)} exiting={FadeOut.duration(250)} style={styles.fill}>
          <LinearGradient colors={['#1E293B', '#0F172A']} style={styles.fill}>
            <View style={styles.content}>

              <View style={styles.header}>
                <View style={styles.badge}>
                  <MaterialIcons name="security" size={12} color="#10B981" />
                  <Text style={styles.badgeText}>SECURE MEDICAL CALL</Text>
                </View>
                <Text style={styles.callTypeText}>
                  {ringing.callType === 'video' ? 'INCOMING VIDEO CALL' : 'INCOMING VOICE CALL'}
                </Text>
              </View>

              <View style={styles.center}>
                <Animated.View style={[styles.avatarRing, animatedAvatarStyle]}>
                  <View style={styles.avatar}>
                    <Text style={styles.avatarInitial}>{ringing.callerName.charAt(0).toUpperCase()}</Text>
                  </View>
                </Animated.View>
                <Text style={styles.callerName}>{ringing.callerName}</Text>
                <Text style={styles.ringingText}>Incoming…</Text>
              </View>

              <View style={styles.actions}>
                <View style={styles.actionItem}>
                  <TouchableOpacity style={[styles.actionBtn, styles.declineBtn]} onPress={handleDecline}>
                    <MaterialIcons name="call-end" size={32} color="#fff" />
                  </TouchableOpacity>
                  <Text style={styles.actionLabel}>Decline</Text>
                </View>
                <View style={styles.actionItem}>
                  <TouchableOpacity style={[styles.actionBtn, styles.acceptBtn]} onPress={handleAccept}>
                    <MaterialIcons name={ringing.callType === 'video' ? 'videocam' : 'call'} size={32} color="#fff" />
                  </TouchableOpacity>
                  <Text style={styles.actionLabel}>Accept</Text>
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
  fill: { flex: 1 },
  content: { flex: 1, padding: 40, paddingTop: 80, justifyContent: 'space-between', alignItems: 'center' },
  header: { alignItems: 'center', gap: 10 },
  badge: { flexDirection: 'row', alignItems: 'center', gap: 6, backgroundColor: 'rgba(16,185,129,0.1)', paddingHorizontal: 12, paddingVertical: 6, borderRadius: 20 },
  badgeText: { color: '#10B981', fontSize: 10, fontWeight: '800', letterSpacing: 1 },
  callTypeText: { color: 'rgba(255,255,255,0.45)', fontSize: 11, fontWeight: '700', letterSpacing: 2 },
  center: { alignItems: 'center', gap: 20 },
  avatarRing: { width: 140, height: 140, borderRadius: 70, backgroundColor: 'rgba(99,102,241,0.2)', borderWidth: 2, borderColor: 'rgba(99,102,241,0.4)', justifyContent: 'center', alignItems: 'center' },
  avatar: { width: 118, height: 118, borderRadius: 59, backgroundColor: '#4338CA', justifyContent: 'center', alignItems: 'center' },
  avatarInitial: { color: '#fff', fontSize: 52, fontWeight: '900' },
  callerName: { color: '#fff', fontSize: 28, fontWeight: '900', textAlign: 'center' },
  ringingText: { color: 'rgba(255,255,255,0.4)', fontSize: 15, fontWeight: '600' },
  actions: { flexDirection: 'row', justifyContent: 'space-around', width: '100%', marginBottom: 40 },
  actionItem: { alignItems: 'center', gap: 10 },
  actionBtn: { width: 72, height: 72, borderRadius: 36, justifyContent: 'center', alignItems: 'center', shadowColor: '#000', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.3, shadowRadius: 6, elevation: 5 },
  declineBtn: { backgroundColor: '#EF4444' },
  acceptBtn: { backgroundColor: '#10B981' },
  actionLabel: { color: '#fff', fontSize: 14, fontWeight: '700' },
});
