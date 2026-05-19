import React, { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  TextInput,
  ScrollView,
  ActivityIndicator,
  Image,
  KeyboardAvoidingView,
  Platform,
  Switch,
} from 'react-native';
import { useLocalSearchParams, useRouter, Stack } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTheme } from '@/context';
import { Colors, DesignTokens } from '@/constants/Colors';
import { LinearGradient } from 'expo-linear-gradient';
import SafeBlurView from '@/components/ui/SafeBlurView';
import { supabase } from '@/utils/supabase/client';
import { toast } from '@/lib/toast';
import { Ionicons } from '@expo/vector-icons';


import {
  Plus,
  Search,
  DoorOpen,
  Users,
  MapPin,
  Wifi,
  Projector,
  Monitor,
  Coffee,
  Snowflake,
  Tv,
  LayoutGrid,
  Calendar,
  ChevronRight,
  X,
  Clock,
  User,
  Edit2,
  Trash2,
  Check,
  Building2,
} from 'lucide-react-native';
import BottomSheet, { BottomSheetBackdrop, BottomSheetView, BottomSheetScrollView } from '@gorhom/bottom-sheet';
import { format, startOfDay, endOfDay } from 'date-fns';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface Room {
  id: string;
  name: string;
  photo_url: string;
  location: string;
  capacity: number;
  size?: number;
  amenities: string[];
  status: string;
  description?: string;
  property_id: string;
  created_at?: string;
}

interface Booking {
  id: string;
  room_id: string;
  room_name?: string;
  title: string;
  booked_by: string;
  booked_by_name?: string;
  start_time: string;
  end_time: string;
  status: string;
  attendees?: number;
  property_id: string;
}

