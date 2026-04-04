import React from 'react';
import { View, Text, StyleSheet } from 'react-native';

export type TicketStatus = 'open' | 'waitlist' | 'assigned' | 'in_progress' | 'paused' | 'pending_validation' | 'resolved' | 'closed';

const STATUS_CONFIG: Record<string, { bg: string; text: string; label: string }> = {
  open:              { bg: 'rgba(100,116,139,0.12)', text: '#64748B', label: 'Open' },
  waitlist:          { bg: 'rgba(168,85,247,0.12)', text: '#A855F7', label: 'Waitlist' },
  assigned:          { bg: 'rgba(59,130,246,0.12)', text: '#3B82F6', label: 'Assigned' },
  in_progress:       { bg: 'rgba(245,158,11,0.12)', text: '#F59E0B', label: 'In Progress' },
  paused:            { bg: 'rgba(245,158,11,0.12)', text: '#D97706', label: 'Paused' },
  pending_validation:{ bg: 'rgba(139,92,246,0.12)', text: '#8B5CF6', label: 'Pending Validation' },
  resolved:          { bg: 'rgba(16,185,129,0.12)', text: '#10B981', label: 'Resolved' },
  closed:            { bg: 'rgba(148,163,184,0.12)', text: '#94A3B8', label: 'Closed' },
};

interface StatusBadgeProps {
  status: string;
  size?: 'sm' | 'md';
}

export default function StatusBadge({ status, size = 'md' }: StatusBadgeProps) {
  const config = STATUS_CONFIG[status] ?? STATUS_CONFIG.open;
  return (
    <View style={[styles.badge, { backgroundColor: config.bg }, size === 'sm' && styles.badgeSm]}>
      <Text style={[styles.text, { color: config.text }, size === 'sm' && styles.textSm]}>
        {config.label}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  badge: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 999,
    alignSelf: 'flex-start',
  },
  badgeSm: {
    paddingHorizontal: 7,
    paddingVertical: 2,
  },
  text: {
    fontSize: 11,
    fontWeight: '700',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  textSm: {
    fontSize: 9,
  },
});
