import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  Image,
  StyleSheet,
  ViewStyle,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';

export interface TicketCardProps {
  id: string;
  title: string;
  priority: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';
  status: 'ASSIGNED' | 'IN_PROGRESS' | 'COMPLETED' | 'OPEN' | 'PENDING_VALIDATION' | 'WAITLISTED';
  ticketNumber: string;
  createdAt: string;
  assignedTo?: string;
  assigneePhotoUrl?: string | null;
  photoUrl?: string;
  propertyName?: string;
  escalationChain?: { name: string; avatar?: string | null }[];
  raisedByTenant?: boolean;
  onClick: () => void;
  onEdit?: () => void;
  onDelete?: () => void;
  onValidate?: () => void;
  onReject?: () => void;
  style?: ViewStyle;
}

const PRIORITY_COLORS: Record<string, { bg: string; text: string; border: string }> = {
  LOW: { bg: 'rgba(59,130,246,0.06)', text: '#3B82F6', border: 'rgba(59,130,246,0.2)' },
  MEDIUM: { bg: 'rgba(245,158,11,0.06)', text: '#F59E0B', border: 'rgba(245,158,11,0.2)' },
  HIGH: { bg: 'rgba(249,115,22,0.06)', text: '#F97316', border: 'rgba(249,115,22,0.2)' },
  CRITICAL: { bg: 'rgba(244,63,94,0.06)', text: '#F43F5E', border: 'rgba(244,63,94,0.2)' },
};

const STATUS_COLORS: Record<string, { bg: string; text: string }> = {
  OPEN: { bg: '#F1F5F9', text: '#475569' },
  ASSIGNED: { bg: 'rgba(59,130,246,0.1)', text: '#3B82F6' },
  IN_PROGRESS: { bg: 'rgba(245,158,11,0.1)', text: '#F59E0B' },
  COMPLETED: { bg: 'rgba(16,185,129,0.1)', text: '#10B981' },
  PENDING_VALIDATION: { bg: 'rgba(139,92,246,0.1)', text: '#8B5CF6' },
  WAITLISTED: { bg: 'rgba(168,85,247,0.1)', text: '#A855F7' },
};

