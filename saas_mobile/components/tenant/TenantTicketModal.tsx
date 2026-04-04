'use client';
import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Modal,
  TextInput,
  TouchableOpacity,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  ActivityIndicator,
  Alert,
} from 'react-native';
import { createTicket } from '@/utils/api/mobileApi';

interface TenantTicketModalProps {
  visible: boolean;
  propertyId: string;
  organizationId: string;
  userId: string;
  userName: string;
  propertyName: string;
  onClose: () => void;
  onSuccess?: (ticketNumber: string, ticketId: string) => void;
}

type Priority = 'low' | 'medium' | 'high' | 'critical';

const PRIORITIES: { value: Priority; label: string; color: string }[] = [
  { value: 'low', label: 'Low', color: '#22C55E' },
  { value: 'medium', label: 'Medium', color: '#F59E0B' },
  { value: 'high', label: 'High', color: '#F97316' },
  { value: 'critical', label: 'Critical', color: '#EF4444' },
];

export function TenantTicketModal({
  visible,
  propertyId,
  organizationId,
  userId,
  userName,
  propertyName,
  onClose,
  onSuccess,
}: TenantTicketModalProps) {
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [priority, setPriority] = useState<Priority>('medium');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const reset = () => {
    setTitle('');
    setDescription('');
    setPriority('medium');
    setError(null);
    setIsSubmitting(false);
  };

  const handleClose = () => {
    reset();
    onClose();
  };

  const handleSubmit = async () => {
    if (!description.trim()) {
      setError('Please describe the issue');
      return;
    }

    setIsSubmitting(true);
    setError(null);

    try {
      const result = await createTicket({
        title: title.trim() || undefined,
        description: description.trim(),
        propertyId,
        organizationId,
        priority,
        isInternal: false,
      });

      if (result.error) {
        setError(result.error);
        return;
      }

      const ticketNumber = result.ticket?.ticket_number ?? 'TKT';
      const ticketId = result.ticket?.id ?? '';

      // AI classification summary for confirmation
      const classification = result.classification;
      let message = `Ticket ${ticketNumber} created successfully!`;
      if (classification?.issue_code) {
        message += `\n\nAuto-classified as: ${classification.issue_code}`;
        message += `\nConfidence: ${classification.confidence}`;
      }

      Alert.alert('Ticket Created', message, [
        {
          text: 'OK',
          onPress: () => {
            onSuccess?.(ticketNumber, ticketId);
            handleClose();
          },
        },
      ]);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to create ticket');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Modal
      visible={visible}
      animationType="slide"
      presentationStyle="pageSheet"
      onRequestClose={handleClose}
    >
      <KeyboardAvoidingView
        style={styles.container}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        {/* Header */}
        <View style={styles.header}>
          <TouchableOpacity onPress={handleClose} disabled={isSubmitting}>
            <Text style={styles.cancelText}>Cancel</Text>
          </TouchableOpacity>
          <Text style={styles.headerTitle}>New Request</Text>
          <TouchableOpacity
            onPress={handleSubmit}
            disabled={isSubmitting || !description.trim()}
            style={styles.submitBtn}
          >
            {isSubmitting ? (
              <ActivityIndicator size="small" color="#667eea" />
            ) : (
              <Text
                style={[
                  styles.submitText,
                  !description.trim() && styles.submitTextDisabled,
                ]}
              >
                Submit
              </Text>
            )}
          </TouchableOpacity>
        </View>

        <ScrollView
          style={styles.scrollView}
          contentContainerStyle={styles.scrollContent}
          keyboardShouldPersistTaps="handled"
        >
          {/* Property info */}
          <View style={styles.propertyBanner}>
            <Text style={styles.propertyLabel}>Property</Text>
            <Text style={styles.propertyName}>{propertyName}</Text>
          </View>

          {/* Title */}
          <View style={styles.field}>
            <Text style={styles.fieldLabel}>Title (optional)</Text>
            <TextInput
              style={styles.input}
              placeholder="Brief summary of the issue"
              placeholderTextColor="#94A3B8"
              value={title}
              onChangeText={setTitle}
              maxLength={120}
            />
          </View>

          {/* Description */}
          <View style={styles.field}>
            <Text style={styles.fieldLabel}>
              Description <Text style={styles.required}>*</Text>
            </Text>
            <TextInput
              style={[styles.input, styles.textArea]}
              placeholder="Describe the issue in detail. Mention the floor/location if relevant."
              placeholderTextColor="#94A3B8"
              value={description}
              onChangeText={setDescription}
              multiline
              numberOfLines={5}
              textAlignVertical="top"
            />
          </View>

          {/* Priority */}
          <View style={styles.field}>
            <Text style={styles.fieldLabel}>Priority</Text>
            <View style={styles.priorityRow}>
              {PRIORITIES.map((p) => (
                <TouchableOpacity
                  key={p.value}
                  style={[
                    styles.priorityChip,
                    priority === p.value && {
                      backgroundColor: p.color,
                      borderColor: p.color,
                    },
                  ]}
                  onPress={() => setPriority(p.value)}
                >
                  <Text
                    style={[
                      styles.priorityChipText,
                      priority === p.value && styles.priorityChipTextActive,
                    ]}
                  >
                    {p.label}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>
          </View>

          {/* Error */}
          {error && (
            <View style={styles.errorBox}>
              <Text style={styles.errorText}>{error}</Text>
            </View>
          )}

          {/* AI Classification note */}
          <View style={styles.aiNote}>
            <Text style={styles.aiNoteText}>
              Your request will be automatically classified by AI and assigned to the right team.
            </Text>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f0f4f8',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 14,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(0,0,0,0.06)',
    backgroundColor: '#fff',
  },
  headerTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#1a1a1a',
  },
  cancelText: {
    fontSize: 15,
    color: '#EF4444',
  },
  submitBtn: {
    minWidth: 60,
    alignItems: 'flex-end',
  },
  submitText: {
    fontSize: 15,
    fontWeight: '600',
    color: '#667eea',
  },
  submitTextDisabled: {
    color: '#CBD5E1',
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    padding: 16,
    paddingBottom: 40,
  },
  propertyBanner: {
    backgroundColor: 'rgba(102, 126, 234, 0.1)',
    borderRadius: 12,
    padding: 12,
    marginBottom: 20,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  propertyLabel: {
    fontSize: 12,
    color: '#667eea',
    fontWeight: '600',
  },
  propertyName: {
    fontSize: 12,
    color: '#1a1a1a',
    fontWeight: '500',
  },
  field: {
    marginBottom: 20,
  },
  fieldLabel: {
    fontSize: 13,
    fontWeight: '600',
    color: '#374151',
    marginBottom: 8,
  },
  required: {
    color: '#EF4444',
  },
  input: {
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 14,
    fontSize: 15,
    color: '#1a1a1a',
    borderWidth: 1,
    borderColor: 'rgba(0,0,0,0.08)',
  },
  textArea: {
    minHeight: 120,
    paddingTop: 14,
  },
  priorityRow: {
    flexDirection: 'row',
    gap: 10,
  },
  priorityChip: {
    flex: 1,
    paddingVertical: 10,
    paddingHorizontal: 8,
    borderRadius: 10,
    backgroundColor: '#fff',
    borderWidth: 1.5,
    borderColor: 'rgba(0,0,0,0.1)',
    alignItems: 'center',
  },
  priorityChipText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#6B7280',
  },
  priorityChipTextActive: {
    color: '#fff',
  },
  errorBox: {
    backgroundColor: 'rgba(239, 68, 68, 0.08)',
    borderRadius: 10,
    padding: 12,
    marginBottom: 16,
  },
  errorText: {
    fontSize: 13,
    color: '#EF4444',
  },
  aiNote: {
    backgroundColor: 'rgba(102, 126, 234, 0.06)',
    borderRadius: 10,
    padding: 12,
  },
  aiNoteText: {
    fontSize: 12,
    color: '#667eea',
    lineHeight: 18,
  },
});
