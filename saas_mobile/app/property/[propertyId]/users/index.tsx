import React, { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  TextInput,
  ActivityIndicator,
  RefreshControl,
  Alert,
  Keyboard,
  ScrollView,
  Image,
} from 'react-native';
import { useLocalSearchParams } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useTheme } from '@/context';
import { Colors } from '@/constants/Colors';
import { supabase } from '@/utils/supabase/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { StatusBadge } from '@/components/ui/StatusBadge';
import { useAuth } from '@/hooks/useAuth';
import BottomSheet, {
  BottomSheetBackdrop,
  BottomSheetBackdropProps,
  BottomSheetScrollView,
  BottomSheetView,
} from '@gorhom/bottom-sheet';
import {
  Search,
  UserPlus,
  Mail,
  Phone,
  Shield,
  Building2,
  Calendar,
  Key,
  RefreshCw,
  Trash2,
  Edit2,
  X,
  ChevronRight,
  MoreVertical,
  Wrench,
  Star,
} from 'lucide-react-native';

// ─── Types ────────────────────────────────────────────────────────────────────

interface UserWithMembership {
  id: string;
  full_name: string;
  email: string;
  avatar_url?: string;
  user_photo_url?: string;
  phone?: string;
  propertyRole?: string;
  is_active: boolean;
  joined_at: string;
  role: string;
  is_accepted: boolean;
}

interface UserSkills {
  skill_code: string;
}

// ─── Role Helpers ─────────────────────────────────────────────────────────────

const PROPERTY_ROLE_OPTIONS = ['property_admin', 'staff', 'mst', 'security'];

function formatRole(role: string): string {
  if (!role) return 'Member';
  if (role === 'tenant') return 'Client';
  if (role === 'super_tenant') return 'Super Client';
  if (role === 'property_admin') return 'Admin';
  if (role === 'mst') return 'MST';
  if (role === 'staff') return 'Staff';
  if (role === 'security') return 'Security';
  if (role === 'soft_service_manager') return 'SSM';
  return role.replace(/_/g, ' ').replace(/\b\w/g, (l) => l.toUpperCase());
}

function getRoleBadgeColor(role: string): {
  bg: string;
  text: string;
  border: string;
} {
  switch (role) {
    case 'property_admin':
      return { bg: '#FEF3C7', text: '#92400E', border: '#FCD34D' };
    case 'staff':
      return { bg: '#DBEAFE', text: '#1E40AF', border: '#93C5FD' };
    case 'mst':
      return { bg: '#D1FAE5', text: '#065F46', border: '#6EE7B7' };
    case 'security':
      return { bg: '#F3E8FF', text: '#6B21A8', border: '#C4B5FD' };
    default:
      return { bg: '#F1F5F9', text: '#475569', border: '#CBD5E1' };
  }
}

// ─── Segmented Control ────────────────────────────────────────────────────────

const TABS = [
  { key: 'all', label: 'All' },
  { key: 'property_admin', label: 'Admins' },
  { key: 'staff', label: 'Staff' },
  { key: 'mst', label: 'MST' },
];

function SegmentedControl({
  selected,
  onSelect,
  colors,
}: {
  selected: string;
  onSelect: (key: string) => void;
  colors: typeof Colors.light;
}) {
  return (
    <View
      style={[
        styles.segmentContainer,
        { backgroundColor: colors.surface, borderColor: colors.border },
      ]}
    >
      {TABS.map((tab) => {
        const isSelected = selected === tab.key;
        return (
          <TouchableOpacity
            key={tab.key}
            style={[
              styles.segmentItem,
              isSelected && { backgroundColor: colors.primary },
            ]}
            onPress={() => onSelect(tab.key)}
            activeOpacity={0.7}
          >
            <Text
              style={[
                styles.segmentText,
                { color: isSelected ? '#FFFFFF' : colors.textSecondary },
                isSelected && styles.segmentTextSelected,
              ]}
            >
              {tab.label}
            </Text>
          </TouchableOpacity>
        );
      })}
    </View>
  );
}

// ─── User Card ────────────────────────────────────────────────────────────────

