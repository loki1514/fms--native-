'use client';
import React, { useState, useEffect, useMemo } from 'react';
import { useLocalSearchParams, usePathname, useRouter, Slot } from 'expo-router';
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
import { CAPABILITY_MATRIX } from '@/constants/capabilities';
import { CapabilityDomain } from '@/types/rbac';
import {
  LayoutDashboard,
  Ticket,
  Users,
  UserCheck,
  DoorOpen,
  Fuel,
  Zap,
  Package,
  ArrowUpCircle,
  FileText,
  Settings,
  LogOut,
  Plus,
  Scan,
  Moon,
  Sun,
} from 'lucide-react-native';
import { Ionicons } from '@expo/vector-icons';
import { TenantTicketModal } from '@/components/tenant/TenantTicketModal';
import AnimatedLogo from '@/components/shared/AnimatedLogo';
import NotificationBell from '@/components/dashboard/NotificationBell';

// ---- Layout Constants ----
const SIDEBAR_WIDTH = 288;

// ---- Mobile-only roles (full-screen, no sidebar) ----
// DEPRECATED: All roles now use the unified sidebar layout with capability-based filtering.
const MOBILE_ROLES: string[] = [];

// ---- Roles that render their own full-screen dashboard with internal sidebar ----
// DEPRECATED: All roles now use the unified sidebar layout with capability-based filtering.
const FULL_DASHBOARD_ROLES: string[] = [];

// ---- Full-screen routes for full-dashboard roles (no sidebar) ----
const FULL_SCREEN_ROUTES = [
  'mst', 'maintenance_staff', 'staff', 'soft_service_staff', 'soft_service_supervisor', 'soft_service_manager', 
  'property_admin', 'lovable-admin', 'lovable-super-admin', 'lovable-mst', 'settings', 'profile'
];

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
  domain?: CapabilityDomain;
};

// ---- Navigation Structure (matches web sidebar) ----
// Each item maps to a capability domain so we can filter by role permissions.
const NAV_ITEMS: NavItem[] = [
  { label: 'Dashboard',       route: 'dashboard',    icon: LayoutDashboard, domain: 'dashboards' },
  { label: 'Requests',        route: 'tickets',      icon: Ticket,          domain: 'tickets' },
  { label: 'Flow Map',        route: 'flow-map',     icon: ArrowUpCircle,   domain: 'tickets' },
  { label: 'User Management', route: 'users',        icon: Users,           domain: 'users' },
  { label: 'Visitors',        route: 'visitors',     icon: UserCheck,       domain: 'visitors' },
  { label: 'Rooms',           route: 'rooms',        icon: DoorOpen,        domain: 'properties' },
  { label: 'Diesel',          route: 'diesel',       icon: Fuel,            domain: 'assets' },
  { label: 'Electricity',     route: 'electricity',  icon: Zap,             domain: 'assets' },
  { label: 'Stock',           route: 'stock',        icon: Package,         domain: 'stock' },
  { label: 'Reports',         route: 'reports',      icon: FileText,        domain: 'reports' },
  { label: 'Settings',        route: 'settings',     icon: Settings },
];

