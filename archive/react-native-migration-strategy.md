# React Native Migration Strategy for SaaS Web App

## Executive Summary

This document provides a comprehensive migration strategy for converting a modern SaaS web application (built with Next.js, React, TypeScript, Tailwind CSS) to a cross-platform React Native mobile application. The strategy focuses on maximizing code reuse, minimizing development time, and ensuring feature parity between web and mobile platforms.

---

## 1. Framework Decision: Expo vs Bare React Native

### Recommendation: **Expo SDK 50+** (Managed Workflow with EAS)

### Decision Matrix

| Criteria | Expo | Bare React Native | Winner |
|----------|------|-------------------|--------|
| **Development Speed** | 5/5 - Pre-configured, hot reload, OTA updates | 3/5 - Manual configuration | **Expo** |
| **SaaS Suitability** | 5/5 - EAS Build, OTA updates perfect for SaaS | 4/5 - Manual CI/CD setup | **Expo** |
| **Native Module Access** | 4/5 - Config plugins, native modules via dev client | 5/5 - Full native access | Tie |
| **Team Skill Requirements** | 5/5 - JS/TS only, no native code needed | 3/5 - iOS/Android knowledge needed | **Expo** |
| **Maintenance Overhead** | 5/5 - Managed updates, single command | 2/5 - Manual upgrades | **Expo** |
| **Third-party Integrations** | 4/5 - 90% of libs work, config plugins available | 5/5 - Any library works | Bare RN |
| **Build & Distribution** | 5/5 - EAS Build cloud, automatic signing | 3/5 - Manual/Xcode/Gradle | **Expo** |

### Why Expo for This SaaS App

1. **Rapid Iteration for SaaS**: Over-the-Air (OTA) updates via EAS Update allow instant bug fixes and feature rollouts without app store review delays
2. **Credit-Based Billing Alignment**: Expo's pay-for-what-you-use model aligns with the SaaS credit system philosophy
3. **Single Codebase Efficiency**: One team can maintain both platforms without native mobile expertise
4. **Enterprise-Ready**: EAS Build provides enterprise-grade CI/CD, code signing, and distribution

### Expo Configuration for SaaS

```javascript
// app.json
{
  "expo": {
    "name": "SaaS Mobile",
    "slug": "saas-mobile",
    "version": "1.0.0",
    "orientation": "portrait",
    "icon": "./assets/icon.png",
    "userInterfaceStyle": "automatic",
    "splash": {
      "image": "./assets/splash.png",
      "resizeMode": "contain",
      "backgroundColor": "#ffffff"
    },
    "assetBundlePatterns": ["**/*"],
    "ios": {
      "supportsTablet": true,
      "bundleIdentifier": "com.yourcompany.saasmobile",
      "buildNumber": "1.0.0"
    },
    "android": {
      "adaptiveIcon": {
        "foregroundImage": "./assets/adaptive-icon.png",
        "backgroundColor": "#ffffff"
      },
      "package": "com.yourcompany.saasmobile",
      "versionCode": 1
    },
    "web": {
      "favicon": "./assets/favicon.png"
    },
    "plugins": [
      "expo-secure-store",
      "expo-local-authentication",
      "expo-notifications",
      ["expo-build-properties", {
        "ios": {
          "newArchEnabled": true
        },
        "android": {
          "newArchEnabled": true
        }
      }]
    ],
    "extra": {
      "eas": {
        "projectId": "your-project-id"
      }
    },
    "updates": {
      "url": "https://u.expo.dev/your-project-id",
      "enabled": true,
      "checkAutomatically": "ON_LOAD",
      "fallbackToCacheTimeout": 0
    },
    "runtimeVersion": {
      "policy": "appVersion"
    }
  }
}
```

### When to Consider Bare React Native

- Need deep native integrations (custom Bluetooth, AR/VR)
- Require specific native performance optimizations
- Have dedicated iOS/Android native developers
- Need libraries without Expo Config Plugins

---

## 2. Code Reuse Strategy

### Shared Code Architecture (Monorepo Approach)

```
saas-platform/
├── apps/
│   ├── web/                    # Next.js web app
│   └── mobile/                 # Expo React Native app
├── packages/
│   ├── shared/                 # SHARED: Business logic, types, utilities
│   │   ├── src/
│   │   │   ├── api/           # API clients, fetch wrappers
│   │   │   ├── types/         # TypeScript interfaces
│   │   │   ├── utils/         # Pure utility functions
│   │   │   ├── hooks/         # Custom React hooks (platform-agnostic)
│   │   │   ├── constants/     # App constants
│   │   │   ├── validation/    # Zod schemas
│   │   │   └── store/         # State management logic
│   │   └── package.json
│   ├── ui/                    # SHARED: Cross-platform UI components
│   │   ├── src/
│   │   │   ├── components/    # Tamagui/React Native Web components
│   │   │   ├── theme/         # Design tokens
│   │   │   └── icons/         # SVG icons
│   │   └── package.json
│   └── config/                # SHARED: ESLint, TS configs
├── package.json
└── turbo.json                 # Turborepo config
```

### What Can Be Shared (80-90% Reuse Potential)

#### 1. Business Logic & State Management
```typescript
// packages/shared/src/store/authStore.ts
import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import { User, AuthState } from '../types';

// Platform-agnostic storage adapter
const getStorage = () => {
  if (typeof window !== 'undefined') {
    // Web: localStorage
    return localStorage;
  }
  // Mobile: AsyncStorage (imported dynamically)
  const AsyncStorage = require('@react-native-async-storage/async-storage').default;
  return AsyncStorage;
};

export const useAuthStore = create<AuthState>()(
  persist(
    (set, get) => ({
      user: null,
      isAuthenticated: false,
      credits: 0,
      login: async (email: string, password: string) => {
        // Shared API call
        const response = await apiClient.post('/auth/login', { email, password });
        set({ user: response.user, isAuthenticated: true, credits: response.credits });
      },
      logout: () => set({ user: null, isAuthenticated: false, credits: 0 }),
      updateCredits: (credits: number) => set({ credits }),
    }),
    {
      name: 'auth-storage',
      storage: createJSONStorage(() => getStorage()),
    }
  )
);
```

