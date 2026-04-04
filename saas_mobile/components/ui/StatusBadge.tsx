import React from 'react';
import { View, Text, StyleSheet, ViewStyle } from 'react-native';

type BadgeVariant = 'success' | 'warning' | 'danger' | 'info' | 'neutral' | 'purple';

interface StatusBadgeProps {
  label: string;
  variant?: BadgeVariant;
  size?: 'sm' | 'md';
  style?: ViewStyle;
}

const VARIANT_COLORS: Record<BadgeVariant, { bg: string; text: string; border: string }> = {
  success: { bg: 'rgba(16,185,129,0.08)', text: '#10B981', border: 'rgba(16,185,129,0.15)' },
  warning: { bg: 'rgba(245,158,11,0.08)', text: '#F59E0B', border: 'rgba(245,158,11,0.15)' },
  danger: { bg: 'rgba(239,68,68,0.08)', text: '#EF4444', border: 'rgba(239,68,68,0.15)' },
  info: { bg: 'rgba(59,130,246,0.08)', text: '#3B82F6', border: 'rgba(59,130,246,0.15)' },
  neutral: { bg: '#F1F5F9', text: '#64748B', border: '#E2E8F0' },
  purple: { bg: 'rgba(124,58,237,0.08)', text: '#7C3AED', border: 'rgba(124,58,237,0.15)' },
};

export function StatusBadge({ label, variant = 'neutral', size = 'sm', style }: StatusBadgeProps) {
  const colors = VARIANT_COLORS[variant];

  return (
    <View
      style={[
        size === 'sm' ? styles.badgeSm : styles.badgeMd,
        { backgroundColor: colors.bg, borderColor: colors.border },
        style,
      ]}
    >
      <Text
        style={[
          size === 'sm' ? styles.textSm : styles.textMd,
          { color: colors.text },
        ]}
      >
        {label}
      </Text>
    </View>
  );
}

// ---- Priority Badge ----
type PriorityLevel = 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';

const PRIORITY_VARIANT: Record<PriorityLevel, BadgeVariant> = {
  LOW: 'info',
  MEDIUM: 'warning',
  HIGH: 'danger',
  CRITICAL: 'danger',
};

export function PriorityBadge({ priority, size = 'sm', style }: { priority: PriorityLevel; size?: 'sm' | 'md'; style?: ViewStyle }) {
  return (
    <StatusBadge
      label={priority}
      variant={PRIORITY_VARIANT[priority] || 'neutral'}
      size={size}
      style={style}
    />
  );
}

// ---- Ticket Status Badge ----
const TICKET_STATUS_VARIANT: Record<string, BadgeVariant> = {
  OPEN: 'warning',
  ASSIGNED: 'info',
  IN_PROGRESS: 'info',
  COMPLETED: 'success',
  CLOSED: 'neutral',
  RESOLVED: 'success',
  PENDING_VALIDATION: 'purple',
  WAITLISTED: 'neutral',
  WAITLIST: 'neutral',
  // lowercase variants
  open: 'warning',
  assigned: 'info',
  in_progress: 'info',
  completed: 'success',
  closed: 'neutral',
  resolved: 'success',
  pending_validation: 'purple',
  waitlisted: 'neutral',
  waitlist: 'neutral',
  // raw / other statuses
  blocked: 'danger',
  client_raised: 'warning',
  work_started: 'info',
  paused: 'neutral',
};

export function TicketStatusBadge({ status, size = 'sm', style }: { status: string; size?: 'sm' | 'md'; style?: ViewStyle }) {
  const variant = TICKET_STATUS_VARIANT[status] || TICKET_STATUS_VARIANT[status.toUpperCase()] || 'neutral';
  const label = status.replace(/_/g, ' ');
  return <StatusBadge label={label} variant={variant} size={size} style={style} />;
}

// ---- Ticket Status Dot ----
// Colored dot indicator for ticket list items (open=orange, in_progress=blue, resolved=green, closed=gray)
const TICKET_DOT_COLORS: Record<string, string> = {
  open: '#F59E0B',
  assigned: '#3B82F6',
  in_progress: '#3B82F6',
  work_started: '#3B82F6',
  completed: '#10B981',
  resolved: '#10B981',
  closed: '#94A3B8',
  paused: '#94A3B8',
  blocked: '#EF4444',
  client_raised: '#F59E0B',
  pending_validation: '#7C3AED',
  waitlisted: '#94A3B8',
  waitlist: '#94A3B8',
};

export function TicketStatusDot({ status, size = 8 }: { status: string; size?: number }) {
  const color = TICKET_DOT_COLORS[status.toLowerCase()] || TICKET_DOT_COLORS[status] || '#94A3B8';
  return (
    <View
      style={{
        width: size,
        height: size,
        borderRadius: size / 2,
        backgroundColor: color,
      }}
    />
  );
}

const styles = StyleSheet.create({
  badgeSm: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 999,
    borderWidth: 1,
  },
  badgeMd: {
    paddingHorizontal: 12,
    paddingVertical: 5,
    borderRadius: 999,
    borderWidth: 1,
  },
  textSm: {
    fontSize: 10,
    fontWeight: '700',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  textMd: {
    fontSize: 12,
    fontWeight: '700',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
});

export default StatusBadge;
