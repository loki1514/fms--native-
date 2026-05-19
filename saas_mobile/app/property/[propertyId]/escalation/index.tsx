import React, { useState, useEffect, useCallback, useMemo } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  TextInput,
  Modal,
  Alert,
  ActivityIndicator,
  RefreshControl,
  ScrollView,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTheme } from '@/context';
import { useAuth } from '@/hooks/useAuth';
import { Colors } from '@/constants/Colors';
import { supabase } from '@/utils/supabase/client';
import {
  ArrowUpCircle,
  Plus,
  ChevronRight,
  X,
  ArrowUp,
  Clock,
  Users,
  Save,
  Trash2,
  AlertCircle,
  ArrowLeft,
} from 'lucide-react-native';

// ─── Types ────────────────────────────────────────────────────────────────────

interface EscalationLevel {
  id: string;
  level: number;
  role?: string;
  user_id?: string;
  response_time_minutes: number;
  user_name?: string;
}

interface EscalationHierarchy {
  id: string;
  name: string;
  description?: string;
  property_id: string;
  levels: EscalationLevel[];
  created_at: string;
}

interface UserOption {
  id: string;
  full_name: string;
  email: string;
  role?: string;
}

// ─── Utility ───────────────────────────────────────────────────────────────────

function formatResponseTime(minutes: number): string {
  if (minutes < 60) return `${minutes} min`;
  const hours = Math.floor(minutes / 60);
  const mins = minutes % 60;
  if (mins === 0) return `${hours}h`;
  return `${hours}h ${mins}m`;
}

// ─── Main Screen ───────────────────────────────────────────────────────────────