#### 2. API Layer (100% Shared)
```typescript
// packages/shared/src/api/client.ts
import { createApiClient } from './fetch-wrapper';

export const apiClient = createApiClient({
  baseURL: process.env.API_URL || 'https://api.yoursaas.com',
  timeout: 30000,
  retries: 3,
});

// All API endpoints shared
export const authApi = {
  login: (data: LoginRequest) => apiClient.post('/auth/login', data),
  register: (data: RegisterRequest) => apiClient.post('/auth/register', data),
  verifyEmail: (token: string) => apiClient.get(`/auth/verify/${token}`),
  resetPassword: (data: ResetPasswordRequest) => apiClient.post('/auth/reset-password', data),
};

export const billingApi = {
  getCredits: () => apiClient.get('/billing/credits'),
  purchaseCredits: (data: PurchaseRequest) => apiClient.post('/billing/purchase', data),
  getPurchaseHistory: () => apiClient.get('/billing/history'),
  createStripeSession: (data: CheckoutRequest) => apiClient.post('/billing/checkout', data),
};

export const userApi = {
  getProfile: () => apiClient.get('/user/profile'),
  updateProfile: (data: UpdateProfileRequest) => apiClient.patch('/user/profile', data),
  changePassword: (data: ChangePasswordRequest) => apiClient.post('/user/change-password', data),
};
```

#### 3. TypeScript Types (100% Shared)
```typescript
// packages/shared/src/types/index.ts
export interface User {
  id: string;
  email: string;
  name: string;
  avatar?: string;
  role: 'user' | 'admin';
  emailVerified: boolean;
  createdAt: Date;
}

export interface CreditTransaction {
  id: string;
  userId: string;
  amount: number;
  type: 'purchase' | 'usage' | 'refund';
  description: string;
  createdAt: Date;
}

export interface Subscription {
  id: string;
  userId: string;
  plan: 'free' | 'starter' | 'pro';
  status: 'active' | 'canceled' | 'past_due';
  currentPeriodEnd: Date;
  cancelAtPeriodEnd: boolean;
}

export interface AuthState {
  user: User | null;
  isAuthenticated: boolean;
  credits: number;
  login: (email: string, password: string) => Promise<void>;
  logout: () => void;
  updateCredits: (credits: number) => void;
}
```

#### 4. Validation Schemas (100% Shared)
```typescript
// packages/shared/src/validation/schemas.ts
import { z } from 'zod';

export const loginSchema = z.object({
  email: z.string().email('Invalid email address'),
  password: z.string().min(8, 'Password must be at least 8 characters'),
});

export const registerSchema = z.object({
  name: z.string().min(2, 'Name must be at least 2 characters'),
  email: z.string().email('Invalid email address'),
  password: z.string().min(8, 'Password must be at least 8 characters'),
  confirmPassword: z.string(),
}).refine((data) => data.password === data.confirmPassword, {
  message: "Passwords don't match",
  path: ['confirmPassword'],
});

export const purchaseCreditsSchema = z.object({
  amount: z.number().min(1).max(10000),
  paymentMethodId: z.string(),
});

export type LoginInput = z.infer<typeof loginSchema>;
export type RegisterInput = z.infer<typeof registerSchema>;
export type PurchaseCreditsInput = z.infer<typeof purchaseCreditsSchema>;
```

#### 5. Utility Functions (100% Shared)
```typescript
// packages/shared/src/utils/
export * from './date';
export * from './currency';
export * from './validation';
export * from './formatting';
export * from './permissions';

// date.ts
export const formatDate = (date: Date | string, format: string = 'MMM dd, yyyy'): string => {
  // Platform-agnostic date formatting
  return new Intl.DateTimeFormat('en-US', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  }).format(new Date(date));
};

// currency.ts
export const formatCurrency = (amount: number, currency: string = 'USD'): string => {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency,
  }).format(amount);
};

// permissions.ts
export const hasPermission = (user: User, permission: string): boolean => {
  const rolePermissions = {
    admin: ['*'],
    user: ['read:profile', 'update:profile', 'read:billing'],
  };
  const permissions = rolePermissions[user.role] || [];
  return permissions.includes('*') || permissions.includes(permission);
};
```

### Platform-Specific Code (10-20%)

```typescript
// apps/mobile/src/utils/storage.ts
import * as SecureStore from 'expo-secure-store';

export const secureStorage = {
  getItem: async (key: string): Promise<string | null> => {
    return await SecureStore.getItemAsync(key);
  },
  setItem: async (key: string, value: string): Promise<void> => {
    await SecureStore.setItemAsync(key, value);
  },
  removeItem: async (key: string): Promise<void> => {
    await SecureStore.deleteItemAsync(key);
  },
};

// apps/web/src/utils/storage.ts
export const secureStorage = {
  getItem: (key: string): string | null => {
    return localStorage.getItem(key);
  },
  setItem: (key: string, value: string): void => {
    localStorage.setItem(key, value);
  },
  removeItem: (key: string): void => {
    localStorage.removeItem(key);
  },
};
```

---

## 3. Navigation Mapping: Web Routing to React Native

### Navigation Strategy: **Expo Router v3** (File-based routing)

Expo Router provides the closest mental model to Next.js App Router, making migration easier.

### Routing Comparison

| Web (Next.js App Router) | Mobile (Expo Router) | Notes |
|--------------------------|----------------------|-------|
| `app/page.tsx` | `app/index.tsx` | Home screen |
| `app/(marketing)/page.tsx` | `app/(marketing)/index.tsx` | Group routes |
| `app/(protected)/dashboard/page.tsx` | `app/(protected)/dashboard.tsx` | Protected routes |
| `app/auth/login/page.tsx` | `app/auth/login.tsx` | Auth screens |
| `app/[...slug]/page.tsx` | `app/[...slug].tsx` | Catch-all routes |
| `app/user/[id]/page.tsx` | `app/user/[id].tsx` | Dynamic routes |

### Directory Structure Mapping

