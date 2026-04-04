'use client';
import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import Svg, { Path, Circle } from 'react-native-svg';

interface Ticket {
  id: string;
  ticket_number?: string;
  title?: string;
  description?: string;
  status: string;
  priority: string;
  created_at: string;
  assignee?: { full_name?: string; user_photo_url?: string };
}

interface TenantTicketCardProps {
  ticket: Ticket;
  onPress?: () => void;
}

const ClockIcon = ({ size = 12, color = '#4CAF50' }: { size?: number; color?: string }) => (
  <Svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2">
    <Circle cx="12" cy="12" r="10" />
    <Path d="M12 6v6l4 2" />
  </Svg>
);

const BuildingIcon = ({ size = 20, color = '#fff' }: { size?: number; color?: string }) => (
  <Svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="1.5">
    <Path d="M3 21h18M5 21V7l8-4 8 4v14M9 21v-6h6v6" />
  </Svg>
);

function getPriorityColor(priority: string): string {
  switch (priority?.toLowerCase()) {
    case 'critical': return '#E53935';
    case 'high': return '#F57C00';
    case 'medium': return '#D4A017';
    case 'low': return '#4CAF50';
    default: return '#94A3B8';
  }
}

function getStatusColor(status: string): string {
  switch (status?.toLowerCase()) {
    case 'open': return '#3B82F6';
    case 'assigned': return '#8B5CF6';
    case 'in_progress': return '#F59E0B';
    case 'resolved': return '#10B981';
    case 'closed': return '#6B7280';
    case 'pending_validation': return '#EC4899';
    default: return '#94A3B8';
  }
}

function getSlaCountdown(createdAt: string): string {
  // DEFENSE-IN-DEPTH: Guard against null/invalid dates (silent crash source)
  const created = new Date(createdAt).getTime();
  if (!createdAt || isNaN(created)) return '--';
  const now = Date.now();
  const diff = now - created;
  const hours = Math.floor(diff / (1000 * 60 * 60));
  if (hours < 1) return `${Math.floor(diff / (1000 * 60))}m`;
  if (hours < 24) return `${hours}h ${Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60))}m`;
  return `${Math.floor(hours / 24)}d ${hours % 24}h`;
}