export default function TicketCard({
  id, title, priority, status, ticketNumber, createdAt,
  assignedTo, assigneePhotoUrl, photoUrl, propertyName,
  escalationChain, raisedByTenant,
  onClick, onEdit, onDelete, onValidate, onReject, style,
}: TicketCardProps) {
  const dateObj = new Date(createdAt);
  const dateStr = dateObj.toLocaleDateString('en-US', { day: '2-digit', month: 'short', year: 'numeric' });
  const timeStr = dateObj.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: true });

  const isClosed = ['COMPLETED', 'CLOSED', 'RESOLVED'].includes(status?.toUpperCase() || '');
  const isCritical = priority?.toUpperCase() === 'CRITICAL' && !isClosed;

  // Elapsed timer
  const getElapsed = () => Math.floor((Date.now() - dateObj.getTime()) / 1000);
  const [elapsedSec, setElapsedSec] = useState(getElapsed);

  useEffect(() => {
    if (isClosed) return;
    const interval = setInterval(() => setElapsedSec(getElapsed()), 1000);
    return () => clearInterval(interval);
  }, [createdAt, isClosed]);

  const formatElapsed = (sec: number) => {
    const d = Math.floor(sec / 86400);
    const h = Math.floor((sec % 86400) / 3600);
    const m = Math.floor((sec % 3600) / 60);
    const s = sec % 60;
    if (d > 0) return `${d}d ${h}h ${m}m`;
    if (h > 0) return `${h}h ${m}m ${s}s`;
    if (m > 0) return `${m}m ${s}s`;
    return `${s}s`;
  };

  const timerColor = isClosed ? '#94A3B8'
    : elapsedSec < 3600 ? '#10B981'
    : elapsedSec < 86400 ? '#F59E0B'
    : elapsedSec < 86400 * 3 ? '#F97316'
    : '#F43F5E';

  const pStyle = PRIORITY_COLORS[priority] || PRIORITY_COLORS.LOW;
  const sStyle = STATUS_COLORS[status] || STATUS_COLORS.OPEN;

  return (
    <TouchableOpacity
      style={[
        styles.card,
        isCritical && styles.criticalCard,
        raisedByTenant && !isCritical && styles.tenantCard,
        style,
      ]}
      onPress={onClick}
      activeOpacity={0.7}
    >
      {/* Header */}
      <View style={styles.headerRow}>
        {photoUrl && (
          <Image source={{ uri: photoUrl }} style={styles.thumbnail} />
        )}
        <Text style={styles.title} numberOfLines={2}>{title}</Text>
      </View>

      {/* Badges */}
      <View style={styles.badgeRow}>
        <View style={[styles.badge, { backgroundColor: pStyle.bg, borderColor: pStyle.border }]}>
          <Text style={[styles.badgeText, { color: pStyle.text }]}>{priority}</Text>
        </View>
        <View style={[styles.badge, { backgroundColor: sStyle.bg, borderColor: sStyle.bg }]}>
          <Text style={[styles.badgeText, { color: sStyle.text }]}>{status.replace('_', ' ')}</Text>
        </View>
        {propertyName && (
          <View style={[styles.badge, { backgroundColor: 'rgba(99,102,241,0.06)', borderColor: 'rgba(99,102,241,0.2)' }]}>
            <Ionicons name="business-outline" size={10} color="#6366F1" />
            <Text style={[styles.badgeText, { color: '#6366F1' }]}>{propertyName}</Text>
          </View>
        )}
      </View>

      {/* Assignee */}
      {assignedTo && status !== 'OPEN' && (
        <View style={styles.assigneeRow}>
          <Text style={styles.assigneeLabel}>Serving:</Text>
          {assigneePhotoUrl ? (
            <Image source={{ uri: assigneePhotoUrl }} style={styles.assigneeAvatar} />
          ) : (
            <View style={styles.assigneeInitials}>
              <Text style={styles.initialsText}>
                {assignedTo.split(' ').map(n => n[0]).join('').slice(0, 2).toUpperCase()}
              </Text>
            </View>
          )}
          <Text style={styles.assigneeName}>{assignedTo}</Text>
        </View>
      )}

      {/* Escalation chain */}
      {escalationChain && escalationChain.length > 0 && (
        <View style={styles.escalationRow}>
          <Text style={styles.escalatedLabel}>Escalated</Text>
          {escalationChain.map((person, i) => {
            const initials = person.name.split(' ').map(n => n[0]).join('').slice(0, 2).toUpperCase();
            const isLast = i === escalationChain.length - 1;
            return (
              <React.Fragment key={i}>
                <View style={[styles.escalationCircle, isLast && { borderColor: '#FCA5A5' }]}>
                  {person.avatar ? (
                    <Image source={{ uri: person.avatar }} style={{ width: 24, height: 24, borderRadius: 12 }} />
                  ) : (
                    <Text style={[styles.escalationInitials, isLast && { color: '#EF4444' }]}>{initials}</Text>
                  )}
                </View>
                {!isLast && <Ionicons name="chevron-forward" size={10} color="#FCA5A5" />}
              </React.Fragment>
            );
          })}
        </View>
      )}

      {/* Footer */}
      <View style={styles.footer}>
        <View>
          <Text style={styles.metaText}>{ticketNumber} • {dateStr} • {timeStr}</Text>
          <View style={styles.timerRow}>
            <Ionicons name="timer-outline" size={12} color={timerColor} />
            <Text style={[styles.timerText, { color: timerColor }]}>
              {isClosed ? `Closed after ${formatElapsed(elapsedSec)}` : formatElapsed(elapsedSec)}
            </Text>
          </View>
        </View>
        <TouchableOpacity style={styles.viewBtn} onPress={onClick}>
          <Text style={styles.viewBtnText}>View</Text>
        </TouchableOpacity>
      </View>

      {/* Validation actions */}
      {status === 'PENDING_VALIDATION' && (onValidate || onReject) && (
        <View style={styles.validationRow}>
          {onValidate && (
            <TouchableOpacity style={styles.validateBtn} onPress={onValidate}>
              <Ionicons name="checkmark-circle-outline" size={14} color="#FFF" />
              <Text style={styles.validateBtnText}>Looks Good</Text>
            </TouchableOpacity>
          )}
          {onReject && (
            <TouchableOpacity style={styles.rejectBtn} onPress={onReject}>
              <Ionicons name="close-circle-outline" size={14} color="#EF4444" />
              <Text style={styles.rejectBtnText}>Not Resolved</Text>
            </TouchableOpacity>
          )}
        </View>
      )}
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: '#FFF', borderRadius: 16, padding: 16, gap: 12,
    borderWidth: 1, borderColor: '#E5E7EB',
    shadowColor: '#000', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.04, shadowRadius: 4, elevation: 1,
  },
  criticalCard: { borderWidth: 2, borderColor: '#F43F5E' },
  tenantCard: { borderWidth: 2, borderColor: '#F59E0B' },
  headerRow: { flexDirection: 'row', gap: 12, alignItems: 'flex-start' },
  thumbnail: { width: 56, height: 56, borderRadius: 12 },
  title: { flex: 1, fontSize: 15, fontWeight: '600', color: '#1A2332', lineHeight: 20 },
  badgeRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
  badge: { flexDirection: 'row', alignItems: 'center', gap: 4, paddingHorizontal: 8, paddingVertical: 3, borderRadius: 999, borderWidth: 1 },
  badgeText: { fontSize: 10, fontWeight: '700', textTransform: 'uppercase' },
  assigneeRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  assigneeLabel: { fontSize: 12, color: '#6B7280' },
  assigneeAvatar: { width: 20, height: 20, borderRadius: 10, borderWidth: 1, borderColor: '#E5E7EB' },
  assigneeInitials: { width: 20, height: 20, borderRadius: 10, backgroundColor: 'rgba(59,130,246,0.1)', justifyContent: 'center', alignItems: 'center' },
  initialsText: { fontSize: 8, fontWeight: '700', color: '#3B82F6' },
  assigneeName: { fontSize: 13, fontWeight: '600', color: '#1A2332' },
  escalationRow: { flexDirection: 'row', alignItems: 'center', gap: 4, flexWrap: 'wrap' },
  escalatedLabel: { fontSize: 10, fontWeight: '600', color: '#EF4444', textTransform: 'uppercase', letterSpacing: 0.5, marginRight: 4 },
  escalationCircle: { width: 24, height: 24, borderRadius: 12, borderWidth: 1, borderColor: '#E5E7EB', justifyContent: 'center', alignItems: 'center', overflow: 'hidden', backgroundColor: '#F3F4F6' },
  escalationInitials: { fontSize: 8, fontWeight: '700', color: '#6B7280' },
  footer: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-end', paddingTop: 12, borderTopWidth: 1, borderTopColor: '#F3F4F6' },
  metaText: { fontSize: 10, color: '#9CA3AF', marginBottom: 4 },
  timerRow: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  timerText: { fontSize: 10, fontWeight: '900' },
  viewBtn: { paddingHorizontal: 16, paddingVertical: 8, backgroundColor: '#3B82F6', borderRadius: 10 },
  viewBtnText: { fontSize: 12, fontWeight: '700', color: '#FFF' },
  validationRow: { flexDirection: 'row', gap: 8, paddingTop: 12, borderTopWidth: 1, borderTopColor: 'rgba(139,92,246,0.1)' },
  validateBtn: { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, paddingVertical: 10, backgroundColor: '#10B981', borderRadius: 12 },
  validateBtnText: { fontSize: 12, fontWeight: '700', color: '#FFF' },
  rejectBtn: { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, paddingVertical: 10, backgroundColor: 'rgba(239,68,68,0.06)', borderRadius: 12, borderWidth: 1, borderColor: 'rgba(239,68,68,0.2)' },
  rejectBtnText: { fontSize: 12, fontWeight: '700', color: '#EF4444' },
});
