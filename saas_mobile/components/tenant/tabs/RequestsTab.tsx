'use client';
import React, { useState } from 'react';
import { View, Text, StyleSheet, FlatList, RefreshControl, TouchableOpacity } from 'react-native';
import Animated, { FadeInDown } from 'react-native-reanimated';
import Svg, { Path, Circle } from 'react-native-svg';
import { TenantTicketCard } from '../TenantTicketCard';

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

interface RequestsTabProps {
  tickets: Ticket[];
  onRefresh?: () => void;
  refreshing?: boolean;
  onTicketPress?: (ticket: Ticket) => void;
  onCreateTicket?: () => void;
}

const FILTERS = ['All', 'Open', 'In Progress', 'Resolved'];

const FILTER_COLORS: Record<string, string> = {
  All: '#667eea',
  Open: '#3B82F6',
  'In Progress': '#F59E0B',
  Resolved: '#10B981',
};

export function RequestsTab({ tickets, onRefresh, refreshing, onTicketPress, onCreateTicket }: RequestsTabProps) {
  const [activeFilter, setActiveFilter] = useState('All');

  const filtered = tickets.filter((t) => {
    if (activeFilter === 'All') return true;
    if (activeFilter === 'Open') return t.status.toLowerCase() === 'open';
    if (activeFilter === 'In Progress') return t.status.toLowerCase() === 'in_progress';
    if (activeFilter === 'Resolved') return ['resolved', 'closed'].includes(t.status.toLowerCase());
    return true;
  });

  return (
    <View style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <View>
          <Text style={styles.title}>My Requests</Text>
          <Text style={styles.subtitle}>{filtered.length} {activeFilter.toLowerCase()}</Text>
        </View>
        <TouchableOpacity style={styles.createBtn} onPress={onCreateTicket} activeOpacity={0.8}>
          <Svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="2.5" strokeLinecap="round">
            <Path d="M12 5v14M5 12h14" />
          </Svg>
          <Text style={styles.createBtnText}>New Request</Text>
        </TouchableOpacity>
      </View>

      {/* Filter chips */}
      <View style={styles.filterRow}>
        {FILTERS.map((f, i) => {
          const active = activeFilter === f;
          const color = FILTER_COLORS[f];
          return (
            <TouchableOpacity
              key={f}
              onPress={() => setActiveFilter(f)}
              style={[
                styles.chip,
                active && { backgroundColor: color, borderColor: color },
              ]}
              activeOpacity={0.7}
            >
              <Text style={[styles.chipText, active && styles.chipTextActive]}>{f}</Text>
              {active && <View style={[styles.chipDot, { backgroundColor: 'rgba(255,255,255,0.5)' }]} />}
            </TouchableOpacity>
          );
        })}
      </View>

      {/* List */}
      <FlatList
        data={filtered}
        keyExtractor={(item) => item.id}
        renderItem={({ item, index }) => (
          <Animated.View entering={FadeInDown.delay(index * 60).springify()} style={styles.cardWrapper}>
            <TenantTicketCard ticket={item} onPress={() => onTicketPress?.(item)} />
          </Animated.View>
        )}
        contentContainerStyle={styles.listContent}
        showsVerticalScrollIndicator={false}
        refreshControl={
          onRefresh ? (
            <RefreshControl
              refreshing={refreshing ?? false}
              onRefresh={onRefresh}
              tintColor="#667eea"
              colors={['#667eea']}
            />
          ) : undefined
        }
        ListEmptyComponent={
          <Animated.View entering={FadeInDown.delay(100)} style={styles.empty}>
            <View style={styles.emptyIconWrap}>
              <Svg width="30" height="30" viewBox="0 0 24 24" fill="none" stroke="#667eea" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                <Path d="M2 9a3 3 0 0 1 0 6v2a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2v-2a3 3 0 0 1 0-6V7a2 2 0 0 0-2-2H4a2 2 0 0 0-2 2Z" />
                <Path d="M13 5v14M13 12h.01" />
              </Svg>
            </View>
            <Text style={styles.emptyText}>
              {activeFilter === 'All' ? 'No requests yet' : `No ${activeFilter.toLowerCase()} requests`}
            </Text>
            <Text style={styles.emptySubtext}>
              {activeFilter === 'All' ? 'Tap "New Request" to raise your first ticket' : 'Try a different filter to see more requests'}
            </Text>
          </Animated.View>
        }
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f0f4f8',
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingTop: 16,
    paddingBottom: 6,
  },
  title: {
    fontSize: 22,
    fontWeight: '800',
    color: '#1a1a1a',
    letterSpacing: -0.5,
  },
  subtitle: {
    fontSize: 12,
    color: '#888',
    marginTop: 2,
    fontWeight: '500',
  },
  createBtn: {
    backgroundColor: '#667eea',
    borderRadius: 10,
    paddingHorizontal: 14,
    paddingVertical: 9,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    shadowColor: '#667eea',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 4,
  },
  createBtnText: {
    color: '#fff',
    fontSize: 12,
    fontWeight: '700',
  },
  filterRow: {
    flexDirection: 'row',
    paddingHorizontal: 16,
    paddingVertical: 10,
    gap: 8,
  },
  chip: {
    paddingHorizontal: 14,
    paddingVertical: 7,
    borderRadius: 20,
    backgroundColor: 'rgba(255,255,255,0.9)',
    borderWidth: 1,
    borderColor: 'rgba(0,0,0,0.08)',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
  },
  chipDot: {
    width: 5,
    height: 5,
    borderRadius: 2.5,
  },
  chipText: {
    fontSize: 12,
    color: '#666',
    fontWeight: '500',
  },
  chipTextActive: {
    color: '#fff',
    fontWeight: '600',
  },
  listContent: {
    padding: 16,
    paddingBottom: 200,
  },
  cardWrapper: {
    marginBottom: 12,
  },
  empty: {
    backgroundColor: 'rgba(255,255,255,0.9)',
    borderRadius: 18,
    padding: 32,
    alignItems: 'center',
    marginTop: 20,
    borderWidth: 1,
    borderColor: 'rgba(0,0,0,0.05)',
  },
  emptyIconWrap: {
    width: 60,
    height: 60,
    borderRadius: 30,
    backgroundColor: 'rgba(102,126,234,0.1)',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 16,
  },
  emptyText: {
    fontSize: 16,
    fontWeight: '700',
    color: '#1a1a1a',
    marginBottom: 4,
  },
  emptySubtext: {
    fontSize: 13,
    color: '#888',
    textAlign: 'center',
  },
});
