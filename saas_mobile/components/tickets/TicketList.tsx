import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { Ticket } from '@/types';
import { EmptyState } from '@/components/ui';
import { RefreshControl } from 'react-native';

interface TicketListProps {
  tickets: Ticket[];
  loading: boolean;
  refreshing?: boolean;
  onRefresh?: () => void;
  emptyTitle?: string;
  emptyDescription?: string;
  emptyActionLabel?: string;
  onEmptyAction?: () => void;
}

export default function TicketList({
  tickets,
  loading,
  refreshing = false,
  onRefresh,
  emptyTitle,
  emptyDescription,
  emptyActionLabel,
  onEmptyAction,
}: TicketListProps) {
  if (loading && tickets.length === 0) {
    return (
      <View style={styles.container}>
        <Text style={styles.loadingText}>Loading...</Text>
      </View>
    );
  }

  if (tickets.length === 0) {
    return (
      <View style={styles.container}>
        <EmptyState
          title={emptyTitle || 'No tickets'}
          description={emptyDescription}
          actionLabel={emptyActionLabel}
          onEmptyAction={onEmptyAction}
        />
      </View>
    );
  }

  return (
    <View style={styles.container}>
      {tickets.map(ticket => (
        <View key={ticket.id} style={styles.ticketItem}>
          <Text style={styles.ticketTitle}>{ticket.title}</Text>
          <Text style={styles.ticketStatus}>{ticket.status}</Text>
        </View>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    padding: 16,
  },
  loadingText: {
    textAlign: 'center',
    marginTop: 32,
  },
  ticketItem: {
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#E2E8F0',
  },
  ticketTitle: {
    fontSize: 14,
    fontFamily: 'Urbanist-SemiBold',
  },
  ticketStatus: {
    fontSize: 12,
    color: '#64748B',
    marginTop: 4,
  },
});
