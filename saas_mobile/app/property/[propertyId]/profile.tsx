import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  RefreshControl,
  ActivityIndicator,
  StatusBar,
  Image,
  TextInput,
  Alert,
  Modal,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useTheme } from '@/context';
import { useAuth } from '@/hooks/useAuth';
import { Colors } from '@/constants/Colors';
import { createClient } from '@/utils/supabase/client';
import {
  ArrowLeft,
  Camera,
  Edit3,
  Save,
  X,
  Mail,
  Phone,
  Building2,
  Briefcase,
  MapPin,
  Shield,
  Calendar,
} from 'lucide-react-native';
import * as ImagePicker from 'expo-image-picker';

// Types
interface UserProfile {
  id: string;
  full_name: string;
  email: string;
  phone?: string;
  user_photo_url?: string | null;
  role?: string;
  designation?: string;
  department?: string;
  employee_id?: string;
  joining_date?: string;
  address?: string;
  city?: string;
  country?: string;
}

export default function ProfileScreen() {
  const { propertyId } = useLocalSearchParams<{ propertyId: string }>();
  const router = useRouter();
  const { theme } = useTheme();
  const { user, membership } = useAuth();
  const colors = Colors[theme];
  const insets = useSafeAreaInsets();

  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [showPhotoModal, setShowPhotoModal] = useState(false);
  
  // Edit form state
  const [editForm, setEditForm] = useState<Partial<UserProfile>>({});

  const supabase = React.useMemo(() => createClient(), []);

  const fetchProfile = useCallback(async () => {
    if (!user) return;
    try {
      const { data, error } = await supabase
        .from('users')
        .select('*')
        .eq('id', user.id)
        .maybeSingle();

      if (error) throw error;
      if (data) {
        setProfile(data as UserProfile);
        setEditForm(data as UserProfile);
      }
    } catch (error) {
      console.error('Error fetching profile:', error);
    } finally {
      setIsLoading(false);
    }
  }, [user, supabase]);

  useEffect(() => {
    fetchProfile();
  }, [fetchProfile]);

  const onRefresh = useCallback(async () => {
    setIsRefreshing(true);
    await fetchProfile();
    setIsRefreshing(false);
  }, [fetchProfile]);

  const handleSave = async () => {
    if (!profile) return;
    setIsSaving(true);
    try {
      const { error } = await (supabase
        .from('users') as any)
        .update({
          full_name: editForm.full_name,
          phone: editForm.phone,
          designation: editForm.designation,
          department: editForm.department,
          address: editForm.address,
          city: editForm.city,
          country: editForm.country,
        })
        .eq('id', profile.id);

      if (error) throw error;
      
      setProfile(prev => (prev ? { ...prev, ...editForm } : prev));
      setIsEditing(false);
      Alert.alert('Success', 'Profile updated successfully');
    } catch (error) {
      console.error('Error saving profile:', error);
      Alert.alert('Error', 'Failed to update profile');
    } finally {
      setIsSaving(false);
    }
  };

  const handlePhotoCapture = async () => {
    const { status } = await ImagePicker.requestCameraPermissionsAsync();
    if (status !== 'granted') {
      Alert.alert('Permission required', 'Camera access is needed to capture photos');
      return;
    }
    
    const result = await ImagePicker.launchCameraAsync({
      mediaTypes: ['images'],
      quality: 0.7,
      allowsEditing: true,
      aspect: [1, 1],
    });

    if (!result.canceled && result.assets[0]) {
      const uri = result.assets[0].uri;
      try {
        const uriParts = uri.split('.');
        const ext = uriParts[uriParts.length - 1] || 'jpg';
        const filename = `${profile?.id}/${Date.now()}.${ext}`;
        const response = await fetch(uri);
        const blob = await response.blob();

        const { error: uploadError } = await supabase.storage
          .from('avatars')
          .upload(filename, blob, { contentType: 'image/jpeg' });

        if (uploadError) throw uploadError;

        const { data: urlData } = supabase.storage
          .from('avatars')
          .getPublicUrl(filename);

        const publicUrl = urlData.publicUrl;
        await (supabase.from('users') as any).update({ user_photo_url: publicUrl }).eq('id', profile?.id);

        setProfile(prev => (prev ? { ...prev, user_photo_url: publicUrl } : prev));
      } catch (error) {
        console.error('Error uploading photo:', error);
        Alert.alert('Error', 'Failed to upload photo');
      }
    }
    setShowPhotoModal(false);
  };

  const handlePhotoPick = async () => {
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images'],
      quality: 0.7,
      allowsEditing: true,
      aspect: [1, 1],
    });

    if (!result.canceled && result.assets[0]) {
      const uri = result.assets[0].uri;
      try {
        const uriParts = uri.split('.');
        const ext = uriParts[uriParts.length - 1] || 'jpg';
        const filename = `${profile?.id}/${Date.now()}.${ext}`;
        const response = await fetch(uri);
        const blob = await response.blob();

        const { error: uploadError } = await supabase.storage
          .from('avatars')
          .upload(filename, blob, { contentType: 'image/jpeg' });

        if (uploadError) throw uploadError;

        const { data: urlData } = supabase.storage
          .from('avatars')
          .getPublicUrl(filename);

        const publicUrl = urlData.publicUrl;
        await (supabase.from('users') as any).update({ user_photo_url: publicUrl }).eq('id', profile?.id);

        setProfile(prev => (prev ? { ...prev, user_photo_url: publicUrl } : prev));
      } catch (error) {
        console.error('Error uploading photo:', error);
        Alert.alert('Error', 'Failed to upload photo');
      }
    }
    setShowPhotoModal(false);
  };

  const getRoleDisplay = () => {
    if (!membership || !propertyId) return 'Member';
    const prop = membership.properties.find((p) => p.id === propertyId);
    if (!prop) return 'Member';
    return prop.role.replace(/_/g, ' ').replace(/\b\w/g, (l) => l.toUpperCase());
  };

  const getInitials = () => {
    return profile?.full_name?.[0]?.toUpperCase() || 
           profile?.email?.[0]?.toUpperCase() || 
           user?.email?.[0]?.toUpperCase() || 
           'U';
  };

  if (isLoading) {
    return (
      <View style={[styles.container, { backgroundColor: colors.background, paddingTop: insets.top, paddingBottom: insets.bottom }]}>
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={colors.primary} />
        </View>
      </View>
    );
  }

  return (
    <View style={[styles.container, { backgroundColor: colors.background, paddingTop: insets.top, paddingBottom: insets.bottom }]}>
      <StatusBar barStyle={theme === 'dark' ? 'light-content' : 'dark-content'} />
      
      {/* Header */}
      <View style={[styles.header, { backgroundColor: '#708F96' }]}>
        <View style={styles.headerTop}>
          <TouchableOpacity 
            style={styles.backBtn}
            onPress={() => router.back()}
          >
            <ArrowLeft size={24} color="#fff" />
          </TouchableOpacity>
          
          <Text style={styles.headerTitle}>Profile</Text>
          
          <TouchableOpacity
            style={styles.editBtn}
            onPress={() => isEditing ? handleSave() : setIsEditing(true)}
          >
            {isEditing ? (
              isSaving ? (
                <ActivityIndicator size="small" color="#fff" />
              ) : (
                <Save size={20} color="#fff" />
              )
            ) : (
              <Edit3 size={20} color="#fff" />
            )}
          </TouchableOpacity>
        </View>
      </View>

      <ScrollView
        style={styles.content}
        showsVerticalScrollIndicator={false}
        refreshControl={<RefreshControl refreshing={isRefreshing} onRefresh={onRefresh} tintColor={colors.primary} />}
      >
        {/* Profile Photo Section */}
        <View style={styles.photoSection}>
          <View style={styles.photoContainer}>
            {profile?.user_photo_url ? (
              <Image source={{ uri: profile.user_photo_url }} style={styles.profilePhoto} />
            ) : (
              <View style={[styles.photoPlaceholder, { backgroundColor: colors.primary + '20' }]}>
                <Text style={[styles.photoPlaceholderText, { color: colors.primary }]}>{getInitials()}</Text>
              </View>
            )}
            
            <TouchableOpacity
              style={[styles.cameraBtn, { backgroundColor: colors.primary }]}
              onPress={() => setShowPhotoModal(true)}
            >
              <Camera size={16} color="#fff" />
            </TouchableOpacity>
          </View>
          
          {!isEditing ? (
            <>
              <Text style={[styles.name, { color: colors.text }]}>{profile?.full_name || 'User'}</Text>
              <Text style={[styles.email, { color: colors.textSecondary }]} numberOfLines={1}>
                {profile?.email || user?.email}
              </Text>
              <View style={[styles.roleBadge, { backgroundColor: colors.primary + '18' }]}>
                <Text style={[styles.roleText, { color: colors.primary }]}>{getRoleDisplay()}</Text>
              </View>
            </>
          ) : null}
        </View>

        {/* Basic Information */}
        <View style={[styles.sectionCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
          <Text style={[styles.sectionTitle, { color: colors.textSecondary }]}>BASIC INFORMATION</Text>
          
          {isEditing ? (
            <View style={styles.editFields}>
              <View style={styles.fieldGroup}>
                <Text style={[styles.fieldLabel, { color: colors.textSecondary }]} numberOfLines={1}>Full Name</Text>
                <TextInput
                  style={[styles.input, { backgroundColor: colors.surface, borderColor: colors.border, color: colors.text }]}
                  value={editForm.full_name || ''}
                  onChangeText={(text) => setEditForm(prev => ({ ...prev, full_name: text }))}
                  placeholder="Enter full name"
                  placeholderTextColor={colors.textTertiary}
                />
              </View>
              
              <View style={styles.fieldGroup}>
                <Text style={[styles.fieldLabel, { color: colors.textSecondary }]} numberOfLines={1}>Phone</Text>
                <TextInput
                  style={[styles.input, { backgroundColor: colors.surface, borderColor: colors.border, color: colors.text }]}
                  value={editForm.phone || ''}
                  onChangeText={(text) => setEditForm(prev => ({ ...prev, phone: text }))}
                  placeholder="Enter phone number"
                  placeholderTextColor={colors.textTertiary}
                  keyboardType="phone-pad"
                />
              </View>
              
              <View style={styles.fieldGroup}>
                <Text style={[styles.fieldLabel, { color: colors.textSecondary }]} numberOfLines={1}>Designation</Text>
                <TextInput
                  style={[styles.input, { backgroundColor: colors.surface, borderColor: colors.border, color: colors.text }]}
                  value={editForm.designation || ''}
                  onChangeText={(text) => setEditForm(prev => ({ ...prev, designation: text }))}
                  placeholder="Enter designation"
                  placeholderTextColor={colors.textTertiary}
                />
              </View>
              
              <View style={styles.fieldGroup}>
                <Text style={[styles.fieldLabel, { color: colors.textSecondary }]} numberOfLines={1}>Department</Text>
                <TextInput
                  style={[styles.input, { backgroundColor: colors.surface, borderColor: colors.border, color: colors.text }]}
                  value={editForm.department || ''}
                  onChangeText={(text) => setEditForm(prev => ({ ...prev, department: text }))}
                  placeholder="Enter department"
                  placeholderTextColor={colors.textTertiary}
                />
              </View>
            </View>
          ) : (
            <View style={styles.infoList}>
              <InfoItem 
                icon={<Mail size={18} color={colors.primary} />}
                label="Email"
                value={profile?.email || 'Not set'}
              />
              
              <InfoItem 
                icon={<Phone size={18} color={colors.primary} />}
                label="Phone"
                value={profile?.phone || 'Not set'}
              />
              
              <InfoItem 
                icon={<Briefcase size={18} color={colors.primary} />}
                label="Designation"
                value={profile?.designation || 'Not set'}
              />
              
              <InfoItem 
                icon={<Building2 size={18} color={colors.primary} />}
                label="Department"
                value={profile?.department || 'Not set'}
              />
            </View>
          )}
        </View>

        {/* Address Information */}
        {!isEditing && (
          <View style={[styles.sectionCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
            <Text style={[styles.sectionTitle, { color: colors.textSecondary }]}>ADDRESS</Text>
            
            <View style={styles.infoList}>
              <InfoItem 
                icon={<MapPin size={18} color={colors.primary} />}
                label="Address"
                value={profile?.address || 'Not set'}
              />
              
              <InfoItem 
                icon={<Building2 size={18} color={colors.primary} />}
                label="City"
                value={profile?.city || 'Not set'}
              />
              
              <InfoItem 
                icon={<Shield size={18} color={colors.primary} />}
                label="Country"
                value={profile?.country || 'Not set'}
              />
            </View>
          </View>
        )}

        {/* Account Information */}
        <View style={[styles.sectionCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
          <Text style={[styles.sectionTitle, { color: colors.textSecondary }]}>ACCOUNT</Text>
          
          <View style={styles.infoList}>
            <InfoItem 
              icon={<Shield size={18} color={colors.primary} />}
              label="Employee ID"
              value={profile?.employee_id || 'Not assigned'}
            />
            
            <InfoItem 
              icon={<Calendar size={18} color={colors.primary} />}
              label="Joining Date"
              value={profile?.joining_date 
                ? new Date(profile.joining_date).toLocaleDateString('en-US', { 
                    year: 'numeric', 
                    month: 'long', 
                    day: 'numeric' 
                  })
                : 'Not set'}
            />
          </View>
        </View>

        <View style={{ height: 40 }} />
      </ScrollView>

      {/* Photo Modal */}
      <Modal
        visible={showPhotoModal}
        transparent
        animationType="fade"
        onRequestClose={() => setShowPhotoModal(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={[styles.modalContent, { backgroundColor: colors.card }]}>
            <View style={styles.modalHeader}>
              <Text style={[styles.modalTitle, { color: colors.text }]} numberOfLines={1}>Update Photo</Text>
              <TouchableOpacity onPress={() => setShowPhotoModal(false)}>
                <X size={24} color={colors.textSecondary} />
              </TouchableOpacity>
            </View>
            
            <TouchableOpacity
              style={[styles.modalOption, { borderBottomWidth: 1, borderBottomColor: colors.border }]}
              onPress={handlePhotoCapture}
            >
              <Camera size={24} color={colors.primary} />
              <Text style={[styles.modalOptionText, { color: colors.text }]} numberOfLines={1}>Take Photo</Text>
            </TouchableOpacity>
            
            <TouchableOpacity
              style={styles.modalOption}
              onPress={handlePhotoPick}
            >
              <Mail size={24} color={colors.primary} />
              <Text style={[styles.modalOptionText, { color: colors.text }]} numberOfLines={1}>Choose from Library</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
    </View>
  );
}

// Info Item Component
function InfoItem({ icon, label, value }: { icon: React.ReactNode; label: string; value: string }) {
  const { theme } = useTheme();
  const colors = Colors[theme];
  const insets = useSafeAreaInsets();
  
  return (
    <View style={styles.infoItem}>
      <View style={[styles.infoIcon, { backgroundColor: colors.primary + '12' }]}>
        {icon}
      </View>
      <View style={styles.infoContent}>
        <Text style={[styles.infoLabel, { color: colors.textSecondary }]} numberOfLines={1}>{label}</Text>
        <Text style={[styles.infoValue, { color: colors.text }]} numberOfLines={1}>{value}</Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  header: {
    paddingHorizontal: 20,
    paddingTop: 16,
    paddingBottom: 20,
  },
  headerTop: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  backBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: 'rgba(255,255,255,0.15)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  headerTitle: {
    fontSize: 20,
    fontFamily: 'Poppins-Bold',
    color: '#fff',
  },
  editBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: 'rgba(255,255,255,0.15)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  content: {
    flex: 1,
    paddingHorizontal: 16,
  },
  photoSection: {
    alignItems: 'center',
    paddingVertical: 24,
  },
  photoContainer: {
    position: 'relative',
    marginBottom: 16,
  },
  profilePhoto: {
    width: 120,
    height: 120,
    borderRadius: 60,
  },
  photoPlaceholder: {
    width: 120,
    height: 120,
    borderRadius: 60,
    justifyContent: 'center',
    alignItems: 'center',
  },
  photoPlaceholderText: {
    fontSize: 48,
    fontFamily: 'Poppins-Bold',
  },
  cameraBtn: {
    position: 'absolute',
    bottom: 0,
    right: 0,
    width: 36,
    height: 36,
    borderRadius: 18,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 3,
    borderColor: '#fff',
  },
  name: {
    fontSize: 24,
    fontFamily: 'Poppins-Bold',
  },
  email: {
    fontSize: 14,
    fontFamily: 'Urbanist-Regular',
    marginTop: 4,
  },
  roleBadge: {
    paddingHorizontal: 14,
    paddingVertical: 6,
    borderRadius: 16,
    marginTop: 12,
  },
  roleText: {
    fontSize: 12,
    fontFamily: 'Urbanist-Bold',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  sectionCard: {
    borderRadius: 16,
    borderWidth: 1,
    padding: 16,
    marginBottom: 16,
  },
  sectionTitle: {
    fontSize: 11,
    fontFamily: 'Urbanist-Bold',
    letterSpacing: 1,
    marginBottom: 16,
  },
  editFields: {
    gap: 16,
  },
  fieldGroup: {
    gap: 6,
  },
  fieldLabel: {
    fontSize: 12,
    fontFamily: 'Urbanist-Bold',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  input: {
    borderRadius: 10,
    borderWidth: 1,
    paddingHorizontal: 14,
    paddingVertical: 12,
    fontSize: 15,
    fontFamily: 'Urbanist-Regular',
  },
  infoList: {
    gap: 16,
  },
  infoItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  infoIcon: {
    width: 40,
    height: 40,
    borderRadius: 10,
    justifyContent: 'center',
    alignItems: 'center',
  },
  infoContent: {
    flex: 1,
  },
  infoLabel: {
    fontSize: 12,
    fontFamily: 'Urbanist-Bold',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  infoValue: {
    fontSize: 15,
    fontFamily: 'Urbanist-Regular',
    marginTop: 2,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'flex-end',
  },
  modalContent: {
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    padding: 20,
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 20,
  },
  modalTitle: {
    fontSize: 18,
    fontFamily: 'Poppins-Bold',
  },
  modalOption: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 16,
    paddingVertical: 16,
  },
  modalOptionText: {
    fontSize: 16,
    fontFamily: 'Urbanist-Medium',
  },
});