```
# Web (Next.js)
app/
├── (marketing)/
│   ├── page.tsx              # Landing page
│   ├── pricing/page.tsx      # Pricing page
│   ├── about/page.tsx        # About page
│   └── contact/page.tsx      # Contact page
├── (protected)/
│   ├── dashboard/page.tsx    # Main dashboard
│   ├── settings/page.tsx     # User settings
│   ├── billing/page.tsx      # Billing/credits
│   └── profile/page.tsx      # User profile
├── auth/
│   ├── login/page.tsx        # Login
│   ├── register/page.tsx     # Register
│   ├── forgot-password/page.tsx
│   └── verify-email/page.tsx
└── api/                      # API routes (web-only)

# Mobile (Expo Router)
app/
├── (marketing)/
│   ├── index.tsx             # Landing (simplified for mobile)
│   ├── pricing.tsx           # Pricing
│   ├── about.tsx             # About
│   └── contact.tsx           # Contact
├── (protected)/
│   ├── _layout.tsx           # Protected route layout with auth check
│   ├── dashboard.tsx         # Dashboard (adapted for mobile)
│   ├── settings.tsx          # Settings
│   ├── billing/
│   │   ├── index.tsx         # Billing overview
│   │   ├── purchase.tsx      # Purchase credits
│   │   └── history.tsx       # Purchase history
│   └── profile.tsx           # Profile
├── auth/
│   ├── _layout.tsx           # Auth layout (no header)
│   ├── login.tsx             # Login
│   ├── register.tsx          # Register
│   ├── forgot-password.tsx
│   └── verify-email.tsx
└── _layout.tsx               # Root layout
```

### Navigation Implementation

```typescript
// apps/mobile/app/_layout.tsx
import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { ThemeProvider } from '@saas/ui';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { AuthProvider } from '../contexts/AuthContext';

const queryClient = new QueryClient();

export default function RootLayout() {
  return (
    <QueryClientProvider client={queryClient}>
      <ThemeProvider>
        <AuthProvider>
          <Stack screenOptions={{ headerShown: false }}>
            <Stack.Screen name="(marketing)" />
            <Stack.Screen name="auth" />
            <Stack.Screen name="(protected)" />
          </Stack>
          <StatusBar style="auto" />
        </AuthProvider>
      </ThemeProvider>
    </QueryClientProvider>
  );
}
```

```typescript
// apps/mobile/app/(protected)/_layout.tsx
import { Redirect, Stack } from 'expo-router';
import { useAuthStore } from '@saas/shared';
import { TabBar } from '../../components/TabBar';

export default function ProtectedLayout() {
  const { isAuthenticated } = useAuthStore();

  if (!isAuthenticated) {
    return <Redirect href="/auth/login" />;
  }

  return (
    <Tabs
      screenOptions={{
        headerShown: true,
      }}
      tabBar={(props) => <TabBar {...props} />}
    >
      <Tabs.Screen
        name="dashboard"
        options={{
          title: 'Dashboard',
          tabBarIcon: ({ color }) => <HomeIcon color={color} />,
        }}
      />
      <Tabs.Screen
        name="billing"
        options={{
          title: 'Credits',
          tabBarIcon: ({ color }) => <CreditCardIcon color={color} />,
        }}
      />
      <Tabs.Screen
        name="settings"
        options={{
          title: 'Settings',
          tabBarIcon: ({ color }) => <SettingsIcon color={color} />,
        }}
      />
    </Tabs>
  );
}
```

### Navigation Patterns Conversion

```typescript
// Web: router.push('/dashboard')
// Mobile: router.push('/dashboard')

// Web: router.replace('/login')
// Mobile: router.replace('/auth/login')

// Web: useSearchParams()
// Mobile: useLocalSearchParams() (Expo Router)

// apps/mobile/hooks/useNavigation.ts
import { useRouter, useLocalSearchParams } from 'expo-router';

export const useNavigation = () => {
  const router = useRouter();
  const params = useLocalSearchParams();

  return {
    navigate: (path: string) => router.push(path as any),
    replace: (path: string) => router.replace(path as any),
    back: () => router.back(),
    params,
    // Helper for web/mobile parity
    navigateToDashboard: () => router.push('/dashboard'),
    navigateToLogin: () => router.push('/auth/login'),
    navigateToBilling: () => router.push('/billing'),
  };
};
```

### Alternative: React Navigation (if not using Expo Router)

```typescript
// apps/mobile/navigation/AppNavigator.tsx
import { NavigationContainer } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';

const Stack = createNativeStackNavigator();
const Tab = createBottomTabNavigator();

function ProtectedTabs() {
  return (
    <Tab.Navigator>
      <Tab.Screen name="Dashboard" component={DashboardScreen} />
      <Tab.Screen name="Billing" component={BillingNavigator} />
      <Tab.Screen name="Settings" component={SettingsScreen} />
    </Tab.Navigator>
  );
}

export function AppNavigator() {
  const { isAuthenticated } = useAuthStore();

  return (
    <NavigationContainer>
      <Stack.Navigator screenOptions={{ headerShown: false }}>
        {!isAuthenticated ? (
          <>
            <Stack.Screen name="Login" component={LoginScreen} />
            <Stack.Screen name="Register" component={RegisterScreen} />
          </>
        ) : (
          <Stack.Screen name="Main" component={ProtectedTabs} />
        )}
      </Stack.Navigator>
    </NavigationContainer>
  );
}
```

---

## 4. UI Component Strategy

### Cross-Platform UI Library Recommendation: **Tamagui**

Tamagui provides the best balance of performance, developer experience, and web-to-mobile code sharing.

### Library Comparison

| Library | Performance | Web Sharing | Learning Curve | SaaS Suitability | Recommendation |
|---------|-------------|-------------|----------------|------------------|----------------|
| **Tamagui** | 5/5 | 5/5 | 3/5 | 5/5 | **Primary Choice** |
| React Native Paper | 4/5 | 2/5 | 4/5 | 4/5 | Material Design focus |
| NativeBase | 3/5 | 3/5 | 4/5 | 3/5 | Deprecated (use Gluestack) |
| Gluestack UI | 4/5 | 4/5 | 3/5 | 4/5 | Good alternative |
| React Native Elements | 3/5 | 2/5 | 5/5 | 3/5 | Simple but limited |
| Styled Components | 3/5 | 4/5 | 4/5 | 3/5 | Runtime overhead |

