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
import { useLocalSearchParams } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTheme } from '@/context';
import { Colors, DesignTokens } from '@/constants/Colors';
import { supabase } from '@/utils/supabase/client';
import { toast } from '@/lib/toast';
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
      style={[styles.roomCard, { backgroundColor: colors.card, borderColor: colors.border }]}
      onPress={onPress}
      activeOpacity={0.7}
    >
      {/* Photo */}
      <View style={[styles.roomPhotoWrap, { backgroundColor: colors.surface }]}>
        {room.photo_url ? (
          <Image source={{ uri: room.photo_url }} style={styles.roomPhoto} resizeMode="cover" />
        ) : (
          <DoorOpen size={32} color={colors.textTertiary} />
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
          <Text style={[styles.roomName, { color: colors.text }]} numberOfLines={1}>{room.name}</Text>
          <View style={styles.roomActions}>
            <TouchableOpacity style={styles.roomActionBtn} onPress={onEdit}>
              <Edit2 size={14} color={colors.textTertiary} />
            </TouchableOpacity>
            <TouchableOpacity style={styles.roomActionBtn} onPress={onDelete}>
              <Trash2 size={14} color={colors.error} />
            </TouchableOpacity>
          </View>
        </View>

        <View style={styles.roomMeta}>
          <View style={styles.roomMetaItem}>
            <Users size={12} color={colors.textSecondary} />
            <Text style={[styles.roomMetaText, { color: colors.textSecondary }]}>{room.capacity} seats</Text>
          </View>
          {room.location && (
            <View style={styles.roomMetaItem}>
              <MapPin size={12} color={colors.textSecondary} />
              <Text style={[styles.roomMetaText, { color: colors.textSecondary }]} numberOfLines={1}>{room.location}</Text>
            </View>
          )}
        </View>

        {/* Amenities */}
        {room.amenities && room.amenities.length > 0 && (
          <View style={styles.amenitiesRow}>
            {room.amenities.slice(0, 5).map((a) => (
              <View key={a} style={[styles.amenityChip, { backgroundColor: colors.primaryLight }]}>
                <Text style={{ marginRight: 3 }}>{AMENITY_ICONS[a]}</Text>
                <Text style={[styles.amenityChipText, { color: colors.primary }]}>{AMENITY_LABELS[a] ?? a}</Text>
              </View>
            ))}
            {room.amenities.length > 5 && (
              <Text style={[styles.amenityMore, { color: colors.textTertiary }]}>+{room.amenities.length - 5}</Text>
            )}
          </View>
        )}
      </View>

      <ChevronRight size={16} color={colors.textTertiary} style={{ alignSelf: 'center' }} />
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
      <View style={[styles.roomDetailPhoto, { backgroundColor: colors.surface }]}>
        {room.photo_url ? (
          <Image source={{ uri: room.photo_url }} style={styles.roomDetailPhotoImg} resizeMode="cover" />
        ) : (
          <DoorOpen size={56} color={colors.textTertiary} />
        )}
        <View style={[styles.roomDetailStatus, { backgroundColor: statusCfg.bg }]}>
          <View style={[styles.roomStatusDot, { backgroundColor: statusCfg.color }]} />
          <Text style={[styles.roomStatusText, { color: statusCfg.color }]}>{statusCfg.label}</Text>
        </View>
      </View>

      {/* Room Info */}
      <View style={styles.roomDetailInfo}>
        <Text style={[styles.roomDetailName, { color: colors.text }]}>{room.name}</Text>
        {room.description && (
          <Text style={[styles.roomDetailDesc, { color: colors.textSecondary }]}>{room.description}</Text>
        )}

        <View style={styles.roomDetailMeta}>
          <View style={[styles.metaChip, { backgroundColor: colors.card, borderColor: colors.border }]}>
            <Users size={14} color={colors.primary} />
            <Text style={[styles.metaChipText, { color: colors.text }]}>{room.capacity} seats</Text>
          </View>
          {room.location && (
            <View style={[styles.metaChip, { backgroundColor: colors.card, borderColor: colors.border }]}>
              <MapPin size={14} color={colors.primary} />
              <Text style={[styles.metaChipText, { color: colors.text }]}>{room.location}</Text>
            </View>
          )}
          {room.size && (
            <View style={[styles.metaChip, { backgroundColor: colors.card, borderColor: colors.border }]}>
              <DoorOpen size={14} color={colors.primary} />
              <Text style={[styles.metaChipText, { color: colors.text }]}>{room.size} sqft</Text>
            </View>
          )}
        </View>

        {/* Amenities */}
        {room.amenities && room.amenities.length > 0 && (
          <View style={styles.roomDetailAmenities}>
            <Text style={[styles.sectionTitle, { color: colors.text }]}>Amenities</Text>
            <View style={styles.amenitiesGrid}>
              {room.amenities.map((a) => (
                <View key={a} style={[styles.amenityItem, { backgroundColor: colors.primaryLight }]}>
                  <Text style={{ marginRight: 4 }}>{AMENITY_ICONS[a]}</Text>
                  <Text style={[styles.amenityItemText, { color: colors.primary }]}>{AMENITY_LABELS[a] ?? a}</Text>
                </View>
              ))}
            </View>
          </View>
        )}

        {/* Today's Bookings */}
        <View style={styles.roomDetailBookings}>
          <Text style={[styles.sectionTitle, { color: colors.text }]}>Today's Schedule</Text>
          {loadingBookings ? (
            <ActivityIndicator size="small" color={colors.primary} style={{ marginVertical: 12 }} />
          ) : bookings.length === 0 ? (
            <View style={[styles.noBookings, { backgroundColor: colors.successBg }]}>
              <Clock size={16} color={colors.success} />
              <Text style={[styles.noBookingsText, { color: colors.success }]}>Available all day</Text>
            </View>
          ) : (
            bookings.map((b) => (
              <View key={b.id} style={[styles.bookingItem, { backgroundColor: colors.card, borderColor: colors.border }]}>
                <View style={[styles.bookingTimeBar, { backgroundColor: colors.primary }]} />
                <View style={styles.bookingContent}>
                  <Text style={[styles.bookingTitle, { color: colors.text }]}>{b.title}</Text>
                  <Text style={[styles.bookingMeta, { color: colors.textSecondary }]}>
                    {format(new Date(b.start_time), 'h:mm a')} - {format(new Date(b.end_time), 'h:mm a')}
                    {b.booked_by_name ? ` · ${b.booked_by_name}` : ''}
                  </Text>
                </View>
                <View style={[
                  styles.bookingStatusBadge,
                  { backgroundColor: b.status === 'confirmed' ? colors.successBg : colors.warningBg }
                ]}>
                  <Text style={[
                    styles.bookingStatusText,
                    { color: b.status === 'confirmed' ? colors.success : colors.warning }
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
          style={[styles.bookRoomBtn, { backgroundColor: colors.primary }]}
          onPress={onBook}
          activeOpacity={0.8}
        >
          <Calendar size={18} color="#fff" />
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
        <Text style={[styles.formTitle, { color: colors.text }]}>{room?.id ? 'Edit Room' : 'Add New Room'}</Text>

        <Text style={[styles.fieldLabel, { color: colors.textSecondary }]}>Room Name *</Text>
        <TextInput
          style={[styles.input, { backgroundColor: colors.card, borderColor: colors.border, color: colors.text }]}
          placeholder="e.g. Conference Room A"
          placeholderTextColor={colors.textTertiary}
          value={name}
          onChangeText={setName}
        />

        <Text style={[styles.fieldLabel, { color: colors.textSecondary }]}>Location / Floor</Text>
        <TextInput
          style={[styles.input, { backgroundColor: colors.card, borderColor: colors.border, color: colors.text }]}
          placeholder="e.g. 2nd Floor, Building B"
          placeholderTextColor={colors.textTertiary}
          value={location}
          onChangeText={setLocation}
        />

        <View style={styles.rowFields}>
          <View style={{ flex: 1 }}>
            <Text style={[styles.fieldLabel, { color: colors.textSecondary }]}>Capacity *</Text>
            <TextInput
              style={[styles.input, { backgroundColor: colors.card, borderColor: colors.border, color: colors.text }]}
              placeholder="Seats"
              placeholderTextColor={colors.textTertiary}
              value={capacity}
              onChangeText={setCapacity}
              keyboardType="number-pad"
            />
          </View>
          <View style={{ flex: 1 }}>
            <Text style={[styles.fieldLabel, { color: colors.textSecondary }]}>Size (sqft)</Text>
            <TextInput
              style={[styles.input, { backgroundColor: colors.card, borderColor: colors.border, color: colors.text }]}
              placeholder="Square feet"
              placeholderTextColor={colors.textTertiary}
              value={size}
              onChangeText={setSize}
              keyboardType="number-pad"
            />
          </View>
        </View>

        <Text style={[styles.fieldLabel, { color: colors.textSecondary }]}>Description</Text>
        <TextInput
          style={[styles.input, styles.textArea, { backgroundColor: colors.card, borderColor: colors.border, color: colors.text }]}
          placeholder="Brief description of the room"
          placeholderTextColor={colors.textTertiary}
          value={description}
          onChangeText={setDescription}
          multiline
          numberOfLines={3}
        />

        <Text style={[styles.fieldLabel, { color: colors.textSecondary }]}>Amenities</Text>
        <View style={styles.amenitiesGrid}>
          {ALL_AMENITIES.map((a) => (
            <TouchableOpacity
              key={a}
              style={[
                styles.amenityToggle,
                { backgroundColor: amenities.includes(a) ? colors.primary : colors.card, borderColor: amenities.includes(a) ? colors.primary : colors.border },
              ]}
              onPress={() => toggleAmenity(a)}
            >
              <Text style={{ marginRight: 4 }}>{AMENITY_ICONS[a]}</Text>
              <Text style={[styles.amenityToggleText, { color: amenities.includes(a) ? '#fff' : colors.textSecondary }]}>
                {AMENITY_LABELS[a]}
              </Text>
              {amenities.includes(a) && <Check size={12} color="#fff" style={{ marginLeft: 4 }} />}
            </TouchableOpacity>
          ))}
        </View>

        <Text style={[styles.fieldLabel, { color: colors.textSecondary }]}>Status</Text>
        <View style={styles.statusToggle}>
          {['available', 'maintenance'].map((s) => (
            <TouchableOpacity
              key={s}
              style={[
                styles.statusToggleBtn,
                { backgroundColor: status === s ? colors.primary : colors.card, borderColor: status === s ? colors.primary : colors.border },
              ]}
              onPress={() => setStatus(s)}
            >
              <Text style={[styles.statusToggleText, { color: status === s ? '#fff' : colors.textSecondary }]}>
                {s.charAt(0).toUpperCase() + s.slice(1)}
              </Text>
            </TouchableOpacity>
          ))}
        </View>

        <View style={styles.formActions}>
          <TouchableOpacity
            style={[styles.cancelBtn, { borderColor: colors.border }]}
            onPress={onClose}
          >
            <Text style={[styles.cancelBtnText, { color: colors.textSecondary }]}>Cancel</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.saveBtn, { backgroundColor: colors.primary }, loading && styles.submitBtnDisabled]}
            onPress={handleSave}
            disabled={loading}
            activeOpacity={0.8}
          >
            {loading ? <ActivityIndicator color="#fff" size="small" /> : <Text style={styles.saveBtnText}>Save Room</Text>}
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
        <Text style={[styles.formTitle, { color: colors.text }]}>Book {room.name}</Text>

        <Text style={[styles.fieldLabel, { color: colors.textSecondary }]}>Meeting Title *</Text>
        <TextInput
          style={[styles.input, { backgroundColor: colors.card, borderColor: colors.border, color: colors.text }]}
          placeholder="e.g. Team Standup"
          placeholderTextColor={colors.textTertiary}
          value={title}
          onChangeText={setTitle}
        />

        <Text style={[styles.fieldLabel, { color: colors.textSecondary }]}>Booked By *</Text>
        <TextInput
          style={[styles.input, { backgroundColor: colors.card, borderColor: colors.border, color: colors.text }]}
          placeholder="Your name"
          placeholderTextColor={colors.textTertiary}
          value={bookedBy}
          onChangeText={setBookedBy}
        />
        {suggestions.length > 0 && (
          <View style={[styles.suggestionsList, { backgroundColor: colors.card, borderColor: colors.border }]}>
            {suggestions.map((s) => (
              <TouchableOpacity
                key={s.id}
                style={styles.suggestionItem}
                onPress={() => { setBookedBy(s.full_name || s.name || ''); setSuggestions([]); }}
              >
                <User size={14} color={colors.textSecondary} />
                <Text style={[styles.suggestionText, { color: colors.text }]}>{s.full_name || s.name}</Text>
              </TouchableOpacity>
            ))}
          </View>
        )}

        <Text style={[styles.fieldLabel, { color: colors.textSecondary }]}>Attendees</Text>
        <TextInput
          style={[styles.input, { backgroundColor: colors.card, borderColor: colors.border, color: colors.text }]}
          placeholder="Number of attendees"
          placeholderTextColor={colors.textTertiary}
          value={attendees}
          onChangeText={setAttendees}
          keyboardType="number-pad"
        />

        <Text style={[styles.fieldLabel, { color: colors.textSecondary }]}>Date</Text>
        <TextInput
          style={[styles.input, { backgroundColor: colors.card, borderColor: colors.border, color: colors.text }]}
          placeholder="YYYY-MM-DD"
          placeholderTextColor={colors.textTertiary}
          value={date}
          onChangeText={setDate}
        />

        <View style={styles.rowFields}>
          <View style={{ flex: 1 }}>
            <Text style={[styles.fieldLabel, { color: colors.textSecondary }]}>Start Time</Text>
            <TextInput
              style={[styles.input, { backgroundColor: colors.card, borderColor: colors.border, color: colors.text }]}
              placeholder="HH:MM"
              placeholderTextColor={colors.textTertiary}
              value={startTime}
              onChangeText={setStartTime}
            />
          </View>
          <View style={{ flex: 1 }}>
            <Text style={[styles.fieldLabel, { color: colors.textSecondary }]}>End Time</Text>
            <TextInput
              style={[styles.input, { backgroundColor: colors.card, borderColor: colors.border, color: colors.text }]}
              placeholder="HH:MM"
              placeholderTextColor={colors.textTertiary}
              value={endTime}
              onChangeText={setEndTime}
            />
          </View>
        </View>

        <View style={styles.formActions}>
          <TouchableOpacity style={[styles.cancelBtn, { borderColor: colors.border }]} onPress={onClose}>
            <Text style={[styles.cancelBtnText, { color: colors.textSecondary }]}>Cancel</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.saveBtn, { backgroundColor: colors.primary }, loading && styles.submitBtnDisabled]}
            onPress={handleBook}
            disabled={loading}
            activeOpacity={0.8}
          >
            {loading ? <ActivityIndicator color="#fff" size="small" /> : <Text style={styles.saveBtnText}>Confirm Booking</Text>}
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
  const { theme } = useTheme();
  const colors = Colors[theme];
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
    <View style={[styles.container, { backgroundColor: colors.background, paddingTop: insets.top, paddingBottom: insets.bottom }]}>
      {/* Header */}
      <View style={styles.header}>
        <View>
          <Text style={[styles.headerTitle, { color: colors.text }]}>Meeting Rooms</Text>
          <Text style={[styles.headerSub, { color: colors.textSecondary }]}>
            Manage conference facilities
          </Text>
        </View>
        {activeTab === 'rooms' && (
          <TouchableOpacity
            style={[styles.addBtn, { backgroundColor: colors.primary }]}
            onPress={handleAddRoom}
            activeOpacity={0.8}
          >
            <Plus size={18} color="#fff" />
            <Text style={styles.addBtnText}>Add Room</Text>
          </TouchableOpacity>
        )}
      </View>

      {/* Tabs */}
      <View style={[styles.tabBar, { borderColor: colors.border }]}>
        <TouchableOpacity
          style={[styles.tab, activeTab === 'rooms' && { backgroundColor: colors.primary }]}
          onPress={() => setActiveTab('rooms')}
          activeOpacity={0.7}
        >
          <LayoutGrid size={14} color={activeTab === 'rooms' ? '#fff' : colors.textSecondary} />
          <Text style={[styles.tabText, { color: activeTab === 'rooms' ? '#fff' : colors.textSecondary }]}>Rooms</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.tab, activeTab === 'bookings' && { backgroundColor: colors.primary }]}
          onPress={() => setActiveTab('bookings')}
          activeOpacity={0.7}
        >
          <Calendar size={14} color={activeTab === 'bookings' ? '#fff' : colors.textSecondary} />
          <Text style={[styles.tabText, { color: activeTab === 'bookings' ? '#fff' : colors.textSecondary }]}>
            Today's Bookings
          </Text>
        </TouchableOpacity>
      </View>

      {activeTab === 'rooms' ? (
        <>
          {/* Search */}
          <View style={styles.searchRow}>
            <View style={[styles.searchWrap, { backgroundColor: colors.card, borderColor: colors.border }]}>
              <Search size={16} color={colors.textTertiary} style={{ marginRight: 8 }} />
              <TextInput
                style={[styles.searchInput, { color: colors.text }]}
                placeholder="Search by name or location..."
                placeholderTextColor={colors.textTertiary}
                value={searchQuery}
                onChangeText={setSearchQuery}
              />
            </View>
          </View>

          {/* Room List */}
          {isLoading ? (
            <View style={styles.loadingWrap}>
              <ActivityIndicator size="large" color={colors.primary} />
            </View>
          ) : filteredRooms.length === 0 ? (
            <View style={styles.emptyWrap}>
              <View style={[styles.emptyIcon, { backgroundColor: colors.primaryLight }]}>
                <DoorOpen size={32} color={colors.primary} />
              </View>
              <Text style={[styles.emptyTitle, { color: colors.text }]}>No rooms found</Text>
              <Text style={[styles.emptySub, { color: colors.textSecondary }]}>
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
              ItemSeparatorComponent={() => <View style={{ height: 10 }} />}
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
              <View style={[styles.emptyIcon, { backgroundColor: colors.primaryLight }]}>
                <Calendar size={32} color={colors.primary} />
              </View>
              <Text style={[styles.emptyTitle, { color: colors.text }]}>No bookings today</Text>
              <Text style={[styles.emptySub, { color: colors.textSecondary }]}>
                Select a room to make a booking
              </Text>
            </View>
          }
          renderItem={({ item }) => (
            <View style={[styles.bookingCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
              <View style={[styles.bookingCardTime, { backgroundColor: colors.primary }]}>
                <Text style={styles.bookingCardTimeText}>
                  {format(new Date(item.start_time), 'h:mm')}
                </Text>
                <Text style={styles.bookingCardAmPm}>
                  {format(new Date(item.start_time), 'a')}
                </Text>
              </View>
              <View style={styles.bookingCardInfo}>
                <Text style={[styles.bookingCardTitle, { color: colors.text }]}>{item.title}</Text>
                <Text style={[styles.bookingCardMeta, { color: colors.textSecondary }]}>
                  {item.room_name} · {format(new Date(item.start_time), 'h:mm a')} - {format(new Date(item.end_time), 'h:mm a')}
                </Text>
                {item.booked_by_name && (
                  <Text style={[styles.bookingCardMeta, { color: colors.textTertiary }]}>
                    Booked by {item.booked_by_name}
                  </Text>
                )}
              </View>
              <View style={[
                styles.bookingCardStatus,
                { backgroundColor: item.status === 'confirmed' ? colors.successBg : colors.warningBg }
              ]}>
                <Text style={[
                  styles.bookingCardStatusText,
                  { color: item.status === 'confirmed' ? colors.success : colors.warning }
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
        backgroundStyle={{ backgroundColor: colors.card }}
        handleIndicatorStyle={{ backgroundColor: colors.border }}
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
        backgroundStyle={{ backgroundColor: colors.card }}
        handleIndicatorStyle={{ backgroundColor: colors.border }}
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
        backgroundStyle={{ backgroundColor: colors.card }}
        handleIndicatorStyle={{ backgroundColor: colors.border }}
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
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingTop: 8,
    paddingBottom: 12,
  },
  headerTitle: { fontSize: 22, fontFamily: 'Poppins-Bold' },
  headerSub: { fontSize: 12, fontFamily: 'Urbanist-Regular', marginTop: 2 },
  addBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 14,
    paddingVertical: 9,
    borderRadius: 20,
    gap: 4,
  },
  addBtnText: { color: '#fff', fontSize: 13, fontFamily: 'Urbanist-Bold' },
  tabBar: { flexDirection: 'row', marginHorizontal: 12, borderWidth: 1, borderRadius: 12, overflow: 'hidden', marginBottom: 12 },
  tab: { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', paddingVertical: 10, gap: 6 },
  tabText: { fontSize: 12, fontFamily: 'Urbanist-Bold', textTransform: 'uppercase', letterSpacing: 0.5 },
  searchRow: { paddingHorizontal: 12, marginBottom: 12 },
  searchWrap: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 12, paddingVertical: 10, borderRadius: 12, borderWidth: 1 },
  searchInput: { flex: 1, fontSize: 14, fontFamily: 'Urbanist-Regular', padding: 0 },
  listContent: { paddingHorizontal: 12, paddingBottom: 100 },
  loadingWrap: { flex: 1, justifyContent: 'center', alignItems: 'center', paddingBottom: 100 },
  emptyWrap: { flex: 1, justifyContent: 'center', alignItems: 'center', paddingTop: 80, paddingBottom: 100 },
  emptyIcon: { width: 72, height: 72, borderRadius: 36, alignItems: 'center', justifyContent: 'center', marginBottom: 16 },
  emptyTitle: { fontSize: 18, fontFamily: 'Poppins-Bold', marginBottom: 6 },
  emptySub: { fontSize: 14, fontFamily: 'Urbanist-Regular', textAlign: 'center', paddingHorizontal: 40 },
  // Room card
  roomCard: { flexDirection: 'row', alignItems: 'center', padding: 12, borderRadius: 14, borderWidth: 1, gap: 12 },
  roomPhotoWrap: { width: 72, height: 72, borderRadius: 12, alignItems: 'center', justifyContent: 'center', overflow: 'hidden', position: 'relative' },
  roomPhoto: { width: 72, height: 72 },
  roomStatusBadge: { position: 'absolute', bottom: 4, left: 4, right: 4, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', borderRadius: 6, paddingVertical: 2, gap: 3 },
  roomStatusDot: { width: 6, height: 6, borderRadius: 3 },
  roomStatusText: { fontSize: 8, fontFamily: 'Urbanist-Bold', textTransform: 'uppercase' },
  roomInfo: { flex: 1, gap: 4 },
  roomNameRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  roomName: { fontSize: 15, fontFamily: 'Poppins-Bold', flex: 1 },
  roomActions: { flexDirection: 'row', gap: 4 },
  roomActionBtn: { width: 26, height: 26, borderRadius: 6, alignItems: 'center', justifyContent: 'center' },
  roomMeta: { flexDirection: 'row', gap: 12 },
  roomMetaItem: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  roomMetaText: { fontSize: 11, fontFamily: 'Urbanist-Regular' },
  amenitiesRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 4, marginTop: 4 },
  amenityChip: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 7, paddingVertical: 3, borderRadius: 8, gap: 2 },
  amenityChipText: { fontSize: 9, fontFamily: 'Urbanist-Bold' },
  amenityMore: { fontSize: 9, fontFamily: 'Urbanist-Regular', alignSelf: 'center' },
  // Room detail
  roomDetailPhoto: { height: 180, alignItems: 'center', justifyContent: 'center', overflow: 'hidden' },
  roomDetailPhotoImg: { width: '100%', height: '100%' },
  roomDetailStatus: { position: 'absolute', top: 12, right: 12, flexDirection: 'row', alignItems: 'center', gap: 4, paddingHorizontal: 10, paddingVertical: 5, borderRadius: 20 },
  roomDetailInfo: { padding: 16 },
  roomDetailName: { fontSize: 22, fontFamily: 'Poppins-Bold', marginBottom: 6 },
  roomDetailDesc: { fontSize: 14, fontFamily: 'Urbanist-Regular', marginBottom: 12, lineHeight: 20 },
  roomDetailMeta: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 16 },
  metaChip: { flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: 12, paddingVertical: 7, borderRadius: 20, borderWidth: 1 },
  metaChipText: { fontSize: 13, fontFamily: 'Urbanist-Medium' },
  roomDetailAmenities: { marginBottom: 16 },
  sectionTitle: { fontSize: 15, fontFamily: 'Poppins-Bold', marginBottom: 10, marginTop: 8 },
  amenitiesGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  amenityItem: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 10, paddingVertical: 6, borderRadius: 20, gap: 4 },
  amenityItemText: { fontSize: 12, fontFamily: 'Urbanist-Medium' },
  roomDetailBookings: { marginBottom: 16 },
  noBookings: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, paddingVertical: 16, borderRadius: 12 },
  noBookingsText: { fontSize: 14, fontFamily: 'Urbanist-Bold' },
  bookingItem: { flexDirection: 'row', alignItems: 'center', borderRadius: 12, borderWidth: 1, marginBottom: 8, overflow: 'hidden' },
  bookingTimeBar: { width: 4, alignSelf: 'stretch' },
  bookingContent: { flex: 1, padding: 12 },
  bookingTitle: { fontSize: 14, fontFamily: 'Poppins-Bold', marginBottom: 2 },
  bookingMeta: { fontSize: 12, fontFamily: 'Urbanist-Regular' },
  bookingStatusBadge: { paddingHorizontal: 8, paddingVertical: 4, borderRadius: 8, marginRight: 12 },
  bookingStatusText: { fontSize: 10, fontFamily: 'Urbanist-Bold', textTransform: 'uppercase' },
  bookRoomBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, paddingVertical: 14, borderRadius: 12, marginTop: 8 },
  bookRoomBtnText: { color: '#fff', fontSize: 16, fontFamily: 'Poppins-Bold' },
  // Booking card
  bookingCard: { flexDirection: 'row', alignItems: 'center', padding: 12, borderRadius: 14, borderWidth: 1, marginBottom: 10, gap: 12 },
  bookingCardTime: { width: 52, height: 52, borderRadius: 12, alignItems: 'center', justifyContent: 'center' },
  bookingCardTimeText: { fontSize: 18, fontFamily: 'Poppins-Bold', color: '#fff' },
  bookingCardAmPm: { fontSize: 10, fontFamily: 'Urbanist-Bold', color: 'rgba(255,255,255,0.7)', textTransform: 'uppercase' },
  bookingCardInfo: { flex: 1 },
  bookingCardTitle: { fontSize: 15, fontFamily: 'Poppins-Bold', marginBottom: 4 },
  bookingCardMeta: { fontSize: 12, fontFamily: 'Urbanist-Regular', marginBottom: 2 },
  bookingCardStatus: { paddingHorizontal: 8, paddingVertical: 4, borderRadius: 8 },
  bookingCardStatusText: { fontSize: 10, fontFamily: 'Urbanist-Bold', textTransform: 'uppercase' },
  // Form
  formTitle: { fontSize: 20, fontFamily: 'Poppins-Bold', marginBottom: 16 },
  fieldLabel: { fontSize: 12, fontFamily: 'Urbanist-Bold', marginBottom: 6, marginTop: 12, textTransform: 'uppercase', letterSpacing: 0.5 },
  input: { borderWidth: 1, borderRadius: 12, paddingHorizontal: 14, paddingVertical: 12, fontSize: 15, fontFamily: 'Urbanist-Regular' },
  textArea: { minHeight: 80, textAlignVertical: 'top', paddingTop: 12 },
  rowFields: { flexDirection: 'row', gap: 12 },
  suggestionsList: { borderWidth: 1, borderRadius: 10, marginTop: 4, overflow: 'hidden' },
  suggestionItem: { flexDirection: 'row', alignItems: 'center', gap: 8, paddingHorizontal: 12, paddingVertical: 10, borderBottomWidth: 0.5, borderBottomColor: 'rgba(0,0,0,0.06)' },
  suggestionText: { fontSize: 14, fontFamily: 'Urbanist-Medium' },
  amenityToggle: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 12, paddingVertical: 8, borderRadius: 20, borderWidth: 1, gap: 4 },
  amenityToggleText: { fontSize: 13, fontFamily: 'Urbanist-Medium' },
  statusToggle: { flexDirection: 'row', gap: 8 },
  statusToggleBtn: { flex: 1, alignItems: 'center', justifyContent: 'center', paddingVertical: 10, borderRadius: 12, borderWidth: 1 },
  statusToggleText: { fontSize: 13, fontFamily: 'Urbanist-Bold' },
  formActions: { flexDirection: 'row', gap: 12, marginTop: 24 },
  cancelBtn: { flex: 1, alignItems: 'center', justifyContent: 'center', paddingVertical: 14, borderRadius: 12, borderWidth: 1, borderColor: Colors.light.border },
  cancelBtnText: { fontSize: 15, fontFamily: 'Poppins-Bold' },
  saveBtn: { flex: 2, alignItems: 'center', justifyContent: 'center', paddingVertical: 14, borderRadius: 12 },
  saveBtnText: { color: '#fff', fontSize: 15, fontFamily: 'Poppins-Bold' },
  submitBtnDisabled: { opacity: 0.6 },
});
