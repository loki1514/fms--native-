import React, { useState, useEffect, useRef } from 'react';
import {
  Modal,
  View,
  Text,
  TextInput,
  TouchableOpacity,
  ScrollView,
  StyleSheet,
  ActivityIndicator,
  SafeAreaView,
  KeyboardAvoidingView,
  Platform,
  Image,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { createClient } from '@/utils/supabase/client';
import MediaCaptureModal, { MediaFile } from '../shared/MediaCaptureModal';
import { Video, ResizeMode } from 'expo-av';

interface TicketCreateModalProps {
  isOpen: boolean;
  onClose: () => void;
  propertyId: string;
  organizationId: string;
  onSuccess?: (ticket: any) => void;
  isAdminMode?: boolean;
}

export default function TicketCreateModal({
  isOpen,
  onClose,
  propertyId,
  organizationId,
  onSuccess,
  isAdminMode = false,
}: TicketCreateModalProps) {
  const supabase = createClient();
  const [description, setDescription] = useState('');
  const [isInternal, setIsInternal] = useState(false);
  const [media, setMedia] = useState<MediaFile | null>(null);
  const [showMediaModal, setShowMediaModal] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  // Mentions
  const [propertyUsers, setPropertyUsers] = useState<{ id: string; full_name: string; role?: string }[]>([]);
  const [mentionQuery, setMentionQuery] = useState('');
  const [showMentionDropdown, setShowMentionDropdown] = useState(false);
  const [taggedUser, setTaggedUser] = useState<{ id: string; full_name: string } | null>(null);

  useEffect(() => {
    if (!propertyId || !isOpen) return;
    const fetchUsers = async () => {
      const { data } = await (supabase
        .from('property_memberships')
        .select('user:users(id, full_name), role')
        .eq('property_id', propertyId)
        .eq('is_active', true) as any);

      const users = (data || [])
        .map((m: any) => ({
          id: m.user?.id,
          full_name: m.user?.full_name,
          role: m.role,
        }))
        .filter((u: any) => u.id && u.full_name);
      setPropertyUsers(users);
    };
    fetchUsers();
  }, [propertyId, isOpen]);

  const handleTextChange = (text: string) => {
    setDescription(text);
    const lastAt = text.lastIndexOf('@');
    if (lastAt !== -1) {
      const query = text.slice(lastAt + 1);
      if (!query.includes(' ') && !query.includes('\n')) {
        setMentionQuery(query);
        setShowMentionDropdown(true);
        return;
      }
    }
    setShowMentionDropdown(false);
  };

  const selectMention = (user: { id: string; full_name: string }) => {
    const lastAt = description.lastIndexOf('@');
    const before = description.slice(0, lastAt);
    setDescription(`${before}@${user.full_name} `);
    setTaggedUser(user);
    setShowMentionDropdown(false);
  };

  const handleSubmit = async () => {
    if (!description.trim()) {
      setError('Please describe the issue');
      return;
    }
    setIsSubmitting(true);
    setError(null);

    try {
      // 1. Create Ticket
      const { data: ticket, error: ticketError } = await (supabase
        .from('tickets')
        .insert({
          description: description.trim(),
          property_id: propertyId,
          organization_id: organizationId,
          internal: isInternal,
          assigned_to: taggedUser?.id,
          status: 'open',
          priority: 'medium', // default
          title: description.split('\n')[0].slice(0, 80),
        } as any) as any).select().single();

      if (ticketError) throw ticketError;

      // 2. Upload Media (Mock logic for now, using the URI from MediaFile)
      if (media && ticket) {
        // In real app, we use FileSystem + Supabase Storage
        // For this migration, we assume the component caller handles final sync or we use a helper
        console.log('Attaching media to ticket:', ticket.id, media.uri);
      }

      setSuccess(true);
      onSuccess?.(ticket);
      setTimeout(() => {
        handleReset();
        onClose();
      }, 2000);
    } catch (err: any) {
      setError(err.message || 'Failed to create ticket');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleReset = () => {
    setDescription('');
    setIsInternal(false);
    setMedia(null);
    setSuccess(false);
    setError(null);
    setTaggedUser(null);
  };

  return (
    <Modal visible={isOpen} animationType="slide" transparent={false} onRequestClose={onClose}>
      <SafeAreaView style={styles.container}>
        <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} style={{ flex: 1 }}>
          {/* Header */}
          <View style={styles.header}>
            <TouchableOpacity onPress={onClose} style={styles.closeBtn}>
              <Ionicons name="close" size={24} color="#475569" />
            </TouchableOpacity>
            <Text style={styles.headerTitle}>Raise Request</Text>
            <View style={{ width: 40 }} />
          </View>

          <ScrollView style={styles.form} contentContainerStyle={{ padding: 20 }}>
            {success ? (
              <View style={styles.successView}>
                <Ionicons name="checkmark-circle" size={80} color="#10B981" />
                <Text style={styles.successText}>Request Submitted!</Text>
                <Text style={styles.successSubText}>Your ticket has been created and assigned.</Text>
              </View>
            ) : (
              <>
                {/* Description */}
                <View style={styles.field}>
                  <Text style={styles.label}>Description</Text>
                  <View style={styles.inputWrapper}>
                    <TextInput
                      style={styles.textArea}
                      placeholder="Describe the issue... (use @ to tag)"
                      placeholderTextColor="#94A3B8"
                      multiline
                      value={description}
                      onChangeText={handleTextChange}
                    />
                    
                    {/* Mention Dropdown */}
                    {showMentionDropdown && (
                      <View style={styles.mentionOverlay}>
                        {propertyUsers
                          .filter(u => u.full_name.toLowerCase().includes(mentionQuery.toLowerCase()))
                          .slice(0, 5)
                          .map(user => (
                            <TouchableOpacity
                              key={user.id}
                              style={styles.mentionItem}
                              onPress={() => selectMention(user)}
                            >
                              <View style={styles.avatarMini}>
                                <Text style={styles.avatarText}>{user.full_name[0]}</Text>
                              </View>
                              <View>
                                <Text style={styles.mentionName}>{user.full_name}</Text>
                                <Text style={styles.mentionRole}>{user.role?.replace(/_/g, ' ')}</Text>
                              </View>
                            </TouchableOpacity>
                          ))}
                      </View>
                    )}
                  </View>
                </View>

                {/* Internal Toggle */}
                <View style={styles.toggleRow}>
                  <View>
                    <Text style={styles.toggleLabel}>Internal Ticket</Text>
                    <Text style={styles.toggleSubLabel}>Not visible to tenants</Text>
                  </View>
                  <TouchableOpacity
                    style={[styles.toggle, isInternal && styles.toggleActive]}
                    onPress={() => setIsInternal(!isInternal)}
                  >
                    <View style={[styles.toggleCircle, isInternal && styles.toggleCircleActive]} />
                  </TouchableOpacity>
                </View>

                {/* Media Attachment */}
                <View style={[styles.field, { marginTop: 20 }]}>
                  <Text style={styles.label}>Proof Attachment</Text>
                  {media ? (
                    <View style={styles.mediaPreview}>
                      {media.type === 'image' ? (
                        <Image source={{ uri: media.uri }} style={styles.previewContent} />
                      ) : (
                        <Video
                          source={{ uri: media.uri }}
                          style={styles.previewContent}
                          resizeMode={ResizeMode.COVER}
                          shouldPlay={false}
                        />
                      )}
                      <TouchableOpacity style={styles.removeMedia} onPress={() => setMedia(null)}>
                        <Ionicons name="close" size={16} color="#FFF" />
                      </TouchableOpacity>
                    </View>
                  ) : (
                    <TouchableOpacity style={styles.mediaPlaceholder} onPress={() => setShowMediaModal(true)}>
                      <Ionicons name="camera-outline" size={32} color="#64748B" />
                      <Text style={styles.mediaPlaceholderText}>Add Photo or Video</Text>
                    </TouchableOpacity>
                  )}
                </View>

                {/* Submit Action */}
                <TouchableOpacity
                  style={[styles.submitBtn, (!description.trim() || isSubmitting) && styles.submitBtnDisabled]}
                  onPress={handleSubmit}
                  disabled={isSubmitting || !description.trim()}
                >
                  {isSubmitting ? (
                    <ActivityIndicator color="#FFF" />
                  ) : (
                    <>
                      <Text style={styles.submitBtnText}>Submit Request</Text>
                      <Ionicons name="arrow-forward" size={18} color="#FFF" />
                    </>
                  )}
                </TouchableOpacity>

                {error && <Text style={styles.errorText}>{error}</Text>}
              </>
            )}
          </ScrollView>
        </KeyboardAvoidingView>

        <MediaCaptureModal
          isOpen={showMediaModal}
          onClose={() => setShowMediaModal(false)}
          onCapture={setMedia}
          title="Capture Evidence"
        />
      </SafeAreaView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#FFF' },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', padding: 16, borderBottomWidth: 1, borderBottomColor: '#F1F5F9' },
  closeBtn: { width: 40, height: 40, borderRadius: 12, backgroundColor: '#F1F5F9', justifyContent: 'center', alignItems: 'center' },
  headerTitle: { fontSize: 16, fontWeight: '900', color: '#1A2332', textTransform: 'uppercase', letterSpacing: 1 },
  form: { flex: 1 },
  field: { marginBottom: 12 },
  label: { fontSize: 13, fontWeight: '800', color: '#64748B', marginBottom: 8, textTransform: 'uppercase', letterSpacing: 1 },
  inputWrapper: { position: 'relative', zIndex: 10 },
  textArea: { backgroundColor: '#F8FAFC', borderRadius: 16, borderWidth: 1, borderColor: '#E2E8F0', padding: 16, fontSize: 15, color: '#1A2332', height: 140, textAlignVertical: 'top' },
  mentionOverlay: { position: 'absolute', top: 145, left: 0, right: 0, backgroundColor: '#FFF', borderRadius: 16, borderWidth: 1, borderColor: '#E2E8F0', shadowColor: '#000', shadowOffset: { width: 0, height: 10 }, shadowOpacity: 0.1, shadowRadius: 20, elevation: 5, zIndex: 20 },
  mentionItem: { flexDirection: 'row', alignItems: 'center', gap: 12, padding: 12, borderBottomWidth: 1, borderBottomColor: '#F1F5F9' },
  avatarMini: { width: 32, height: 32, borderRadius: 16, backgroundColor: '#4F46E5', justifyContent: 'center', alignItems: 'center' },
  avatarText: { color: '#FFF', fontSize: 12, fontWeight: '700' },
  mentionName: { fontSize: 14, fontWeight: '700', color: '#1A2332' },
  mentionRole: { fontSize: 10, color: '#94A3B8', textTransform: 'uppercase' },
  toggleRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', padding: 16, backgroundColor: '#F8FAFC', borderRadius: 16, borderWidth: 1, borderColor: '#E2E8F0', marginTop: 8 },
  toggleLabel: { fontSize: 14, fontWeight: '800', color: '#1A2332' },
  toggleSubLabel: { fontSize: 12, color: '#64748B' },
  toggle: { width: 48, height: 24, borderRadius: 12, backgroundColor: '#E2E8F0', padding: 2 },
  toggleActive: { backgroundColor: '#F59E0B' },
  toggleCircle: { width: 20, height: 20, borderRadius: 10, backgroundColor: '#FFF' },
  toggleCircleActive: { transform: [{ translateX: 24 }] },
  mediaPlaceholder: { height: 140, borderStyle: 'dashed', borderWidth: 2, borderColor: '#CBD5E1', borderRadius: 16, justifyContent: 'center', alignItems: 'center', gap: 8, backgroundColor: '#F8FAFC' },
  mediaPlaceholderText: { fontSize: 13, fontWeight: '700', color: '#64748B' },
  mediaPreview: { height: 200, borderRadius: 16, overflow: 'hidden', position: 'relative' },
  previewContent: { width: '100%', height: '100%' },
  removeMedia: { position: 'absolute', top: 12, right: 12, width: 32, height: 32, borderRadius: 16, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'center', alignItems: 'center' },
  submitBtn: { flexDirection: 'row', backgroundColor: '#7C3AED', padding: 18, borderRadius: 18, justifyContent: 'center', alignItems: 'center', gap: 10, marginTop: 32 },
  submitBtnDisabled: { opacity: 0.5 },
  submitBtnText: { color: '#FFF', fontSize: 15, fontWeight: '900', textTransform: 'uppercase', letterSpacing: 1.5 },
  errorText: { color: '#EF4444', fontSize: 12, fontWeight: '700', textAlign: 'center', marginTop: 12 },
  successView: { alignItems: 'center', paddingVertical: 40 },
  successText: { fontSize: 20, fontStyle: 'italic', fontWeight: '900', color: '#1A2332', marginTop: 24 },
  successSubText: { fontSize: 14, color: '#64748B', textAlign: 'center', marginTop: 8 },
});