### Tamagui Setup

```typescript
// packages/ui/tamagui.config.ts
import { createTamagui } from 'tamagui';
import { defaultConfig } from '@tamagui/config/v4';

export const config = createTamagui({
  ...defaultConfig,
  themes: {
    light: {
      background: '#ffffff',
      color: '#000000',
      primary: '#007AFF',
      secondary: '#5856D6',
      success: '#34C759',
      warning: '#FF9500',
      error: '#FF3B30',
      gray1: '#8E8E93',
      gray2: '#C7C7CC',
      gray3: '#D1D1D6',
      gray4: '#E5E5EA',
      gray5: '#F2F2F7',
    },
    dark: {
      background: '#000000',
      color: '#ffffff',
      primary: '#0A84FF',
      secondary: '#5E5CE6',
      success: '#30D158',
      warning: '#FF9F0A',
      error: '#FF453A',
      gray1: '#8E8E93',
      gray2: '#636366',
      gray3: '#48484A',
      gray4: '#3A3A3C',
      gray5: '#2C2C2E',
    },
  },
  tokens: {
    size: {
      xs: 4,
      sm: 8,
      md: 16,
      lg: 24,
      xl: 32,
      '2xl': 48,
      '3xl': 64,
    },
    space: {
      xs: 4,
      sm: 8,
      md: 16,
      lg: 24,
      xl: 32,
      '2xl': 48,
      '3xl': 64,
    },
    radius: {
      none: 0,
      sm: 4,
      md: 8,
      lg: 12,
      xl: 16,
      full: 9999,
    },
  },
});

export type AppConfig = typeof config;
declare module 'tamagui' {
  interface TamaguiCustomConfig extends AppConfig {}
}
```

### Shared Component Examples

```typescript
// packages/ui/src/components/Button.tsx
import { Button as TamaguiButton, styled } from 'tamagui';

export const Button = styled(TamaguiButton, {
  variants: {
    variant: {
      primary: {
        backgroundColor: '$primary',
        color: '$background',
      },
      secondary: {
        backgroundColor: '$secondary',
        color: '$background',
      },
      outline: {
        backgroundColor: 'transparent',
        borderWidth: 1,
        borderColor: '$primary',
        color: '$primary',
      },
      ghost: {
        backgroundColor: 'transparent',
        color: '$primary',
      },
    },
    size: {
      sm: {
        paddingVertical: '$sm',
        paddingHorizontal: '$md',
        fontSize: 14,
      },
      md: {
        paddingVertical: '$md',
        paddingHorizontal: '$lg',
        fontSize: 16,
      },
      lg: {
        paddingVertical: '$lg',
        paddingHorizontal: '$xl',
        fontSize: 18,
      },
    },
  } as const,
  defaultVariants: {
    variant: 'primary',
    size: 'md',
  },
});
```

```typescript
// packages/ui/src/components/Card.tsx
import { YStack, styled } from 'tamagui';

export const Card = styled(YStack, {
  backgroundColor: '$background',
  borderRadius: '$lg',
  padding: '$lg',
  shadowColor: '$gray1',
  shadowOffset: { width: 0, height: 2 },
  shadowOpacity: 0.1,
  shadowRadius: 8,
  elevation: 3,
  
  variants: {
    variant: {
      default: {},
      elevated: {
        shadowOpacity: 0.2,
        elevation: 5,
      },
      outlined: {
        borderWidth: 1,
        borderColor: '$gray4',
        shadowOpacity: 0,
        elevation: 0,
      },
    },
  },
  defaultVariants: {
    variant: 'default',
  },
});
```

```typescript
// packages/ui/src/components/Input.tsx
import { Input as TamaguiInput, styled } from 'tamagui';

export const Input = styled(TamaguiInput, {
  borderWidth: 1,
  borderColor: '$gray4',
  borderRadius: '$md',
  paddingHorizontal: '$md',
  paddingVertical: '$sm',
  fontSize: 16,
  
  variants: {
    state: {
      default: {},
      error: {
        borderColor: '$error',
      },
      success: {
        borderColor: '$success',
      },
    },
  },
  defaultVariants: {
    state: 'default',
  },
});
```

### Responsive Design Strategy

```typescript
// packages/ui/src/hooks/useResponsive.ts
import { useWindowDimensions } from 'react-native';
import { useMedia } from 'tamagui';

// Breakpoints matching Tailwind
const breakpoints = {
  sm: 640,
  md: 768,
  lg: 1024,
  xl: 1280,
};

export const useResponsive = () => {
  const { width, height } = useWindowDimensions();
  const media = useMedia();

  return {
    width,
    height,
    isMobile: width < breakpoints.md,
    isTablet: width >= breakpoints.md && width < breakpoints.lg,
    isDesktop: width >= breakpoints.lg,
    // Tamagui media queries
    media,
  };
};

// Usage in components
import { XStack, YStack } from 'tamagui';

export function DashboardLayout({ children }: { children: React.ReactNode }) {
  const { isMobile } = useResponsive();

  return (
    <XStack
      flex={1}
      flexDirection={isMobile ? 'column' : 'row'}
    >
      {!isMobile && <Sidebar />}
      <YStack flex={1} padding='$md'>
        {children}
      </YStack>
    </XStack>
  );
}
```

### Mobile-Specific Adaptations

```typescript
// apps/mobile/src/components/MobileDashboard.tsx
import { ScrollView, RefreshControl } from 'react-native';
import { YStack, XStack, Text, Card } from '@saas/ui';
import { useResponsive } from '@saas/ui/hooks';
import { CreditDisplay } from './CreditDisplay';
import { QuickActions } from './QuickActions';
import { RecentActivity } from './RecentActivity';

export function MobileDashboard() {
  const [refreshing, setRefreshing] = useState(false);
  const { isMobile } = useResponsive();

  const onRefresh = async () => {
    setRefreshing(true);
    await refetchData();
    setRefreshing(false);
  };

  return (
    <ScrollView
      refreshControl={
        <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
      }
    >
      <YStack padding='$md' space='$lg'>
        {/* Credit Balance Card */}
        <CreditDisplay />
        
        {/* Quick Actions Grid */}
        <QuickActions />
        
        {/* Recent Activity */}
        <RecentActivity />
      </YStack>
    </ScrollView>
  );
}
```