export default function EscalationScreen() {
  const { propertyId } = useLocalSearchParams<{ propertyId: string }>();
  const router = useRouter();
  const { theme } = useTheme();
  const { membership, user } = useAuth();
  const colors = Colors[theme];
  const insets = useSafeAreaInsets();

  // ── State ────────────────────────────────────────────────────────────────────
  const [hierarchies, setHierarchies] = useState<EscalationHierarchy[]>([]);
  const [users, setUsers] = useState<UserOption[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  const [selectedHierarchy, setSelectedHierarchy] = useState<EscalationHierarchy | null>(null);
  const [isSaving, setIsSaving] = useState(false);

  // Form state
  const [formName, setFormName] = useState('');
  const [formDescription, setFormDescription] = useState('');
  const [formLevels, setFormLevels] = useState<{
    role: string;
    user_id: string;
    user_name: string;
    response_time_minutes: number;
  }[]>([
    { role: '', user_id: '', user_name: '', response_time_minutes: 30 },
  ]);

  // ── Computed ────────────────────────────────────────────────────────────────
  const isAdmin = useMemo(() => {
    if (!membership || !propertyId) return false;
    const prop = membership.properties.find((p) => p.id === propertyId);
    return prop ? ['property_admin', 'org_admin', 'org_super_admin', 'master_admin'].includes(prop.role.toLowerCase()) : false;
  }, [membership, propertyId]);

  const ROLE_OPTIONS = [
    { label: 'Staff', value: 'staff' },
    { label: 'Property Manager', value: 'property_manager' },
    { label: 'Admin', value: 'property_admin' },
    { label: 'Org Admin', value: 'org_admin' },
    { label: 'Super Admin', value: 'master_admin' },
    { label: 'Vendor', value: 'vendor' },
    { label: 'Custom', value: 'custom' },
  ];

  // ── Fetch ───────────────────────────────────────────────────────────────────
  const fetchHierarchies = useCallback(async () => {
    if (!propertyId) return;
    try {
      const { data, error } = await supabase
        .from('escalation_hierarchies')
        .select(`
          *,
          levels:escalation_levels(*)
        `)
        .eq('property_id', propertyId)
        .order('created_at', { ascending: false });
      if (error) throw error;
      setHierarchies((data || []) as EscalationHierarchy[]);
    } catch (err) {
      console.error('Error fetching hierarchies:', err);
    }
  }, [propertyId]);

  const fetchUsers = useCallback(async () => {
    if (!propertyId) return;
    try {
      // Fetch property members
      const { data, error } = await supabase
        .from('property_memberships')
        .select(`
          user_id,
          users:user_id(full_name, email, role)
        `)
        .eq('property_id', propertyId)
        .eq('is_active', true);
      if (error) throw error;

      const userList: UserOption[] = (data || [])
        .map((m: any) => ({
          id: m.user_id,
          full_name: m.users?.full_name || 'Unknown',
          email: m.users?.email || '',
          role: m.users?.role || '',
        }))
        .filter((u: UserOption) => u.id);
      setUsers(userList);
    } catch (err) {
      console.error('Error fetching users:', err);
    }
  }, [propertyId]);

  const fetchAll = useCallback(async (refresh = false) => {
    if (refresh) setIsRefreshing(true);
    else setIsLoading(true);
    try {
      await Promise.all([fetchHierarchies(), fetchUsers()]);
    } finally {
      setIsLoading(false);
      setIsRefreshing(false);
    }
  }, [fetchHierarchies, fetchUsers]);

  useEffect(() => {
    if (propertyId) fetchAll();
  }, [propertyId, fetchAll]);

  // ── Handlers ────────────────────────────────────────────────────────────────
  const handleRefresh = () => fetchAll(true);

  const handleHierarchyPress = (hierarchy: EscalationHierarchy) => {
    setSelectedHierarchy(hierarchy);
    setFormName(hierarchy.name);
    setFormDescription(hierarchy.description || '');
    setFormLevels(
      hierarchy.levels.map((l) => ({
        role: l.role || '',
        user_id: l.user_id || '',
        user_name: l.user_name || '',
        response_time_minutes: l.response_time_minutes,
      }))
    );
    setShowEditModal(true);
  };

  const handleCreateHierarchy = async () => {
    if (!formName.trim() || !propertyId) {
      Alert.alert('Error', 'Hierarchy name is required');
      return;
    }
    if (formLevels.length === 0 || !formLevels.some((l) => l.role || l.user_id)) {
      Alert.alert('Error', 'Add at least one escalation level');
      return;
    }
    setIsSaving(true);
    try {
      const { data: hData, error: hError } = await (supabase.from('escalation_hierarchies') as any)
        .insert({ property_id: propertyId, name: formName.trim(), description: formDescription.trim() || null })
        .select()
        .single();
      if (hError) throw hError;

      // Insert levels
      const levelsToInsert = formLevels
        .filter((l) => l.role || l.user_id)
        .map((l, idx) => ({
          hierarchy_id: (hData as any).id,
          level: idx + 1,
          role: l.role || null,
          user_id: l.user_id || null,
          user_name: l.user_name || null,
          response_time_minutes: l.response_time_minutes,
        }));
      if (levelsToInsert.length > 0) {
        const { error: lError } = await (supabase.from('escalation_levels') as any).insert(levelsToInsert);
        if (lError) throw lError;
      }

      setShowCreateModal(false);
      resetForm();
      await fetchHierarchies();
      Alert.alert('Success', 'Escalation hierarchy created');
    } catch (err: any) {
      Alert.alert('Error', err.message || 'Failed to create hierarchy');
    } finally {
      setIsSaving(false);
    }
  };

  const handleUpdateHierarchy = async () => {
    if (!selectedHierarchy || !formName.trim()) {
      Alert.alert('Error', 'Hierarchy name is required');
      return;
    }
    setIsSaving(true);
    try {
      const { error: hError } = await (supabase.from('escalation_hierarchies') as any)
        .update({ name: formName.trim(), description: formDescription.trim() || null })
        .eq('id', selectedHierarchy.id);
      if (hError) throw hError;

      // Delete existing levels and re-insert
      await (supabase.from('escalation_levels') as any).delete().eq('hierarchy_id', selectedHierarchy.id);

      const levelsToInsert = formLevels
        .filter((l) => l.role || l.user_id)
        .map((l, idx) => ({
          hierarchy_id: selectedHierarchy.id,
          level: idx + 1,
          role: l.role || null,
          user_id: l.user_id || null,
          user_name: l.user_name || null,
          response_time_minutes: l.response_time_minutes,
        }));
      if (levelsToInsert.length > 0) {
        const { error: lError } = await (supabase.from('escalation_levels') as any).insert(levelsToInsert);
        if (lError) throw lError;
      }

      setShowEditModal(false);
      resetForm();
      setSelectedHierarchy(null);
      await fetchHierarchies();
      Alert.alert('Success', 'Escalation hierarchy updated');
    } catch (err: any) {
      Alert.alert('Error', err.message || 'Failed to update hierarchy');
    } finally {
      setIsSaving(false);
    }
  };

  const handleDeleteHierarchy = async (hierarchy: EscalationHierarchy) => {
    Alert.alert('Delete Hierarchy', `Are you sure you want to delete "${hierarchy.name}"?`, [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete',
        style: 'destructive',
        onPress: async () => {
          try {
            await supabase.from('escalation_levels').delete().eq('hierarchy_id', hierarchy.id);
            const { error } = await supabase.from('escalation_hierarchies').delete().eq('id', hierarchy.id);
            if (error) throw error;
            setHierarchies((prev) => prev.filter((h) => h.id !== hierarchy.id));
            Alert.alert('Deleted', 'Hierarchy removed');
          } catch (err: any) {
            Alert.alert('Error', err.message || 'Failed to delete');
          }
        },
      },
    ]);
  };

  const resetForm = () => {
    setFormName('');
    setFormDescription('');
    setFormLevels([{ role: '', user_id: '', user_name: '', response_time_minutes: 30 }]);
  };

  const addLevel = () => {
    if (formLevels.length >= 5) {
      Alert.alert('Limit reached', 'Maximum 5 escalation levels allowed');
      return;
    }
    setFormLevels((prev) => [...prev, { role: '', user_id: '', user_name: '', response_time_minutes: 60 }]);
  };

  const removeLevel = (index: number) => {
    if (formLevels.length <= 1) {
      Alert.alert('Cannot remove', 'At least one level is required');
      return;
    }
    setFormLevels((prev) => prev.filter((_, i) => i !== index));
  };

  const updateLevel = (index: number, field: string, value: any) => {
    setFormLevels((prev) => prev.map((l, i) => i === index ? { ...l, [field]: value } : l));
  };

  const selectUserForLevel = (index: number) => {
    const options = users.map((u) => ({ text: u.full_name, onPress: () => updateLevel(index, 'user_id', u.id) }));
    if (options.length === 0) {
      Alert.alert('No users', 'No property members found');
      return;
    }
    Alert.alert('Select User', 'Choose a user for this level', [
      ...options.slice(0, 5),
      { text: 'Cancel', style: 'cancel' },
    ]);
  };

  // ─── Render ─────────────────────────────────────────────────────────────────
  const bgColor = theme === 'light' ? '#FBF8F4' : colors.background;

  if (isLoading && hierarchies.length === 0) {
    return (
      <View style={[styles.container, { backgroundColor: bgColor, paddingTop: insets.top, paddingBottom: insets.bottom }]}>
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={colors.primary} />
          <Text style={[styles.loadingText, { color: colors.textSecondary }]}>Loading escalation matrix...</Text>
        </View>
      </View>
    );
  }

  const renderHierarchyForm = (isEdit: boolean) => {
    const totalResponseTime = formLevels.reduce((sum, l) => sum + (l.response_time_minutes || 0), 0);

    return (
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} style={{ flex: 1 }}>
        <ScrollView style={styles.formScroll} showsVerticalScrollIndicator={false}>
          <Text style={[styles.inputLabel, { color: colors.textSecondary }]}>Hierarchy Name *</Text>
          <TextInput
            style={[styles.input, { backgroundColor: colors.surface, borderColor: colors.border, color: colors.text }]}
            placeholder="e.g. Ticket Escalation"
            placeholderTextColor={colors.textTertiary}
            value={formName}
            onChangeText={setFormName}
          />
          <Text style={[styles.inputLabel, { color: colors.textSecondary }]}>Description</Text>
          <TextInput
            style={[styles.input, { backgroundColor: colors.surface, borderColor: colors.border, color: colors.text }]}
            placeholder="Optional description"
            placeholderTextColor={colors.textTertiary}
            value={formDescription}
            onChangeText={setFormDescription}
          />

          {/* Total response time banner */}
          <View style={[styles.totalTimeBanner, { backgroundColor: colors.primary + '12' }]}>
            <Clock size={14} color={colors.primary} />
            <Text style={[styles.totalTimeText, { color: colors.primary }]}>
              Total response time: {formatResponseTime(totalResponseTime)}
            </Text>
          </View>

          {/* Levels */}
          <View style={styles.levelsSectionHeader}>
            <Text style={[styles.inputLabel, { color: colors.textSecondary }]}>Escalation Levels</Text>
            <TouchableOpacity style={[styles.addLevelBtn, { backgroundColor: colors.primary }]} onPress={addLevel}>
              <Plus size={12} color="#FFFFFF" />
              <Text style={styles.addLevelBtnText}>Level</Text>
            </TouchableOpacity>
          </View>

          {formLevels.map((level, idx) => (
            <View key={idx} style={[styles.levelCard, { backgroundColor: colors.surface, borderColor: colors.border }]}>
              <View style={styles.levelHeader}>
                <View style={[styles.levelNumberBadge, { backgroundColor: colors.primary }]}>
                  <Text style={styles.levelNumberText}>{idx + 1}</Text>
                </View>
                <Text style={[styles.levelTitle, { color: colors.text }]}>Level {idx + 1}</Text>
                <TouchableOpacity onPress={() => removeLevel(idx)}>
                  <Trash2 size={14} color={colors.error} />
                </TouchableOpacity>
              </View>

              <Text style={[styles.levelInputLabel, { color: colors.textSecondary }]}>Role / Designation</Text>
              <View style={styles.roleChipRow}>
                {ROLE_OPTIONS.map((r) => (
                  <TouchableOpacity
                    key={r.value}
                    style={[styles.roleChip, level.role === r.value ? { backgroundColor: colors.primary + '18', borderColor: colors.primary } : { backgroundColor: colors.card, borderColor: colors.border }]}
                    onPress={() => updateLevel(idx, 'role', r.value)}
                  >
                    <Text style={[styles.roleChipText, { color: level.role === r.value ? colors.primary : colors.textSecondary }]}>
                      {r.label}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>

              <Text style={[styles.levelInputLabel, { color: colors.textSecondary }]}>Assign to User (optional)</Text>
              <TouchableOpacity
                style={[styles.userSelectBtn, { backgroundColor: colors.card, borderColor: colors.border }]}
                onPress={() => selectUserForLevel(idx)}
              >
                <Users size={14} color={colors.textTertiary} />
                <Text style={[styles.userSelectText, { color: level.user_name ? colors.text : colors.textTertiary }]}>
                  {level.user_name || 'Select user...'}
                </Text>
                <ChevronRight size={14} color={colors.textTertiary} />
              </TouchableOpacity>

              <Text style={[styles.levelInputLabel, { color: colors.textSecondary }]}>Response Time (minutes)</Text>
              <View style={styles.responseTimeRow}>
                {[15, 30, 60, 120, 240].map((mins) => (
                  <TouchableOpacity
                    key={mins}
                    style={[styles.timeChip, level.response_time_minutes === mins ? { backgroundColor: colors.primary + '18', borderColor: colors.primary } : { backgroundColor: colors.card, borderColor: colors.border }]}
                    onPress={() => updateLevel(idx, 'response_time_minutes', mins)}
                  >
                    <Text style={[styles.timeChipText, { color: level.response_time_minutes === mins ? colors.primary : colors.textSecondary }]}>
                      {formatResponseTime(mins)}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>

              {idx < formLevels.length - 1 && (
                <View style={styles.arrowConnector}>
                  <ArrowUp size={14} color={colors.textTertiary} />
                  <Text style={[styles.arrowConnectorText, { color: colors.textTertiary }]}>
                    Escalates after {formatResponseTime(level.response_time_minutes)}
                  </Text>
                </View>
              )}
            </View>
          ))}
        </ScrollView>

        <TouchableOpacity
          style={[styles.submitBtn, { backgroundColor: colors.primary }, isSaving && { opacity: 0.6 }]}
          onPress={isEdit ? handleUpdateHierarchy : handleCreateHierarchy}
          disabled={isSaving}
        >
          {isSaving ? (
            <ActivityIndicator size="small" color="#FFFFFF" />
          ) : (
            <>
              <Save size={18} color="#FFFFFF" />
              <Text style={styles.submitBtnText}>{isEdit ? 'Update Hierarchy' : 'Save Hierarchy'}</Text>
            </>
          )}
        </TouchableOpacity>
      </KeyboardAvoidingView>
    );
  };

  return (
    <View style={[styles.container, { backgroundColor: bgColor, paddingTop: insets.top, paddingBottom: insets.bottom }]}>
      {/* ── Header ── */}
      <View style={[styles.headerSection, { backgroundColor: '#708F96' }]}>
        <View style={styles.headerTop}>
          <TouchableOpacity onPress={() => router.back()} style={styles.backBtn} activeOpacity={0.7}>
            <ArrowLeft size={22} color="#FFFFFF" />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>Escalation Matrix</Text>
          {isAdmin && (
            <TouchableOpacity
              style={[styles.headerBtn, { backgroundColor: 'rgba(255,255,255,0.25)' }]}
              onPress={() => { resetForm(); setShowCreateModal(true); }}
            >
              <Plus size={20} color="#FFFFFF" />
            </TouchableOpacity>
          )}
        </View>
        {isAdmin && (
          <Text style={styles.headerSubtitle}>Define who gets notified at each escalation level</Text>
        )}
      </View>

      {/* ── List ── */}
      <FlatList
        data={hierarchies}
        keyExtractor={(item) => item.id}
        refreshControl={<RefreshControl refreshing={isRefreshing} onRefresh={handleRefresh} tintColor={colors.primary} />}
        contentContainerStyle={styles.listContent}
        showsVerticalScrollIndicator={false}
        ListEmptyComponent={
          <View style={styles.emptyState}>
            <ArrowUpCircle size={48} color={colors.textTertiary} />
            <Text style={[styles.emptyTitle, { color: colors.textSecondary }]}>No escalation hierarchies</Text>
            <Text style={[styles.emptySubtitle, { color: colors.textTertiary }]}>
              {isAdmin ? 'Create your first escalation chain' : 'No escalation configured for this property'}
            </Text>
            {isAdmin && (
              <TouchableOpacity style={[styles.createFirstBtn, { backgroundColor: colors.primary }]} onPress={() => { resetForm(); setShowCreateModal(true); }}>
                <Text style={styles.createFirstBtnText}>Create Hierarchy</Text>
              </TouchableOpacity>
            )}
          </View>
        }
        renderItem={({ item: hierarchy }) => {
          const totalResponseTime = hierarchy.levels.reduce((sum, l) => sum + (l.response_time_minutes || 0), 0);

          return (
            <TouchableOpacity
              style={[styles.hierarchyCard, { backgroundColor: colors.card, borderColor: colors.border }]}
              onPress={() => handleHierarchyPress(hierarchy)}
              activeOpacity={0.72}
            >
              <View style={styles.hierarchyHeader}>
                <View style={[styles.hierarchyIconWrap, { backgroundColor: colors.primary + '18' }]}>
                  <ArrowUpCircle size={20} color={colors.primary} />
                </View>
                <View style={styles.hierarchyContent}>
                  <Text style={[styles.hierarchyName, { color: colors.text }]} numberOfLines={1}>{hierarchy.name}</Text>
                  <Text style={[styles.hierarchyMeta, { color: colors.textSecondary }]}>
                    {hierarchy.description || 'No description'}
                  </Text>
                </View>
                <View style={styles.hierarchyRight}>
                  <View style={[styles.levelCountBadge, { backgroundColor: colors.primary + '18' }]}>
                    <Text style={[styles.levelCountBadgeText, { color: colors.primary }]}>{hierarchy.levels.length}</Text>
                    <Text style={[styles.levelCountBadgeLabel, { color: colors.primary }]}>LVL</Text>
                  </View>
                </View>
              </View>

              {/* Levels preview */}
              {hierarchy.levels.length > 0 && (
                <View style={styles.levelsPreview}>
                  {hierarchy.levels.map((level, idx) => (
                    <View key={level.id || idx} style={styles.levelPreviewItem}>
                      <View style={[styles.levelDot, { backgroundColor: colors.primary }]} />
                      <Text style={[styles.levelPreviewText, { color: colors.textSecondary }]} numberOfLines={1}>
                        L{idx + 1}: {level.role ? level.role.replace('_', ' ').replace(/\b\w/g, (c) => c.toUpperCase()) : level.user_name || 'Unassigned'}
                      </Text>
                      <Text style={[styles.levelPreviewTime, { color: colors.textTertiary }]}>
                        {formatResponseTime(level.response_time_minutes)}
                      </Text>
                    </View>
                  ))}
                </View>
              )}

              {/* Footer */}
              <View style={styles.hierarchyFooter}>
                <View style={styles.totalTimeInfo}>
                  <Clock size={12} color={colors.textTertiary} />
                  <Text style={[styles.totalTimeInfoText, { color: colors.textTertiary }]}>
                    Total escalation window: {formatResponseTime(totalResponseTime)}
                  </Text>
                </View>
                <View style={styles.hierarchyActions}>
                  {isAdmin && (
                    <TouchableOpacity
                      style={styles.deleteBtn}
                      onPress={() => handleDeleteHierarchy(hierarchy)}
                    >
                      <Trash2 size={14} color={colors.error} />
                    </TouchableOpacity>
                  )}
                  <ChevronRight size={16} color={colors.textTertiary} />
                </View>
              </View>
            </TouchableOpacity>
          );
        }}
      />

      {/* ── Create Modal ── */}
      <Modal visible={showCreateModal} animationType="slide" transparent>
        <View style={styles.modalOverlay}>
          <View style={[styles.formSheet, { backgroundColor: colors.card }]}>
            <View style={styles.modalHandle} />
            <View style={styles.modalHeaderRow}>
              <Text style={[styles.modalTitle, { color: colors.text }]}>New Escalation Hierarchy</Text>
              <TouchableOpacity onPress={() => { setShowCreateModal(false); resetForm(); }}>
                <X size={20} color={colors.textSecondary} />
              </TouchableOpacity>
            </View>
            {renderHierarchyForm(false)}
          </View>
        </View>
      </Modal>

      {/* ── Edit Modal ── */}
      <Modal visible={showEditModal} animationType="slide" transparent>
        <View style={styles.modalOverlay}>
          <View style={[styles.formSheet, { backgroundColor: colors.card }]}>
            <View style={styles.modalHandle} />
            <View style={styles.modalHeaderRow}>
              <Text style={[styles.modalTitle, { color: colors.text }]}>Edit Hierarchy</Text>
              <TouchableOpacity onPress={() => { setShowEditModal(false); resetForm(); setSelectedHierarchy(null); }}>
                <X size={20} color={colors.textSecondary} />
              </TouchableOpacity>
            </View>
            {renderHierarchyForm(true)}
          </View>
        </View>
      </Modal>
    </View>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  container: { flex: 1 },
  loadingContainer: { flex: 1, justifyContent: 'center', alignItems: 'center', gap: 16 },
  loadingText: { fontSize: 14, fontFamily: 'Urbanist-Medium' },

  headerSection: { paddingHorizontal: 16, paddingTop: 16, paddingBottom: 20 },
  headerTop: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  headerTitle: { fontSize: 24, fontFamily: 'Poppins-Bold', color: '#FFFFFF', letterSpacing: -0.3 },
  headerSubtitle: { fontSize: 12, fontFamily: 'Urbanist-Regular', color: 'rgba(255,255,255,0.65)', marginTop: 4 },
  headerBtn: { width: 36, height: 36, borderRadius: 10, justifyContent: 'center', alignItems: 'center' },
  backBtn: { width: 36, height: 36, borderRadius: 10, justifyContent: 'center', alignItems: 'center', backgroundColor: 'rgba(255,255,255,0.15)' },

  listContent: { paddingHorizontal: 16, paddingTop: 16, paddingBottom: 100 },
  emptyState: { flex: 1, alignItems: 'center', justifyContent: 'center', paddingTop: 60, gap: 12 },
  emptyTitle: { fontSize: 16, fontFamily: 'Poppins-Bold' },
  emptySubtitle: { fontSize: 13, fontFamily: 'Urbanist-Regular', textAlign: 'center' },
  createFirstBtn: { paddingHorizontal: 20, paddingVertical: 10, borderRadius: 10 },
  createFirstBtnText: { color: '#FFFFFF', fontSize: 13, fontFamily: 'Poppins-Bold' },

  hierarchyCard: { borderRadius: 14, borderWidth: 1, padding: 14, marginBottom: 12 },
  hierarchyHeader: { flexDirection: 'row', alignItems: 'center', gap: 12, marginBottom: 12 },
  hierarchyIconWrap: { width: 40, height: 40, borderRadius: 10, justifyContent: 'center', alignItems: 'center', flexShrink: 0 },
  hierarchyContent: { flex: 1 },
  hierarchyName: { fontSize: 16, fontFamily: 'Poppins-Bold', marginBottom: 2 },
  hierarchyMeta: { fontSize: 11, fontFamily: 'Urbanist-Regular' },
  hierarchyRight: {},
  levelCountBadge: { flexDirection: 'row', alignItems: 'center', gap: 2, paddingHorizontal: 10, paddingVertical: 4, borderRadius: 12 },
  levelCountBadgeText: { fontSize: 14, fontFamily: 'Poppins-Bold' },
  levelCountBadgeLabel: { fontSize: 9, fontFamily: 'Urbanist-Bold' },

  levelsPreview: { gap: 6, marginBottom: 12 },
  levelPreviewItem: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  levelDot: { width: 6, height: 6, borderRadius: 3 },
  levelPreviewText: { flex: 1, fontSize: 12, fontFamily: 'Urbanist-Medium' },
  levelPreviewTime: { fontSize: 11, fontFamily: 'Urbanist-Medium' },

  hierarchyFooter: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  totalTimeInfo: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  totalTimeInfoText: { fontSize: 11, fontFamily: 'Urbanist-Medium' },
  hierarchyActions: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  deleteBtn: { padding: 4 },

  // Form Modal
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)' },
  formSheet: { flex: 1, marginTop: 60, borderTopLeftRadius: 20, borderTopRightRadius: 20, paddingHorizontal: 20, paddingBottom: 34 },
  modalHandle: { width: 36, height: 4, backgroundColor: '#D1D5DB', borderRadius: 2, alignSelf: 'center', marginTop: 10, marginBottom: 16 },
  modalHeaderRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 },
  modalTitle: { fontSize: 18, fontFamily: 'Poppins-Bold' },
  formScroll: { flex: 1 },
  inputLabel: { fontSize: 11, fontFamily: 'Urbanist-Bold', textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 6, marginTop: 12 },
  input: { borderRadius: 10, borderWidth: 1, paddingHorizontal: 12, paddingVertical: 10, fontSize: 14, fontFamily: 'Urbanist-Regular' },

  totalTimeBanner: { flexDirection: 'row', alignItems: 'center', gap: 6, borderRadius: 10, paddingHorizontal: 12, paddingVertical: 8, marginTop: 16 },
  totalTimeText: { fontSize: 12, fontFamily: 'Poppins-Bold' },

  levelsSectionHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginTop: 16, marginBottom: 8 },
  addLevelBtn: { flexDirection: 'row', alignItems: 'center', gap: 4, paddingHorizontal: 10, paddingVertical: 5, borderRadius: 16 },
  addLevelBtnText: { color: '#FFFFFF', fontSize: 12, fontFamily: 'Urbanist-Bold' },

  levelCard: { borderRadius: 12, borderWidth: 1, padding: 14, marginBottom: 12 },
  levelHeader: { flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 12 },
  levelNumberBadge: { width: 24, height: 24, borderRadius: 12, justifyContent: 'center', alignItems: 'center' },
  levelNumberText: { color: '#FFFFFF', fontSize: 12, fontFamily: 'Poppins-Bold' },
  levelTitle: { flex: 1, fontSize: 14, fontFamily: 'Poppins-Bold' },
  levelInputLabel: { fontSize: 10, fontFamily: 'Urbanist-Bold', textTransform: 'uppercase', letterSpacing: 0.3, marginBottom: 6, marginTop: 8 },
  roleChipRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
  roleChip: { paddingHorizontal: 10, paddingVertical: 5, borderRadius: 16, borderWidth: 1 },
  roleChipText: { fontSize: 11, fontFamily: 'Urbanist-Medium' },
  userSelectBtn: { flexDirection: 'row', alignItems: 'center', gap: 8, borderRadius: 10, borderWidth: 1, paddingHorizontal: 12, paddingVertical: 10 },
  userSelectText: { flex: 1, fontSize: 13, fontFamily: 'Urbanist-Regular' },
  responseTimeRow: { flexDirection: 'row', gap: 6, marginTop: 4 },
  timeChip: { paddingHorizontal: 10, paddingVertical: 6, borderRadius: 16, borderWidth: 1 },
  timeChipText: { fontSize: 11, fontFamily: 'Urbanist-Medium' },
  arrowConnector: { flexDirection: 'row', alignItems: 'center', gap: 4, marginTop: 12, paddingTop: 8, borderTopWidth: 1, borderTopColor: 'rgba(0,0,0,0.06)' },
  arrowConnectorText: { fontSize: 11, fontFamily: 'Urbanist-Regular' },

  submitBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, borderRadius: 12, paddingVertical: 14, marginTop: 8 },
  submitBtnText: { color: '#FFFFFF', fontSize: 15, fontFamily: 'Poppins-Bold' },
});