const QUICK_ACTIONS: NavItem[] = [
  { label: 'New Request', route: '/new-request', icon: Plus },
  { label: 'Scanner',     route: '/scanner',    icon: Scan },
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
  collapsed,
  isDark,
}: {
  item: NavItem;
  isActive: boolean;
  onPress: () => void;
  collapsed: boolean;
  isDark: boolean;
}) {
  const Icon = item.icon;
  const primary = '#708F96';

  if (collapsed) {
    // Icon-only mode: small centered teal dot on active
    return (
      <TouchableOpacity
        style={[styles.navItemCollapsed, isActive && styles.navItemCollapsedActive]}
        onPress={onPress}
        activeOpacity={0.7}
      >
        <View style={styles.navItemIconCentered}>
          <Icon
            size={18}
            color={isActive ? primary : (isDark ? 'rgba(230,235,238,0.45)' : 'rgba(26,35,50,0.45)')}
            strokeWidth={1.5}
          />
        </View>
      </TouchableOpacity>
    );
  }

  return (
    <TouchableOpacity
      style={[
        styles.navItem,
        isActive && {
          backgroundColor: primary,
          shadowColor: primary,
          shadowOffset: { width: 0, height: 2 },
          shadowOpacity: 0.35,
          shadowRadius: 6,
          elevation: 3,
        },
      ]}
      onPress={onPress}
      activeOpacity={0.7}
    >
      <View style={styles.navItemInner}>
        <Icon
          size={17}
          color={isActive ? '#FFFFFF' : (isDark ? 'rgba(230,235,238,0.6)' : 'rgba(26,35,50,0.6)')}
          strokeWidth={1.5}
        />
        <Text
          style={[
            styles.navItemLabel,
            { color: isActive ? '#FFFFFF' : (isDark ? 'rgba(230,235,238,0.75)' : 'rgba(26,35,50,0.75)') },
          ]}
        >
          {item.label}
        </Text>
      </View>
    </TouchableOpacity>
  );
}

// ---- Sidebar ----
/**
 * Filter nav items by role capabilities (mirrors saas_one CapabilityWrapper logic).
 * Settings is always visible (no domain = unrestricted).
 */
function getFilteredNavItems(role: string): NavItem[] {
  const capabilities = CAPABILITY_MATRIX[role as keyof typeof CAPABILITY_MATRIX] || {};
  return NAV_ITEMS.filter((item) => {
    if (!item.domain) return true; // Settings etc.
    return capabilities[item.domain]?.includes('view');
  });
}