---

## 5. State Management Migration

### Recommended Approach: **Zustand + TanStack Query**

This combination provides the best developer experience and works identically on web and mobile.

### State Management Architecture

```typescript
// packages/shared/src/store/
├── index.ts
├── authStore.ts          # Authentication state
├── userStore.ts          # User profile state
├── billingStore.ts       # Credits & billing state
├── uiStore.ts            # UI state (modals, toasts)
└── notificationStore.ts  # Push notifications state
```

### Store Implementations

```typescript
// packages/shared/src/store/authStore.ts
import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { User } from '../types';
import { authApi } from '../api';

interface AuthState {
  // State
  user: User | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  error: string | null;
  
  // Actions
  login: (email: string, password: string) => Promise<void>;
  register: (data: RegisterData) => Promise<void>;
  logout: () => Promise<void>;
  clearError: () => void;
  updateUser: (user: Partial<User>) => void;
}

export const useAuthStore = create<AuthState>()(
  persist(
    (set, get) => ({
      user: null,
      isAuthenticated: false,
      isLoading: false,
      error: null,

      login: async (email, password) => {
        set({ isLoading: true, error: null });
        try {
          const response = await authApi.login({ email, password });
          set({
            user: response.user,
            isAuthenticated: true,
            isLoading: false,
          });
        } catch (error: any) {
          set({
            error: error.message || 'Login failed',
            isLoading: false,
          });
          throw error;
        }
      },

      register: async (data) => {
        set({ isLoading: true, error: null });
        try {
          const response = await authApi.register(data);
          set({
            user: response.user,
            isAuthenticated: true,
            isLoading: false,
          });
        } catch (error: any) {
          set({
            error: error.message || 'Registration failed',
            isLoading: false,
          });
          throw error;
        }
      },

      logout: async () => {
        await authApi.logout();
        set({
          user: null,
          isAuthenticated: false,
          error: null,
        });
      },

      clearError: () => set({ error: null }),

      updateUser: (userData) => {
        const currentUser = get().user;
        if (currentUser) {
          set({ user: { ...currentUser, ...userData } });
        }
      },
    }),
    {
      name: 'auth-storage',
      partialize: (state) => ({ 
        user: state.user, 
        isAuthenticated: state.isAuthenticated 
      }),
    }
  )
);
```

```typescript
// packages/shared/src/store/billingStore.ts
import { create } from 'zustand';
import { billingApi } from '../api';
import { CreditTransaction, Subscription } from '../types';

interface BillingState {
  credits: number;
  transactions: CreditTransaction[];
  subscription: Subscription | null;
  isLoading: boolean;
  
  fetchCredits: () => Promise<void>;
  fetchTransactions: () => Promise<void>;
  purchaseCredits: (amount: number, paymentMethodId: string) => Promise<void>;
  useCredits: (amount: number, description: string) => Promise<void>;
}

export const useBillingStore = create<BillingState>((set, get) => ({
  credits: 0,
  transactions: [],
  subscription: null,
  isLoading: false,

  fetchCredits: async () => {
    const response = await billingApi.getCredits();
    set({ credits: response.credits });
  },

  fetchTransactions: async () => {
    const response = await billingApi.getPurchaseHistory();
    set({ transactions: response.transactions });
  },

  purchaseCredits: async (amount, paymentMethodId) => {
    set({ isLoading: true });
    try {
      const response = await billingApi.purchaseCredits({
        amount,
        paymentMethodId,
      });
      set((state) => ({
        credits: state.credits + amount,
        transactions: [response.transaction, ...state.transactions],
        isLoading: false,
      }));
    } catch (error) {
      set({ isLoading: false });
      throw error;
    }
  },

  useCredits: async (amount, description) => {
    const { credits } = get();
    if (credits < amount) {
      throw new Error('Insufficient credits');
    }
    
    // Optimistic update
    set((state) => ({
      credits: state.credits - amount,
    }));

    try {
      await billingApi.useCredits({ amount, description });
    } catch (error) {
      // Rollback on error
      set((state) => ({
        credits: state.credits + amount,
      }));
      throw error;
    }
  },
}));
```

### TanStack Query Integration

```typescript
// packages/shared/src/hooks/useUser.ts
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { userApi } from '../api';

export const useUser = () => {
  return useQuery({
    queryKey: ['user'],
    queryFn: () => userApi.getProfile(),
    staleTime: 5 * 60 * 1000, // 5 minutes
  });
};

export const useUpdateUser = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (data: UpdateProfileRequest) => userApi.updateProfile(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['user'] });
    },
  });
};

// packages/shared/src/hooks/useCredits.ts
export const useCredits = () => {
  return useQuery({
    queryKey: ['credits'],
    queryFn: () => billingApi.getCredits(),
    refetchInterval: 30000, // Refetch every 30 seconds
  });
};

export const usePurchaseCredits = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (data: PurchaseRequest) => billingApi.purchaseCredits(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['credits'] });
      queryClient.invalidateQueries({ queryKey: ['transactions'] });
    },
  });
};
```

### Context Providers for Mobile

```typescript
// apps/mobile/src/contexts/AuthContext.tsx
import { createContext, useContext, useEffect } from 'react';
import { useAuthStore } from '@saas/shared';
import { useRouter, useSegments } from 'expo-router';

const AuthContext = createContext(null);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const { isAuthenticated, isLoading } = useAuthStore();
  const segments = useSegments();
  const router = useRouter();

  useEffect(() => {
    if (isLoading) return;

    const inAuthGroup = segments[0] === 'auth';

    if (!isAuthenticated && !inAuthGroup) {
      // Redirect to login if not authenticated
      router.replace('/auth/login');
    } else if (isAuthenticated && inAuthGroup) {
      // Redirect to dashboard if already authenticated
      router.replace('/dashboard');
    }
  }, [isAuthenticated, segments, isLoading]);

  return (
    <AuthContext.Provider value={null}>
      {children}
    </AuthContext.Provider>
  );
}
```

