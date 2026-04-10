import React, { useState, useEffect, useRef } from 'react';
import { StyleSheet, View, Text, TouchableOpacity, ActivityIndicator, Alert } from 'react-native';
import { Audio, InterruptionModeIOS, InterruptionModeAndroid } from 'expo-av';
import MaterialIcons from '@expo/vector-icons/MaterialIcons';
import { Colors, Spacing, BorderRadius } from '@/constants/theme';
import { useColorScheme } from '@/hooks/use-color-scheme';

interface AudioMessageProps {
  uri: string;
  isMe: boolean;
  timestamp: string;
}

export const AudioMessage: React.FC<AudioMessageProps> = ({ uri, isMe, timestamp }) => {
  const colorScheme = useColorScheme() ?? 'light';
  const themeColors = Colors[colorScheme as 'light' | 'dark'];
  
  const [sound, setSound] = useState<Audio.Sound | null>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [position, setPosition] = useState(0);
  const [duration, setDuration] = useState(0);
  const [isLoading, setIsLoading] = useState(false);

  const onPlaybackStatusUpdate = (status: any) => {
    if (status.isLoaded) {
      setPosition(status.positionMillis);
      setDuration(status.durationMillis || 0);
      setIsPlaying(status.isPlaying);
      if (status.didJustFinish) {
        setIsPlaying(false);
        setPosition(0);
        sound?.setPositionAsync(0);
      }
    }
  };

  useEffect(() => {
    return () => {
      if (sound) {
        sound.unloadAsync();
      }
    };
  }, [sound]);

  const togglePlayback = async () => {
    try {
      // Ensure audio mode is correct for playback
      await Audio.setAudioModeAsync({
        allowsRecordingIOS: false,
        playsInSilentModeIOS: true,
        staysActiveInBackground: true,
        interruptionModeIOS: InterruptionModeIOS.DuckOthers,
        shouldDuckAndroid: true,
        interruptionModeAndroid: InterruptionModeAndroid.DuckOthers,
      });

      if (sound === null) {
        setIsLoading(true);
        console.log('[AudioMessage] Loading URI:', uri);
        
        const { sound: newSound } = await Audio.Sound.createAsync(
          { uri },
          { shouldPlay: true, progressUpdateIntervalMillis: 100 },
          onPlaybackStatusUpdate
        );
        
        setSound(newSound);
        setIsLoading(false);
      } else {
        const status = await sound.getStatusAsync();
        if (status.isLoaded) {
          if (status.isPlaying) {
            await sound.pauseAsync();
          } else {
            await sound.playFromPositionAsync(position);
          }
        }
      }
    } catch (error) {
      console.error('[AudioMessage] error:', error);
      Alert.alert('Playback Error', 'The clinical voice note could not be loaded. Please ensure the message is still available.');
      setIsLoading(false);
    }
  };

  const formatTime = (millis: number) => {
    const totalSeconds = millis / 1000;
    const minutes = Math.floor(totalSeconds / 60);
    const seconds = Math.floor(totalSeconds % 60);
    return `${minutes}:${seconds < 10 ? '0' : ''}${seconds}`;
  };

  const progress = duration > 0 ? position / duration : 0;

  return (
    <View style={styles.container}>
      <View style={styles.playerRow}>
        <TouchableOpacity 
          style={[styles.playButton, { backgroundColor: isMe ? 'rgba(255,255,255,0.2)' : themeColors.tint + '20' }]} 
          onPress={togglePlayback}
          disabled={isLoading}
        >
          {isLoading ? (
            <ActivityIndicator size="small" color={isMe ? '#fff' : themeColors.tint} />
          ) : (
            <MaterialIcons 
              name={isPlaying ? "pause" : "play-arrow"} 
              size={28} 
              color={isMe ? '#fff' : themeColors.tint} 
            />
          )}
        </TouchableOpacity>

        <View style={styles.progressSection}>
          <View style={[styles.track, { backgroundColor: isMe ? 'rgba(255,255,255,0.3)' : themeColors.border }]}>
            <View 
              style={[
                styles.progressBar, 
                { 
                  width: `${progress * 100}%`, 
                  backgroundColor: isMe ? '#fff' : themeColors.tint 
                }
              ]} 
            />
          </View>
          <View style={styles.metaRow}>
            <Text style={[styles.timeText, { color: isMe ? 'rgba(255,255,255,0.8)' : themeColors.muted }]}>
              {formatTime(isPlaying || position > 0 ? position : duration)}
            </Text>
            <Text style={[styles.timestampText, { color: isMe ? 'rgba(255,255,255,0.6)' : themeColors.muted }]}>
              {timestamp}
            </Text>
          </View>
        </View>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    width: 220,
    paddingVertical: 4,
  },
  playerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  playButton: {
    width: 44,
    height: 44,
    borderRadius: 22,
    justifyContent: 'center',
    alignItems: 'center',
  },
  progressSection: {
    flex: 1,
    gap: 6,
  },
  track: {
    height: 4,
    borderRadius: 2,
    width: '100%',
    overflow: 'hidden',
  },
  progressBar: {
    height: '100%',
  },
  metaRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  timeText: {
    fontSize: 11,
    fontWeight: '600',
  },
  timestampText: {
    fontSize: 10,
  },
});
