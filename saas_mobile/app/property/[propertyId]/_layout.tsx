'use client';
import React, { useState, useEffect, useMemo } from 'react';
import { Redirect, useLocalSearchParams, usePathname, useRouter, Slot } from 'expo-router';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  ActivityIndicator,
} from 'react-native';
import { useAuth } from '@/hooks/useAuth';
import { Colors } from '@/constants/Colors';
import { useTheme } from '@/context';
import {
  checkPropertyAccess,
  getRoleAllowedPaths,
  getRoleDefaultPath,
} from '@/utils/api/mobileApi';
import {
  LayoutDashboard,
  Ticket,
  Users,
  UserCheck,
  DoorOpen,
  Fuel,
  Zap,
  Package,
  CheckSquare,
  Wrench,
  ArrowUpCircle,
  FileText,
  Settings,
  LogOut,
  Plus,
  Scan,
  Moon,
  Sun,
} from 'lucide-react-native';
import { TenantTicketModal } from '@/components/tenant/TenantTicketModal';
import AnimatedLogo from '@/components/shared/AnimatedLogo';

// ---- Layout Constants ----
const SIDEBAR_WIDTH = 288;

// ---- Mobile-only roles (full-screen, no sidebar) ----
// Mirrors: tenant and super_tenant get the mobile glassmorphism dashboard
const MOBILE_ROLES = ['tenant', 'super_tenant'];

// ---- Property Context ----
export const PropertyContext = React.createContext<{
  propertyName: string;
  propertyRole: string | null;
  propertyCode?: string;
} | null>(null);

export function usePropertyContext() {
  const ctx = React.useContext(PropertyContext);
  if (!ctx) throw new Error('usePropertyContext must be used within PropertyLayout');
  return ctx;
}

// ---- Nav Item Types ----
type NavItem = {
  label: string;
  route: string;
  icon: React.ComponentType<{ size: number; color: string; strokeWidth?: number }>;
};

type NavSection = {
  title?: string;
  items: NavItem[];
  quickAction?: boolean;
};

// ---- Navigation Structure (exact match to web layout) ----
const NAV_SECTIONS: NavSection[] = [
  {
    title: 'Quick Actions',
    quickAction: true,
    items: [
      { label: 'New Request', route: '/new-request', icon: Plus },
      { label: 'Scanner', route: '/scanner', icon: Scan },
    ],
  },
  {
    title: 'Core Operations',
    items: [
      { label: 'Dashboard',      route: 'dashboard',   icon: LayoutDashboard },
      { label: 'Requests',       route: 'tickets',     icon: Ticket },
    ],
  },
  {
    title: 'Management Hub',
    items: [
      { label: 'User Management',     route: 'users',       icon: Users },
      { label: 'Visitor Management',  route: 'visitors',    icon: UserCheck },
      { label: 'Meeting Rooms',      route: 'rooms',       icon: DoorOpen },
      { label: 'Diesel Logger',      route: 'diesel',      icon: Fuel },
      { label: 'Electricity Logger',  route: 'electricity', icon: Zap },
      { label: 'Stock Management',   route: 'stock',      icon: Package },
      { label: 'Checklists',         route: 'checklist',   icon: CheckSquare },
      { label: 'PPM Calendar',       route: 'ppm',         icon: Wrench },
      { label: 'Escalation',         route: 'escalation',  icon: ArrowUpCircle },
    ],
  },
  {
    title: 'System',
    items: [
      { label: 'Reports',   route: 'reports',   icon: FileText },
      { label: 'Settings',  route: 'settings',  icon: Settings },
    ],
  },
];

// ---- Get User Initials ----
function getInitials(name: string): string {
  return (
    name
      .split(' ')
      .map((n) => n[0])
      .join('')
      .toUpperCase()
      .slice(0, 2) || 'U'
  );
}

// ---- Theme Toggle ----
function ThemeToggleButton() {
  const { theme, toggleTheme } = useTheme();
  const Icon = theme === 'dark' ? Sun : Moon;
  return (
    <TouchableOpacity
      style={styles.themeToggle}
      onPress={toggleTheme as () => void}
      activeOpacity={0.7}
    >
      <Icon size={16} color="#708F96" strokeWidth={1.5} />
    </TouchableOpacity>
  );
}