function Sidebar({
  currentRoute,
  onNewRequest,
  collapsed,
  onToggle,
  role,
}: {
  currentRoute: string;
  onNewRequest: () => void;
  collapsed: boolean;
  onToggle: () => void;
  role: string;
}) {
  const { user, signOut } = useAuth();
  const { propertyId } = useLocalSearchParams<{ propertyId: string }>();
  const { theme } = useTheme();
  const router = useRouter();

  const handleNavigate = (route: string) => {
    if (route.startsWith('/')) {
      if (route === '/new-request') {
        onNewRequest();
      }
      return;
    }
    router.push(`/property/${propertyId}/${route}` as never);
  };

  const isDark = theme === 'dark';
  const bgColor = isDark ? '#151B2B' : '#FFFFFF';
  const borderColor = isDark ? '#2D3748' : '#E2E8F0';
  const textPrimary = isDark ? '#F8FAFC' : '#1A2332';
  const textSecondary = isDark ? 'rgba(230,235,238,0.5)' : 'rgba(26,35,50,0.5)';

  // Collapsed width
  const currentW = collapsed ? 72 : 288;

  return (
    <View style={[styles.sidebar, {
      backgroundColor: bgColor,
      borderRightColor: borderColor,
      width: currentW,
    }]}>
      {/* Header: Logo + collapse toggle — web-matched styling */}
      <View style={styles.sidebarHeader}>
        {!collapsed ? (
          <View style={styles.logoSection}>
            <AnimatedLogo size="lg" />
            {/* Staff Dashboard badge */}
            <View style={[styles.staffBadge, {
              backgroundColor: isDark ? 'rgba(112,143,150,0.1)' : 'rgba(112,143,150,0.06)',
              borderColor: isDark ? 'rgba(112,143,150,0.15)' : 'rgba(112,143,150,0.1)',
            }]}>
              <Text style={[styles.staffBadgeText, { color: '#708F96' }]}>STAFF DASHBOARD</Text>
            </View>
          </View>
        ) : (
          <AnimatedLogo size="md" />
        )}

        {/* Notification Bell + Collapse toggle */}
        <View style={styles.headerActions}>
          <NotificationBell />
          <TouchableOpacity
            style={[styles.collapseBtn, { backgroundColor: isDark ? 'rgba(255,255,255,0.06)' : '#F1F5F9' }]}
            onPress={onToggle}
            activeOpacity={0.7}
          >
            <Ionicons
              name={collapsed ? 'menu-outline' : 'chevron-back-outline'}
              size={collapsed ? 20 : 16}
              color={isDark ? 'rgba(230,235,238,0.6)' : '#64748B'}
            />
          </TouchableOpacity>
        </View>
      </View>

      {/* Quick Actions row */}
      <View style={[styles.quickActionsRow, {
        borderBottomColor: borderColor,
        paddingHorizontal: collapsed ? 12 : 14,
      }]}>
        {QUICK_ACTIONS.map((item) => {
          const Icon = item.icon;
          return (
            <TouchableOpacity
              key={item.route}
              style={[styles.quickActionChip, {
                backgroundColor: isDark ? 'rgba(112,143,150,0.08)' : 'rgba(112,143,150,0.06)',
                borderColor: isDark ? 'rgba(112,143,150,0.12)' : 'rgba(112,143,150,0.1)',
                paddingHorizontal: collapsed ? 10 : 12,
              }]}
              onPress={() => handleNavigate(item.route)}
              activeOpacity={0.7}
            >
              <Icon size={14} color="#708F96" strokeWidth={1.5} />
              {!collapsed && (
                <Text style={[styles.quickActionChipLabel, { color: textPrimary }]}>
                  {item.label.toUpperCase()}
                </Text>
              )}
            </TouchableOpacity>
          );
        })}
      </View>

      {/* Navigation */}
      <ScrollView
        style={{ flex: 1 }}
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{ paddingVertical: 6, paddingHorizontal: collapsed ? 10 : 12 }}
      >
        {!collapsed && (
          <Text style={[styles.navSectionLabel, { color: textSecondary }]}>MANAGEMENT</Text>
        )}
        {getFilteredNavItems(role).map((item) => (
          <SidebarItem
            key={item.route}
            item={item}
            isActive={
              currentRoute === item.route ||
              (item.route === 'dashboard' &&
                (currentRoute === 'dashboard' || currentRoute === 'index'))
            }
            onPress={() => handleNavigate(item.route)}
            collapsed={collapsed}
            isDark={isDark}
          />
        ))}
      </ScrollView>

      {/* Bottom: User card + actions */}
      <View style={[styles.sidebarBottom, {
        borderTopColor: borderColor,
        backgroundColor: isDark ? 'rgba(255,255,255,0.02)' : 'rgba(0,0,0,0.01)',
      }]}>
        {/* User card */}
        <View style={[styles.userCard, {
          backgroundColor: isDark ? 'rgba(255,255,255,0.04)' : 'rgba(0,0,0,0.02)',
          borderColor: isDark ? 'rgba(255,255,255,0.07)' : 'rgba(0,0,0,0.05)',
        }]}>
          <View style={[styles.avatar, { backgroundColor: 'rgba(112,143,150,0.12)' }]}>
            <Text style={[styles.avatarText, { color: '#708F96' }]}>
              {getInitials(user?.full_name ?? user?.email ?? 'User')}
            </Text>
          </View>
          {!collapsed && (
            <View style={styles.userInfo}>
              <Text style={[styles.userName, { color: textPrimary }]} numberOfLines={1}>
                {user?.full_name || user?.email?.split('@')[0] || 'User'}
              </Text>
              <Text style={[styles.userRole, { color: textSecondary }]} numberOfLines={1}>
                {user?.name ?? 'Staff'}
              </Text>
            </View>
          )}
        </View>

        {/* Action row */}
        <View style={styles.actionBtns}>
          <ThemeToggleButton />
          <TouchableOpacity
            style={styles.logoutBtn}
            onPress={async () => { 
              await signOut(); 
              router.replace('/login');
            }}
            activeOpacity={0.7}
          >
            <LogOut size={15} color="#EF4444" strokeWidth={1.5} />
            {!collapsed && <Text style={styles.logoutBtnText}>Logout</Text>}
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
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);

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
        // Pass user from AuthContext so checkPropertyAccess doesn't need to re-hydrate
        // the session — the AuthContext client has it; the mobileApi singleton may not.
        const data = await checkPropertyAccess(propertyId, user);
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

  const isFullScreen = FULL_SCREEN_ROUTES.includes(currentRoute);

  // ---- Unified sidebar layout for ALL roles (unless full-screen) ----
  if (isFullScreen) {
    return (
      <PropertyContext.Provider value={propertyInfo}>
        <View style={{ flex: 1, backgroundColor: colors.background }}>
          <Slot />
        </View>
      </PropertyContext.Provider>
    );
  }

  // Capability-based module filtering in Sidebar ensures each role only sees permitted modules.
  return (
    <PropertyContext.Provider value={propertyInfo}>
      <View style={styles.container}>
        {/* Persistent Sidebar */}
        <Sidebar
          currentRoute={currentRoute}
          onNewRequest={() => setTicketModalVisible(true)}
          collapsed={sidebarCollapsed}
          onToggle={() => setSidebarCollapsed(c => !c)}
          role={role}
        />

        {/* Content — children render here via Expo Router file-based routing */}
        <View style={[styles.contentArea, {
          backgroundColor: colors.background,
          marginLeft: sidebarCollapsed ? 72 : SIDEBAR_WIDTH,
        }]}>
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
    overflow: 'hidden',
  },
  contentArea: {
    flex: 1,
    marginLeft: SIDEBAR_WIDTH,
    zIndex: 1,
  },
  sidebarHeader: {
    paddingTop: 16,
    paddingHorizontal: 14,
    paddingBottom: 12,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 8,
  },
  logoSection: {
    flex: 1,
    alignItems: 'center',
    gap: 6,
  },
  staffBadge: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 20,
    borderWidth: 1,
  },
  staffBadgeText: {
    fontFamily: 'Poppins-Bold',
    fontSize: 8,
    fontWeight: '900',
    letterSpacing: 1.5,
  },
  headerActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  collapseBtn: {
    width: 36,
    height: 36,
    borderRadius: 10,
    justifyContent: 'center',
    alignItems: 'center',
    flexShrink: 0,
  },
  quickActionsRow: {
    flexDirection: 'row',
    gap: 8,
    paddingVertical: 8,
    borderBottomWidth: 1,
  },
  quickActionChip: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 5,
    paddingVertical: 8,
    borderRadius: 8,
    borderWidth: 1,
  },
  quickActionChipLabel: {
    fontFamily: 'Poppins-Bold',
    fontSize: 9,
    letterSpacing: 0.5,
  },
  navSectionLabel: {
    fontFamily: 'Poppins-Bold',
    fontSize: 9,
    letterSpacing: 1.2,
    marginBottom: 6,
    marginLeft: 4,
  },
  navItem: {
    marginVertical: 1,
    borderRadius: 10,
    paddingVertical: 10,
    paddingHorizontal: 12,
    overflow: 'hidden',
  },
  navItemCollapsed: {
    marginVertical: 2,
    borderRadius: 10,
    paddingVertical: 10,
    alignItems: 'center',
  },
  navItemCollapsedActive: {
    backgroundColor: 'rgba(112,143,150,0.12)',
  },
  navItemInner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  navItemIconCentered: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  navItemLabel: {
    fontFamily: 'Urbanist-Medium',
    fontSize: 14,
    letterSpacing: 0.1,
  },
  sidebarBottom: {
    borderTopWidth: 1,
    paddingHorizontal: 14,
    paddingTop: 12,
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
