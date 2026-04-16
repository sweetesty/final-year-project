import React, { useEffect, useRef, useState } from 'react';
import {
  View, Text, TouchableOpacity, StyleSheet, Platform, Alert,
} from 'react-native';
import MaterialIcons from '@expo/vector-icons/MaterialIcons';
import { LinearGradient } from 'expo-linear-gradient';
import Animated, { FadeIn, FadeInDown } from 'react-native-reanimated';

// Agora is a native module — not available in Expo Go.
// We lazy-require it so the rest of the app doesn't crash when it's missing.
let createAgoraRtcEngine: any = null;
let ChannelProfileType: any = {};
let ClientRoleType: any = {};
let RtcSurfaceView: any = null;
let VideoSourceType: any = {};
let agoraAvailable = false;

try {
  const agora = require('react-native-agora');
  createAgoraRtcEngine = agora.createAgoraRtcEngine;
  ChannelProfileType = agora.ChannelProfileType;
  ClientRoleType = agora.ClientRoleType;
  RtcSurfaceView = agora.RtcSurfaceView;
  VideoSourceType = agora.VideoSourceType;
  agoraAvailable = true;
} catch (_) {
  // Running in Expo Go — Agora native module not linked
}
import { AgoraCallService, CallType } from '../services/AgoraCallService';

interface Props {
  channelName: string;
  callType: CallType;
  /** Numeric UID for the local user. Pass 0 to let Agora auto-assign. */
  localUid?: number;
  partnerName: string;
  onEnd: () => void;
}