interface StaffMember {
  id: string;
  name: string;
  email: string;
  full_name?: string;
  designation?: string;
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const AMENITY_ICONS: Record<string, React.ReactNode> = {
  wifi: <Wifi size={14} />,
  projector: <Projector size={14} />,
  tv: <Tv size={14} />,
  whiteboard: <Monitor size={14} />,
  coffee: <Coffee size={14} />,
  ac: <Snowflake size={14} />,
};

const AMENITY_LABELS: Record<string, string> = {
  wifi: 'Wi-Fi',
  projector: 'Projector',
  tv: 'TV',
  whiteboard: 'Whiteboard',
  coffee: 'Coffee',
  ac: 'AC',
};

const ALL_AMENITIES = Object.keys(AMENITY_LABELS);

const STATUS_CONFIG: Record<string, { color: string; bg: string; label: string }> = {
  available: { color: Colors.light.success, bg: Colors.light.successBg, label: 'Available' },
  busy: { color: Colors.light.error, bg: Colors.light.errorBg, label: 'Busy' },
  maintenance: { color: Colors.light.warning, bg: Colors.light.warningBg, label: 'Maintenance' },
  active: { color: Colors.light.success, bg: Colors.light.successBg, label: 'Available' },
  inactive: { color: Colors.light.textTertiary, bg: Colors.light.surface, label: 'Inactive' },
};

// ---------------------------------------------------------------------------
// Room Card Component
// ---------------------------------------------------------------------------

function RoomCard({ room, onPress, onEdit, onDelete }: {
  room: Room;
  onPress: () => void;
  onEdit: () => void;
  onDelete: () => void;
}) {
  const { theme } = useTheme();
  const colors = Colors[theme];
  const statusCfg = STATUS_CONFIG[room.status] ?? STATUS_CONFIG.available;

  return (
    <TouchableOpacity
      style={[styles.roomCard]}
      onPress={onPress}
      activeOpacity={0.7}
    >
      <SafeBlurView
        intensity={40}
        tint="dark"
        style={[StyleSheet.absoluteFillObject, { borderRadius: 16, borderWidth: 1, borderColor: 'rgba(255,255,255,0.15)', overflow: 'hidden' }]}
      >
        <LinearGradient
          colors={['rgba(255,255,255,0.06)', 'rgba(255,255,255,0.02)', 'rgba(0,0,0,0.1)']}
          style={StyleSheet.absoluteFillObject}
        />
      </SafeBlurView>
      {/* Photo */}
      <View style={styles.roomPhotoWrap}>
        {room.photo_url ? (
          <Image source={{ uri: room.photo_url }} style={styles.roomPhoto} resizeMode="cover" />
        ) : (
          <DoorOpen size={32} color="#64748B" />
        )}
        {/* Status badge */}
        <View style={[styles.roomStatusBadge, { backgroundColor: statusCfg.bg }]}>
          <View style={[styles.roomStatusDot, { backgroundColor: statusCfg.color }]} />
          <Text style={[styles.roomStatusText, { color: statusCfg.color }]}>{statusCfg.label}</Text>
        </View>
      </View>

      {/* Info */}
      <View style={styles.roomInfo}>
        <View style={styles.roomNameRow}>
          <Text style={styles.roomName} numberOfLines={1}>{room.name}</Text>
          <View style={styles.roomActions}>
            <TouchableOpacity style={styles.roomActionBtn} onPress={onEdit}>
              <Edit2 size={14} color="#64748B" />
            </TouchableOpacity>
            <TouchableOpacity style={styles.roomActionBtn} onPress={onDelete}>
              <Trash2 size={14} color="#EF4444" />
            </TouchableOpacity>
          </View>
        </View>

        <View style={styles.roomMeta}>
          <View style={styles.roomMetaItem}>
            <Users size={12} color="#94A3B8" />
            <Text style={styles.roomMetaText}>{room.capacity} seats</Text>
          </View>
          {room.location && (
            <View style={styles.roomMetaItem}>
              <MapPin size={12} color="#94A3B8" />
              <Text style={styles.roomMetaText} numberOfLines={1}>{room.location}</Text>
            </View>
          )}
        </View>

        {/* Amenities */}
        {room.amenities && room.amenities.length > 0 && (
          <View style={styles.amenitiesRow}>
            {room.amenities.slice(0, 5).map((a) => (
              <View key={a} style={styles.amenityChip}>
                <Text style={{ marginRight: 3 }}>{AMENITY_ICONS[a]}</Text>
                <Text style={styles.amenityChipText}>{AMENITY_LABELS[a] ?? a}</Text>
              </View>
            ))}
            {room.amenities.length > 5 && (
              <Text style={styles.amenityMore}>+{room.amenities.length - 5}</Text>
            )}
          </View>
        )}
      </View>

      <ChevronRight size={16} color="#64748B" style={{ alignSelf: 'center' }} />
    </TouchableOpacity>
  );
}

// ---------------------------------------------------------------------------
// Room Detail Bottom Sheet
// ---------------------------------------------------------------------------

function RoomDetailSheet({
  room,
  bookings,
  loadingBookings,
  onBook,
}: {
  room: Room;
  bookings: Booking[];
  loadingBookings: boolean;
  onBook: () => void;
}) {
  const { theme } = useTheme();
  const colors = Colors[theme];
  const statusCfg = STATUS_CONFIG[room.status] ?? STATUS_CONFIG.available;

  return (
    <BottomSheetScrollView contentContainerStyle={{ paddingBottom: 40 }} showsVerticalScrollIndicator={false}>
      {/* Header Photo */}
      <View style={[styles.roomDetailPhoto, { backgroundColor: 'rgba(30,41,59,0.5)' }]}>
        {room.photo_url ? (
          <Image source={{ uri: room.photo_url }} style={styles.roomDetailPhotoImg} resizeMode="cover" />
        ) : (
          <DoorOpen size={56} color="#64748B" />
        )}
        <View style={[styles.roomDetailStatus, { backgroundColor: statusCfg.bg }]}>
          <View style={[styles.roomStatusDot, { backgroundColor: statusCfg.color }]} />
          <Text style={[styles.roomStatusText, { color: statusCfg.color }]}>{statusCfg.label}</Text>
        </View>
      </View>

      {/* Room Info */}
      <View style={styles.roomDetailInfo}>
        <Text style={styles.roomDetailName}>{room.name}</Text>
        {room.description && (
          <Text style={styles.roomDetailDesc}>{room.description}</Text>
        )}

        <View style={styles.roomDetailMeta}>
          <View style={styles.metaChip}>
            <Users size={14} color="#60A5FA" />
            <Text style={styles.metaChipText}>{room.capacity} seats</Text>
          </View>
          {room.location && (
            <View style={styles.metaChip}>
              <MapPin size={14} color="#60A5FA" />
              <Text style={styles.metaChipText}>{room.location}</Text>
            </View>
          )}
          {room.size && (
            <View style={styles.metaChip}>
              <DoorOpen size={14} color="#60A5FA" />
              <Text style={styles.metaChipText}>{room.size} sqft</Text>
            </View>
          )}
        </View>

        {/* Amenities */}
        {room.amenities && room.amenities.length > 0 && (
          <View style={styles.roomDetailAmenities}>
            <Text style={styles.sectionTitle}>Amenities</Text>
            <View style={styles.amenitiesGrid}>
              {room.amenities.map((a) => (
                <View key={a} style={styles.amenityItem}>
                  <Text style={{ marginRight: 4 }}>{AMENITY_ICONS[a]}</Text>
                  <Text style={styles.amenityItemText}>{AMENITY_LABELS[a] ?? a}</Text>
                </View>
              ))}
            </View>
          </View>
        )}

        {/* Today's Bookings */}
        <View style={styles.roomDetailBookings}>
          <Text style={styles.sectionTitle}>Today's Schedule</Text>
          {loadingBookings ? (
            <ActivityIndicator size="small" color="#60A5FA" style={{ marginVertical: 12 }} />
          ) : bookings.length === 0 ? (
            <View style={styles.noBookings}>
              <Clock size={16} color="#22C55E" />
              <Text style={styles.noBookingsText}>Available all day</Text>
            </View>
          ) : (
            bookings.map((b) => (
              <View key={b.id} style={styles.bookingItem}>
                <View style={[styles.bookingTimeBar, { backgroundColor: '#60A5FA' }]} />
                <View style={styles.bookingContent}>
                  <Text style={styles.bookingTitle}>{b.title}</Text>
                  <Text style={styles.bookingMeta}>
                    {format(new Date(b.start_time), 'h:mm a')} - {format(new Date(b.end_time), 'h:mm a')}
                    {b.booked_by_name ? ` · ${b.booked_by_name}` : ''}
                  </Text>
                </View>
                <View style={[
                  styles.bookingStatusBadge,
                  { backgroundColor: b.status === 'confirmed' ? 'rgba(34,197,94,0.12)' : 'rgba(245,158,11,0.12)' }
                ]}>
                  <Text style={[
                    styles.bookingStatusText,
                    { color: b.status === 'confirmed' ? '#22C55E' : '#F59E0B' }
                  ]}>
                    {b.status === 'confirmed' ? 'Confirmed' : 'Pending'}
                  </Text>
                </View>
              </View>
            ))
          )}
        </View>

        {/* Book Button */}
        <TouchableOpacity
          style={styles.bookRoomBtn}
          onPress={onBook}
          activeOpacity={0.8}
        >
          <Calendar size={18} color="#60A5FA" />
          <Text style={styles.bookRoomBtnText}>Book This Room</Text>
        </TouchableOpacity>
      </View>
    </BottomSheetScrollView>
  );
}

// ---------------------------------------------------------------------------
// Room Form (Create / Edit) Bottom Sheet
// ---------------------------------------------------------------------------

function RoomForm({
  room,
  propertyId,
  onClose,
  onSuccess,
}: {
  room?: Room;
  propertyId: string;
  onClose: () => void;
  onSuccess: () => void;
}) {
  const { theme } = useTheme();
  const colors = Colors[theme];

  const [name, setName] = useState(room?.name ?? '');
  const [location, setLocation] = useState(room?.location ?? '');
  const [capacity, setCapacity] = useState(room?.capacity?.toString() ?? '');
  const [size, setSize] = useState(room?.size?.toString() ?? '');
  const [description, setDescription] = useState(room?.description ?? '');
  const [amenities, setAmenities] = useState<string[]>(room?.amenities ?? []);
  const [status, setStatus] = useState(room?.status ?? 'available');
  const [loading, setLoading] = useState(false);

  const toggleAmenity = (a: string) => {
    setAmenities((prev) => (prev.includes(a) ? prev.filter((x) => x !== a) : [...prev, a]));
  };

  const handleSave = async () => {
    if (!name.trim()) { toast.error('Room name is required'); return; }
    if (!capacity.trim() || isNaN(Number(capacity))) { toast.error('Valid capacity is required'); return; }
    setLoading(true);
    try {
      const payload = {
        name: name.trim(),
        location: location.trim(),
        capacity: Number(capacity),
        size: size ? Number(size) : null,
        description: description.trim() || null,
        amenities,
        status,
        property_id: propertyId,
      };
      let error;
      if (room?.id) {
        ({ error } = await (supabase.from('meeting_rooms') as any).update(payload as any).eq('id', room.id));
      } else {
        ({ error } = await (supabase.from('meeting_rooms') as any).insert(payload as any));
      }
      if (error) throw error;
      toast.success(room?.id ? 'Room updated' : 'Room created');
      onSuccess();
    } catch (err: any) {
      toast.error(err.message || 'Save failed');
    } finally {
      setLoading(false);
    }
  };

  return (
    <KeyboardAvoidingView
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      style={{ flex: 1 }}
    >
      <BottomSheetScrollView contentContainerStyle={{ padding: 16, paddingBottom: 40 }} showsVerticalScrollIndicator={false}>
        <Text style={styles.formTitle}>{room?.id ? 'Edit Room' : 'Add New Room'}</Text>

        <Text style={styles.fieldLabel}>Room Name *</Text>
        <TextInput
          style={styles.input}
          placeholder="e.g. Conference Room A"
          placeholderTextColor="#475569"
          value={name}
          onChangeText={setName}
        />

        <Text style={styles.fieldLabel}>Location / Floor</Text>
        <TextInput
          style={styles.input}
          placeholder="e.g. 2nd Floor, Building B"
          placeholderTextColor="#475569"
          value={location}
          onChangeText={setLocation}
        />

        <View style={styles.rowFields}>
          <View style={{ flex: 1 }}>
            <Text style={styles.fieldLabel}>Capacity *</Text>
            <TextInput
              style={styles.input}
              placeholder="Seats"
              placeholderTextColor="#475569"
              value={capacity}
              onChangeText={setCapacity}
              keyboardType="number-pad"
            />
          </View>
          <View style={{ flex: 1 }}>
            <Text style={styles.fieldLabel}>Size (sqft)</Text>
            <TextInput
              style={styles.input}
              placeholder="Square feet"
              placeholderTextColor="#475569"
              value={size}
              onChangeText={setSize}
              keyboardType="number-pad"
            />
          </View>
        </View>

        <Text style={styles.fieldLabel}>Description</Text>
        <TextInput
          style={[styles.input, styles.textArea]}
          placeholder="Brief description of the room"
          placeholderTextColor="#475569"
          value={description}
          onChangeText={setDescription}
          multiline
          numberOfLines={3}
        />

        <Text style={styles.fieldLabel}>Amenities</Text>
        <View style={styles.amenitiesGrid}>
          {ALL_AMENITIES.map((a) => (
            <TouchableOpacity
              key={a}
              style={[
                styles.amenityToggle,
                amenities.includes(a) && { backgroundColor: '#1E3A5F', borderColor: '#60A5FA' },
              ]}
              onPress={() => toggleAmenity(a)}
            >
              <Text style={{ marginRight: 4 }}>{AMENITY_ICONS[a]}</Text>
              <Text style={[styles.amenityToggleText, amenities.includes(a) && { color: '#60A5FA' }]}>
                {AMENITY_LABELS[a]}
              </Text>
              {amenities.includes(a) && <Check size={12} color="#60A5FA" style={{ marginLeft: 4 }} />}
            </TouchableOpacity>
          ))}
        </View>

        <Text style={styles.fieldLabel}>Status</Text>
        <View style={styles.statusToggle}>
          {['available', 'maintenance'].map((s) => (
            <TouchableOpacity
              key={s}
              style={[
                styles.statusToggleBtn,
                status === s && { backgroundColor: '#1E3A5F', borderColor: '#60A5FA' },
              ]}
              onPress={() => setStatus(s)}
            >
              <Text style={[styles.statusToggleText, status === s && { color: '#60A5FA' }]}>
                {s.charAt(0).toUpperCase() + s.slice(1)}
              </Text>
            </TouchableOpacity>
          ))}
        </View>

        <View style={styles.formActions}>
          <TouchableOpacity
            style={styles.cancelBtn}
            onPress={onClose}
          >
            <Text style={styles.cancelBtnText}>Cancel</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.saveBtn, loading && styles.submitBtnDisabled]}
            onPress={handleSave}
            disabled={loading}
            activeOpacity={0.8}
          >
            {loading ? <ActivityIndicator color="#60A5FA" size="small" /> : <Text style={styles.saveBtnText}>Save Room</Text>}
          </TouchableOpacity>
        </View>
      </BottomSheetScrollView>
    </KeyboardAvoidingView>
  );
}