function UserCard({
  user,
  onPress,
  colors,
}: {
  user: UserWithMembership;
  onPress: () => void;
  colors: typeof Colors.light;
}) {
  const roleBadge = getRoleBadgeColor(user.propertyRole || user.role || 'staff');
  const initials = user.full_name
    ? user.full_name
        .split(' ')
        .map((n) => n[0])
        .join('')
        .slice(0, 2)
        .toUpperCase()
    : 'U';

  return (
    <TouchableOpacity
      style={[
        styles.userCard,
        { backgroundColor: colors.card, borderColor: colors.border },
      ]}
      onPress={onPress}
      activeOpacity={0.7}
    >
      {/* Avatar */}
      <View
        style={[
          styles.avatarCircle,
          { backgroundColor: colors.primaryLight, borderColor: colors.border },
        ]}
      >
        {user.user_photo_url || user.avatar_url ? (
          <Image
            source={{ uri: user.user_photo_url || user.avatar_url }}
            style={styles.avatarImage}
          />
        ) : (
          <Text style={[styles.avatarInitials, { color: colors.primary }]}>
            {initials}
          </Text>
        )}
      </View>

      {/* User Info */}
      <View style={styles.userCardInfo}>
        <View style={styles.userCardNameRow}>
          <Text
            style={[styles.userCardName, { color: colors.text }]}
            numberOfLines={1}
          >
            {user.full_name || 'Unknown'}
          </Text>
          <View
            style={[
              styles.roleBadge,
              { backgroundColor: roleBadge.bg, borderColor: roleBadge.border },
            ]}
          >
            <Text style={[styles.roleBadgeText, { color: roleBadge.text }]}>
              {formatRole(user.propertyRole || user.role)}
            </Text>
          </View>
        </View>

        <Text
          style={[styles.userCardEmail, { color: colors.textSecondary }]}
          numberOfLines={1}
        >
          {user.email}
        </Text>

        <View style={styles.userCardMeta}>
          <View
            style={[
              styles.statusDot,
              {
                backgroundColor: user.is_active ? colors.success : '#94A3B8',
              },
            ]}
          />
          <Text style={[styles.statusText, { color: colors.textSecondary }]}>
            {user.is_active ? 'Active' : 'Inactive'}
          </Text>
          {user.joined_at && (
            <>
              <Text style={[styles.metaDivider, { color: colors.textTertiary }]}>
                {' '}
                ·{' '}
              </Text>
              <Text style={[styles.statusText, { color: colors.textSecondary }]}>
                Joined {formatJoinDate(user.joined_at)}
              </Text>
            </>
          )}
        </View>
      </View>

      {/* Chevron */}
      <ChevronRight
        size={18}
        color={colors.textTertiary}
        style={styles.chevron}
      />
    </TouchableOpacity>
  );
}

function formatJoinDate(dateStr: string): string {
  try {
    const date = new Date(dateStr);
    const now = new Date();
    const diff = now.getTime() - date.getTime();
    const days = Math.floor(diff / (1000 * 60 * 60 * 24));
    if (days < 30) return `${days}d ago`;
    const months = Math.floor(days / 30);
    if (months < 12) return `${months}mo ago`;
    return `${Math.floor(months / 12)}y ago`;
  } catch {
    return '';
  }
}

// ─── Empty State ─────────────────────────────────────────────────────────────

function EmptyState({ colors }: { colors: typeof Colors.light }) {
  return (
    <View style={styles.emptyState}>
      <View
        style={[
          styles.emptyIconWrap,
          { backgroundColor: colors.primaryLight },
        ]}
      >
        <Search size={32} color={colors.primary} />
      </View>
      <Text style={[styles.emptyTitle, { color: colors.text }]}>
        No team members found
      </Text>
      <Text style={[styles.emptySubtitle, { color: colors.textSecondary }]}>
        Try adjusting your search or filter, or add a new member.
      </Text>
    </View>
  );
}

// ─── Loading State ───────────────────────────────────────────────────────────

function LoadingState({ colors }: { colors: typeof Colors.light }) {
  return (
    <View style={styles.loadingState}>
      <ActivityIndicator size="large" color={colors.primary} />
      <Text style={[styles.loadingText, { color: colors.textSecondary }]}>
        Loading team members...
      </Text>
    </View>
  );
}

// ─── User Detail Bottom Sheet ─────────────────────────────────────────────────