export default function AgoraCallScreen({
  channelName,
  callType,
  localUid = 0,
  partnerName,
  onEnd,
}: Props) {
  const engine = useRef<any>(null);

  const [joined, setJoined] = useState(false);
  const [remoteUid, setRemoteUid] = useState<number | null>(null);
  const [muted, setMuted] = useState(false);
  const [speakerOn, setSpeakerOn] = useState(callType === 'video');
  const [cameraOn, setCameraOn] = useState(callType === 'video');
  const [duration, setDuration] = useState(0);

  // ── Duration timer ─────────────────────────────────────────────────────────
  useEffect(() => {
    if (!joined) return;
    const t = setInterval(() => setDuration(d => d + 1), 1000);
    return () => clearInterval(t);
  }, [joined]);

  const formatDuration = (s: number) =>
    `${Math.floor(s / 60).toString().padStart(2, '0')}:${(s % 60).toString().padStart(2, '0')}`;

  // ── Agora setup ────────────────────────────────────────────────────────────
  useEffect(() => {
    if (!agoraAvailable) {
      // Running in Expo Go — show a friendly message instead of crashing
      Alert.alert(
        'Dev Build Required',
        'Voice & video calls use Agora which requires a dev build.\n\nRun: npx expo run:ios',
        [{ text: 'OK', onPress: onEnd }]
      );
      return;
    }

    if (!AgoraCallService.APP_ID) {
      Alert.alert('Configuration Error', 'Agora App ID is not set. Add EXPO_PUBLIC_AGORA_APP_ID to your .env file.');
      onEnd();
      return;
    }

    const init = async () => {
      const rtc = createAgoraRtcEngine();
      engine.current = rtc;

      rtc.initialize({
        appId: AgoraCallService.APP_ID,
        channelProfile: ChannelProfileType.ChannelProfileCommunication,
      });

      // Event listeners
      rtc.addListener('onUserJoined', (connection, uid) => {
        setRemoteUid(uid);
      });
      rtc.addListener('onUserOffline', () => {
        setRemoteUid(null);
      });
      rtc.addListener('onJoinChannelSuccess', () => {
        setJoined(true);
      });
      rtc.addListener('onError', (errCode) => {
        console.warn('[Agora] error code:', errCode);
      });

      if (callType === 'video') {
        rtc.enableVideo();
        rtc.startPreview();
      } else {
        rtc.enableAudio();
      }

      rtc.setEnableSpeakerphone(callType === 'video');

      // Join with no token (testing mode — set token in Agora console for production)
      await rtc.joinChannel('', channelName, localUid, {
        clientRoleType: ClientRoleType.ClientRoleBroadcaster,
        publishMicrophoneTrack: true,
        publishCameraTrack: callType === 'video',
        autoSubscribeAudio: true,
        autoSubscribeVideo: callType === 'video',
      });
    };

    init().catch(e => {
      console.error('[Agora] init failed:', e);
      Alert.alert('Call Error', 'Unable to start the call. Please try again.');
      onEnd();
    });

    return () => {
      engine.current?.leaveChannel();
      engine.current?.release();
      engine.current = null;
    };
  }, []);

  // ── Controls ───────────────────────────────────────────────────────────────
  const toggleMute = () => {
    engine.current?.muteLocalAudioStream(!muted);
    setMuted(m => !m);
  };

  const toggleSpeaker = () => {
    engine.current?.setEnableSpeakerphone(!speakerOn);
    setSpeakerOn(s => !s);
  };

  const toggleCamera = () => {
    engine.current?.muteLocalVideoStream(cameraOn);
    setCameraOn(c => !c);
  };

  const switchCamera = () => {
    engine.current?.switchCamera();
  };

  const endCall = () => {
    engine.current?.leaveChannel();
    onEnd();
  };

  // ── Render ─────────────────────────────────────────────────────────────────
  const isVideo = callType === 'video';

  return (
    <Animated.View entering={FadeIn.duration(300)} style={StyleSheet.absoluteFill}>
      {/* Background: remote video or dark gradient */}
      {isVideo && remoteUid != null && RtcSurfaceView ? (
        <RtcSurfaceView
          canvas={{ uid: remoteUid, sourceType: VideoSourceType.VideoSourceRemote }}
          style={StyleSheet.absoluteFill}
        />
      ) : (
        <LinearGradient
          colors={isVideo ? ['#0F172A', '#1E293B', '#0F172A'] : ['#0F1B2D', '#1E1B4B', '#0F1B2D']}
          style={StyleSheet.absoluteFill}
        />
      )}

      {/* Local video (PiP) */}
      {isVideo && cameraOn && RtcSurfaceView && (
        <Animated.View entering={FadeInDown.duration(300)} style={styles.localVideo}>
          <RtcSurfaceView
            canvas={{ uid: 0, sourceType: VideoSourceType.VideoSourceCamera }}
            style={StyleSheet.absoluteFill}
          />
          <TouchableOpacity style={styles.flipBtn} onPress={switchCamera}>
            <MaterialIcons name="flip-camera-ios" size={18} color="#fff" />
          </TouchableOpacity>
        </Animated.View>
      )}

      {/* Top info */}
      <Animated.View entering={FadeInDown.delay(100).duration(400)} style={styles.topInfo}>
        <Text style={styles.partnerName}>{partnerName}</Text>
        <Text style={styles.callStatus}>
          {!joined ? 'Connecting…' : remoteUid != null ? formatDuration(duration) : 'Waiting for other party…'}
        </Text>
        {joined && (
          <View style={styles.secureBadge}>
            <MaterialIcons name="lock" size={10} color="#10B981" />
            <Text style={styles.secureText}>ENCRYPTED</Text>
          </View>
        )}
      </Animated.View>

      {/* Avatar (voice call or when remote video is off) */}
      {(!isVideo || remoteUid == null) && (
        <View style={styles.avatarWrap}>
          <View style={styles.avatar}>
            <Text style={styles.avatarText}>{partnerName.charAt(0).toUpperCase()}</Text>
          </View>
          {!joined && (
            <View style={styles.callingDots}>
              {[0, 1, 2].map(i => (
                <View key={i} style={[styles.dot, { opacity: 0.4 + i * 0.2 }]} />
              ))}
            </View>
          )}
        </View>
      )}

      {/* Control bar */}
      <Animated.View entering={FadeInDown.delay(200).duration(400)} style={styles.controls}>
        <TouchableOpacity
          style={[styles.ctrlBtn, muted && styles.ctrlBtnActive]}
          onPress={toggleMute}
        >
          <MaterialIcons name={muted ? 'mic-off' : 'mic'} size={24} color="#fff" />
          <Text style={styles.ctrlLabel}>{muted ? 'Unmute' : 'Mute'}</Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.ctrlBtn, speakerOn && styles.ctrlBtnActive]}
          onPress={toggleSpeaker}
        >
          <MaterialIcons name={speakerOn ? 'volume-up' : 'volume-down'} size={24} color="#fff" />
          <Text style={styles.ctrlLabel}>Speaker</Text>
        </TouchableOpacity>

        {isVideo && (
          <TouchableOpacity
            style={[styles.ctrlBtn, !cameraOn && styles.ctrlBtnActive]}
            onPress={toggleCamera}
          >
            <MaterialIcons name={cameraOn ? 'videocam' : 'videocam-off'} size={24} color="#fff" />
            <Text style={styles.ctrlLabel}>{cameraOn ? 'Camera' : 'No Cam'}</Text>
          </TouchableOpacity>
        )}

        <TouchableOpacity style={styles.endBtn} onPress={endCall}>
          <MaterialIcons name="call-end" size={30} color="#fff" />
          <Text style={[styles.ctrlLabel, { color: '#fff' }]}>End</Text>
        </TouchableOpacity>
      </Animated.View>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  topInfo: {
    position: 'absolute',
    top: Platform.OS === 'ios' ? 64 : 48,
    left: 0,
    right: 0,
    alignItems: 'center',
    gap: 4,
  },
  partnerName: {
    color: '#fff',
    fontSize: 26,
    fontWeight: '900',
    letterSpacing: -0.5,
    textShadowColor: 'rgba(0,0,0,0.4)',
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 4,
  },
  callStatus: {
    color: 'rgba(255,255,255,0.65)',
    fontSize: 14,
    fontWeight: '600',
  },
  secureBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: 'rgba(16,185,129,0.15)',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 12,
    marginTop: 4,
  },
  secureText: {
    color: '#10B981',
    fontSize: 9,
    fontWeight: '800',
    letterSpacing: 1,
  },
  avatarWrap: {
    ...StyleSheet.absoluteFillObject,
    justifyContent: 'center',
    alignItems: 'center',
    gap: 20,
  },
  avatar: {
    width: 110,
    height: 110,
    borderRadius: 55,
    backgroundColor: 'rgba(99,102,241,0.35)',
    borderWidth: 3,
    borderColor: 'rgba(99,102,241,0.6)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  avatarText: {
    color: '#fff',
    fontSize: 48,
    fontWeight: '900',
  },
  callingDots: {
    flexDirection: 'row',
    gap: 8,
  },
  dot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: '#fff',
  },
  localVideo: {
    position: 'absolute',
    top: Platform.OS === 'ios' ? 140 : 120,
    right: 16,
    width: 110,
    height: 160,
    borderRadius: 16,
    overflow: 'hidden',
    borderWidth: 2,
    borderColor: 'rgba(255,255,255,0.3)',
    backgroundColor: '#000',
  },
  flipBtn: {
    position: 'absolute',
    bottom: 8,
    right: 8,
    width: 30,
    height: 30,
    borderRadius: 15,
    backgroundColor: 'rgba(0,0,0,0.45)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  controls: {
    position: 'absolute',
    bottom: Platform.OS === 'ios' ? 52 : 36,
    left: 0,
    right: 0,
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'flex-end',
    gap: 20,
    paddingHorizontal: 24,
  },
  ctrlBtn: {
    alignItems: 'center',
    gap: 6,
    width: 64,
    paddingVertical: 14,
    borderRadius: 20,
    backgroundColor: 'rgba(255,255,255,0.15)',
  },
  ctrlBtnActive: {
    backgroundColor: 'rgba(239,68,68,0.35)',
  },
  ctrlLabel: {
    color: 'rgba(255,255,255,0.75)',
    fontSize: 11,
    fontWeight: '700',
  },
  endBtn: {
    alignItems: 'center',
    gap: 6,
    width: 72,
    paddingVertical: 14,
    borderRadius: 24,
    backgroundColor: '#EF4444',
  },
});
