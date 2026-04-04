import React, { useState } from 'react';
import {
  Modal,
  View,
  Text,
  Image,
  TouchableOpacity,
  StyleSheet,
  SafeAreaView,
  ActivityIndicator,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import * as ImagePicker from 'expo-image-picker';
import { Video, ResizeMode } from 'expo-av';

export type MediaFile = {
  uri: string;
  type: 'image' | 'video';
  width?: number;
  height?: number;
  duration?: number;
};

interface MediaCaptureModalProps {
  isOpen: boolean;
  onClose: () => void;
  onCapture: (media: MediaFile) => void;
  title?: string;
}

type Mode = 'photo' | 'video';

export default function MediaCaptureModal({ isOpen, onClose, onCapture, title = 'Add Media' }: MediaCaptureModalProps) {
  const [mode, setMode] = useState<Mode>('photo');
  const [capturedMedia, setCapturedMedia] = useState<MediaFile | null>(null);
  const [isLaunching, setIsLaunching] = useState(false);

  const launchCamera = async () => {
    setIsLaunching(true);
    try {
      const { status } = await ImagePicker.requestCameraPermissionsAsync();
      if (status !== 'granted') { setIsLaunching(false); return; }

      const result = await ImagePicker.launchCameraAsync({
        mediaTypes: mode === 'photo' ? ['images'] : ['videos'],
        quality: 0.85,
        videoMaxDuration: 60,
        allowsEditing: false,
      });

      if (!result.canceled && result.assets?.[0]) {
        const asset = result.assets[0];
        setCapturedMedia({
          uri: asset.uri,
          type: asset.type === 'video' ? 'video' : 'image',
          width: asset.width,
          height: asset.height,
          duration: asset.duration || undefined,
        });
      }
    } catch (err) {
      console.error('Camera launch failed:', err);
    } finally {
      setIsLaunching(false);
    }
  };

  const launchGallery = async () => {
    setIsLaunching(true);
    try {
      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: mode === 'photo' ? ['images'] : ['images', 'videos'],
        quality: 0.85,
        allowsEditing: false,
      });

      if (!result.canceled && result.assets?.[0]) {
        const asset = result.assets[0];
        setCapturedMedia({
          uri: asset.uri,
          type: asset.type === 'video' ? 'video' : 'image',
          width: asset.width,
          height: asset.height,
          duration: asset.duration || undefined,
        });
      }
    } catch (err) {
      console.error('Gallery launch failed:', err);
    } finally {
      setIsLaunching(false);
    }
  };

  const confirmMedia = () => {
    if (capturedMedia) {
      onCapture(capturedMedia);
      setCapturedMedia(null);
      onClose();
    }
  };

  const retake = () => {
    setCapturedMedia(null);
  };

  const handleClose = () => {
    setCapturedMedia(null);
    setMode('photo');
    onClose();
  };

  return (
    <Modal visible={isOpen} animationType="slide" transparent={false} onRequestClose={handleClose}>
      <SafeAreaView style={styles.container}>
        {/* Header */}
        <View style={styles.header}>
          <TouchableOpacity onPress={handleClose} style={styles.closeBtn}>
            <Ionicons name="close" size={22} color="#FFF" />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>{title}</Text>
          <View style={{ width: 40 }} />
        </View>

        {/* Mode Tabs */}
        {!capturedMedia && (
          <View style={styles.modeRow}>
            <TouchableOpacity
              style={[styles.modeTab, mode === 'photo' && styles.modeTabActive]}
              onPress={() => setMode('photo')}
            >
              <Ionicons name="camera" size={16} color={mode === 'photo' ? '#000' : 'rgba(255,255,255,0.6)'} />
              <Text style={[styles.modeTabText, mode === 'photo' && styles.modeTabTextActive]}>Photo</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.modeTab, mode === 'video' && styles.modeTabActiveRed]}
              onPress={() => setMode('video')}
            >
              <Ionicons name="videocam" size={16} color={mode === 'video' ? '#FFF' : 'rgba(255,255,255,0.6)'} />
              <Text style={[styles.modeTabText, mode === 'video' && styles.modeTabTextActive]}>Video</Text>
            </TouchableOpacity>
          </View>
        )}

        {/* Content */}
        <View style={styles.content}>
          {capturedMedia ? (
            capturedMedia.type === 'image' ? (
              <Image source={{ uri: capturedMedia.uri }} style={styles.preview} resizeMode="contain" />
            ) : (
              <Video
                source={{ uri: capturedMedia.uri }}
                style={styles.preview}
                useNativeControls
                resizeMode={ResizeMode.CONTAIN}
              />
            )
          ) : (
            <View style={styles.placeholder}>
              <View style={styles.iconCircle}>
                <Ionicons name={mode === 'photo' ? 'camera' : 'videocam'} size={40} color="rgba(255,255,255,0.2)" />
              </View>
              <TouchableOpacity onPress={launchCamera} style={styles.launchBtn} disabled={isLaunching}>
                {isLaunching ? <ActivityIndicator color="#000" /> : <Text style={styles.launchBtnText}>Open Camera</Text>}
              </TouchableOpacity>
            </View>
          )}
        </View>

        {/* Controls */}
        <View style={styles.controls}>
          {capturedMedia ? (
            <View style={styles.reviewRow}>
              <TouchableOpacity onPress={retake} style={styles.retakeBtn}>
                <Ionicons name="refresh" size={20} color="rgba(255,255,255,0.7)" />
                <Text style={styles.retakeText}>Retake</Text>
              </TouchableOpacity>
              <TouchableOpacity onPress={confirmMedia} style={styles.confirmBtn}>
                <Ionicons name="checkmark-circle" size={20} color="#000" />
                <Text style={styles.confirmBtnText}>Use {capturedMedia.type === 'image' ? 'Photo' : 'Video'}</Text>
              </TouchableOpacity>
            </View>
          ) : (
            <View style={styles.captureRow}>
              {/* Gallery */}
              <TouchableOpacity onPress={launchGallery} style={styles.galleryBtn} disabled={isLaunching}>
                <Ionicons name="images-outline" size={22} color="#FFF" />
                <Text style={styles.galleryText}>Gallery</Text>
              </TouchableOpacity>

              {/* Shutter */}
              <TouchableOpacity onPress={launchCamera} style={styles.shutterOuter} disabled={isLaunching}>
                <View style={[styles.shutterInner, mode === 'video' && { backgroundColor: '#EF4444' }]} />
              </TouchableOpacity>

              <View style={{ width: 56 }} />
            </View>
          )}
        </View>
      </SafeAreaView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#000' },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 16, paddingVertical: 12 },
  closeBtn: { width: 40, height: 40, borderRadius: 20, backgroundColor: 'rgba(255,255,255,0.1)', justifyContent: 'center', alignItems: 'center' },
  headerTitle: { fontSize: 14, fontWeight: '900', color: '#FFF', textTransform: 'uppercase', letterSpacing: 2 },
  modeRow: { flexDirection: 'row', justifyContent: 'center', gap: 4, paddingHorizontal: 16, paddingBottom: 12 },
  modeTab: { flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: 20, paddingVertical: 10, borderRadius: 20, backgroundColor: 'rgba(255,255,255,0.08)' },
  modeTabActive: { backgroundColor: '#FFF' },
  modeTabActiveRed: { backgroundColor: '#EF4444' },
  modeTabText: { fontSize: 13, fontWeight: '900', color: 'rgba(255,255,255,0.6)' },
  modeTabTextActive: { color: '#000' },
  content: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  preview: { width: '100%', height: '100%' },
  placeholder: { alignItems: 'center', gap: 20 },
  iconCircle: { width: 80, height: 80, borderRadius: 40, backgroundColor: 'rgba(255,255,255,0.05)', justifyContent: 'center', alignItems: 'center' },
  launchBtn: { paddingHorizontal: 32, paddingVertical: 16, backgroundColor: '#FFF', borderRadius: 20 },
  launchBtnText: { fontSize: 14, fontWeight: '900', color: '#000', textTransform: 'uppercase', letterSpacing: 2 },
  controls: { padding: 24 },
  reviewRow: { flexDirection: 'row', gap: 12 },
  retakeBtn: { flex: 1, paddingVertical: 16, alignItems: 'center', gap: 4, borderWidth: 1, borderColor: 'rgba(255,255,255,0.2)', borderRadius: 16 },
  retakeText: { fontSize: 10, fontWeight: '900', color: 'rgba(255,255,255,0.6)', textTransform: 'uppercase', letterSpacing: 2 },
  confirmBtn: { flex: 2, flexDirection: 'row', paddingVertical: 16, backgroundColor: '#FFF', borderRadius: 16, justifyContent: 'center', alignItems: 'center', gap: 8 },
  confirmBtnText: { fontSize: 14, fontWeight: '900', color: '#000', textTransform: 'uppercase', letterSpacing: 1 },
  captureRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  galleryBtn: { width: 56, alignItems: 'center', gap: 4 },
  galleryText: { fontSize: 9, fontWeight: '900', color: 'rgba(255,255,255,0.5)', textTransform: 'uppercase', letterSpacing: 1 },
  shutterOuter: { width: 72, height: 72, borderRadius: 36, borderWidth: 4, borderColor: '#FFF', justifyContent: 'center', alignItems: 'center' },
  shutterInner: { width: 56, height: 56, borderRadius: 28, backgroundColor: '#FFF' },
});
