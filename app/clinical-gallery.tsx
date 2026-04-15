import React, { useState, useEffect } from 'react';
import {
  StyleSheet, View, Text, TouchableOpacity, FlatList,
  ActivityIndicator, Modal, ScrollView, Dimensions
} from 'react-native';
import { Stack, useLocalSearchParams, useRouter } from 'expo-router';
import MaterialIcons from '@expo/vector-icons/MaterialIcons';
import { Image } from 'expo-image';
import { Colors, Spacing, BorderRadius, Shadows } from '@/constants/theme';
import { useColorScheme } from '@/hooks/use-color-scheme';
import { ChatService } from '@/src/services/ChatService';
import { useAuthViewModel } from '@/src/viewmodels/useAuthViewModel';
import { LinearGradient } from 'expo-linear-gradient';
import Animated, { FadeInUp, FadeIn } from 'react-native-reanimated';

const { width } = Dimensions.get('window');
const COLUMN_WIDTH = (width - Spacing.lg * 2 - Spacing.md * 2) / 3;

export default function ClinicalGalleryScreen() {
  const { patientId, patientName } = useLocalSearchParams<{ patientId: string; patientName: string }>();
  const colorScheme = useColorScheme() ?? 'light';
  const themeColors = Colors[colorScheme as 'light' | 'dark'];
  const router = useRouter();
  const { role } = useAuthViewModel();

  const [records, setRecords] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedImage, setSelectedImage] = useState<any>(null);

  useEffect(() => {
    if (patientId) fetchGallery();
  }, [patientId]);

  const fetchGallery = async () => {
    setLoading(true);
    try {
      const data = await ChatService.getClinicalRecords(patientId);
      setRecords(data);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  const renderItem = ({ item, index }: { item: any; index: number }) => (
    <Animated.View entering={FadeInUp.delay(index * 40)}>
      <TouchableOpacity
        style={[styles.imageCard, { backgroundColor: themeColors.card, borderColor: themeColors.border }]}
        onPress={() => setSelectedImage(item)}
        activeOpacity={0.8}
      >
        <Image source={{ uri: item.image_url }} style={styles.gridImage} contentFit="cover" transition={200} />
        <View style={styles.dateLabel}>
          <Text style={styles.dateText}>
            {new Date(item.timestamp).toLocaleDateString([], { month: 'short', day: 'numeric' })}
          </Text>
        </View>
      </TouchableOpacity>
    </Animated.View>
  );

  return (
    <View style={[styles.container, { backgroundColor: themeColors.background }]}>
      <Stack.Screen options={{ 
        title: role === 'doctor' ? `Gallery: ${patientName}` : 'My Clinical Gallery',
        headerShown: true 
      }} />

      {loading ? (
        <View style={styles.centered}><ActivityIndicator color={themeColors.tint} size="large" /></View>
      ) : records.length === 0 ? (
        <View style={styles.emptyState}>
          <MaterialIcons name="photo-library" size={64} color={themeColors.muted + '40'} />
          <Text style={[styles.emptyTitle, { color: themeColors.text }]}>No records yet</Text>
          <Text style={[styles.emptySub, { color: themeColors.muted }]}>
            Clinical photos uploaded via chat will appear here.
          </Text>
        </View>
      ) : (
        <FlatList
          data={records}
          keyExtractor={(m) => m.id}
          renderItem={renderItem}
          numColumns={3}
          contentContainerStyle={styles.listContent}
          columnWrapperStyle={styles.columnWrapper}
          showsVerticalScrollIndicator={false}
        />
      )}

      {/* Detail Modal */}
      <Modal visible={!!selectedImage} transparent animationType="fade">
        <View style={styles.modalOverlay}>
          <TouchableOpacity style={StyleSheet.absoluteFill} onPress={() => setSelectedImage(null)} />
          <Animated.View entering={FadeIn} style={[styles.modalContent, { backgroundColor: themeColors.card }]}>
            <View style={styles.modalHeader}>
              <Text style={[styles.modalTitle, { color: themeColors.text }]}>Clinical Record</Text>
              <TouchableOpacity onPress={() => setSelectedImage(null)} style={styles.closeBtn}>
                <MaterialIcons name="close" size={24} color={themeColors.text} />
              </TouchableOpacity>
            </View>

            <ScrollView showsVerticalScrollIndicator={false}>
              {selectedImage && (
                <>
                  <Image source={{ uri: selectedImage.image_url }} style={styles.fullImage} contentFit="contain" />
                  <View style={styles.modalInfo}>
                    <View style={styles.infoRow}>
                      <MaterialIcons name="event" size={16} color={themeColors.tint} />
                      <Text style={[styles.infoVal, { color: themeColors.text }]}>
                        {new Date(selectedImage.timestamp).toLocaleString()}
                      </Text>
                    </View>
                    <Text style={[styles.descTitle, { color: themeColors.muted }]}>DESCRIPTION</Text>
                    <View style={[styles.descBox, { backgroundColor: themeColors.background }]}>
                      <Text style={[styles.descText, { color: themeColors.text }]}>
                        {selectedImage.description || 'No description provided.'}
                      </Text>
                    </View>
                  </View>
                </>
              )}
            </ScrollView>
          </Animated.View>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  centered: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  listContent: { padding: Spacing.lg },
  columnWrapper: { gap: Spacing.md, marginBottom: Spacing.md },
  imageCard: {
    width: COLUMN_WIDTH,
    height: COLUMN_WIDTH,
    borderRadius: BorderRadius.xl,
    borderWidth: 1,
    overflow: 'hidden',
    ...Shadows.light,
  },
  gridImage: { width: '100%', height: '100%' },
  dateLabel: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    backgroundColor: 'rgba(0,0,0,0.5)',
    paddingVertical: 2,
    alignItems: 'center',
  },
  dateText: { color: '#fff', fontSize: 10, fontWeight: '700' },

  emptyState: { flex: 1, justifyContent: 'center', alignItems: 'center', padding: 40 },
  emptyTitle: { fontSize: 20, fontWeight: '800', marginTop: 16 },
  emptySub: { fontSize: 14, textAlign: 'center', marginTop: 8, lineHeight: 20 },

  // Modal
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.85)', justifyContent: 'center', padding: 20 },
  modalContent: { borderRadius: BorderRadius.xl, overflow: 'hidden', maxHeight: '90%' },
  modalHeader: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    padding: 16, borderBottomWidth: 1, borderBottomColor: 'rgba(0,0,0,0.05)',
  },
  modalTitle: { fontSize: 18, fontWeight: '800' },
  closeBtn: { padding: 4 },
  fullImage: { width: '100%', height: 350 },
  modalInfo: { padding: 20 },
  infoRow: { flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 16 },
  infoVal: { fontSize: 14, fontWeight: '600' },
  descTitle: { fontSize: 11, fontWeight: '800', letterSpacing: 1, marginBottom: 8 },
  descBox: { padding: 12, borderRadius: 12 },
  descText: { fontSize: 15, lineHeight: 22 },
});
