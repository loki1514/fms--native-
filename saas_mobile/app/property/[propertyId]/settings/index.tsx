import React from 'react';
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
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useTheme } from '@/context';
import { useAuth } from '@/hooks/useAuth';
import { Colors } from '@/constants/Colors';
import { createClient } from '@/utils/supabase/client';
import {
  User,
  Bell,
  ChevronRight,
  Shield,
  Building2,
  Palette,
  FileText,
  HelpCircle,
  LogOut,
} from 'lucide-react-native';
import { Ionicons } from '@expo/vector-icons';

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
  const { theme, toggleTheme } = useTheme();
  const { user, membership, signOut } = useAuth();
  const colors = Colors[theme];
  const insets = useSafeAreaInsets();

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
      onPress: () => router.push(`/property/${propertyId}/profile` as any),
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
      onPress: () => toggleTheme(),
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
      <View style={[styles.container, { backgroundColor: colors.background, paddingTop: insets.top }]}>
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={colors.primary} />
        </View>
      </View>
    );
  }

  return (
    <View style={[styles.container, { backgroundColor: colors.background, paddingTop: insets.top }]}>
      <StatusBar barStyle={theme === 'dark' ? 'light-content' : 'dark-content'} />
      
      {/* Header */}
      <View style={[styles.header, { backgroundColor: '#708F96' }]}>
        <View style={styles.headerTop}>
          <TouchableOpacity
            style={styles.backBtn}
            onPress={() => router.back()}
            activeOpacity={0.7}
          >
            <Ionicons name="chevron-back" size={24} color="#fff" />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>Settings</Text>
          <View style={{ width: 40 }} />
        </View>
        {/* User Avatar + Name */}
        <TouchableOpacity
          style={styles.headerUserRow}
          onPress={() => router.push(`/property/${propertyId}/profile`)}
          activeOpacity={0.7}
        >
          <View style={styles.headerAvatar}>
            {userProfile?.user_photo_url ? (
              <Image source={{ uri: userProfile.user_photo_url }} style={styles.headerAvatarImg} />
            ) : (
              <Text style={styles.headerAvatarText}>
                {userProfile?.full_name?.[0]?.toUpperCase() || user?.email?.[0]?.toUpperCase() || 'U'}
              </Text>
            )}
          </View>
          <View style={{ flex: 1, marginLeft: 12 }}>
            <Text style={styles.headerUserName} numberOfLines={1}>
              {userProfile?.full_name || 'User'}
            </Text>
            <Text style={styles.headerUserEmail} numberOfLines={1}>
              {userProfile?.email || user?.email || ''}
            </Text>
          </View>
          <Ionicons name="chevron-forward" size={20} color="rgba(255,255,255,0.6)" />
        </TouchableOpacity>
      </View>

      <ScrollView
        style={styles.content}
        showsVerticalScrollIndicator={false}
        refreshControl={<RefreshControl refreshing={isRefreshing} onRefresh={onRefresh} tintColor={colors.primary} />}
      >
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

      {/* Bottom Navigation */}
      <View style={[styles.bottomNav, {
        backgroundColor: colors.surface,
        borderTopColor: colors.border,
        paddingBottom: Math.max(insets.bottom, 12)
      }]}>
        <TouchableOpacity style={styles.navItem} onPress={() => router.push(`/property/${propertyId}/mst` as any)}>
          <View style={styles.navIconWrapper}>
            <Ionicons name="grid-outline" size={22} color={colors.textTertiary} />
          </View>
          <Text style={[styles.navText, { color: colors.textTertiary }]}>OVERVIEW</Text>
        </TouchableOpacity>

        <TouchableOpacity style={styles.navItem} onPress={() => router.push(`/property/${propertyId}/tickets` as any)}>
          <View style={styles.navIconWrapper}>
            <Ionicons name="ticket-outline" size={22} color={colors.textTertiary} />
          </View>
          <Text style={[styles.navText, { color: colors.textTertiary }]}>REQUESTS</Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={styles.navItemCenter}
          onPress={() => router.push(`/property/${propertyId}/mst` as any)}
        >
          <View style={[styles.centerFab, { backgroundColor: colors.primary }]}>
            <Ionicons name="add" size={32} color="#FFF" />
          </View>
        </TouchableOpacity>

        <TouchableOpacity style={styles.navItem} onPress={() => router.push(`/property/${propertyId}/electricity` as any)}>
          <View style={styles.navIconWrapper}>
            <Ionicons name="flash-outline" size={22} color={colors.textTertiary} />
          </View>
          <Text style={[styles.navText, { color: colors.textTertiary }]}>LOGGERS</Text>
        </TouchableOpacity>

        <TouchableOpacity style={styles.navItem} onPress={() => router.push(`/property/${propertyId}/settings`)}>
          <View style={[styles.navIconWrapper, { backgroundColor: theme === 'dark' ? 'rgba(112,143,150,0.12)' : 'rgba(112,143,150,0.08)' }]}>
            <Ionicons name="settings-outline" size={22} color={colors.primary} />
          </View>
          <Text style={[styles.navText, { color: colors.primary }]}>SETTINGS</Text>
        </TouchableOpacity>
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
    paddingBottom: 24,
  },
  headerTop: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 8,
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
    fontSize: 18,
    fontFamily: 'Poppins-Bold',
    color: '#fff',
  },
  headerSubtitle: {
    fontSize: 14,
    fontFamily: 'Urbanist-Regular',
    color: 'rgba(255,255,255,0.7)',
    marginTop: 4,
  },
  headerUserRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 16,
  },
  headerAvatar: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: 'rgba(255,255,255,0.25)',
    justifyContent: 'center',
    alignItems: 'center',
    overflow: 'hidden',
    borderWidth: 2,
    borderColor: 'rgba(255,255,255,0.4)',
  },
  headerAvatarImg: {
    width: 48,
    height: 48,
    borderRadius: 24,
  },
  headerAvatarText: {
    fontSize: 20,
    fontFamily: 'Poppins-Bold',
    color: '#fff',
  },
  headerUserName: {
    fontSize: 16,
    fontFamily: 'Poppins-Bold',
    color: '#fff',
  },
  headerUserEmail: {
    fontSize: 12,
    fontFamily: 'Urbanist-Regular',
    color: 'rgba(255,255,255,0.65)',
    marginTop: 2,
  },
  content: {
    flex: 1,
    paddingHorizontal: 16,
    paddingTop: 16,
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

  // Bottom Navigation
  bottomNav: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingTop: 12,
    borderTopWidth: 1,
  },
  navItem: {
    alignItems: 'center',
    justifyContent: 'center',
    width: 60,
  },
  navItemCenter: {
    alignItems: 'center',
    justifyContent: 'center',
    width: 60,
  },
  navIconWrapper: {
    width: 44,
    height: 32,
    borderRadius: 16,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 4,
  },
  centerFab: {
    width: 56,
    height: 56,
    borderRadius: 28,
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#3B82F6',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.3,
    shadowRadius: 12,
    elevation: 8,
  },
  navText: {
    fontSize: 10,
    fontFamily: 'Urbanist-Bold',
    letterSpacing: 0.3,
  },
});