---

## 6. Web-Specific to Mobile-Specific Conversions

### 6.1 Storage Migration

```typescript
// packages/shared/src/storage/index.ts
import { Platform } from 'react-native';

interface StorageAdapter {
  getItem: (key: string) => Promise<string | null>;
  setItem: (key: string, value: string) => Promise<void>;
  removeItem: (key: string) => Promise<void>;
}

// Web implementation
const webStorage: StorageAdapter = {
  getItem: async (key) => localStorage.getItem(key),
  setItem: async (key, value) => localStorage.setItem(key, value),
  removeItem: async (key) => localStorage.removeItem(key),
};

// Mobile implementation
let mobileStorage: StorageAdapter;

if (Platform.OS !== 'web') {
  const SecureStore = require('expo-secure-store');
  mobileStorage = {
    getItem: SecureStore.getItemAsync,
    setItem: SecureStore.setItemAsync,
    removeItem: SecureStore.deleteItemAsync,
  };
}

export const storage = Platform.OS === 'web' ? webStorage : mobileStorage;

// Usage
import { storage } from '@saas/shared/storage';

// Store auth token
await storage.setItem('auth_token', token);

// Retrieve auth token
const token = await storage.getItem('auth_token');

// Remove auth token
await storage.removeItem('auth_token');
```

### 6.2 Window Events to Mobile Lifecycle

```typescript
// packages/shared/src/hooks/useAppState.ts
import { useEffect, useState, useRef } from 'react';
import { AppState, AppStateStatus } from 'react-native';

export const useAppState = () => {
  const [appState, setAppState] = useState<AppStateStatus>(AppState.currentState);
  const appStateRef = useRef(AppState.currentState);

  useEffect(() => {
    const subscription = AppState.addEventListener('change', (nextAppState) => {
      appStateRef.current = nextAppState;
      setAppState(nextAppState);
    });

    return () => {
      subscription.remove();
    };
  }, []);

  return {
    appState,
    isActive: appState === 'active',
    isInactive: appState === 'inactive',
    isBackground: appState === 'background',
  };
};

// Usage for refreshing data when app becomes active
function DashboardScreen() {
  const { isActive } = useAppState();
  const { refetch } = useCredits();

  useEffect(() => {
    if (isActive) {
      refetch();
    }
  }, [isActive]);

  return <DashboardContent />;
}
```

### 6.3 Network Status Handling

```typescript
// packages/shared/src/hooks/useNetworkStatus.ts
import { useEffect, useState } from 'react';
import NetInfo, { NetInfoState } from '@react-native-community/netinfo';

export const useNetworkStatus = () => {
  const [isConnected, setIsConnected] = useState(true);
  const [connectionType, setConnectionType] = useState<string | null>(null);

  useEffect(() => {
    const unsubscribe = NetInfo.addEventListener((state: NetInfoState) => {
      setIsConnected(state.isConnected ?? false);
      setConnectionType(state.type);
    });

    return () => unsubscribe();
  }, []);

  return { isConnected, connectionType };
};

// Usage
function App() {
  const { isConnected } = useNetworkStatus();

  if (!isConnected) {
    return <OfflineScreen />;
  }

  return <MainApp />;
}
```

### 6.4 CSS/Tailwind to React Native Styling

```typescript
// Tailwind to Tamagui mapping
const tailwindToTamagui = {
  // Layout
  'flex': { display: 'flex' },
  'flex-col': { flexDirection: 'column' },
  'flex-row': { flexDirection: 'row' },
  'items-center': { alignItems: 'center' },
  'justify-center': { justifyContent: 'center' },
  
  // Spacing
  'p-4': { padding: 16 },
  'px-4': { paddingHorizontal: 16 },
  'py-2': { paddingVertical: 8 },
  'm-4': { margin: 16 },
  'mx-auto': { marginHorizontal: 'auto' },
  
  // Sizing
  'w-full': { width: '100%' },
  'h-full': { height: '100%' },
  'min-h-screen': { minHeight: '100vh' },
  
  // Colors
  'bg-white': { backgroundColor: '#ffffff' },
  'text-black': { color: '#000000' },
  'text-blue-500': { color: '#3b82f6' },
  
  // Typography
  'text-sm': { fontSize: 14 },
  'text-base': { fontSize: 16 },
  'text-lg': { fontSize: 18 },
  'font-bold': { fontWeight: 'bold' },
  
  // Borders
  'rounded': { borderRadius: 4 },
  'rounded-lg': { borderRadius: 8 },
  'rounded-full': { borderRadius: 9999 },
  
  // Effects
  'shadow': { 
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 2,
  },
};
```

### Component Conversion Example

```typescript
// Web (Tailwind + React)
function CreditCard({ credits, onPurchase }: CreditCardProps) {
  return (
    <div className="bg-white rounded-lg shadow-md p-6 max-w-sm mx-auto">
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-lg font-semibold text-gray-800">Credit Balance</h3>
        <CoinsIcon className="w-6 h-6 text-yellow-500" />
      </div>
      <div className="text-4xl font-bold text-blue-600 mb-4">
        {credits.toLocaleString()}
      </div>
      <button
        onClick={onPurchase}
        className="w-full bg-blue-600 text-white py-2 px-4 rounded-lg hover:bg-blue-700 transition-colors"
      >
        Purchase Credits
      </button>
    </div>
  );
}

// Mobile (Tamagui)
import { Card, XStack, YStack, Text, Button } from 'tamagui';
import { Coins } from '@tamagui/lucide-icons';

function CreditCard({ credits, onPurchase }: CreditCardProps) {
  return (
    <Card maxWidth={320} alignSelf="center">
      <YStack space="$md">
        <XStack justifyContent="space-between" alignItems="center">
          <Text fontSize="$lg" fontWeight="600" color="$gray12">
            Credit Balance
          </Text>
          <Coins size={24} color="$yellow10" />
        </XStack>
        <Text fontSize="$8" fontWeight="bold" color="$blue10">
          {credits.toLocaleString()}
        </Text>
        <Button onPress={onPurchase} theme="blue">
          Purchase Credits
        </Button>
      </YStack>
    </Card>
  );
}
```

