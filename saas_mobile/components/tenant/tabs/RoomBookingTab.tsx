'use client';
import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, FlatList, TouchableOpacity, RefreshControl } from 'react-native';
import Animated, { FadeInDown } from 'react-native-reanimated';
import Svg, { Path, Circle, Rect, G } from 'react-native-svg';
import { createClient } from '@/utils/supabase/client';

interface Room {
  id: string;
  name: string;
  capacity: number;
  floor: number;
  credits_required: number;
  is_available: boolean;
}

interface RoomBookingTabProps {
  propertyId: string;
  userId: string;
  refreshing?: boolean;
  onRefresh?: () => void;
}

const CAPACITY_OPTIONS = [
  { label: 'Any', value: null },
  { label: '2+', value: 2 },
  { label: '4+', value: 4 },
  { label: '6+', value: 6 },
  { label: '8+', value: 8 },
];

function RoomIcon({ color }: { color: string }) {
  return (
    <Svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <Rect x="3" y="3" width="18" height="18" rx="2" />
      <Path d="M3 9h18M9 21V9" />
    </Svg>
  );
}

export function RoomBookingTab({ propertyId, userId, refreshing, onRefresh }: RoomBookingTabProps) {
  const [rooms, setRooms] = useState<Room[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedCapacity, setSelectedCapacity] = useState<number | null>(null);

  const fetchRooms = async () => {
    const supabase = createClient();
    let query = supabase
      .from('meeting_rooms')
      .select('id, name, capacity, floor, credits_required, is_available')
      .eq('property_id', propertyId)
      .eq('is_available', true)
      .order('name');

    if (selectedCapacity) {
      query = query.gte('capacity', selectedCapacity);
    }

    const { data, error } = await query;
    if (!error && data) {
      setRooms(data);
    }
    setLoading(false);
  };

  useEffect(() => {
    fetchRooms();
  }, [propertyId, selectedCapacity]);

  const handleRefresh = () => {
    setLoading(true);
    fetchRooms();
    onRefresh?.();
  };

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <View>
          <Text style={styles.title}>Meeting Rooms</Text>
          <Text style={styles.subtitle}>{rooms.length} rooms available</Text>
        </View>
      </View>

      {/* Capacity filter */}
      <View style={styles.capacityRow}>
        {CAPACITY_OPTIONS.map((opt) => (
          <TouchableOpacity
            key={opt.label}
            onPress={() => setSelectedCapacity(opt.value)}
            style={[styles.capChip, selectedCapacity === opt.value && styles.capChipActive]}
            activeOpacity={0.7}
          >
            <Text style={[styles.capChipText, selectedCapacity === opt.value && styles.capChipTextActive]}>
              {opt.label}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      {/* Rooms list */}
      <FlatList
        data={rooms}
        keyExtractor={(item) => item.id}
        renderItem={({ item, index }) => (
          <Animated.View entering={FadeInDown.delay(index * 60).springify()} style={styles.roomCard}>
            <View style={styles.roomIconWrap}>
              <RoomIcon color="#708F96" />
            </View>
            <View style={styles.roomInfo}>
              <Text style={styles.roomName}>{item.name}</Text>
              <View style={styles.roomMeta}>
                <View style={styles.metaItem}>
                  <Svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="#888" strokeWidth="2">
                    <Path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z" />
                  </Svg>
                  <Text style={styles.roomMetaText}>Floor {item.floor}</Text>
                </View>
                <View style={styles.metaItem}>
                  <Svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="#888" strokeWidth="2">
                    <Path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" />
                    <Circle cx="9" cy="7" r="4" />
                  </Svg>
                  <Text style={styles.roomMetaText}>{item.capacity} people</Text>
                </View>
                <View style={styles.creditBadge}>
                  <Text style={styles.roomCreditText}>{item.credits_required} cr/hr</Text>
                </View>
              </View>
            </View>
            <TouchableOpacity style={styles.bookBtn} activeOpacity={0.8}>
              <Text style={styles.bookBtnText}>Book</Text>
            </TouchableOpacity>
          </Animated.View>
        )}
        contentContainerStyle={styles.listContent}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl
            refreshing={refreshing ?? false}
            onRefresh={handleRefresh}
            tintColor="#708F96"
            colors={['#708F96']}
          />
        }
        ListEmptyComponent={
          <Animated.View entering={FadeInDown.delay(100)} style={styles.empty}>
            <View style={styles.emptyIconWrap}>
              <Svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="#708F96" strokeWidth="1.5" strokeLinecap="round">
                <Rect x="3" y="3" width="18" height="18" rx="2" />
                <Path d="M3 9h18M9 21V9" />
              </Svg>
            </View>
            <Text style={styles.emptyText}>
              {loading ? 'Loading rooms...' : 'No rooms available'}
            </Text>
            <Text style={styles.emptySubtext}>
              {loading ? '' : 'Try adjusting your capacity filter'}
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
    backgroundColor: '#060912',
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingTop: 16,
    paddingBottom: 8,
  },
  title: {
    fontSize: 22,
    fontWeight: '800',
    color: '#FFFFFF',
    letterSpacing: -0.5,
    fontFamily: 'Poppins-SemiBold',
  },
  subtitle: {
    fontSize: 12,
    color: 'rgba(255,255,255,0.55)',
    marginTop: 2,
    fontWeight: '500',
    fontFamily: 'Urbanist-Regular',
  },
  capacityRow: {
    flexDirection: 'row',
    paddingHorizontal: 16,
    paddingVertical: 10,
    gap: 8,
  },
  capChip: {
    paddingHorizontal: 14,
    paddingVertical: 7,
    borderRadius: 20,
    backgroundColor: 'rgba(255,255,255,0.08)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.12)',
  },
  capChipActive: {
    backgroundColor: '#708F96',
    borderColor: '#708F96',
    shadowColor: '#708F96',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 6,
    elevation: 3,
  },
  capChipText: {
    fontSize: 12,
    color: 'rgba(255,255,255,0.55)',
    fontWeight: '500',
    fontFamily: 'Urbanist-SemiBold',
  },
  capChipTextActive: {
    color: '#fff',
    fontWeight: '600',
    fontFamily: 'Urbanist-SemiBold',
  },
  listContent: {
    padding: 16,
    paddingBottom: 200,
  },
  roomCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(255,255,255,0.08)',
    borderRadius: 16,
    padding: 14,
    marginBottom: 10,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.12)',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.05,
    shadowRadius: 8,
    elevation: 3,
  },
  roomIconWrap: {
    width: 44,
    height: 44,
    borderRadius: 12,
    backgroundColor: 'rgba(112,143,150,0.15)',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  roomInfo: {
    flex: 1,
  },
  roomName: {
    fontSize: 15,
    fontWeight: '700',
    color: '#FFFFFF',
    marginBottom: 5,
    fontFamily: 'Urbanist-SemiBold',
  },
  roomMeta: {
    flexDirection: 'row',
    gap: 10,
    flexWrap: 'wrap',
    alignItems: 'center',
  },
  metaItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  roomMetaText: {
    fontSize: 11,
    color: 'rgba(255,255,255,0.55)',
    fontWeight: '500',
    fontFamily: 'Urbanist-Regular',
  },
  creditBadge: {
    backgroundColor: 'rgba(212,160,23,0.1)',
    borderRadius: 6,
    paddingHorizontal: 7,
    paddingVertical: 2,
  },
  roomCreditText: {
    fontSize: 10,
    color: '#FF9F0A',
    fontWeight: '700',
  },
  bookBtn: {
    backgroundColor: '#708F96',
    borderRadius: 10,
    paddingHorizontal: 18,
    paddingVertical: 9,
    shadowColor: '#708F96',
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.25,
    shadowRadius: 6,
    elevation: 3,
  },
  bookBtnText: {
    color: '#fff',
    fontSize: 12,
    fontWeight: '700',
    fontFamily: 'Urbanist-SemiBold',
  },
  empty: {
    backgroundColor: 'rgba(255,255,255,0.08)',
    borderRadius: 18,
    padding: 32,
    alignItems: 'center',
    marginTop: 20,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.12)',
  },
  emptyIconWrap: {
    width: 60,
    height: 60,
    borderRadius: 30,
    backgroundColor: 'rgba(112,143,150,0.12)',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 16,
  },
  emptyText: {
    fontSize: 16,
    fontWeight: '700',
    color: '#FFFFFF',
    marginBottom: 4,
    fontFamily: 'Urbanist-SemiBold',
  },
  emptySubtext: {
    fontSize: 13,
    color: 'rgba(255,255,255,0.45)',
    textAlign: 'center',
    fontFamily: 'Urbanist-Regular',
  },
});
