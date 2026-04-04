import React from 'react';
import {
  Modal,
  View,
  Text,
  Image,
  TouchableOpacity,
  StyleSheet,
  Dimensions,
  SafeAreaView,
  Share,
  Alert,
  Platform,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import * as FileSystem from 'expo-file-system';
// @ts-ignore
import * as MediaLibrary from 'expo-media-library';

interface ImagePreviewModalProps {
  isOpen: boolean;
  onClose: () => void;
  imageUrl: string | null;
  title?: string;
}

const { width: SCREEN_W, height: SCREEN_H } = Dimensions.get('window');

export default function ImagePreviewModal({ isOpen, onClose, imageUrl, title }: ImagePreviewModalProps) {
  if (!imageUrl) return null;

  const handleDownload = async () => {
    try {
      const { status } = await MediaLibrary.requestPermissionsAsync();
      if (status !== 'granted') {
        Alert.alert('Permission Required', 'Please allow access to save photos.');
        return;
      }
      const ext = imageUrl.split('.').pop()?.split('?')[0] || 'jpg';
      // @ts-ignore
      const localUri = `${FileSystem.cacheDirectory}download_${Date.now()}.${ext}`;
      const { uri } = await FileSystem.downloadAsync(imageUrl, localUri);
      await MediaLibrary.saveToLibraryAsync(uri);
      Alert.alert('Saved', 'Image saved to your photo library.');
    } catch (err) {
      Alert.alert('Error', 'Failed to download image.');
    }
  };

  const handleShare = async () => {
    try {
      await Share.share({ url: imageUrl, message: title || 'Photo Preview' });
    } catch { /* user cancelled */ }
  };

  return (
    <Modal visible={isOpen} animationType="fade" transparent onRequestClose={onClose}>
      <SafeAreaView style={styles.overlay}>
        {/* Header */}
        <View style={styles.header}>
          <View>
            <Text style={styles.title}>{title || 'Photo Preview'}</Text>
            <Text style={styles.subtitle}>Visual Proof</Text>
          </View>
          <View style={styles.headerActions}>
            <TouchableOpacity onPress={handleShare} style={styles.iconBtn}>
              <Ionicons name="share-outline" size={20} color="#94A3B8" />
            </TouchableOpacity>
            <TouchableOpacity onPress={handleDownload} style={styles.iconBtn}>
              <Ionicons name="download-outline" size={20} color="#94A3B8" />
            </TouchableOpacity>
            <TouchableOpacity onPress={onClose} style={styles.iconBtn}>
              <Ionicons name="close" size={20} color="#EF4444" />
            </TouchableOpacity>
          </View>
        </View>

        {/* Image */}
        <View style={styles.imageContainer}>
          <Image
            source={{ uri: imageUrl }}
            style={styles.image}
            resizeMode="contain"
          />
        </View>

        {/* Footer */}
        <View style={styles.footer}>
          <TouchableOpacity onPress={onClose} style={styles.closeBtn}>
            <Text style={styles.closeBtnText}>Close Preview</Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: { flex: 1, backgroundColor: 'rgba(15,23,42,0.95)' },
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', padding: 16, borderBottomWidth: 1, borderBottomColor: 'rgba(241,245,249,0.1)' },
  title: { fontSize: 16, fontWeight: '900', color: '#FFF' },
  subtitle: { fontSize: 10, fontWeight: '600', color: '#94A3B8', textTransform: 'uppercase', letterSpacing: 1.5, marginTop: 2 },
  headerActions: { flexDirection: 'row', gap: 8 },
  iconBtn: { width: 40, height: 40, borderRadius: 12, backgroundColor: 'rgba(255,255,255,0.05)', justifyContent: 'center', alignItems: 'center' },
  imageContainer: { flex: 1, justifyContent: 'center', alignItems: 'center', padding: 8 },
  image: { width: SCREEN_W - 32, height: SCREEN_H * 0.65, borderRadius: 12 },
  footer: { padding: 16, alignItems: 'center' },
  closeBtn: { paddingHorizontal: 32, paddingVertical: 14, backgroundColor: '#7C3AED', borderRadius: 14 },
  closeBtnText: { fontSize: 12, fontWeight: '900', color: '#FFF', textTransform: 'uppercase', letterSpacing: 1.5 },
});