### 6.5 Form Handling Migration

```typescript
// Web: React Hook Form + Zod
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { loginSchema } from '@saas/shared';

function LoginForm() {
  const { register, handleSubmit, formState: { errors } } = useForm({
    resolver: zodResolver(loginSchema),
  });

  return (
    <form onSubmit={handleSubmit(onSubmit)}>
      <input {...register('email')} />
      {errors.email && <span>{errors.email.message}</span>}
      <input type="password" {...register('password')} />
      <button type="submit">Login</button>
    </form>
  );
}

// Mobile: React Hook Form + Tamagui
import { useForm, Controller } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { YStack, Input, Text, Button } from 'tamagui';
import { loginSchema } from '@saas/shared';

function LoginForm() {
  const { control, handleSubmit, formState: { errors } } = useForm({
    resolver: zodResolver(loginSchema),
  });

  return (
    <YStack space="$md">
      <Controller
        control={control}
        name="email"
        render={({ field: { onChange, value } }) => (
          <>
            <Input
              placeholder="Email"
              value={value}
              onChangeText={onChange}
              keyboardType="email-address"
              autoCapitalize="none"
              state={errors.email ? 'error' : 'default'}
            />
            {errors.email && (
              <Text color="$red10" fontSize="$sm">
                {errors.email.message}
              </Text>
            )}
          </>
        )}
      />
      <Controller
        control={control}
        name="password"
        render={({ field: { onChange, value } }) => (
          <>
            <Input
              placeholder="Password"
              value={value}
              onChangeText={onChange}
              secureTextEntry
              state={errors.password ? 'error' : 'default'}
            />
            {errors.password && (
              <Text color="$red10" fontSize="$sm">
                {errors.password.message}
              </Text>
            )}
          </>
        )}
      />
      <Button onPress={handleSubmit(onSubmit)}>Login</Button>
    </YStack>
  );
}
```

---

## 7. Feature Parity Plan

### Feature Mapping Matrix

| Web Feature | Mobile Equivalent | Status | Priority |
|-------------|-------------------|--------|----------|
| **Authentication** | | | |
| Email/Password Login | Same | ✅ 1:1 | P0 |
| Social Login (Google/GitHub) | Same + Apple Sign-In | ✅ Enhanced | P0 |
| Email Verification | Deep linking to app | ⚠️ Adapted | P0 |
| Password Reset | Deep linking to app | ⚠️ Adapted | P0 |
| 2FA | Same + Biometric auth | ✅ Enhanced | P1 |
| **Dashboard** | | | |
| Credit Display | Same + Widget support | ✅ Enhanced | P0 |
| Usage Analytics | Charts (victory-native) | ✅ 1:1 | P1 |
| Quick Actions | Touch-optimized buttons | ✅ Adapted | P0 |
| **Billing** | | | |
| Credit Purchase | In-app purchases (IAP) | ⚠️ Adapted | P0 |
| Stripe Integration | Same + Apple Pay/Google Pay | ✅ Enhanced | P0 |
| Purchase History | Same | ✅ 1:1 | P1 |
| Subscription Management | Same | ✅ 1:1 | P1 |
| **User Profile** | | | |
| Profile Edit | Same | ✅ 1:1 | P1 |
| Avatar Upload | Camera/Roll integration | ✅ Enhanced | P2 |
| Notification Preferences | Push notification settings | ✅ Enhanced | P1 |
| **Settings** | | | |
| Theme (Dark/Light) | Same + System preference | ✅ Enhanced | P2 |
| Language | Same | ✅ 1:1 | P2 |
| Security | Biometric auth option | ✅ Enhanced | P1 |
| **Notifications** | | | |
| Email Notifications | Push notifications | ✅ Enhanced | P1 |
| In-app Notifications | Local notifications | ✅ Enhanced | P2 |

### Mobile-First Enhancements

```typescript
// apps/mobile/src/features/biometricAuth.ts
import * as LocalAuthentication from 'expo-local-authentication';

export const biometricAuth = {
  isAvailable: async (): Promise<boolean> => {
    const compatible = await LocalAuthentication.hasHardwareAsync();
    const enrolled = await LocalAuthentication.isEnrolledAsync();
    return compatible && enrolled;
  },

  authenticate: async (reason: string = 'Authenticate'): Promise<boolean> => {
    const result = await LocalAuthentication.authenticateAsync({
      promptMessage: reason,
      fallbackLabel: 'Use passcode',
      disableDeviceFallback: false,
    });
    return result.success;
  },
};

// Usage in login flow
async function loginWithBiometric() {
  const available = await biometricAuth.isAvailable();
  if (available) {
    const success = await biometricAuth.authenticate('Login to SaaS App');
    if (success) {
      // Retrieve stored credentials and auto-login
      const credentials = await getStoredCredentials();
      await authStore.login(credentials.email, credentials.password);
    }
  }
}
```

```typescript
// apps/mobile/src/features/pushNotifications.ts
import * as Notifications from 'expo-notifications';
import * as Device from 'expo-device';

Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowAlert: true,
    shouldPlaySound: true,
    shouldSetBadge: true,
  }),
});

export const pushNotifications = {
  register: async (): Promise<string | null> => {
    if (!Device.isDevice) {
      console.log('Must use physical device for Push Notifications');
      return null;
    }

    const { status: existingStatus } = await Notifications.getPermissionsAsync();
    let finalStatus = existingStatus;

    if (existingStatus !== 'granted') {
      const { status } = await Notifications.requestPermissionsAsync();
      finalStatus = status;
    }

    if (finalStatus !== 'granted') {
      console.log('Failed to get push token');
      return null;
    }

    const token = (await Notifications.getExpoPushTokenAsync()).data;
    return token;
  },

  scheduleLocal: async (title: string, body: string, delay: number = 0) => {
    await Notifications.scheduleNotificationAsync({
      content: { title, body },
      trigger: delay > 0 ? { seconds: delay } : null,
    });
  },
};
```