export function TenantTicketCard({ ticket, onPress }: TenantTicketCardProps) {
  const initials = ticket.assignee?.full_name
    ?.split(' ')
    .map((n) => n[0])
    .join('')
    .toUpperCase()
    .slice(0, 2) ?? '??';

  const isClosed = ['resolved', 'closed'].includes(ticket.status?.toLowerCase());
  // DEFENSE-IN-DEPTH: created_at may be null from Supabase despite the TS type
  const countdown = ticket.created_at ? getSlaCountdown(ticket.created_at) : '--';

  return (
    <TouchableOpacity onPress={onPress} activeOpacity={0.8} style={styles.card}>
      {/* Header */}
      <View style={styles.header}>
        <View style={styles.avatar}>
          <BuildingIcon size={18} color="#fff" />
        </View>
        <View style={styles.info}>
          <Text style={styles.ticketId} numberOfLines={1}>
            {ticket.ticket_number ?? ticket.id}
          </Text>
          <Text style={styles.date}>
            {ticket.created_at
              ? new Date(ticket.created_at).toLocaleDateString('en-IN', {
                  month: 'short',
                  day: 'numeric',
                  year: 'numeric',
                  hour: '2-digit',
                  minute: '2-digit',
                })
              : '--'}
          </Text>
        </View>
        <View style={styles.actions}>
          <View style={[styles.actionBtn, { backgroundColor: 'rgba(0,0,0,0.2)' }]}>
            <Svg width={14} height={14} viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="2">
              <Path d="M7 17L17 7M17 7H7M17 7V17" />
            </Svg>
          </View>
        </View>
      </View>

      {/* Tags */}
      <View style={styles.tags}>
        <View style={[styles.tag, { backgroundColor: `${getPriorityColor(ticket.priority)}20` }]}>
          <Text style={[styles.tagText, { color: getPriorityColor(ticket.priority) }]}>
            {ticket.priority?.toUpperCase() ?? 'MEDIUM'}
          </Text>
        </View>
        <View style={[styles.tag, { backgroundColor: `${getStatusColor(ticket.status)}20` }]}>
          <Text style={[styles.tagText, { color: getStatusColor(ticket.status) }]}>
            {ticket.status?.replace('_', ' ').toUpperCase() ?? 'OPEN'}
          </Text>
        </View>
      </View>

      {/* Description */}
      <Text style={styles.description} numberOfLines={2}>
        {ticket.title || ticket.description || 'No description'}
      </Text>

      {/* Assignee */}
      {ticket.assignee && (
        <View style={styles.assignee}>
          <View style={styles.assigneeBadge}>
            <Text style={styles.assigneeBadgeText}>{initials}</Text>
          </View>
          <Text style={styles.assigneeName}>{ticket.assignee.full_name}</Text>
        </View>
      )}

      {/* Footer */}
      {!isClosed && (
        <View style={styles.footer}>
          <View>
            <Text style={styles.slaLabel}>SLA COUNTDOWN</Text>
            <View style={styles.countdownRow}>
              <ClockIcon />
              <Text style={styles.countdown}>{countdown}</Text>
            </View>
          </View>
        </View>
      )}

      {/* CTA */}
      <View style={styles.ctaRow}>
        <TouchableOpacity style={styles.primaryBtn}>
          <Text style={styles.primaryBtnText}>View Ticket</Text>
        </TouchableOpacity>
        {!isClosed && (
          <View style={styles.secondaryBtn}>
            <Text style={styles.secondaryBtnText}>Accept Task</Text>
          </View>
        )}
      </View>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: 'rgba(255,255,255,0.92)',
    borderRadius: 18,
    padding: 16,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.6)',
    shadowColor: '#667eea',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.08,
    shadowRadius: 16,
    elevation: 5,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
  },
  avatar: {
    width: 40,
    height: 40,
    borderRadius: 10,
    backgroundColor: '#667eea',
    justifyContent: 'center',
    alignItems: 'center',
  },
  info: {
    flex: 1,
    marginLeft: 12,
  },
  ticketId: {
    fontSize: 12,
    fontWeight: '600',
    color: '#1a1a1a',
  },
  date: {
    fontSize: 10,
    color: '#666',
    marginTop: 2,
  },
  actions: {
    flexDirection: 'row',
    gap: 6,
  },
  actionBtn: {
    width: 34,
    height: 34,
    borderRadius: 8,
    justifyContent: 'center',
    alignItems: 'center',
  },
  tags: {
    flexDirection: 'row',
    gap: 6,
    marginBottom: 10,
  },
  tag: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 5,
  },
  tagText: {
    fontSize: 9,
    fontWeight: '600',
  },
  description: {
    fontSize: 12,
    color: '#333',
    lineHeight: 17,
    marginBottom: 10,
  },
  assignee: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 10,
  },
  assigneeBadge: {
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: '#667eea',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 8,
  },
  assigneeBadgeText: {
    fontSize: 9,
    fontWeight: '600',
    color: '#fff',
  },
  assigneeName: {
    fontSize: 11,
    color: '#555',
  },
  footer: {
    flexDirection: 'row',
    marginBottom: 10,
  },
  slaLabel: {
    fontSize: 8,
    color: '#888',
    marginBottom: 2,
  },
  countdownRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  countdown: {
    fontSize: 12,
    fontWeight: '600',
    color: '#4CAF50',
  },
  ctaRow: {
    flexDirection: 'row',
    gap: 8,
  },
  primaryBtn: {
    flex: 1,
    backgroundColor: '#667eea',
    borderRadius: 10,
    paddingVertical: 10,
    alignItems: 'center',
  },
  primaryBtnText: {
    color: '#fff',
    fontSize: 12,
    fontWeight: '600',
  },
  secondaryBtn: {
    flex: 1,
    backgroundColor: 'rgba(102,126,234,0.1)',
    borderRadius: 10,
    paddingVertical: 10,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: 'rgba(102,126,234,0.2)',
  },
  secondaryBtnText: {
    color: '#fff',
    fontSize: 12,
    fontWeight: '600',
  },
});