// ---------------------------------------------------------------------------
// Booking Form Bottom Sheet
// ---------------------------------------------------------------------------

function BookingForm({
  room,
  propertyId,
  onClose,
  onSuccess,
}: {
  room: Room;
  propertyId: string;
  onClose: () => void;
  onSuccess: () => void;
}) {
  const { theme } = useTheme();
  const colors = Colors[theme];

  const [title, setTitle] = useState('');
  const [bookedBy, setBookedBy] = useState('');
  const [attendees, setAttendees] = useState('');
  const [date, setDate] = useState(format(new Date(), 'yyyy-MM-dd'));
  const [startTime, setStartTime] = useState('09:00');
  const [endTime, setEndTime] = useState('10:00');
  const [loading, setLoading] = useState(false);
  const [suggestions, setSuggestions] = useState<StaffMember[]>([]);

  useEffect(() => {
    const fetchUsers = async () => {
      if (bookedBy.length < 2) { setSuggestions([]); return; }
      const { data } = await supabase
        .from('users')
        .select('id, full_name, email, designation')
        .ilike('full_name', `%${bookedBy}%`)
        .limit(5);
      setSuggestions(data as StaffMember[] ?? []);
    };
    const debounce = setTimeout(fetchUsers, 300);
    return () => clearTimeout(debounce);
  }, [bookedBy]);

  const handleBook = async () => {
    if (!title.trim()) { toast.error('Meeting title is required'); return; }
    if (!bookedBy.trim()) { toast.error('Booked by name is required'); return; }
    setLoading(true);
    try {
      const startDateTime = `${date}T${startTime}:00`;
      const endDateTime = `${date}T${endTime}:00`;
      const { error } = await (supabase.from('room_bookings') as any).insert({
        room_id: room.id,
        room_name: room.name,
        property_id: propertyId,
        title: title.trim(),
        booked_by: bookedBy.trim(),
        start_time: startDateTime,
        end_time: endDateTime,
        attendees: attendees ? Number(attendees) : null,
        status: 'confirmed',
      } as any);
      if (error) throw error;
      toast.success('Room booked successfully');
      onSuccess();
    } catch (err: any) {
      toast.error(err.message || 'Booking failed');
    } finally {
      setLoading(false);
    }
  };

  return (
    <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={{ flex: 1 }}>
      <BottomSheetScrollView contentContainerStyle={{ padding: 16, paddingBottom: 40 }} showsVerticalScrollIndicator={false}>
        <Text style={styles.formTitle}>Book {room.name}</Text>

        <Text style={styles.fieldLabel}>Meeting Title *</Text>
        <TextInput
          style={styles.input}
          placeholder="e.g. Team Standup"
          placeholderTextColor="#475569"
          value={title}
          onChangeText={setTitle}
        />

        <Text style={styles.fieldLabel}>Booked By *</Text>
        <TextInput
          style={styles.input}
          placeholder="Your name"
          placeholderTextColor="#475569"
          value={bookedBy}
          onChangeText={setBookedBy}
        />
        {suggestions.length > 0 && (
          <View style={styles.suggestionsList}>
            {suggestions.map((s) => (
              <TouchableOpacity
                key={s.id}
                style={styles.suggestionItem}
                onPress={() => { setBookedBy(s.full_name || s.name || ''); setSuggestions([]); }}
              >
                <User size={14} color="#94A3B8" />
                <Text style={styles.suggestionText}>{s.full_name || s.name}</Text>
              </TouchableOpacity>
            ))}
          </View>
        )}

        <Text style={styles.fieldLabel}>Attendees</Text>
        <TextInput
          style={styles.input}
          placeholder="Number of attendees"
          placeholderTextColor="#475569"
          value={attendees}
          onChangeText={setAttendees}
          keyboardType="number-pad"
        />

        <Text style={styles.fieldLabel}>Date</Text>
        <TextInput
          style={styles.input}
          placeholder="YYYY-MM-DD"
          placeholderTextColor="#475569"
          value={date}
          onChangeText={setDate}
        />

        <View style={styles.rowFields}>
          <View style={{ flex: 1 }}>
            <Text style={styles.fieldLabel}>Start Time</Text>
            <TextInput
              style={styles.input}
              placeholder="HH:MM"
              placeholderTextColor="#475569"
              value={startTime}
              onChangeText={setStartTime}
            />
          </View>
          <View style={{ flex: 1 }}>
            <Text style={styles.fieldLabel}>End Time</Text>
            <TextInput
              style={styles.input}
              placeholder="HH:MM"
              placeholderTextColor="#475569"
              value={endTime}
              onChangeText={setEndTime}
            />
          </View>
        </View>

        <View style={styles.formActions}>
          <TouchableOpacity style={styles.cancelBtn} onPress={onClose}>
            <Text style={styles.cancelBtnText}>Cancel</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.saveBtn, loading && styles.submitBtnDisabled]}
            onPress={handleBook}
            disabled={loading}
            activeOpacity={0.8}
          >
            {loading ? <ActivityIndicator color="#60A5FA" size="small" /> : <Text style={styles.saveBtnText}>Confirm Booking</Text>}
          </TouchableOpacity>
        </View>
      </BottomSheetScrollView>
    </KeyboardAvoidingView>
  );
}

