import React from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  RefreshControl,
  ActivityIndicator,
  SafeAreaView,
  StatusBar,
  Image,
} from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useTheme } from '@/context';
import { useAuth } from '@/hooks/useAuth';
import { Colors } from '@/constants/Colors';
import { createClient } from '@/utils/supabase/client';
import {
  User,
  Settings,
  Bell,
  ChevronRight,
  Shield,
  Building2,
  Palette,
  FileText,
  HelpCircle,
  LogOut,
  Edit3,
} from 'lucide-react-native';

// Types
interface Property {
  id: string;
  name: string;
  code: string;
  address?: string;
}

interface UserProfile {
  id: string;
  full_name: string;
  email: string;
  user_photo_url?: string | null;
  role?: string;
  designation?: string;
}

export default function SettingsScreen() {
  const { propertyId } = useLocalSearchParams<{ propertyId: string }>();
  const router = useRouter();
  const { theme, setTheme } = useTheme();
  const { user, membership, signOut } = useAuth();
  const colors = Colors[theme];

  const [property, setProperty] = React.useState<Property | null>(null);
  const [userProfile, setUserProfile] = React.useState<UserProfile | null>(null);
  const [isLoading, setIsLoading] = React.useState(true);
  const [isRefreshing, setIsRefreshing] = React.useState(false);

  const supabase = React.useMemo(() => createClient(), []);

  const fetchData = React.useCallback(async () => {
    if (!propertyId || !user) return;
    try {
      // Fetch property details
      const { data: propData } = await supabase
        .from('properties')
        .select('id, name, code, address')
        .eq('id', propertyId)
        .maybeSingle();

      if (propData) {
        setProperty(propData as Property);
      }

      // Fetch user profile
      const { data: userData } = await supabase
        .from('users')
        .select('id, full_name, email, user_photo_url, role, designation')
        .eq('id', user.id)
        .maybeSingle();

      if (userData) {
        setUserProfile(userData as UserProfile);
      }
    } catch (error) {
      console.error('Error fetching settings data:', error);
    } finally {
      setIsLoading(false);
    }
  }, [propertyId, user, supabase]);

  React.useEffect(() => {
    fetchData();
  }, [fetchData]);

  const onRefresh = React.useCallback(async () => {
    setIsRefreshing(true);
    await fetchData();
    setIsRefreshing(false);
  }, [fetchData]);

  const handleSignOut = async () => {
    await signOut();
    router.replace('/(auth)/login');
  };

  const getRoleDisplay = () => {
    if (!membership || !propertyId) return 'Member';
    const prop = membership.properties.find((p) => p.id === propertyId);
    if (!prop) return 'Member';
    return prop.role.replace(/_/g, ' ').replace(/\b\w/g, (l) => l.toUpperCase());
  };

  const menuItems = [
    {
      icon: <User size={20} color={colors.primary} />,
      title: 'Profile',
      subtitle: userProfile?.full_name || 'View and edit profile',
      onPress: () => router.push(`/property/${propertyId}/profile`),
    },
    {
      icon: <Building2 size={20} color={colors.primary} />,
      title: 'Property',
      subtitle: property?.name || 'Manage property settings',
      onPress: () => {},
    },
    {
      icon: <Palette size={20} color={colors.primary} />,
      title: 'Appearance',
      subtitle: theme === 'dark' ? 'Dark mode' : 'Light mode',
      onPress: () => setTheme(theme === 'dark' ? 'light' : 'dark'),
      toggle: true,
      toggleValue: theme === 'dark',
    },
    {
      icon: <Bell size={20} color={colors.primary} />,
      title: 'Notifications',
      subtitle: 'Manage notification preferences',
      onPress: () => {},
    },
    {
      icon: <Shield size={20} color={colors.primary} />,
      title: 'Security',
      subtitle: 'Password and authentication',
      onPress: () => {},
    },
    {
      icon: <FileText size={20} color={colors.primary} />,
      title: 'Terms & Privacy',
      subtitle: 'Legal information',
      onPress: () => {},
    },
    {
      icon: <HelpCircle size={20} color={colors.primary} />,
      title: 'Help & Support',
      subtitle: 'Get assistance',
      onPress: () => {},
    },
  ];

  if (isLoading) {
    return (
      <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]} edges={['top']}>
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={colors.primary} />
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]} edges={['top']}>
      <StatusBar barStyle={theme === 'dark' ? 'light-content' : 'dark-content'} />
      
      {/* Header */}
      <View style={[styles.header, { backgroundColor: '#708F96' }]}>
        <View style={styles.headerContent}>
          <Text style={styles.headerTitle}>Settings</Text>
          <Text style={styles.headerSubtitle}>Manage your account and preferences</Text>
        </View>
      </View>

      <ScrollView
        style={styles.content}
        showsVerticalScrollIndicator={false}
        refreshControl={<RefreshControl refreshing={isRefreshing} onRefresh={onRefresh} tintColor={colors.primary} />}
      >
        {/* Profile Card */}
        <View style={[styles.profileCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
          <View style={styles.profileHeader}>
            <View style={[styles.avatarContainer, { backgroundColor: colors.primary + '20' }]}>
              {userProfile?.user_photo_url ? (
                <Image source={{ uri: userProfile.user_photo_url }} style={styles.avatarImage} />
              ) : (
                <Text style={[styles.avatarText, { color: colors.primary }]}>
                  {userProfile?.full_name?.[0]?.toUpperCase() || user?.email?.[0]?.toUpperCase() || 'U'}
                </Text>
              )}
            </View>
            <View style={styles.profileInfo}>
              <Text style={[styles.profileName, { color: colors.text }]} numberOfLines={1}>
                {userProfile?.full_name || 'User'}
              </Text>
              <Text style={[styles.profileEmail, { color: colors.textSecondary }]} numberOfLines={1}>
                {userProfile?.email || user?.email || 'No email'}
              </Text>
              <View style={[styles.roleBadge, { backgroundColor: colors.primary + '18' }]}>
                <Text style={[styles.roleText, { color: colors.primary }]}>{getRoleDisplay()}</Text>
              </View>
            </View>
          </View>

          <TouchableOpacity
            style={[styles.editProfileBtn, { backgroundColor: colors.primary }]}
            onPress={() => router.push(`/property/${propertyId}/profile`)}
          >
            <Edit3 size={14} color="#fff" />
            <Text style={styles.editProfileText}>Edit Profile</Text>
          </TouchableOpacity>
        </View>

        {/* Property Info */}
        {property && (
          <View style={[styles.sectionCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
            <Text style={[styles.sectionTitle, { color: colors.textSecondary }]}>PROPERTY</Text>
            <View style={styles.propertyRow}>
              <Building2 size={18} color={colors.primary} />
              <View style={styles.propertyInfo}>
                <Text style={[styles.propertyName, { color: colors.text }]} numberOfLines={1}>
                  {property.name}
                </Text>
                <Text style={[styles.propertyCode, { color: colors.textSecondary }]}>
                  {property.code}
                </Text>
              </View>
            </View>
          </View>
        )}

        {/* Menu Items */}
        <View style={[styles.sectionCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
          <Text style={[styles.sectionTitle, { color: colors.textSecondary }]}>PREFERENCES</Text>
          {menuItems.slice(2, 5).map((item, index) => (
            <TouchableOpacity
              key={item.title}
              style={[
                styles.menuItem,
                index !== 2 && { borderTopWidth: 1, borderTopColor: colors.border },
              ]}
              onPress={item.onPress}
            >
              <View style={styles.menuItemLeft}>
                <View style={[styles.menuIcon, { backgroundColor: colors.primary + '12' }]}>
                  {item.icon}
                </View>
                <View>
                  <Text style={[styles.menuTitle, { color: colors.text }]}>{item.title}</Text>
                  <Text style={[styles.menuSubtitle, { color: colors.textSecondary }]}>{item.subtitle}</Text>
                </View>
              </View>
              {item.toggle ? (
                <View style={[
                  styles.toggle,
                  { backgroundColor: item.toggleValue ? colors.primary : colors.border },
                ]}>
                  <View style={[
                    styles.toggleKnob,
                    { 
                      backgroundColor: '#fff',
                      transform: [{ translateX: item.toggleValue ? 16 : 0 }],
                    },
                  ]} />
                </View>
              ) : (
                <ChevronRight size={18} color={colors.textTertiary} />
              )}
            </TouchableOpacity>
          ))}
        </View>

        {/* Support Section */}
        <View style={[styles.sectionCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
          <Text style={[styles.sectionTitle, { color: colors.textSecondary }]}>SUPPORT</Text>
          {menuItems.slice(5).map((item, index) => (
            <TouchableOpacity
              key={item.title}
              style={[
                styles.menuItem,
                index !== 0 && { borderTopWidth: 1, borderTopColor: colors.border },
              ]}
              onPress={item.onPress}
            >
              <View style={styles.menuItemLeft}>
                <View style={[styles.menuIcon, { backgroundColor: colors.primary + '12' }]}>
                  {item.icon}
                </View>
                <View>
                  <Text style={[styles.menuTitle, { color: colors.text }]}>{item.title}</Text>
                  <Text style={[styles.menuSubtitle, { color: colors.textSecondary }]}>{item.subtitle}</Text>
                </View>
              </View>
              <ChevronRight size={18} color={colors.textTertiary} />
            </TouchableOpacity>
          ))}
        </View>

        {/* Sign Out */}
        <TouchableOpacity
          style={[styles.signOutBtn, { backgroundColor: colors.error + '12' }]}
          onPress={handleSignOut}
        >
          <LogOut size={18} color={colors.error} />
          <Text style={[styles.signOutText, { color: colors.error }]}>Sign Out</Text>
        </TouchableOpacity>

        <View style={styles.versionInfo}>
          <Text style={[styles.versionText, { color: colors.textTertiary }]}>FMS v1.0.0</Text>
        </View>

        <View style={{ height: 40 }} />
      </ScrollView>
    </SafeAreaView>
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
    paddingTop: 20,
    paddingBottom: 24,
  },
  headerContent: {},
  headerTitle: {
    fontSize: 28,
    fontFamily: 'Poppins-Bold',
    color: '#fff',
  },
  headerSubtitle: {
    fontSize: 14,
    fontFamily: 'Urbanist-Regular',
    color: 'rgba(255,255,255,0.7)',
    marginTop: 4,
  },
  content: {
    flex: 1,
    paddingHorizontal: 16,
    paddingTop: 16,
  },
  profileCard: {
    borderRadius: 16,
    borderWidth: 1,
    padding: 16,
    marginBottom: 16,
  },
  profileHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 16,
  },
  avatarContainer: {
    width: 64,
    height: 64,
    borderRadius: 32,
    justifyContent: 'center',
    alignItems: 'center',
    overflow: 'hidden',
  },
  avatarImage: {
    width: 64,
    height: 64,
    borderRadius: 32,
  },
  avatarText: {
    fontSize: 28,
    fontFamily: 'Poppins-Bold',
  },
  profileInfo: {
    flex: 1,
  },
  profileName: {
    fontSize: 18,
    fontFamily: 'Poppins-Bold',
  },
  profileEmail: {
    fontSize: 13,
    fontFamily: 'Urbanist-Regular',
    marginTop: 2,
  },
  roleBadge: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 12,
    alignSelf: 'flex-start',
    marginTop: 8,
  },
  roleText: {
    fontSize: 11,
    fontFamily: 'Urbanist-Bold',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  editProfileBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingVertical: 12,
    borderRadius: 12,
    marginTop: 16,
  },
  editProfileText: {
    fontSize: 14,
    fontFamily: 'Urbanist-Bold',
    color: '#fff',
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
    marginBottom: 12,
  },
  propertyRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  propertyInfo: {
    flex: 1,
  },
  propertyName: {
    fontSize: 15,
    fontFamily: 'Poppins-Bold',
  },
  propertyCode: {
    fontSize: 12,
    fontFamily: 'Urbanist-Regular',
    marginTop: 2,
  },
  menuItem: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 14,
  },
  menuItemLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  menuIcon: {
    width: 40,
    height: 40,
    borderRadius: 10,
    justifyContent: 'center',
    alignItems: 'center',
  },
  menuTitle: {
    fontSize: 15,
    fontFamily: 'Poppins-Bold',
  },
  menuSubtitle: {
    fontSize: 12,
    fontFamily: 'Urbanist-Regular',
    marginTop: 2,
  },
  toggle: {
    width: 48,
    height: 28,
    borderRadius: 14,
    padding: 2,
    justifyContent: 'center',
  },
  toggleKnob: {
    width: 24,
    height: 24,
    borderRadius: 12,
  },
  signOutBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingVertical: 16,
    borderRadius: 14,
    marginTop: 8,
  },
  signOutText: {
    fontSize: 16,
    fontFamily: 'Poppins-Bold',
  },
  versionInfo: {
    alignItems: 'center',
    marginTop: 24,
  },
  versionText: {
    fontSize: 12,
    fontFamily: 'Urbanist-Regular',
  },
});
