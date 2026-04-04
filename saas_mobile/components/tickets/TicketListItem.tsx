import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  Image,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import StatusBadge from './StatusBadge';

interface TicketListItemProps {
  id: string;
  title: string;
  status: string;
  priority: string;
  ticketNumber: string;
  createdAt: string;
  assignedTo?: string;
  assigneePhotoUrl?: string | null;
  photoUrl?: string;
  onPress: () => void;
}

const PRIORITY_CONFIG: Record<string, { bg: string; text: string; dot: string }> = {
  critical: { bg: 'rgba(244,63,94,0.06)', text: '#F43F5E', dot: '#F43F5E' },
  high:     { bg: 'rgba(249,115,22,0.06)', text: '#F97316', dot: '#F97316' },
  medium:   { bg: 'rgba(245,158,11,0.06)', text: '#F59E0B', dot: '#F59E0B' },
  low:      { bg: 'rgba(148,163,184,0.06)', text: '#94A3B8', dot: '#94A3B8' },
};

function formatTimeAgo(dateStr: string): string {
  const now = Date.now();
  const then = new Date(dateStr).getTime();
  const diffMs = now - then;
  const diffSec = Math.floor(diffMs / 1000);
  const diffMin = Math.floor(diffSec / 60);
  const diffHr  = Math.floor(diffMin / 60);
  const diffDay = Math.floor(diffHr  / 24);
  if (diffDay > 0)  return `${diffDay}d ago`;
  if (diffHr  > 0)  return `${diffHr}h ago`;
  if (diffMin > 0)  return `${diffMin}m ago`;
  return 'Just now';
}

export default function TicketListItem({
  id, title, status, priority, ticketNumber,
  createdAt, assignedTo, assigneePhotoUrl, photoUrl, onPress,
}: TicketListItemProps) {
  const [timeAgo, setTimeAgo] = useState(() => formatTimeAgo(createdAt));
  const isClosed = ['resolved', 'closed'].includes(status);

  useEffect(() => {
    if (isClosed) return;
    const interval = setInterval(() => setTimeAgo(formatTimeAgo(createdAt)), 30000);
    return () => clearInterval(interval);
  }, [createdAt, isClosed]);

  const pCfg = PRIORITY_CONFIG[priority?.toLowerCase()] ?? PRIORITY_CONFIG.low;

  return (
    <TouchableOpacity
      style={[styles.card, priority?.toLowerCase() === 'critical' && !isClosed && styles.criticalCard]}
      onPress={onPress}
      activeOpacity={0.7}
    >
      {/* Left accent bar for priority */}
      <View style={[styles.priorityBar, { backgroundColor: pCfg.dot }]} />

      <View style={styles.content}>
        {/* Top row: ticket number + time */}
        <View style={styles.topRow}>
          <Text style={styles.ticketNumber}>{ticketNumber}</Text>
          <Text style={styles.timeAgo}>{timeAgo}</Text>
        </View>

        {/* Title */}
        <Text style={styles.title} numberOfLines={2}>{title}</Text>

        {/* Bottom row: badges + assignee */}
        <View style={styles.bottomRow}>
          <View style={styles.badgeGroup}>
            <StatusBadge status={status} size="sm" />
            <View style={[styles.priorityBadge, { backgroundColor: pCfg.bg }]}>
              <View style={[styles.priorityDot, { backgroundColor: pCfg.dot }]} />
              <Text style={[styles.priorityText, { color: pCfg.text }]}>
                {priority?.toUpperCase()}
              </Text>
            </View>
          </View>

          {assignedTo && (
            <View style={styles.assigneeRow}>
              {assigneePhotoUrl ? (
                <Image source={{ uri: assigneePhotoUrl }} style={styles.assigneeAvatar} />
              ) : (
                <View style={styles.assigneeInitials}>
                  <Text style={styles.assigneeInitialsText}>
                    {assignedTo.split(' ').map(n => n[0]).join('').slice(0, 2).toUpperCase()}
                  </Text>
                </View>
              )}
              <Text style={styles.assigneeName} numberOfLines={1}>{assignedTo}</Text>
            </View>
          )}
        </View>
      </View>

      {/* Chevron */}
      <View style={styles.chevron}>
        <Ionicons name="chevron-forward" size={16} color="#CBD5E1" />
      </View>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: '#FFF',
    borderRadius: 14,
    flexDirection: 'row',
    alignItems: 'stretch',
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: '#E2E8F0',
    marginHorizontal: 16,
    marginBottom: 10,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.04,
    shadowRadius: 4,
    elevation: 1,
  },
  criticalCard: {
    borderColor: '#F43F5E',
    borderWidth: 1.5,
  },
  priorityBar: {
    width: 4,
  },
  content: {
    flex: 1,
    padding: 14,
    gap: 6,
  },
  topRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  ticketNumber: {
    fontSize: 10,
    fontWeight: '700',
    color: '#94A3B8',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  timeAgo: {
    fontSize: 10,
    fontWeight: '600',
    color: '#94A3B8',
  },
  title: {
    fontSize: 15,
    fontWeight: '600',
    color: '#1A2332',
    lineHeight: 20,
  },
  bottomRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: 4,
  },
  badgeGroup: {
    flexDirection: 'row',
    gap: 6,
    flex: 1,
  },
  priorityBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 7,
    paddingVertical: 2,
    borderRadius: 999,
  },
  priorityDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
  },
  priorityText: {
    fontSize: 9,
    fontWeight: '700',
    letterSpacing: 0.3,
  },
  assigneeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    maxWidth: '45%',
  },
  assigneeAvatar: {
    width: 20,
    height: 20,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  assigneeInitials: {
    width: 20,
    height: 20,
    borderRadius: 10,
    backgroundColor: 'rgba(59,130,246,0.1)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  assigneeInitialsText: {
    fontSize: 7,
    fontWeight: '700',
    color: '#3B82F6',
  },
  assigneeName: {
    fontSize: 11,
    fontWeight: '600',
    color: '#64748B',
  },
  chevron: {
    justifyContent: 'center',
    paddingRight: 12,
  },
});