// ---- Sidebar Nav Item ----
function SidebarItem({
  item,
  isActive,
  onPress,
}: {
  item: NavItem;
  isActive: boolean;
  onPress: () => void;
}) {
  const Icon = item.icon;
  return (
    <TouchableOpacity
      style={[styles.navItem, isActive && styles.navItemActive]}
      onPress={() => {
        console.log('[SidebarItem] pressed:', item.label, item.route);
        onPress();
      }}
      activeOpacity={0.7}
    >
      <View style={styles.navItemInner}>
        {isActive && <View style={styles.activeIndicator} />}
        <Icon
          size={17}
          color={isActive ? '#FFFFFF' : 'rgba(26,35,50,0.6)'}
          strokeWidth={1.5}
        />
        <Text
          style={[
            styles.navItemLabel,
            { color: isActive ? '#FFFFFF' : 'rgba(26,35,50,0.75)' },
          ]}
        >
          {item.label}
        </Text>
      </View>
    </TouchableOpacity>
  );
}

// ---- Sidebar ----
function Sidebar({
  currentRoute,
  onNewRequest,
}: {
  currentRoute: string;
  onNewRequest: () => void;
}) {
  const { user, signOut } = useAuth();
  const { propertyId } = useLocalSearchParams<{ propertyId: string }>();
  const { theme } = useTheme();
  const router = useRouter();
  const handleNavigate = (route: string) => {
    console.log('[Sidebar] navigate:', route, 'propertyId:', propertyId);
    if (route.startsWith('/')) {
      if (route === '/new-request') {
        onNewRequest();
      }
      return;
    }
    const path = `/property/${propertyId}/${route}`;
    console.log('[Sidebar] pushing to:', path);
    router.push(path as never);
  };

  const isDark = theme === 'dark';
  const bgColor = isDark ? '#151B2B' : '#FFFFFF';
  const borderColor = isDark ? '#2D3748' : '#E2E8F0';
  const sectionTitleColor = isDark ? 'rgba(230,235,238,0.4)' : 'rgba(26,35,50,0.4)';
  const textPrimary = isDark ? '#F8FAFC' : '#1A2332';

  return (
    <View style={[styles.sidebar, { backgroundColor: bgColor, borderRightColor: borderColor }]}>
      {/* Logo Header */}
      <View style={styles.sidebarHeader}>
        <AnimatedLogo size="md" />
      </View>

      {/* Navigation */}
      <ScrollView
        style={{ flex: 1 }}
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{ paddingVertical: 8 }}
      >
        {NAV_SECTIONS.map((section, sectionIdx) => (
          <View key={section.title ?? `section-${sectionIdx}`}>
            {section.title ? (
              <View style={styles.sectionTitleRow}>
                <View style={styles.sectionAccent} />
                <Text style={[styles.sectionTitle, { color: sectionTitleColor }]}>
                  {section.title}
                </Text>
              </View>
            ) : null}

            {section.quickAction ? (
              <View style={styles.quickActionsGrid}>
                {section.items.map((item) => {
                  const Icon = item.icon;
                  return (
                    <TouchableOpacity
                      key={item.route}
                      style={[
                        styles.quickActionBtn,
                        {
                          backgroundColor: isDark ? 'rgba(255,255,255,0.04)' : '#F8FAFC',
                          borderColor: isDark ? 'rgba(255,255,255,0.08)' : '#E2E8F0',
                        },
                      ]}
                      onPress={() => handleNavigate(item.route)}
                      activeOpacity={0.7}
                    >
                      <View style={styles.quickActionIconWrap}>
                        <Icon size={20} color="#708F96" strokeWidth={1.5} />
                      </View>
                      <Text style={[styles.quickActionLabel, { color: textPrimary }]}>
                        {item.label.toUpperCase()}
                      </Text>
                    </TouchableOpacity>
                  );
                })}
              </View>
            ) : (
              section.items.map((item) => (
                <SidebarItem
                  key={item.route}
                  item={item}
                  isActive={
                    currentRoute === item.route ||
                    (item.route === 'dashboard' &&
                      (currentRoute === 'dashboard' || currentRoute === 'index'))
                  }
                  onPress={() => handleNavigate(item.route)}
                />
              ))
            )}
          </View>
        ))}
      </ScrollView>

      {/* Bottom */}
      <View style={[styles.sidebarBottom, { borderTopColor: borderColor }]}>
        <View
          style={[
            styles.userCard,
            {
              backgroundColor: isDark ? 'rgba(255,255,255,0.04)' : 'rgba(0,0,0,0.02)',
              borderColor: isDark ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.05)',
            },
          ]}
        >
          <View style={[styles.avatar, { backgroundColor: 'rgba(112,143,150,0.12)' }]}>
            <Text style={[styles.avatarText, { color: '#708F96' }]}>
              {getInitials(user?.full_name ?? user?.email ?? 'User')}
            </Text>
          </View>
          <View style={styles.userInfo}>
            <Text
              style={[styles.userName, { color: textPrimary }]}
              numberOfLines={1}
            >
              {user?.full_name || user?.email?.split('@')[0] || 'User'}
            </Text>
            <Text
              style={[styles.userRole, { color: sectionTitleColor }]}
              numberOfLines={1}
            >
              {user?.name ?? 'Staff'}
            </Text>
          </View>
        </View>

        <View style={styles.actionBtns}>
          <ThemeToggleButton />
          <TouchableOpacity
            style={styles.logoutBtn}
            onPress={async () => {
              await signOut();
            }}
            activeOpacity={0.7}
          >
            <LogOut size={15} color="#EF4444" strokeWidth={1.5} />
            <Text style={styles.logoutBtnText}>Logout</Text>
          </TouchableOpacity>
        </View>
      </View>
    </View>
  );
}