### Deep Linking Configuration

```typescript
// apps/mobile/src/navigation/linking.ts
import * as Linking from 'expo-linking';

const linking = {
  prefixes: ['saasmobile://', 'https://yourapp.com'],
  config: {
    screens: {
      auth: {
        screens: {
          login: 'login',
          'verify-email': 'verify/:token',
          'reset-password': 'reset-password/:token',
        },
      },
      protected: {
        screens: {
          dashboard: 'dashboard',
          billing: 'billing',
          settings: 'settings',
        },
      },
    },
  },
};

// Handle email verification deep link
useEffect(() => {
  const subscription = Linking.addEventListener('url', ({ url }) => {
    const { path, queryParams } = Linking.parse(url);
    
    if (path === 'verify' && queryParams?.token) {
      verifyEmail(queryParams.token);
    }
    
    if (path === 'reset-password' && queryParams?.token) {
      navigateToResetPassword(queryParams.token);
    }
  });

  return () => subscription.remove();
}, []);
```

### Feature Parity Checklist

```markdown
## Pre-Launch Checklist

### Authentication
- [ ] Email/Password login works
- [ ] Registration with validation
- [ ] Email verification via deep link
- [ ] Password reset flow
- [ ] Social login (Google, Apple, GitHub)
- [ ] Biometric authentication (Face ID/Touch ID)
- [ ] Session persistence across app restarts
- [ ] Auto-logout on token expiry

### Dashboard
- [ ] Credit balance display
- [ ] Real-time credit updates
- [ ] Usage statistics/charts
- [ ] Quick action buttons
- [ ] Pull-to-refresh
- [ ] Offline mode support

### Billing
- [ ] Credit purchase via Stripe
- [ ] Apple Pay / Google Pay integration
- [ ] In-app purchase (IAP) option
- [ ] Purchase history list
- [ ] Transaction details
- [ ] Receipt email
- [ ] Subscription management
- [ ] Cancel subscription

### User Profile
- [ ] View profile
- [ ] Edit profile
- [ ] Change password
- [ ] Upload avatar (camera/gallery)
- [ ] Delete account

### Settings
- [ ] Dark/Light theme
- [ ] Language selection
- [ ] Notification preferences
- [ ] Biometric auth toggle
- [ ] Privacy settings

### Notifications
- [ ] Push notification permission
- [ ] Receive push notifications
- [ ] Notification tap handling
- [ ] Badge count management
- [ ] Local notifications

### Performance
- [ ] App launch < 3 seconds
- [ ] Smooth 60fps animations
- [ ] Offline functionality
- [ ] Error boundaries
- [ ] Crash reporting

### Security
- [ ] Secure token storage
- [ ] Certificate pinning
- [ ] Screenshot prevention (sensitive screens)
- [ ] Jailbreak detection (optional)
```

---

## Implementation Roadmap

### Phase 1: Foundation (Weeks 1-2)
- [ ] Set up Expo project with TypeScript
- [ ] Configure monorepo structure
- [ ] Set up Tamagui UI library
- [ ] Implement shared packages (types, API, utils)
- [ ] Set up navigation (Expo Router)
- [ ] Configure state management (Zustand)

### Phase 2: Authentication (Weeks 3-4)
- [ ] Login screen
- [ ] Registration screen
- [ ] Email verification
- [ ] Password reset
- [ ] Social login integration
- [ ] Biometric authentication
- [ ] Auth context and protected routes

### Phase 3: Core Features (Weeks 5-7)
- [ ] Dashboard with credit display
- [ ] Purchase credits flow
- [ ] Stripe integration
- [ ] Purchase history
- [ ] User profile
- [ ] Settings

### Phase 4: Polish & Enhancements (Weeks 8-9)
- [ ] Push notifications
- [ ] Deep linking
- [ ] Offline support
- [ ] Performance optimization
- [ ] Error handling
- [ ] Analytics integration

### Phase 5: Testing & Launch (Weeks 10-11)
- [ ] Unit tests
- [ ] Integration tests
- [ ] E2E tests (Maestro)
- [ ] Beta testing (TestFlight/Play Console)
- [ ] App store submission

---

## Dependencies Summary

### Core
```json
{
  "expo": "~50.0.0",
  "expo-router": "~3.4.0",
  "react": "18.2.0",
  "react-native": "0.73.0",
  "typescript": "^5.3.0"
}
```

### UI & Styling
```json
{
  "tamagui": "^1.88.0",
  "@tamagui/config": "^1.88.0",
  "@tamagui/lucide-icons": "^1.88.0"
}
```

### State Management
```json
{
  "zustand": "^4.4.0",
  "@tanstack/react-query": "^5.0.0"
}
```

### Navigation
```json
{
  "expo-router": "~3.4.0"
}
```

### Storage & Security
```json
{
  "@react-native-async-storage/async-storage": "1.21.0",
  "expo-secure-store": "~12.8.0",
  "expo-local-authentication": "~13.8.0"
}
```

### Payments
```json
{
  "@stripe/stripe-react-native": "0.35.0",
  "expo-in-app-purchases": "~14.8.0"
}
```

### Notifications
```json
{
  "expo-notifications": "~0.27.0",
  "expo-device": "~5.9.0"
}
```

### Forms & Validation
```json
{
  "react-hook-form": "^7.49.0",
  "zod": "^3.22.0",
  "@hookform/resolvers": "^3.3.0"
}
```

---

## Conclusion

This migration strategy provides a clear path to convert your SaaS web application to React Native while maximizing code reuse and maintaining feature parity. The recommended stack (Expo + Tamagui + Zustand) offers:

- **80-90% code reuse** between web and mobile
- **Single team maintenance** without native mobile expertise
- **Rapid iteration** with OTA updates
- **Enterprise-ready** CI/CD with EAS
- **Future-proof** architecture with New Architecture (Fabric) support

The phased implementation approach allows for incremental delivery and early user feedback, reducing risk and ensuring a successful launch.