// ---------------------------------------------------------------------------
// Main Screen
// ---------------------------------------------------------------------------

type RoomTab = 'rooms' | 'bookings';

export default function RoomsScreen() {
  const { propertyId } = useLocalSearchParams<{ propertyId: string }>();
  const router = useRouter();
  const { theme } = useTheme();
  const colors = Colors[theme];
  const isDark = theme === 'dark';
  const insets = useSafeAreaInsets();

  const [activeTab, setActiveTab] = useState<RoomTab>('rooms');

  const [rooms, setRooms] = useState<Room[]>([]);
  const [bookings, setBookings] = useState<Booking[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');

  // Bottom sheets
  const detailSheetRef = useRef<BottomSheet>(null);
  const formSheetRef = useRef<BottomSheet>(null);
  const bookingSheetRef = useRef<BottomSheet>(null);

  const [selectedRoom, setSelectedRoom] = useState<Room | null>(null);
  const [editingRoom, setEditingRoom] = useState<Room | undefined>(undefined);
  const [roomBookings, setRoomBookings] = useState<Booking[]>([]);
  const [loadingBookings, setLoadingBookings] = useState(false);

  const snapPoints = useMemo(() => ['60%', '90%'], []);
  const formSnapPoints = useMemo(() => ['85%'], []);

  // Fetch rooms
  const fetchRooms = useCallback(async () => {
    if (!propertyId) return;
    setIsLoading(true);
    try {
      const { data, error } = await supabase
        .from('meeting_rooms')
        .select('*')
        .eq('property_id', propertyId)
        .order('name');
      if (error) throw error;
      setRooms((data as Room[]) ?? []);
    } catch (err) {
      console.error('Error fetching rooms:', err);
    } finally {
      setIsLoading(false);
    }
  }, [propertyId]);

  // Fetch bookings
  const fetchBookings = useCallback(async () => {
    if (!propertyId) return;
    try {
      const { start, end } = {
        start: startOfDay(new Date()).toISOString(),
        end: endOfDay(new Date()).toISOString(),
      };
      const { data, error } = await supabase
        .from('room_bookings')
        .select('*')
        .eq('property_id', propertyId)
        .gte('start_time', start)
        .lte('start_time', end)
        .order('start_time');
      if (error) throw error;
      setBookings((data as Booking[]) ?? []);
    } catch (err) {
      console.error('Error fetching bookings:', err);
    }
  }, [propertyId]);

  useEffect(() => {
    fetchRooms();
    fetchBookings();
  }, [fetchRooms, fetchBookings]);

  // Fetch today's bookings for selected room
  const fetchRoomBookings = useCallback(async (roomId: string) => {
    setLoadingBookings(true);
    try {
      const { start, end } = {
        start: startOfDay(new Date()).toISOString(),
        end: endOfDay(new Date()).toISOString(),
      };
      const { data } = await supabase
        .from('room_bookings')
        .select('*')
        .eq('room_id', roomId)
        .gte('start_time', start)
        .lte('start_time', end)
        .order('start_time');
      setRoomBookings((data as Booking[]) ?? []);
    } catch (err) {
      console.error(err);
    } finally {
      setLoadingBookings(false);
    }
  }, []);

  const handleRoomPress = (room: Room) => {
    setSelectedRoom(room);
    fetchRoomBookings(room.id);
    detailSheetRef.current?.expand();
  };

  const handleEditRoom = (room: Room) => {
    detailSheetRef.current?.close();
    setEditingRoom(room);
    formSheetRef.current?.expand();
  };

  const handleAddRoom = () => {
    setEditingRoom(undefined);
    formSheetRef.current?.expand();
  };

  const handleDeleteRoom = async (room: Room) => {
    // Simple confirm via alert
    const { Alert } = require('react-native');
    Alert.alert('Delete Room', `Are you sure you want to deactivate "${room.name}"?`, [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete',
        style: 'destructive',
        onPress: async () => {
          try {
            const { error } = await (supabase.from('meeting_rooms') as any)
              .update({ status: 'inactive' } as any)
              .eq('id', room.id);
            if (error) throw error;
            toast.success('Room deactivated');
            fetchRooms();
          } catch (err: any) {
            toast.error(err.message || 'Delete failed');
          }
        },
      },
    ]);
  };

  const handleBookRoom = () => {
    detailSheetRef.current?.close();
    bookingSheetRef.current?.expand();
  };

  const renderBackdrop = useCallback(
    (props: any) => (
      <BottomSheetBackdrop {...props} appearsOnIndex={0} disappearsOnIndex={-1} opacity={0.5} />
    ),
    []
  );

  const filteredRooms = rooms.filter((r) =>
    searchQuery
      ? r.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        r.location?.toLowerCase().includes(searchQuery.toLowerCase())
      : true
  );

  const renderRoomItem = ({ item }: { item: Room }) => (
    <RoomCard
      room={item}
      onPress={() => handleRoomPress(item)}
      onEdit={() => handleEditRoom(item)}
      onDelete={() => handleDeleteRoom(item)}
    />
  );

  return (
    <View style={[styles.container, { paddingBottom: Math.max(insets.bottom, 12) + 90 }]}>
      <Stack.Screen options={{ headerShown: false }} />
      <LinearGradient
        colors={isDark ? ['#0B1120', '#0F172A', '#1E293B'] : ['#F1F5F9', '#F8FAFC', '#FFFFFF']}
        style={StyleSheet.absoluteFillObject}
      />

      {/* Header */}
      <View style={[styles.header, { paddingTop: insets.top + 12 }]}>
        <View style={styles.headerTop}>
          <TouchableOpacity onPress={() => router.back()} style={styles.backBtn} activeOpacity={0.7}>
            <Ionicons name="chevron-back" size={22} color="#FFFFFF" />
          </TouchableOpacity>
          <View style={styles.headerTitleWrap}>
            <Text style={styles.headerTitleMain}>Meeting Rooms</Text>
            <Text style={styles.headerSubtitleMain}>Manage conference facilities</Text>
          </View>
          {activeTab === 'rooms' && (
            <TouchableOpacity
              style={[styles.headerAddBtnPill, { backgroundColor: '#1E3A5F' }]}
              onPress={handleAddRoom}
              activeOpacity={0.8}
            >
              <Plus size={14} color="#60A5FA" />
              <Text style={styles.headerAddBtnText}>Add Room</Text>
            </TouchableOpacity>
          )}
        </View>

        {/* Tabs */}
        <View style={styles.tabBar}>
          <TouchableOpacity
            style={[styles.tab, activeTab === 'rooms' && styles.tabActive]}
            onPress={() => setActiveTab('rooms')}
            activeOpacity={0.8}
          >
            <Building2 size={14} color={activeTab === 'rooms' ? '#FFFFFF' : '#94A3B8'} />
            <Text style={[styles.tabText, activeTab === 'rooms' && styles.tabTextActive]}>My Rooms</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.tab, activeTab === 'bookings' && styles.tabActive]}
            onPress={() => setActiveTab('bookings')}
            activeOpacity={0.8}
          >
            <Calendar size={14} color={activeTab === 'bookings' ? '#FFFFFF' : '#94A3B8'} />
            <Text style={[styles.tabText, activeTab === 'bookings' && styles.tabTextActive]}>Today's Bookings</Text>
          </TouchableOpacity>
        </View>
      </View>

      {activeTab === 'rooms' ? (
        <>
          {/* Search */}
          <View style={styles.searchRow}>
            <View style={styles.searchWrap}>
              <Search size={16} color="#64748B" />
              <TextInput
                style={styles.searchInput}
                placeholder="Search by name or location..."
                placeholderTextColor="#475569"
                value={searchQuery}
                onChangeText={setSearchQuery}
              />
            </View>
          </View>

          {/* Room List */}
          {isLoading ? (
            <View style={styles.loadingWrap}>
              <ActivityIndicator size="large" color="#60A5FA" />
            </View>
          ) : filteredRooms.length === 0 ? (
            <View style={styles.emptyWrap}>
              <View style={styles.emptyIconGlow}>
                <DoorOpen size={36} color="#60A5FA" />
              </View>
              <Text style={styles.emptyTitle}>No rooms found</Text>
              <Text style={styles.emptySub}>
                {searchQuery ? 'Try a different search' : 'Add your first meeting room'}
              </Text>
            </View>
          ) : (
            <FlatList
              data={filteredRooms}
              renderItem={renderRoomItem}
              keyExtractor={(item) => item.id}
              contentContainerStyle={styles.listContent}
              showsVerticalScrollIndicator={false}
              ItemSeparatorComponent={() => <View style={{ height: 12 }} />}
            />
          )}
        </>
      ) : (
        /* Bookings List */
        <FlatList
          data={bookings}
          keyExtractor={(item) => item.id}
          contentContainerStyle={styles.listContent}
          showsVerticalScrollIndicator={false}
          ListEmptyComponent={
            <View style={styles.emptyWrap}>
              <View style={styles.emptyIconGlow}>
                <Calendar size={36} color="#60A5FA" />
              </View>
              <Text style={styles.emptyTitle}>No bookings today</Text>
              <Text style={styles.emptySub}>
                Select a room to make a booking
              </Text>
            </View>
          }
          renderItem={({ item }) => (
            <View style={styles.bookingCard}>
              <View style={styles.bookingCardTime}>
                <Text style={styles.bookingCardTimeText}>
                  {format(new Date(item.start_time), 'h:mm')}
                </Text>
                <Text style={styles.bookingCardAmPm}>
                  {format(new Date(item.start_time), 'a')}
                </Text>
              </View>
              <View style={styles.bookingCardInfo}>
                <Text style={styles.bookingCardTitle}>{item.title}</Text>
                <Text style={styles.bookingCardMeta}>
                  {item.room_name} · {format(new Date(item.start_time), 'h:mm a')} - {format(new Date(item.end_time), 'h:mm a')}
                </Text>
                {item.booked_by_name && (
                  <Text style={[styles.bookingCardMeta, { marginTop: 2 }]}>
                    Booked by {item.booked_by_name}
                  </Text>
                )}
              </View>
              <View style={[
                styles.bookingCardStatus,
                { backgroundColor: item.status === 'confirmed' ? 'rgba(34,197,94,0.12)' : 'rgba(245,158,11,0.12)' }
              ]}>
                <Text style={[
                  styles.bookingCardStatusText,
                  { color: item.status === 'confirmed' ? '#22C55E' : '#F59E0B' }
                ]}>
                  {item.status === 'confirmed' ? 'Confirmed' : 'Pending'}
                </Text>
              </View>
            </View>
          )}
        />
      )}

      {/* Room Detail Bottom Sheet */}
      <BottomSheet
        ref={detailSheetRef}
        index={-1}
        snapPoints={snapPoints}
        enablePanDownToClose
        backdropComponent={renderBackdrop}
        backgroundStyle={{ backgroundColor: '#0F172A' }}
        handleIndicatorStyle={{ backgroundColor: 'rgba(255,255,255,0.15)' }}
        onChange={(index) => { if (index === -1) setSelectedRoom(null); }}
      >
        <BottomSheetView style={{ flex: 1 }}>
          {selectedRoom && (
            <RoomDetailSheet
              room={selectedRoom}
              bookings={roomBookings}
              loadingBookings={loadingBookings}
              onBook={handleBookRoom}
            />
          )}
        </BottomSheetView>
      </BottomSheet>

      {/* Room Form (Create / Edit) Bottom Sheet */}
      <BottomSheet
        ref={formSheetRef}
        index={-1}
        snapPoints={formSnapPoints}
        enablePanDownToClose
        backdropComponent={renderBackdrop}
        backgroundStyle={{ backgroundColor: '#0F172A' }}
        handleIndicatorStyle={{ backgroundColor: 'rgba(255,255,255,0.15)' }}
      >
        <BottomSheetView style={{ flex: 1 }}>
          <RoomForm
            room={editingRoom}
            propertyId={propertyId!}
            onClose={() => formSheetRef.current?.close()}
            onSuccess={() => {
              formSheetRef.current?.close();
              fetchRooms();
            }}
          />
        </BottomSheetView>
      </BottomSheet>

      {/* Booking Form Bottom Sheet */}
      <BottomSheet
        ref={bookingSheetRef}
        index={-1}
        snapPoints={formSnapPoints}
        enablePanDownToClose
        backdropComponent={renderBackdrop}
        backgroundStyle={{ backgroundColor: '#0F172A' }}
        handleIndicatorStyle={{ backgroundColor: 'rgba(255,255,255,0.15)' }}
      >
        <BottomSheetView style={{ flex: 1 }}>
          {selectedRoom && (
            <BookingForm
              room={selectedRoom}
              propertyId={propertyId!}
              onClose={() => bookingSheetRef.current?.close()}
              onSuccess={() => {
                bookingSheetRef.current?.close();
                fetchBookings();
                fetchRoomBookings(selectedRoom.id);
              }}
            />
          )}
        </BottomSheetView>
      </BottomSheet>



    </View>
  );
}