function UserDetailSheet({
  user,
  propertyId,
  bottomSheetRef,
  colors,
  onUpdate,
}: {
  user: UserWithMembership;
  propertyId: string;
  bottomSheetRef: React.RefObject<BottomSheet | null>;
  colors: typeof Colors.light;
  onUpdate: () => void;
}) {
  const snapPoints = useMemo(() => ['55%', '80%'], []);
  const [showRolePicker, setShowRolePicker] = useState(false);
  const [selectedRole, setSelectedRole] = useState(user.propertyRole || user.role);
  const [skills, setSkills] = useState<string[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [showConfirmDelete, setShowConfirmDelete] = useState(false);
  const { user: authUser } = useAuth();

  useEffect(() => {
    loadSkills();
  }, []);

  async function loadSkills() {
    if (user.propertyRole === 'mst' || user.propertyRole === 'staff') {
      const { data } = await supabase
        .from('mst_skills')
        .select('skill_code')
        .eq('user_id', user.id)
        .eq('property_id', propertyId);
      if (data) setSkills(data.map((s: UserSkills) => s.skill_code));
    }
  }

  async function handleUpdateRole() {
    setIsLoading(true);
    try {
      const { error } = await (supabase
        .from('property_memberships') as any)
        .update({ role: selectedRole })
        .eq('user_id', user.id)
        .eq('property_id', propertyId);
      if (error) throw error;
      setShowRolePicker(false);
      onUpdate();
      bottomSheetRef.current?.close();
    } catch (err: any) {
      Alert.alert('Error', err.message || 'Failed to update role');
    } finally {
      setIsLoading(false);
    }
  }

  async function handleToggleActive() {
    setIsLoading(true);
    try {
      const { error } = await (supabase
        .from('property_memberships') as any)
        .update({ is_active: !user.is_active })
        .eq('user_id', user.id)
        .eq('property_id', propertyId);
      if (error) throw error;
      onUpdate();
      bottomSheetRef.current?.close();
    } catch (err: any) {
      Alert.alert('Error', err.message || 'Failed to update status');
    } finally {
      setIsLoading(false);
    }
  }

  async function handleResetPassword() {
    try {
      const { error } = await supabase.auth.resetPasswordForEmail(user.email, {
        redirectTo: 'autopilot://reset-password',
      });
      if (error) throw error;
      Alert.alert('Success', `Password reset email sent to ${user.email}`);
    } catch (err: any) {
      Alert.alert('Error', err.message || 'Failed to send reset email');
    }
  }

  async function handleRemoveUser() {
    setIsLoading(true);
    try {
      const { error } = await supabase
        .from('property_memberships')
        .delete()
        .eq('user_id', user.id)
        .eq('property_id', propertyId);
      if (error) throw error;
      onUpdate();
      bottomSheetRef.current?.close();
    } catch (err: any) {
      Alert.alert('Error', err.message || 'Failed to remove member');
    } finally {
      setIsLoading(false);
    }
  }

  const renderBackdrop = useCallback(
    (props: BottomSheetBackdropProps) => (
      <BottomSheetBackdrop
        {...props}
        disappearsOnIndex={-1}
        appearsOnIndex={0}
        opacity={0.5}
      />
    ),
    []
  );

  const initials = user.full_name
    ? user.full_name
        .split(' ')
        .map((n) => n[0])
        .join('')
        .slice(0, 2)
        .toUpperCase()
    : 'U';

  const roleBadge = getRoleBadgeColor(user.propertyRole || user.role || 'staff');

  return (
    <BottomSheet
      ref={bottomSheetRef}
      index={-1}
      snapPoints={snapPoints}
      enablePanDownToClose
      backdropComponent={renderBackdrop}
      backgroundStyle={{ backgroundColor: colors.card }}
      handleIndicatorStyle={{ backgroundColor: colors.border }}
    >
      <BottomSheetScrollView contentContainerStyle={styles.sheetContent}>
        {/* Header */}
        <View style={styles.sheetHeader}>
          <View
            style={[
              styles.sheetAvatar,
              { backgroundColor: colors.primaryLight },
            ]}
          >
            {user.user_photo_url || user.avatar_url ? (
              <Image
                source={{ uri: user.user_photo_url || user.avatar_url }}
                style={styles.sheetAvatarImage}
              />
            ) : (
              <Text style={[styles.sheetAvatarText, { color: colors.primary }]}>
                {initials}
              </Text>
            )}
          </View>
          <Text style={[styles.sheetName, { color: colors.text }]}>
            {user.full_name || 'Unknown'}
          </Text>
          <View
            style={[
              styles.sheetRoleBadge,
              { backgroundColor: roleBadge.bg, borderColor: roleBadge.border },
            ]}
          >
            <Text style={[styles.sheetRoleBadgeText, { color: roleBadge.text }]}>
              {formatRole(user.propertyRole || user.role)}
            </Text>
          </View>
          <View
            style={[
              styles.sheetStatusBadge,
              {
                backgroundColor: user.is_active
                  ? colors.successBg
                  : colors.errorBg,
              },
            ]}
          >
            <View
              style={[
                styles.sheetStatusDot,
                {
                  backgroundColor: user.is_active
                    ? colors.success
                    : colors.error,
                },
              ]}
            />
            <Text
              style={[
                styles.sheetStatusText,
                {
                  color: user.is_active ? colors.success : colors.error,
                },
              ]}
            >
              {user.is_active ? 'Active' : 'Inactive'}
            </Text>
          </View>
        </View>

        {/* User Details */}
        <View
          style={[
            styles.sheetSection,
            { backgroundColor: colors.surfaceElevated, borderColor: colors.border },
          ]}
        >
          <DetailRow
            icon={<Mail size={14} color={colors.textSecondary} />}
            label="Email"
            value={user.email}
            colors={colors}
          />
          {user.phone && (
            <DetailRow
              icon={<Phone size={14} color={colors.textSecondary} />}
              label="Phone"
              value={user.phone}
              colors={colors}
            />
          )}
          <DetailRow
            icon={<Building2 size={14} color={colors.textSecondary} />}
            label="Role"
            value={formatRole(user.propertyRole || user.role)}
            colors={colors}
          />
          {user.joined_at && (
            <DetailRow
              icon={<Calendar size={14} color={colors.textSecondary} />}
              label="Joined"
              value={new Date(user.joined_at).toLocaleDateString()}
              colors={colors}
            />
          )}
          {skills.length > 0 && (
            <DetailRow
              icon={<Wrench size={14} color={colors.textSecondary} />}
              label="Skills"
              value={skills.join(', ')}
              colors={colors}
            />
          )}
        </View>

        {/* Actions */}
        <View style={styles.sheetActions}>
          {/* Change Role */}
          <TouchableOpacity
            style={[
              styles.actionButton,
              { backgroundColor: colors.surfaceElevated, borderColor: colors.border },
            ]}
            onPress={() => setShowRolePicker(!showRolePicker)}
            activeOpacity={0.7}
          >
            <View style={styles.actionLeft}>
              <Shield size={18} color={colors.primary} />
              <Text style={[styles.actionText, { color: colors.text }]}>
                Change Role
              </Text>
            </View>
            <ChevronRight size={16} color={colors.textTertiary} />
          </TouchableOpacity>

          {showRolePicker && (
            <View
              style={[
                styles.rolePickerContainer,
                { backgroundColor: colors.surface, borderColor: colors.border },
              ]}
            >
              {PROPERTY_ROLE_OPTIONS.map((role) => {
                const isSelected = selectedRole === role;
                return (
                  <TouchableOpacity
                    key={role}
                    style={[
                      styles.roleOption,
                      isSelected && { backgroundColor: colors.primaryLight },
                    ]}
                    onPress={() => setSelectedRole(role)}
                    activeOpacity={0.7}
                  >
                    <Text
                      style={[
                        styles.roleOptionText,
                        { color: isSelected ? colors.primary : colors.text },
                      ]}
                    >
                      {formatRole(role)}
                    </Text>
                    {isSelected && (
                      <View
                        style={[
                          styles.roleOptionDot,
                          { backgroundColor: colors.primary },
                        ]}
                      />
                    )}
                  </TouchableOpacity>
                );
              })}
              <Button
                title="Save Role"
                variant="primary"
                size="md"
                onPress={handleUpdateRole}
                loading={isLoading}
                style={{ marginTop: 12 }}
              />
            </View>
          )}

          {/* Reset Password */}
          <TouchableOpacity
            style={[
              styles.actionButton,
              { backgroundColor: colors.surfaceElevated, borderColor: colors.border },
            ]}
            onPress={handleResetPassword}
            activeOpacity={0.7}
          >
            <View style={styles.actionLeft}>
              <Key size={18} color={colors.textSecondary} />
              <Text style={[styles.actionText, { color: colors.text }]}>
                Reset Password
              </Text>
            </View>
            <ChevronRight size={16} color={colors.textTertiary} />
          </TouchableOpacity>

          {/* Deactivate / Activate */}
          <TouchableOpacity
            style={[
              styles.actionButton,
              { backgroundColor: colors.surfaceElevated, borderColor: colors.border },
            ]}
            onPress={handleToggleActive}
            activeOpacity={0.7}
            disabled={isLoading}
          >
            <View style={styles.actionLeft}>
              <RefreshCw size={18} color={colors.textSecondary} />
              <Text style={[styles.actionText, { color: colors.text }]}>
                {user.is_active ? 'Deactivate' : 'Activate'}
              </Text>
            </View>
            <ChevronRight size={16} color={colors.textTertiary} />
          </TouchableOpacity>

          {/* Remove */}
          {showConfirmDelete ? (
            <View
              style={[
                styles.confirmDeleteContainer,
                { backgroundColor: colors.errorBg, borderColor: colors.errorBorder },
              ]}
            >
              <Text style={[styles.confirmDeleteText, { color: colors.error }]}>
                Remove {user.full_name} from this property?
              </Text>
              <View style={styles.confirmDeleteButtons}>
                <Button
                  title="Cancel"
                  variant="ghost"
                  size="sm"
                  onPress={() => setShowConfirmDelete(false)}
                />
                <Button
                  title="Remove"
                  variant="danger"
                  size="sm"
                  onPress={handleRemoveUser}
                  loading={isLoading}
                />
              </View>
            </View>
          ) : (
            <TouchableOpacity
              style={[
                styles.actionButton,
                styles.actionButtonDanger,
                { backgroundColor: colors.errorBg, borderColor: colors.errorBorder },
              ]}
              onPress={() => setShowConfirmDelete(true)}
              activeOpacity={0.7}
            >
              <View style={styles.actionLeft}>
                <Trash2 size={18} color={colors.error} />
                <Text style={[styles.actionText, { color: colors.error }]}>
                  Remove from Property
                </Text>
              </View>
              <ChevronRight size={16} color={colors.error} />
            </TouchableOpacity>
          )}
        </View>
      </BottomSheetScrollView>
    </BottomSheet>
  );
}

function DetailRow({
  icon,
  label,
  value,
  colors,
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
  colors: typeof Colors.light;
}) {
  return (
    <View style={styles.detailRow}>
      <View style={styles.detailIcon}>{icon}</View>
      <View style={styles.detailContent}>
        <Text style={[styles.detailLabel, { color: colors.textTertiary }]}>
          {label}
        </Text>
        <Text style={[styles.detailValue, { color: colors.text }]}>{value}</Text>
      </View>
    </View>
  );
}

// ─── Invite Member Bottom Sheet ───────────────────────────────────────────────

function InviteMemberSheet({
  bottomSheetRef,
  propertyId,
  colors,
  onSuccess,
}: {
  bottomSheetRef: React.RefObject<BottomSheet | null>;
  propertyId: string;
  colors: typeof Colors.light;
  onSuccess: () => void;
}) {
  const snapPoints = useMemo(() => ['60%'], []);
  const [email, setEmail] = useState('');
  const [role, setRole] = useState('staff');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');
  const { user: authUser } = useAuth();

  const renderBackdrop = useCallback(
    (props: BottomSheetBackdropProps) => (
      <BottomSheetBackdrop
        {...props}
        disappearsOnIndex={-1}
        appearsOnIndex={0}
        opacity={0.5}
      />
    ),
    []
  );

  async function handleInvite() {
    setError('');
    if (!email.trim()) {
      setError('Email is required');
      return;
    }
    if (!/\S+@\S+\.\S+/.test(email.trim())) {
      setError('Please enter a valid email address');
      return;
    }

    setIsLoading(true);
    try {
      // First check if user exists by email
      const { data: existingUser } = await supabase
        .from('users')
        .select('id')
        .eq('email', email.trim().toLowerCase())
        .single();

      if (existingUser) {
        // User exists — add to property_memberships
        const { error: memberError } = await (supabase
          .from('property_memberships') as any)
          .insert({
            user_id: (existingUser as any).id,
            property_id: propertyId,
            role: role,
            is_active: true,
            is_accepted: true,
            joined_at: new Date().toISOString(),
          });
        if (memberError) {
          if (memberError.code === '23505') {
            setError('This user is already a member of this property.');
          } else {
            throw memberError;
          }
          return;
        }
      } else {
        // User doesn't exist — create invite (stored as pending membership)
        const { error: inviteError } = await (supabase
          .from('property_invites') as any)
          .insert({
            email: email.trim().toLowerCase(),
            property_id: propertyId,
            role: role,
            invited_by: authUser?.id,
          });
        if (inviteError) throw inviteError;
      }

      bottomSheetRef.current?.close();
      setEmail('');
      setRole('staff');
      onSuccess();
    } catch (err: any) {
      setError(err.message || 'Failed to send invite');
    } finally {
      setIsLoading(false);
    }
  }

  return (
    <BottomSheet
      ref={bottomSheetRef}
      index={-1}
      snapPoints={snapPoints}
      enablePanDownToClose
      backdropComponent={renderBackdrop}
      backgroundStyle={{ backgroundColor: colors.card }}
      handleIndicatorStyle={{ backgroundColor: colors.border }}
    >
      <BottomSheetScrollView contentContainerStyle={styles.sheetContent}>
        {/* Header */}
        <View style={styles.inviteHeader}>
          <View
            style={[
              styles.inviteIconWrap,
              { backgroundColor: colors.primaryLight },
            ]}
          >
            <UserPlus size={24} color={colors.primary} />
          </View>
          <Text style={[styles.inviteTitle, { color: colors.text }]}>
            Invite Team Member
          </Text>
          <Text style={[styles.inviteSubtitle, { color: colors.textSecondary }]}>
            Add a new member to this property by email.
          </Text>
        </View>

        {/* Form */}
        <View style={styles.inviteForm}>
          <View style={styles.inputGroup}>
            <Text style={[styles.inputLabel, { color: colors.textSecondary }]}>
              Email Address
            </Text>
            <TextInput
              style={[
                styles.emailInput,
                {
                  backgroundColor: colors.surfaceElevated,
                  borderColor: error ? colors.error : colors.border,
                  color: colors.text,
                },
              ]}
              placeholder="member@example.com"
              placeholderTextColor={colors.textTertiary}
              value={email}
              onChangeText={(text) => {
                setEmail(text);
                setError('');
              }}
              keyboardType="email-address"
              autoCapitalize="none"
              autoCorrect={false}
            />
            {error ? (
              <Text style={[styles.inputError, { color: colors.error }]}>
                {error}
              </Text>
            ) : null}
          </View>

          <View style={styles.inputGroup}>
            <Text style={[styles.inputLabel, { color: colors.textSecondary }]}>
              Role
            </Text>
            <View style={styles.roleSelectorContainer}>
              {PROPERTY_ROLE_OPTIONS.map((r) => {
                const isSelected = role === r;
                return (
                  <TouchableOpacity
                    key={r}
                    style={[
                      styles.roleChip,
                      {
                        backgroundColor: isSelected
                          ? colors.primary
                          : colors.surfaceElevated,
                        borderColor: isSelected
                          ? colors.primary
                          : colors.border,
                      },
                    ]}
                    onPress={() => setRole(r)}
                    activeOpacity={0.7}
                  >
                    <Text
                      style={[
                        styles.roleChipText,
                        {
                          color: isSelected ? '#FFFFFF' : colors.textSecondary,
                        },
                      ]}
                    >
                      {formatRole(r)}
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </View>
          </View>
        </View>

        {/* Actions */}
        <View style={styles.inviteActions}>
          <Button
            title="Send Invite"
            variant="primary"
            size="lg"
            onPress={handleInvite}
            loading={isLoading}
            leftIcon={<Mail size={16} color="#FFFFFF" />}
            style={styles.inviteButton}
          />
          <Button
            title="Cancel"
            variant="ghost"
            size="md"
            onPress={() => {
              bottomSheetRef.current?.close();
              setEmail('');
              setRole('staff');
              setError('');
            }}
          />
        </View>
      </BottomSheetScrollView>
    </BottomSheet>
  );
}

// ─── Main Screen ─────────────────────────────────────────────────────────────

export default function UsersScreen() {
  const { propertyId } = useLocalSearchParams<{ propertyId: string }>();
  const { theme } = useTheme();
  const colors = Colors[theme];

  const [users, setUsers] = useState<UserWithMembership[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedTab, setSelectedTab] = useState('all');
  const [selectedUser, setSelectedUser] = useState<UserWithMembership | null>(null);

  // Bottom sheet refs
  const userDetailSheetRef = useRef<BottomSheet>(null);
  const inviteSheetRef = useRef<BottomSheet>(null);

  useEffect(() => {
    if (propertyId) {
      fetchUsers();
    }
  }, [propertyId]);

  async function fetchUsers() {
    if (!propertyId) return;
    setIsLoading(true);

    try {
      const { data, error } = await supabase
        .from('property_memberships')
        .select(
          `
          role,
          is_active,
          is_accepted,
          joined_at,
          user:users(id, email, full_name, phone, avatar_url, user_photo_url)
        `
        )
        .eq('property_id', propertyId)
        .order('joined_at', { ascending: false });

      if (error) throw error;

      const mapped: UserWithMembership[] = (data || []).map((m: any) => ({
        id: m.user?.id || '',
        full_name: m.user?.full_name || m.user?.name || 'Unknown',
        email: m.user?.email || '',
        avatar_url: m.user?.avatar_url,
        user_photo_url: m.user?.user_photo_url,
        phone: m.user?.phone,
        propertyRole: m.role,
        role: m.role,
        is_active: m.is_active ?? true,
        is_accepted: m.is_accepted ?? true,
        joined_at: m.joined_at || new Date().toISOString(),
      }));

      setUsers(mapped);
    } catch (err) {
      console.error('[Users] fetchUsers error:', err);
      setUsers([]);
    } finally {
      setIsLoading(false);
    }
  }

  async function handleRefresh() {
    setRefreshing(true);
    await fetchUsers();
    setRefreshing(false);
  }

  function handleUserPress(user: UserWithMembership) {
    setSelectedUser(user);
    userDetailSheetRef.current?.expand();
  }

  function handleAddMember() {
    inviteSheetRef.current?.expand();
  }

  // Filter logic
  const filteredUsers = users.filter((u) => {
    const matchesSearch =
      !searchQuery.trim() ||
      u.full_name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      u.email.toLowerCase().includes(searchQuery.toLowerCase());

    const matchesTab =
      selectedTab === 'all' ||
      (u.propertyRole || u.role) === selectedTab ||
      u.role === selectedTab;

    return matchesSearch && matchesTab;
  });

  const totalCount = users.length;
  const activeCount = users.filter((u) => u.is_active).length;

  return (
    <SafeAreaView
      style={[styles.container, { backgroundColor: colors.background }]}
      edges={['top']}
    >
      {/* Header */}
      <View style={styles.header}>
        <View>
          <Text style={[styles.title, { color: colors.text }]}>Team</Text>
          <Text style={[styles.subtitle, { color: colors.textSecondary }]}>
            {totalCount} members · {activeCount} active
          </Text>
        </View>
        <TouchableOpacity
          style={[styles.addButton, { backgroundColor: colors.primary }]}
          onPress={handleAddMember}
          activeOpacity={0.8}
        >
          <UserPlus size={18} color="#FFFFFF" />
          <Text style={styles.addButtonText}>Add Member</Text>
        </TouchableOpacity>
      </View>

      {/* Search Bar */}
      <View style={styles.searchContainer}>
        <View
          style={[
            styles.searchBar,
            { backgroundColor: colors.surface, borderColor: colors.border },
          ]}
        >
          <Search size={16} color={colors.textTertiary} />
          <TextInput
            style={[styles.searchInput, { color: colors.text }]}
            placeholder="Search members..."
            placeholderTextColor={colors.textTertiary}
            value={searchQuery}
            onChangeText={setSearchQuery}
            autoCapitalize="none"
            autoCorrect={false}
          />
          {searchQuery.length > 0 && (
            <TouchableOpacity onPress={() => setSearchQuery('')}>
              <X size={16} color={colors.textTertiary} />
            </TouchableOpacity>
          )}
        </View>
      </View>

      {/* Segmented Control */}
      <View style={styles.segmentWrapper}>
        <SegmentedControl
          selected={selectedTab}
          onSelect={setSelectedTab}
          colors={colors}
        />
      </View>

      {/* User List */}
      {isLoading ? (
        <LoadingState colors={colors} />
      ) : (
        <FlatList
          data={filteredUsers}
          keyExtractor={(item) => item.id}
          renderItem={({ item }) => (
            <UserCard
              user={item}
              onPress={() => handleUserPress(item)}
              colors={colors}
            />
          )}
          contentContainerStyle={styles.listContent}
          ItemSeparatorComponent={() => <View style={styles.separator} />}
          ListEmptyComponent={<EmptyState colors={colors} />}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={handleRefresh}
              tintColor={colors.primary}
            />
          }
          showsVerticalScrollIndicator={false}
        />
      )}

      {/* User Detail Bottom Sheet */}
      {selectedUser && (
        <UserDetailSheet
          user={selectedUser}
          propertyId={propertyId || ''}
          bottomSheetRef={userDetailSheetRef}
          colors={colors}
          onUpdate={fetchUsers}
        />
      )}

      {/* Invite Member Bottom Sheet */}
      {propertyId && (
        <InviteMemberSheet
          bottomSheetRef={inviteSheetRef}
          propertyId={propertyId}
          colors={colors}
          onSuccess={fetchUsers}
        />
      )}
    </SafeAreaView>
  );
}

// ─── Styles ────────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingTop: 8,
    paddingBottom: 4,
  },
  title: {
    fontSize: 28,
    fontFamily: 'Poppins-Bold',
    letterSpacing: -0.5,
  },
  subtitle: {
    fontSize: 13,
    fontFamily: 'Urbanist-Medium',
    marginTop: 2,
  },
  addButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 12,
  },
  addButtonText: {
    color: '#FFFFFF',
    fontSize: 14,
    fontFamily: 'Poppins-Bold',
  },
  searchContainer: {
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  searchBar: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingHorizontal: 14,
    height: 44,
    borderRadius: 12,
    borderWidth: 1,
  },
  searchInput: {
    flex: 1,
    fontSize: 14,
    fontFamily: 'Urbanist-Medium',
    paddingVertical: 0,
  },
  segmentWrapper: {
    paddingHorizontal: 16,
    paddingBottom: 12,
  },
  segmentContainer: {
    flexDirection: 'row',
    borderRadius: 12,
    borderWidth: 1,
    padding: 3,
  },
  segmentItem: {
    flex: 1,
    paddingVertical: 8,
    alignItems: 'center',
    borderRadius: 9,
  },
  segmentText: {
    fontSize: 13,
    fontFamily: 'Urbanist-SemiBold',
  },
  segmentTextSelected: {
    fontFamily: 'Poppins-Bold',
  },
  listContent: {
    paddingHorizontal: 16,
    paddingBottom: 100,
  },
  separator: {
    height: 10,
  },
  userCard: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 14,
    borderRadius: 16,
    borderWidth: 1,
  },
  avatarCircle: {
    width: 48,
    height: 48,
    borderRadius: 24,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
    flexShrink: 0,
  },
  avatarImage: {
    width: '100%',
    height: '100%',
  },
  avatarInitials: {
    fontSize: 16,
    fontFamily: 'Poppins-Bold',
  },
  userCardInfo: {
    flex: 1,
    marginLeft: 12,
    minWidth: 0,
  },
  userCardNameRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 2,
  },
  userCardName: {
    fontSize: 15,
    fontFamily: 'Poppins-Bold',
    flexShrink: 1,
  },
  roleBadge: {
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 8,
    borderWidth: 1,
  },
  roleBadgeText: {
    fontSize: 9,
    fontFamily: 'Poppins-Bold',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  userCardEmail: {
    fontSize: 13,
    fontFamily: 'Urbanist-Regular',
    marginBottom: 4,
  },
  userCardMeta: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  statusDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    marginRight: 4,
  },
  statusText: {
    fontSize: 11,
    fontFamily: 'Urbanist-Medium',
  },
  metaDivider: {
    fontSize: 11,
  },
  chevron: {
    marginLeft: 8,
    flexShrink: 0,
  },
  emptyState: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingTop: 60,
    paddingHorizontal: 32,
  },
  emptyIconWrap: {
    width: 72,
    height: 72,
    borderRadius: 36,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 16,
  },
  emptyTitle: {
    fontSize: 18,
    fontFamily: 'Poppins-Bold',
    textAlign: 'center',
    marginBottom: 8,
  },
  emptySubtitle: {
    fontSize: 14,
    fontFamily: 'Urbanist-Regular',
    textAlign: 'center',
    lineHeight: 20,
  },
  loadingState: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingTop: 60,
  },
  loadingText: {
    fontSize: 14,
    fontFamily: 'Urbanist-Medium',
    marginTop: 16,
  },
  // Bottom Sheet styles
  sheetContent: {
    paddingHorizontal: 20,
    paddingBottom: 40,
  },
  sheetHeader: {
    alignItems: 'center',
    paddingVertical: 20,
  },
  sheetAvatar: {
    width: 80,
    height: 80,
    borderRadius: 40,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 12,
    overflow: 'hidden',
  },
  sheetAvatarImage: {
    width: '100%',
    height: '100%',
  },
  sheetAvatarText: {
    fontSize: 28,
    fontFamily: 'Poppins-Bold',
  },
  sheetName: {
    fontSize: 20,
    fontFamily: 'Poppins-Bold',
    marginBottom: 6,
  },
  sheetRoleBadge: {
    paddingHorizontal: 14,
    paddingVertical: 4,
    borderRadius: 12,
    borderWidth: 1,
    marginBottom: 6,
  },
  sheetRoleBadgeText: {
    fontSize: 11,
    fontFamily: 'Poppins-Bold',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  sheetStatusBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    paddingHorizontal: 10,
    paddingVertical: 3,
    borderRadius: 10,
  },
  sheetStatusDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
  },
  sheetStatusText: {
    fontSize: 11,
    fontFamily: 'Urbanist-SemiBold',
  },
  sheetSection: {
    borderRadius: 14,
    borderWidth: 1,
    overflow: 'hidden',
    marginBottom: 16,
  },
  detailRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 10,
    paddingHorizontal: 14,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: 'rgba(0,0,0,0.06)',
  },
  detailIcon: {
    width: 28,
    alignItems: 'center',
  },
  detailContent: {
    flex: 1,
    marginLeft: 10,
  },
  detailLabel: {
    fontSize: 10,
    fontFamily: 'Urbanist-Medium',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginBottom: 1,
  },
  detailValue: {
    fontSize: 14,
    fontFamily: 'Urbanist-Regular',
  },
  sheetActions: {
    gap: 8,
  },
  actionButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 14,
    paddingHorizontal: 16,
    borderRadius: 14,
    borderWidth: 1,
  },
  actionButtonDanger: {
    borderWidth: 1,
  },
  actionLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  actionText: {
    fontSize: 14,
    fontFamily: 'Urbanist-SemiBold',
  },
  rolePickerContainer: {
    borderRadius: 14,
    borderWidth: 1,
    padding: 8,
    marginBottom: 4,
  },
  roleOption: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 12,
    paddingHorizontal: 14,
    borderRadius: 10,
  },
  roleOptionText: {
    fontSize: 14,
    fontFamily: 'Urbanist-Medium',
  },
  roleOptionDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  confirmDeleteContainer: {
    borderRadius: 14,
    borderWidth: 1,
    padding: 16,
  },
  confirmDeleteText: {
    fontSize: 14,
    fontFamily: 'Urbanist-Medium',
    textAlign: 'center',
    marginBottom: 12,
  },
  confirmDeleteButtons: {
    flexDirection: 'row',
    gap: 10,
    justifyContent: 'center',
  },
  // Invite Sheet styles
  inviteHeader: {
    alignItems: 'center',
    paddingVertical: 20,
  },
  inviteIconWrap: {
    width: 56,
    height: 56,
    borderRadius: 28,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 12,
  },
  inviteTitle: {
    fontSize: 20,
    fontFamily: 'Poppins-Bold',
    marginBottom: 6,
  },
  inviteSubtitle: {
    fontSize: 14,
    fontFamily: 'Urbanist-Regular',
    textAlign: 'center',
  },
  inviteForm: {
    gap: 16,
    marginBottom: 20,
  },
  inputGroup: {},
  inputLabel: {
    fontSize: 12,
    fontFamily: 'Urbanist-SemiBold',
    marginBottom: 8,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  emailInput: {
    height: 48,
    borderRadius: 12,
    borderWidth: 1,
    paddingHorizontal: 14,
    fontSize: 15,
    fontFamily: 'Urbanist-Regular',
  },
  inputError: {
    fontSize: 12,
    fontFamily: 'Urbanist-Medium',
    marginTop: 5,
  },
  roleSelectorContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  roleChip: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 20,
    borderWidth: 1,
  },
  roleChipText: {
    fontSize: 13,
    fontFamily: 'Urbanist-SemiBold',
  },
  inviteActions: {
    gap: 8,
  },
  inviteButton: {
    width: '100%',
  },
});