// ---- UUID validation helper ----
function isUuid(val: string): boolean {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(val);
}

// ---- Property Layout ----
// Mirrors: saas_development/app/property/[propertyId]/layout.tsx
// Key changes for mobile:
// - Uses direct Supabase checkPropertyAccess() instead of external HTTP call
// - Role path guards via getRoleAllowedPaths / getRoleDefaultPath
// - Skips sidebar for tenant / super_tenant (mobile full-screen glassmorphism dashboard)
// NOTE: Admin sidebar layout renders children directly — nested Stack conflicts with file-based routing
export default function PropertyLayout() {
  const router = useRouter();
  const { propertyId } = useLocalSearchParams<{ propertyId: string }>();
  const pathname = usePathname();
  const { user, isLoading: authLoading, membership } = useAuth();
  const { theme } = useTheme();
  const colors = Colors[theme];

  const [accessState, setAccessState] = useState<{
    authorized: boolean | null;
    role: string | null;
    checking: boolean;
  }>({ authorized: null, role: null, checking: true });

  const [ticketModalVisible, setTicketModalVisible] = useState(false);

  // ---- Access check via web API (mirrors GET /api/auth/property-access) ----
  // CRITICAL: membership is in deps — without it, the layout renders blank when
  // membership loads AFTER the initial effect run (a classic React async race condition).
  useEffect(() => {
    console.log('[PropertyLayout] Effect running — authLoading:', authLoading, 'user:', user?.email, 'propertyId:', propertyId, 'membership:', membership ? 'exists' : 'null');
    const checkAccess = async () => {
      if (authLoading) {
        console.log('[PropertyLayout] Skipping — auth still loading');
        return;
      }
      if (!user) {
        console.log('[PropertyLayout] No user — redirecting to login');
        router.replace('/login');
        return;
      }

      if (!propertyId || (!isUuid(propertyId) && propertyId !== 'all')) {
        console.log('[PropertyLayout] Invalid propertyId:', propertyId);
        setAccessState({ authorized: false, role: null, checking: false });
        return;
      }

      console.log('[PropertyLayout] Calling checkPropertyAccess for:', propertyId);
      try {
        const data = await checkPropertyAccess(propertyId);
        console.log('[PropertyLayout] checkPropertyAccess result:', JSON.stringify(data));

        if (!data.authorized) {
          // ---- DEFENSE-IN-DEPTH: checkPropertyAccess failed (may be RLS)
          // Try membership data as the fallback before declaring unauthorized.
          // This is the core fix for the blank-screen bug: when membership loaded
          // after the initial render, propMembership was null, role was "",
          // and isMobileRole was false → admin sidebar with blank Slot.
          console.log('[PropertyLayout] checkPropertyAccess unauthorized — checking membership fallback');
          const propMembership = membership?.properties?.find((p) => p.id === propertyId);
          const membershipRole = propMembership?.role ?? null;
          console.log('[PropertyLayout] Membership fallback — propMembership:', propMembership?.role ?? 'null', 'membershipRole:', membershipRole);

          if (membershipRole && MOBILE_ROLES.includes(membershipRole)) {
            console.log('[PropertyLayout] Authorized via membership fallback — role:', membershipRole);
            setAccessState({ authorized: true, role: membershipRole, checking: false });
            return;
          }
          if (membershipRole && !MOBILE_ROLES.includes(membershipRole)) {
            console.log('[PropertyLayout] Authorized via membership fallback (non-mobile) — role:', membershipRole);
            setAccessState({ authorized: true, role: membershipRole, checking: false });
            // Path guard for non-mobile roles
            const allowedPaths = getRoleAllowedPaths(membershipRole, propertyId);
            const isPathAllowed = allowedPaths.some(
              (allowed) => pathname.startsWith(allowed) || pathname === allowed
            );
            if (!isPathAllowed) {
              const defaultPath = getRoleDefaultPath(membershipRole, propertyId);
              console.log('[PropertyLayout] Path not allowed — redirecting to:', defaultPath);
              router.replace(defaultPath as never);
            }
            return;
          }

          console.log('[PropertyLayout] Membership fallback also denied — showing access denied');
          setAccessState({ authorized: false, role: null, checking: false });
          return;
        }

        const role = data.role ?? '';
        console.log('[PropertyLayout] Authorized, role:', role, 'isMobile:', MOBILE_ROLES.includes(role));
        setAccessState({ authorized: true, role, checking: false });

        // ---- Role path guards (exact match to web layout) ----
        if (!MOBILE_ROLES.includes(role)) {
          const allowedPaths = getRoleAllowedPaths(role, propertyId);
          const isPathAllowed = allowedPaths.some(
            (allowed) => pathname.startsWith(allowed) || pathname === allowed
          );

          if (!isPathAllowed) {
            const defaultPath = getRoleDefaultPath(role, propertyId);
            console.log('[PropertyLayout] Path not allowed — redirecting to:', defaultPath);
            router.replace(defaultPath as never);
          }
        }
      } catch (err) {
        console.error('[PropertyLayout] Access check failed:', err);
        setAccessState({ authorized: false, role: null, checking: false });
      }
    };

    checkAccess();
  }, [user, authLoading, propertyId, pathname, router, membership]);

  const propertyInfo = useMemo(() => {
    if (!membership?.properties)
      return { propertyName: '', propertyRole: null, propertyCode: undefined };
    const prop = membership.properties.find((p) => p.id === propertyId);
    console.log('[PropertyLayout] propertyInfo — membership properties:', JSON.stringify(membership.properties.map(p => ({ id: p.id, name: p.name, role: p.role }))), 'selected prop:', prop?.name ?? 'not found');
    return {
      propertyName: prop?.name ?? '',
      propertyRole: prop?.role ?? null,
      propertyCode: prop?.code,
    };
  }, [membership, propertyId]);

  const currentRoute = useMemo(() => {
    const parts = pathname.split('/').filter(Boolean);
    return parts[parts.length - 1] ?? 'dashboard';
  }, [pathname]);

  // Loading state
  // DEFENSE-IN-DEPTH: also guard against membership being null — this prevents
  // the blank-sidebar bug where membership loads after the initial access check.
  // In that gap, accessState.checking=false, authLoading=false, but membership=null.
  if (authLoading || accessState.checking || (user && !membership)) {
    console.log('[PropertyLayout] Loading — authLoading:', authLoading, 'accessChecking:', accessState.checking, 'membershipNull:', !membership);
    return (
      <View
        style={{
          flex: 1,
          justifyContent: 'center',
          alignItems: 'center',
          backgroundColor: colors.background,
        }}
      >
        <ActivityIndicator size="large" color={colors.primary} />
      </View>
    );
  }

  // Not authenticated
  if (!user) {
    return null;
  }

  // Resolve role: use access check result, or fall back to AuthContext membership data
  // (access check may fail on web due to RLS policies — membership data was already fetched during login)
  const propMembership = membership?.properties?.find((p) => p.id === propertyId);
  const membershipRole = propMembership?.role ?? null;

  // Determine final role: prefer checkPropertyAccess result, fallback to membership role
  const role = accessState.authorized === true
    ? (accessState.role ?? membershipRole ?? '')
    : (membershipRole ?? '');

  console.log('[PropertyLayout] Final role resolution:', {
    accessAuthorized: accessState.authorized,
    accessRole: accessState.role,
    membershipRole,
    finalRole: role,
    hasMembership: !!propMembership,
    membershipNull: membership === null,
    membershipPropertiesNull: membership?.properties == null,
    propertyId,
  });

  // Not authorized for this property (only show if we genuinely have no role and no membership)
  if (!role && accessState.authorized === false) {
    console.log('[PropertyLayout] Genuinely unauthorized — showing access denied');
    return (
      <View
        style={{
          flex: 1,
          justifyContent: 'center',
          alignItems: 'center',
          backgroundColor: '#f0f4f8',
          padding: 24,
        }}
      >
        <View style={styles.errorIcon}>
          <Text style={styles.errorIconText}>!</Text>
        </View>
        <Text style={styles.errorTitle}>Access Denied</Text>
        <Text style={styles.errorMessage}>
          You don't have permission to access this property. Contact your administrator.
        </Text>
      </View>
    );
  }

  console.log('[PropertyLayout] Access granted — role:', role);
  const isMobileRole = MOBILE_ROLES.includes(role);

  // ---- Tenant / Super Tenant: full-screen mobile UI, no sidebar ----
  // Renders the mobile glassmorphism dashboard (via tenant/index.tsx)
  console.log('[PropertyLayout] Render — role:', role, 'isMobile:', isMobileRole, 'membership:', membership ? 'exists' : 'null');
  if (isMobileRole) {
    console.log('[PropertyLayout] Mobile role — rendering children');
    return (
      <PropertyContext.Provider value={propertyInfo}>
        <Slot />
      </PropertyContext.Provider>
    );
  }

  // ---- All other roles: sidebar + stack navigator ----
  return (
    <PropertyContext.Provider value={propertyInfo}>
      <View style={styles.container}>
        {/* Persistent Sidebar */}
        <Sidebar
          currentRoute={currentRoute}
          onNewRequest={() => setTicketModalVisible(true)}
        />

        {/* Content — children render here via Expo Router file-based routing */}
        <View style={[styles.contentArea, { backgroundColor: colors.background }]}>
          <Slot />
        </View>

        {/* New Request — ticket modal with AI classification */}
        <TenantTicketModal
          visible={ticketModalVisible}
          propertyId={propertyId ?? ''}
          organizationId={membership?.org_id ?? ''}
          userId={user?.id ?? ''}
          userName={user?.full_name ?? user?.email ?? 'User'}
          propertyName={propertyInfo.propertyName}
          onClose={() => setTicketModalVisible(false)}
        />
      </View>
    </PropertyContext.Provider>
  );
}