// ---------------------------------------------------------------------------
// Styles
// ---------------------------------------------------------------------------

const styles = StyleSheet.create({
  container: { flex: 1 },
  header: {
    paddingHorizontal: 16,
    paddingBottom: 12,
  },
  headerTop: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 16,
  },
  backBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: 'rgba(255,255,255,0.08)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerTitleWrap: {
    flex: 1,
    marginLeft: 12,
  },
  headerTitleMain: {
    fontSize: 20,
    fontFamily: 'Poppins-Bold',
    color: '#FFFFFF',
    letterSpacing: -0.3,
  },
  headerSubtitleMain: {
    fontSize: 12,
    fontFamily: 'Urbanist-Medium',
    color: '#94A3B8',
    marginTop: 2,
  },
  headerAddBtnPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: 'rgba(96,165,250,0.3)',
  },
  headerAddBtnText: {
    color: '#60A5FA',
    fontSize: 12,
    fontFamily: 'Urbanist-Bold',
  },
  // Tab bar
  tabBar: {
    flexDirection: 'row',
    backgroundColor: 'rgba(30,41,59,0.6)',
    borderRadius: 12,
    padding: 4,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.08)',
  },
  tab: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 10,
    gap: 6,
    borderRadius: 10,
  },
  tabActive: {
    backgroundColor: '#1E3A5F',
  },
  tabText: {
    fontSize: 12,
    fontFamily: 'Urbanist-Bold',
    color: '#94A3B8',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  tabTextActive: {
    color: '#FFFFFF',
  },
  // Search
  searchRow: {
    paddingHorizontal: 16,
    marginTop: 12,
    marginBottom: 12,
  },
  searchWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(30,41,59,0.5)',
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 12,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.08)',
  },
  searchInput: {
    flex: 1,
    fontSize: 14,
    fontFamily: 'Urbanist-Regular',
    color: '#F1F5F9',
    marginLeft: 10,
    padding: 0,
  },
  // List & empty
  listContent: { paddingHorizontal: 16, paddingBottom: 100 },
  loadingWrap: { flex: 1, justifyContent: 'center', alignItems: 'center', paddingBottom: 100 },
  emptyWrap: { flex: 1, justifyContent: 'center', alignItems: 'center', paddingTop: 100, paddingBottom: 100 },
  emptyIconGlow: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: 'rgba(96,165,250,0.08)',
    borderWidth: 1,
    borderColor: 'rgba(96,165,250,0.2)',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 20,
  },
  emptyTitle: { fontSize: 18, fontFamily: 'Poppins-Bold', color: '#F8FAFC', marginBottom: 6 },
  emptySub: { fontSize: 14, fontFamily: 'Urbanist-Regular', color: '#64748B', textAlign: 'center', paddingHorizontal: 40 },
  // Room card
  roomCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(30,41,59,0.4)',
    borderRadius: 16,
    padding: 14,
    gap: 14,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.06)',
  },
  roomPhotoWrap: {
    width: 64,
    height: 64,
    borderRadius: 12,
    backgroundColor: 'rgba(255,255,255,0.05)',
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
    position: 'relative',
  },
  roomPhoto: { width: 64, height: 64 },
  roomStatusBadge: {
    position: 'absolute',
    bottom: 3,
    left: 3,
    right: 3,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 6,
    paddingVertical: 2,
    gap: 3,
  },
  roomStatusDot: { width: 5, height: 5, borderRadius: 2.5 },
  roomStatusText: { fontSize: 7, fontFamily: 'Urbanist-Bold', textTransform: 'uppercase' },
  roomInfo: { flex: 1, gap: 4 },
  roomNameRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  roomName: { fontSize: 15, fontFamily: 'Poppins-Bold', color: '#F8FAFC', flex: 1 },
  roomActions: { flexDirection: 'row', gap: 6 },
  roomActionBtn: {
    width: 28,
    height: 28,
    borderRadius: 8,
    backgroundColor: 'rgba(255,255,255,0.06)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  roomMeta: { flexDirection: 'row', gap: 14, marginTop: 2 },
  roomMetaItem: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  roomMetaText: { fontSize: 12, fontFamily: 'Urbanist-Regular', color: '#94A3B8' },
  amenitiesRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 5, marginTop: 6 },
  amenityChip: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
    gap: 3,
    backgroundColor: 'rgba(96,165,250,0.1)',
  },
  amenityChipText: { fontSize: 10, fontFamily: 'Urbanist-Bold', color: '#60A5FA' },
  amenityMore: { fontSize: 10, fontFamily: 'Urbanist-Regular', color: '#64748B', alignSelf: 'center' },
  // Room detail
  roomDetailPhoto: { height: 180, alignItems: 'center', justifyContent: 'center', overflow: 'hidden' },
  roomDetailPhotoImg: { width: '100%', height: '100%' },
  roomDetailStatus: {
    position: 'absolute',
    top: 12,
    right: 12,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 20,
  },
  roomDetailInfo: { padding: 16 },
  roomDetailName: { fontSize: 22, fontFamily: 'Poppins-Bold', color: '#F8FAFC', marginBottom: 6 },
  roomDetailDesc: { fontSize: 14, fontFamily: 'Urbanist-Regular', color: '#94A3B8', marginBottom: 12, lineHeight: 20 },
  roomDetailMeta: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 16 },
  metaChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.08)',
    backgroundColor: 'rgba(255,255,255,0.04)',
  },
  metaChipText: { fontSize: 13, fontFamily: 'Urbanist-Medium', color: '#F1F5F9' },
  roomDetailAmenities: { marginBottom: 16 },
  sectionTitle: { fontSize: 15, fontFamily: 'Poppins-Bold', color: '#F8FAFC', marginBottom: 10, marginTop: 8 },
  amenitiesGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  amenityItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 20,
    gap: 4,
    backgroundColor: 'rgba(96,165,250,0.1)',
  },
  amenityItemText: { fontSize: 12, fontFamily: 'Urbanist-Medium', color: '#60A5FA' },
  roomDetailBookings: { marginBottom: 16 },
  noBookings: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingVertical: 16,
    borderRadius: 12,
    backgroundColor: 'rgba(34,197,94,0.08)',
  },
  noBookingsText: { fontSize: 14, fontFamily: 'Urbanist-Bold', color: '#22C55E' },
  bookingItem: {
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.06)',
    marginBottom: 8,
    overflow: 'hidden',
    backgroundColor: 'rgba(30,41,59,0.3)',
  },
  bookingTimeBar: { width: 4, alignSelf: 'stretch' },
  bookingContent: { flex: 1, padding: 12 },
  bookingTitle: { fontSize: 14, fontFamily: 'Poppins-Bold', color: '#F8FAFC', marginBottom: 2 },
  bookingMeta: { fontSize: 12, fontFamily: 'Urbanist-Regular', color: '#94A3B8' },
  bookingStatusBadge: { paddingHorizontal: 8, paddingVertical: 4, borderRadius: 8, marginRight: 12 },
  bookingStatusText: { fontSize: 10, fontFamily: 'Urbanist-Bold', textTransform: 'uppercase' },
  bookRoomBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingVertical: 14,
    borderRadius: 12,
    marginTop: 8,
    backgroundColor: '#1E3A5F',
  },
  bookRoomBtnText: { color: '#60A5FA', fontSize: 16, fontFamily: 'Poppins-Bold' },
  // Booking card
  bookingCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(30,41,59,0.4)',
    padding: 14,
    borderRadius: 16,
    marginBottom: 12,
    gap: 14,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.06)',
  },
  bookingCardTime: {
    width: 52,
    height: 52,
    borderRadius: 12,
    backgroundColor: '#1E3A5F',
    alignItems: 'center',
    justifyContent: 'center',
  },
  bookingCardTimeText: { fontSize: 16, fontFamily: 'Poppins-Bold', color: '#60A5FA' },
  bookingCardAmPm: { fontSize: 9, fontFamily: 'Urbanist-Bold', color: '#60A5FA', textTransform: 'uppercase', opacity: 0.7 },
  bookingCardInfo: { flex: 1 },
  bookingCardTitle: { fontSize: 15, fontFamily: 'Poppins-Bold', color: '#F8FAFC', marginBottom: 3 },
  bookingCardMeta: { fontSize: 12, fontFamily: 'Urbanist-Regular', color: '#94A3B8', marginBottom: 1 },
  bookingCardStatus: { paddingHorizontal: 10, paddingVertical: 4, borderRadius: 8 },
  bookingCardStatusText: { fontSize: 10, fontFamily: 'Urbanist-Bold', textTransform: 'uppercase' },
  // Form
  formTitle: { fontSize: 20, fontFamily: 'Poppins-Bold', color: '#F8FAFC', marginBottom: 16 },
  fieldLabel: {
    fontSize: 11,
    fontFamily: 'Urbanist-Bold',
    color: '#94A3B8',
    marginBottom: 6,
    marginTop: 12,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  input: {
    borderWidth: 1,
    borderRadius: 12,
    borderColor: 'rgba(255,255,255,0.08)',
    backgroundColor: 'rgba(30,41,59,0.4)',
    paddingHorizontal: 14,
    paddingVertical: 12,
    fontSize: 15,
    fontFamily: 'Urbanist-Regular',
    color: '#F1F5F9',
  },
  textArea: { minHeight: 80, textAlignVertical: 'top', paddingTop: 12 },
  rowFields: { flexDirection: 'row', gap: 12 },
  suggestionsList: {
    borderWidth: 1,
    borderRadius: 10,
    marginTop: 4,
    overflow: 'hidden',
    borderColor: 'rgba(255,255,255,0.08)',
    backgroundColor: 'rgba(30,41,59,0.6)',
  },
  suggestionItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderBottomWidth: 0.5,
    borderBottomColor: 'rgba(255,255,255,0.06)',
  },
  suggestionText: { fontSize: 14, fontFamily: 'Urbanist-Medium', color: '#F1F5F9' },
  amenityToggle: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 20,
    borderWidth: 1,
    gap: 4,
    borderColor: 'rgba(255,255,255,0.08)',
    backgroundColor: 'rgba(30,41,59,0.3)',
  },
  amenityToggleText: { fontSize: 13, fontFamily: 'Urbanist-Medium', color: '#F1F5F9' },
  statusToggle: { flexDirection: 'row', gap: 8 },
  statusToggleBtn: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 10,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.08)',
    backgroundColor: 'rgba(30,41,59,0.3)',
  },
  statusToggleText: { fontSize: 13, fontFamily: 'Urbanist-Bold', color: '#F1F5F9' },
  formActions: { flexDirection: 'row', gap: 12, marginTop: 24 },
  cancelBtn: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 14,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.1)',
    backgroundColor: 'rgba(255,255,255,0.04)',
  },
  cancelBtnText: { fontSize: 15, fontFamily: 'Poppins-Bold', color: '#94A3B8' },
  saveBtn: {
    flex: 2,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 14,
    borderRadius: 12,
    backgroundColor: '#1E3A5F',
  },
  saveBtnText: { color: '#60A5FA', fontSize: 15, fontFamily: 'Poppins-Bold' },
  submitBtnDisabled: { opacity: 0.6 },
});