// ---- Styles ----
const styles = StyleSheet.create({
  container: {
    flex: 1,
    flexDirection: 'row',
  },
  sidebar: {
    position: 'absolute',
    top: 0,
    left: 0,
    bottom: 0,
    width: SIDEBAR_WIDTH,
    borderRightWidth: 1,
    zIndex: 2,
  },
  contentArea: {
    flex: 1,
    marginLeft: SIDEBAR_WIDTH,
    zIndex: 1,
  },
  sidebarHeader: {
    paddingTop: 20,
    paddingHorizontal: 20,
    paddingBottom: 16,
    alignItems: 'flex-start',
  },
  logoRow: {},
  sectionTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 16,
    paddingTop: 16,
    paddingBottom: 6,
  },
  sectionAccent: {
    width: 4,
    height: 12,
    borderRadius: 2,
    backgroundColor: '#708F96',
  },
  sectionTitle: {
    fontFamily: 'Poppins-Bold',
    fontSize: 10,
    letterSpacing: 1,
    textTransform: 'uppercase',
  },
  quickActionsGrid: {
    flexDirection: 'row',
    paddingHorizontal: 16,
    gap: 8,
    paddingVertical: 4,
  },
  quickActionBtn: {
    flex: 1,
    alignItems: 'center',
    paddingVertical: 10,
    paddingHorizontal: 6,
    borderRadius: 10,
    borderWidth: 1,
    gap: 6,
  },
  quickActionIconWrap: {
    width: 32,
    height: 32,
    borderRadius: 10,
    backgroundColor: 'rgba(112,143,150,0.12)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  quickActionLabel: {
    fontFamily: 'Poppins-Bold',
    fontSize: 9,
    letterSpacing: 0.5,
    textTransform: 'uppercase',
    textAlign: 'center',
  },
  navItem: {
    marginHorizontal: 12,
    marginVertical: 1,
    borderRadius: 10,
    paddingVertical: 10,
    paddingHorizontal: 12,
    position: 'relative',
    overflow: 'hidden',
  },
  navItemActive: {
    backgroundColor: '#708F96',
  },
  navItemInner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  activeIndicator: {
    width: 4,
    height: 20,
    borderRadius: 4,
    backgroundColor: 'rgba(255,255,255,0.35)',
    position: 'absolute',
    left: -12,
  },
  navItemLabel: {
    fontFamily: 'Urbanist-Medium',
    fontSize: 14,
    letterSpacing: 0.1,
  },
  sidebarBottom: {
    borderTopWidth: 1,
    paddingHorizontal: 16,
    paddingVertical: 12,
    paddingBottom: 24,
  },
  userCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    borderRadius: 12,
    padding: 10,
    marginBottom: 8,
    borderWidth: 1,
  },
  avatar: {
    width: 36,
    height: 36,
    borderRadius: 18,
    justifyContent: 'center',
    alignItems: 'center',
    flexShrink: 0,
  },
  avatarText: {
    fontFamily: 'Poppins-Bold',
    fontSize: 13,
  },
  userInfo: {
    flex: 1,
    minWidth: 0,
  },
  userName: {
    fontFamily: 'Poppins-Medium',
    fontSize: 13,
    fontWeight: '600',
  },
  userRole: {
    fontFamily: 'Urbanist-Regular',
    fontSize: 11,
    marginTop: 1,
  },
  actionBtns: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  themeToggle: {
    width: 32,
    height: 32,
    borderRadius: 8,
    backgroundColor: 'rgba(112,143,150,0.08)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  logoutBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingVertical: 6,
    paddingHorizontal: 8,
  },
  logoutBtnText: {
    fontFamily: 'Urbanist-Medium',
    fontSize: 13,
    color: '#EF4444',
  },
  menuBtn: {
    width: 36,
    height: 36,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 4,
  },
  menuIcon: {
    gap: 4,
    justifyContent: 'center',
  },
  menuLine: {
    width: 18,
    height: 2,
    borderRadius: 1,
  },
  // Access denied styles
  errorIcon: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: 'rgba(239, 68, 68, 0.1)',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 20,
  },
  errorIconText: {
    fontSize: 28,
    fontWeight: '700',
    color: '#EF4444',
  },
  errorTitle: {
    fontSize: 22,
    fontWeight: '700',
    color: '#1a1a1a',
    marginBottom: 8,
    textAlign: 'center',
  },
  errorMessage: {
    fontSize: 14,
    color: '#666',
    textAlign: 'center',
    lineHeight: 20,
    maxWidth: 320,
  },
});
