# React Native Mobile Architecture for SaaS Conversion

## Executive Summary

This document provides a comprehensive technical architecture for converting a SaaS web application to a full-stack React Native mobile application. The architecture prioritizes production readiness, scalability, and maintainability.

---

## 1. Recommended Architecture Stack

### 1.1 React Native Setup: Expo SDK (Recommended)

**Recommendation: Expo SDK with EAS Build**

```
┌─────────────────────────────────────────────────────────────────┐
│                    EXPO SDK ARCHITECTURE                        │
├─────────────────────────────────────────────────────────────────┤
│  Expo SDK 50+                                                   │
│  ├── Managed Workflow (Primary)                                 │
│  ├── EAS Build for CI/CD                                        │
│  ├── EAS Update for OTA updates                                 │
│  └── Expo Prebuild for native modules                           │
└─────────────────────────────────────────────────────────────────┘
```

**Why Expo over Bare Workflow:**

| Factor | Expo SDK | Bare Workflow |
|--------|----------|---------------|
| Development Speed | Faster | Slower |
| Native Module Management | Simplified | Manual |
| OTA Updates | Built-in (EAS Update) | Custom implementation |
| Build Infrastructure | Managed (EAS Build) | Self-managed |
| Team Size Required | Smaller | Larger |
| Time to Market | Shorter | Longer |
| Native Customization | Good (Config Plugins) | Full |

**When to Consider Bare Workflow:**
- Complex native module requirements not covered by Expo
- Deep native SDK integrations (e.g., custom ML libraries)
- Existing native codebase to integrate

**Expo SDK Configuration:**

```json
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
      "bundleIdentifier": "com.yourcompany.saas",
      "buildNumber": "1.0.0",
      "infoPlist": {
        "NSCameraUsageDescription": "Camera access for document scanning",
        "NSPhotoLibraryUsageDescription": "Photo access for profile images",
        "NSLocationWhenInUseUsageDescription": "Location for service tracking"
      }
    },
    "android": {
      "adaptiveIcon": {
        "foregroundImage": "./assets/adaptive-icon.png",
        "backgroundColor": "#ffffff"
      },
      "package": "com.yourcompany.saas",
      "versionCode": 1,
      "permissions": [
        "CAMERA",
        "READ_EXTERNAL_STORAGE",
        "ACCESS_FINE_LOCATION"
      ]
    },
    "plugins": [
      "expo-secure-store",
      "expo-local-authentication",
      "expo-notifications",
      "expo-camera",
      "expo-image-picker"
    ]
  }
}
```

### 1.2 State Management Architecture

**Recommended Stack: Zustand + TanStack Query (React Query)**

```
┌─────────────────────────────────────────────────────────────────┐
│                    STATE MANAGEMENT LAYER                       │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│  ┌─────────────────┐    ┌─────────────────┐                    │
│  │   Zustand       │    │  TanStack Query │                    │
│  │  (Client State) │    │  (Server State) │                    │
│  │                 │    │                 │                    │
│  │  - Auth state   │    │  - API caching  │                    │
│  │  - UI state     │    │  - Background   │                    │
│  │  - Navigation   │    │    sync         │                    │
│  │  - Form state   │    │  - Optimistic   │                    │
│  │                 │    │    updates      │                    │
│  └────────┬────────┘    └────────┬────────┘                    │
│           │                      │                              │
│           └──────────┬───────────┘                              │
│                      │                                          │
│           ┌──────────▼───────────┐                              │
│           │   MMKV (Storage)     │                              │
│           │   - Persistence      │                              │
│           │   - Fast access      │                              │
│           └──────────────────────┘                              │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
```

**Zustand Store Structure:**

```typescript
// stores/authStore.ts
import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import { MMKV } from 'react-native-mmkv';

const storage = new MMKV();

const mmkvStorage = {
  getItem: (name: string) => storage.getString(name) ?? null,
  setItem: (name: string, value: string) => storage.set(name, value),
  removeItem: (name: string) => storage.delete(name),
};

interface AuthState {
  token: string | null;
  refreshToken: string | null;
  user: User | null;
  isAuthenticated: boolean;
  isBiometricEnabled: boolean;
  
  // Actions
  setAuth: (token: string, refreshToken: string, user: User) => void;
  clearAuth: () => void;
  setBiometricEnabled: (enabled: boolean) => void;
  updateUser: (user: Partial<User>) => void;
}

export const useAuthStore = create<AuthState>()(
  persist(
    (set) => ({
      token: null,
      refreshToken: null,
      user: null,
      isAuthenticated: false,
      isBiometricEnabled: false,
      
      setAuth: (token, refreshToken, user) =>
        set({ token, refreshToken, user, isAuthenticated: true }),
      
      clearAuth: () =>
        set({ token: null, refreshToken: null, user: null, isAuthenticated: false }),
      
      setBiometricEnabled: (enabled) =>
        set({ isBiometricEnabled: enabled }),
      
      updateUser: (userUpdate) =>
        set((state) => ({
          user: state.user ? { ...state.user, ...userUpdate } : null,
        })),
    }),
    {
      name: 'auth-storage',
      storage: createJSONStorage(() => mmkvStorage),
      partialize: (state) => ({
        token: state.token,
        refreshToken: state.refreshToken,
        user: state.user,
        isBiometricEnabled: state.isBiometricEnabled,
      }),
    }
  )
);

// stores/uiStore.ts - For UI state only (not persisted)
interface UIState {
  theme: 'light' | 'dark' | 'system';
  isOffline: boolean;
  currentRoute: string;
  
  setTheme: (theme: UIState['theme']) => void;
  setOffline: (isOffline: boolean) => void;
  setCurrentRoute: (route: string) => void;
}

export const useUIStore = create<UIState>((set) => ({
  theme: 'system',
  isOffline: false,
  currentRoute: '',
  
  setTheme: (theme) => set({ theme }),
  setOffline: (isOffline) => set({ isOffline }),
  setCurrentRoute: (currentRoute) => set({ currentRoute }),
}));
```

**TanStack Query Configuration:**

```typescript
// lib/queryClient.ts
import { QueryClient } from '@tanstack/react-query';
import { onlineManager } from '@tanstack/react-query';
import NetInfo from '@react-native-community/netinfo';

// Sync online status with network state
onlineManager.setEventListener((setOnline) => {
  return NetInfo.addEventListener((state) => {
    setOnline(!!state.isConnected);
  });
});

export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 1000 * 60 * 5, // 5 minutes
      gcTime: 1000 * 60 * 30, // 30 minutes (formerly cacheTime)
      retry: (failureCount, error) => {
        // Don't retry on 401/403
        if (error?.response?.status === 401 || error?.response?.status === 403) {
          return false;
        }
        return failureCount < 3;
      },
      retryDelay: (attemptIndex) => Math.min(1000 * 2 ** attemptIndex, 30000),
      refetchOnWindowFocus: false, // Mobile doesn't have window focus
      refetchOnReconnect: true,
    },
    mutations: {
      retry: false,
    },
  },
});

// hooks/useApi.ts
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '../lib/api';

export function useUserProfile(userId: string) {
  return useQuery({
    queryKey: ['user', userId],
    queryFn: () => api.get(`/users/${userId}`).then((res) => res.data),
    enabled: !!userId,
  });
}

export function useUpdateUser() {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: (data: UpdateUserData) =>
      api.patch('/users/me', data).then((res) => res.data),
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['user'] });
      queryClient.setQueryData(['user', data.id], data);
    },
  });
}
```

### 1.3 Networking Layer

**Recommended: Axios with Mobile Optimizations**

```typescript
// lib/api.ts
import axios, { AxiosError, InternalAxiosRequestConfig } from 'axios';
import { useAuthStore } from '../stores/authStore';
import { Platform } from 'react-native';
import DeviceInfo from 'react-native-device-info';

const API_BASE_URL = process.env.EXPO_PUBLIC_API_URL;

// Create axios instance
export const api = axios.create({
  baseURL: API_BASE_URL,
  timeout: 30000, // 30 seconds for mobile networks
  headers: {
    'Content-Type': 'application/json',
    'Accept': 'application/json',
    'X-Platform': Platform.OS,
    'X-App-Version': process.env.EXPO_PUBLIC_APP_VERSION || '1.0.0',
  },
});

// Request interceptor
api.interceptors.request.use(
  async (config: InternalAxiosRequestConfig) => {
    // Add auth token
    const token = useAuthStore.getState().token;
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }
    
    // Add device info for analytics/debugging
    config.headers['X-Device-ID'] = await DeviceInfo.getUniqueId();
    config.headers['X-Device-Model'] = await DeviceInfo.getModel();
    
    // Add request timestamp for latency tracking
    config.headers['X-Request-Time'] = Date.now().toString();
    
    return config;
  },
  (error) => Promise.reject(error)
);

// Response interceptor with token refresh
api.interceptors.response.use(
  (response) => {
    // Track API latency
    const requestTime = parseInt(response.config.headers['X-Request-Time'] as string);
    const latency = Date.now() - requestTime;
    
    // Log slow requests in development
    if (__DEV__ && latency > 5000) {
      console.warn(`Slow API call: ${response.config.url} took ${latency}ms`);
    }
    
    return response;
  },
  async (error: AxiosError) => {
    const originalRequest = error.config as InternalAxiosRequestConfig & { _retry?: boolean };
    
    // Handle token expiration
    if (error.response?.status === 401 && !originalRequest._retry) {
      originalRequest._retry = true;
      
      try {
        const refreshToken = useAuthStore.getState().refreshToken;
        
        if (!refreshToken) {
          useAuthStore.getState().clearAuth();
          return Promise.reject(error);
        }
        
        // Refresh token request
        const response = await axios.post(`${API_BASE_URL}/auth/refresh`, {
          refreshToken,
        });
        
        const { token, refreshToken: newRefreshToken } = response.data;
        
        // Update store
        useAuthStore.setState({
          token,
          refreshToken: newRefreshToken,
        });
        
        // Retry original request
        originalRequest.headers.Authorization = `Bearer ${token}`;
        return api(originalRequest);
      } catch (refreshError) {
        useAuthStore.getState().clearAuth();
        return Promise.reject(refreshError);
      }
    }
    
    // Handle network errors
    if (!error.response) {
      // Network error - could be offline
      console.error('Network error:', error.message);
    }
    
    return Promise.reject(error);
  }
);

// Mobile-optimized request helpers
export const mobileApi = {
  // Optimized for mobile: smaller payload, compression
  get: <T>(url: string, params?: object, options?: { compressed?: boolean }) =>
    api.get<T>(url, {
      params,
      headers: options?.compressed ? { 'Accept-Encoding': 'gzip' } : undefined,
    }),
    
  // Optimized POST with progress tracking for uploads
  post: <T>(url: string, data: unknown, onProgress?: (progress: number) => void) =>
    api.post<T>(url, data, {
      onUploadProgress: onProgress
        ? (progressEvent) => {
            const progress = progressEvent.total
              ? Math.round((progressEvent.loaded * 100) / progressEvent.total)
              : 0;
            onProgress(progress);
          }
        : undefined,
    }),
    
  // Cancelable requests for cleanup
  createCancelToken: () => axios.CancelToken.source(),
};
```

### 1.4 Storage Solutions

**Storage Hierarchy:**

```
┌─────────────────────────────────────────────────────────────────┐
│                    STORAGE ARCHITECTURE                         │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│  ┌─────────────────────────────────────────────────────────┐   │
│  │  Secure Storage (expo-secure-store)                     │   │
│  │  - Auth tokens                                          │   │
│  │  - Refresh tokens                                       │   │
│  │  - API keys                                             │   │
│  │  - Biometric auth state                                 │   │
│  │  Capacity: ~2KB per key                                 │   │
│  └─────────────────────────────────────────────────────────┘   │
│                              │                                  │
│  ┌─────────────────────────────────────────────────────────┐   │
│  │  Fast Storage (MMKV)                                    │   │
│  │  - User preferences                                     │   │
│  │  - App state                                            │   │
│  │  - Cached data                                          │   │
│  │  - Offline queue                                        │   │
│  │  Capacity: Unlimited (disk-based)                       │   │
│  └─────────────────────────────────────────────────────────┘   │
│                              │                                  │
│  ┌─────────────────────────────────────────────────────────┐   │
│  │  File System (expo-file-system)                         │   │
│  │  - Images/Videos                                        │   │
│  │  - Documents                                            │   │
│  │  - Downloaded files                                     │   │
│  │  - Cache directory                                      │   │
│  └─────────────────────────────────────────────────────────┘   │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
```

**Storage Implementation:**

```typescript
// lib/storage.ts
import * as SecureStore from 'expo-secure-store';
import { MMKV } from 'react-native-mmkv';
import * as FileSystem from 'expo-file-system';

// Secure Storage for sensitive data
export const secureStorage = {
  async getItem(key: string): Promise<string | null> {
    try {
      return await SecureStore.getItemAsync(key);
    } catch (error) {
      console.error('SecureStore get error:', error);
      return null;
    }
  },
  
  async setItem(key: string, value: string): Promise<void> {
    try {
      await SecureStore.setItemAsync(key, value);
    } catch (error) {
      console.error('SecureStore set error:', error);
    }
  },
  
  async removeItem(key: string): Promise<void> {
    try {
      await SecureStore.deleteItemAsync(key);
    } catch (error) {
      console.error('SecureStore delete error:', error);
    }
  },
};

// MMKV for fast, non-sensitive storage
export const fastStorage = new MMKV({
  id: 'app-storage',
  encryptionKey: 'your-encryption-key', // Optional encryption
});

// File System helpers
export const fileStorage = {
  async saveFile(uri: string, filename: string, directory: 'cache' | 'documents' = 'cache') {
    const baseDir = directory === 'cache' 
      ? FileSystem.cacheDirectory 
      : FileSystem.documentDirectory;
    
    const destination = `${baseDir}${filename}`;
    
    await FileSystem.copyAsync({
      from: uri,
      to: destination,
    });
    
    return destination;
  },
  
  async getFileSize(uri: string): Promise<number> {
    const info = await FileSystem.getInfoAsync(uri);
    return info.exists && 'size' in info ? info.size : 0;
  },
  
  async clearCache(): Promise<void> {
    if (FileSystem.cacheDirectory) {
      await FileSystem.deleteAsync(FileSystem.cacheDirectory);
    }
  },
  
  async getCacheSize(): Promise<number> {
    if (!FileSystem.cacheDirectory) return 0;
    
    const info = await FileSystem.getInfoAsync(FileSystem.cacheDirectory);
    return info.exists && 'size' in info ? info.size : 0;
  },
};
```

---

## 2. Backend Adaptations for Mobile

### 2.1 API Optimization Strategy

```
┌─────────────────────────────────────────────────────────────────┐
│                  MOBILE API OPTIMIZATION                        │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│  Request Optimizations:                                         │
│  ├── Field selection (?fields=id,name,email)                    │
│  ├── Pagination (cursor-based)                                  │
│  ├── Compression (gzip/brotli)                                  │
│  └── Request batching                                           │
│                                                                 │
│  Response Optimizations:                                        │
│  ├── Response size limits (<100KB typical)                      │
│  ├── Image optimization (WebP, resizing)                        │
│  ├── Delta sync for updates                                     │
│  └── ETag caching                                               │
│                                                                 │
│  Mobile-Specific Headers:                                       │
│  ├── X-Platform: ios|android                                    │
│  ├── X-App-Version: 1.0.0                                       │
│  ├── X-Network-Type: 4g|wifi|3g                                 │
│  └── X-Request-Priority: high|low                               │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
```

**Mobile-Optimized Endpoints:**

```typescript
// Backend API Design (Node.js/Express example)

// 1. Field Selection Support
app.get('/api/users/:id', async (req, res) => {
  const { fields } = req.query;
  const fieldList = fields ? fields.split(',') : null;
  
  const user = await User.findById(req.params.id, fieldList);
  
  // Add ETag for caching
  const etag = crypto.createHash('md5').update(JSON.stringify(user)).digest('hex');
  res.setHeader('ETag', etag);
  
  // Check if client has cached version
  if (req.headers['if-none-match'] === etag) {
    return res.status(304).end();
  }
  
  res.json(user);
});

// 2. Cursor-Based Pagination
app.get('/api/items', async (req, res) => {
  const { cursor, limit = 20, search } = req.query;
  
  const query: any = {};
  if (cursor) {
    query._id = { $gt: cursor };
  }
  if (search) {
    query.name = { $regex: search, $options: 'i' };
  }
  
  const items = await Item.find(query)
    .sort({ _id: 1 })
    .limit(parseInt(limit) + 1)
    .lean();
  
  const hasMore = items.length > limit;
  const results = hasMore ? items.slice(0, -1) : items;
  
  res.json({
    data: results,
    nextCursor: hasMore ? results[results.length - 1]._id : null,
    hasMore,
  });
});

// 3. Delta Sync Endpoint
app.get('/api/sync', async (req, res) => {
  const { since, entity } = req.query;
  const sinceDate = new Date(since);
  
  const changes = await ChangeLog.find({
    entity,
    timestamp: { $gt: sinceDate },
  }).sort({ timestamp: 1 });
  
  const deleted = changes.filter(c => c.action === 'DELETE').map(c => c.entityId);
  const updated = changes.filter(c => c.action !== 'DELETE');
  
  res.json({
    updated,
    deleted,
    syncTimestamp: new Date().toISOString(),
  });
});

// 4. Batch Operations
app.post('/api/batch', async (req, res) => {
  const { operations } = req.body;
  const results = [];
  
  for (const op of operations) {
    try {
      switch (op.method) {
        case 'GET':
          results.push(await handleGet(op.path, op.params));
          break;
        case 'POST':
          results.push(await handlePost(op.path, op.body));
          break;
        case 'PATCH':
          results.push(await handlePatch(op.path, op.body));
          break;
        case 'DELETE':
          results.push(await handleDelete(op.path));
          break;
      }
    } catch (error) {
      results.push({ error: error.message, path: op.path });
    }
  }
  
  res.json({ results });
});
```

### 2.2 Caching Strategy

```typescript
// Backend caching middleware
import Redis from 'ioredis';

const redis = new Redis(process.env.REDIS_URL);

// Mobile-aware caching
export const mobileCache = {
  // Cache GET requests for mobile clients
  middleware(duration = 300) {
    return async (req, res, next) => {
      // Skip caching for non-GET requests
      if (req.method !== 'GET') return next();
      
      // Skip caching for authenticated sensitive data
      if (req.path.includes('/sensitive')) return next();
      
      const cacheKey = `mobile:${req.headers['x-platform']}:${req.originalUrl}`;
      
      try {
        const cached = await redis.get(cacheKey);
        if (cached) {
          res.setHeader('X-Cache', 'HIT');
          return res.json(JSON.parse(cached));
        }
        
        // Override res.json to cache response
        const originalJson = res.json.bind(res);
        res.json = (data) => {
          redis.setex(cacheKey, duration, JSON.stringify(data));
          res.setHeader('X-Cache', 'MISS');
          return originalJson(data);
        };
        
        next();
      } catch (error) {
        next();
      }
    };
  },
  
  // Invalidate cache on mutations
  async invalidate(pattern: string) {
    const keys = await redis.keys(`mobile:*${pattern}*`);
    if (keys.length > 0) {
      await redis.del(...keys);
    }
  },
};
```

### 2.3 Push Notification Backend Setup

```typescript
// Backend push notification service
import admin from 'firebase-admin';
import apn from 'apn';

// Initialize Firebase Admin
admin.initializeApp({
  credential: admin.credential.cert(serviceAccount),
});

// APNs setup for iOS
const apnProvider = new apn.Provider({
  token: {
    key: process.env.APN_KEY_PATH,
    keyId: process.env.APN_KEY_ID,
    teamId: process.env.APN_TEAM_ID,
  },
  production: process.env.NODE_ENV === 'production',
});

export class PushNotificationService {
  // Store device tokens
  async registerDevice(userId: string, token: string, platform: 'ios' | 'android') {
    await DeviceToken.findOneAndUpdate(
      { userId, platform },
      { token, updatedAt: new Date() },
      { upsert: true }
    );
  }
  
  // Send notification to user
  async sendToUser(userId: string, notification: NotificationPayload) {
    const devices = await DeviceToken.find({ userId });
    
    for (const device of devices) {
      if (device.platform === 'android') {
        await this.sendFCM(device.token, notification);
      } else {
        await this.sendAPNs(device.token, notification);
      }
    }
  }
  
  // Firebase Cloud Messaging
  private async sendFCM(token: string, payload: NotificationPayload) {
    const message = {
      token,
      notification: {
        title: payload.title,
        body: payload.body,
      },
      data: payload.data || {},
      android: {
        priority: 'high',
        notification: {
          channelId: payload.channel || 'default',
          sound: 'default',
        },
      },
    };
    
    try {
      await admin.messaging().send(message);
    } catch (error) {
      if (error.code === 'messaging/registration-token-not-registered') {
        // Remove invalid token
        await DeviceToken.deleteOne({ token });
      }
      throw error;
    }
  }
  
  // Apple Push Notification service
  private async sendAPNs(token: string, payload: NotificationPayload) {
    const note = new apn.Notification();
    note.alert = {
      title: payload.title,
      body: payload.body,
    };
    note.payload = payload.data || {};
    note.topic = process.env.BUNDLE_ID;
    note.sound = 'default';
    
    await apnProvider.send(note, token);
  }
  
  // Send to topic (broadcast)
  async sendToTopic(topic: string, payload: NotificationPayload) {
    await admin.messaging().sendToTopic(topic, {
      notification: {
        title: payload.title,
        body: payload.body,
      },
      data: payload.data || {},
    });
  }
}
```

---

## 3. Mobile-Specific Features Implementation

### 3.1 Push Notifications

```typescript
// services/notifications.ts
import * as Notifications from 'expo-notifications';
import * as Device from 'expo-device';
import Constants from 'expo-constants';
import { Platform } from 'react-native';
import { api } from '../lib/api';

// Configure notification behavior
Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowAlert: true,
    shouldPlaySound: true,
    shouldSetBadge: true,
  }),
});

export class NotificationService {
  private static notificationListener: any;
  private static responseListener: any;
  
  // Initialize and request permissions
  static async initialize() {
    if (!Device.isDevice) {
      console.log('Push notifications require physical device');
      return;
    }
    
    const { status: existingStatus } = await Notifications.getPermissionsAsync();
    let finalStatus = existingStatus;
    
    if (existingStatus !== 'granted') {
      const { status } = await Notifications.requestPermissionsAsync();
      finalStatus = status;
    }
    
    if (finalStatus !== 'granted') {
      console.log('Push notification permission denied');
      return;
    }
    
    // Get push token
    const token = await this.getPushToken();
    
    // Register with backend
    if (token) {
      await this.registerWithBackend(token);
    }
    
    // Set up notification channels for Android
    if (Platform.OS === 'android') {
      await this.setupAndroidChannels();
    }
    
    // Listen for notifications
    this.setupListeners();
  }
  
  private static async getPushToken(): Promise<string | null> {
    try {
      const token = await Notifications.getExpoPushTokenAsync({
        projectId: Constants.expoConfig?.extra?.eas.projectId,
      });
      return token.data;
    } catch (error) {
      console.error('Failed to get push token:', error);
      return null;
    }
  }
  
  private static async setupAndroidChannels() {
    await Notifications.setNotificationChannelAsync('default', {
      name: 'Default',
      importance: Notifications.AndroidImportance.MAX,
      vibrationPattern: [0, 250, 250, 250],
      lightColor: '#FF231F7C',
    });
    
    await Notifications.setNotificationChannelAsync('messages', {
      name: 'Messages',
      importance: Notifications.AndroidImportance.HIGH,
      sound: 'message_sound.wav',
      vibrationPattern: [0, 500, 200, 500],
    });
    
    await Notifications.setNotificationChannelAsync('updates', {
      name: 'Updates',
      importance: Notifications.AndroidImportance.DEFAULT,
    });
  }
  
  private static async registerWithBackend(token: string) {
    try {
      await api.post('/notifications/register', {
        token,
        platform: Platform.OS,
      });
    } catch (error) {
      console.error('Failed to register token:', error);
    }
  }
  
  private static setupListeners() {
    // Foreground notifications
    this.notificationListener = Notifications.addNotificationReceivedListener(
      (notification) => {
        console.log('Notification received:', notification);
        // Handle foreground notification
        this.handleNotification(notification);
      }
    );
    
    // Notification response (user tapped)
    this.responseListener = Notifications.addNotificationResponseReceivedListener(
      (response) => {
        const data = response.notification.request.content.data;
        this.handleNotificationTap(data);
      }
    );
  }
  
  private static handleNotification(notification: Notifications.Notification) {
    const { title, body, data } = notification.request.content;
    
    // Update badge count
    if (data?.badgeCount) {
      Notifications.setBadgeCountAsync(data.badgeCount);
    }
    
    // Show in-app notification banner
    // (Implement with your UI library)
  }
  
  private static handleNotificationTap(data: any) {
    // Navigate based on notification type
    switch (data?.type) {
      case 'message':
        // Navigate to chat
        break;
      case 'task':
        // Navigate to task detail
        break;
      default:
        // Navigate to home
    }
  }
  
  static cleanup() {
    if (this.notificationListener) {
      Notifications.removeNotificationSubscription(this.notificationListener);
    }
    if (this.responseListener) {
      Notifications.removeNotificationSubscription(this.responseListener);
    }
  }
  
  // Schedule local notification
  static async scheduleLocalNotification(
    title: string,
    body: string,
    trigger: Notifications.NotificationTriggerInput
  ) {
    await Notifications.scheduleNotificationAsync({
      content: { title, body },
      trigger,
    });
  }
  
  // Clear badge
  static async clearBadge() {
    await Notifications.setBadgeCountAsync(0);
  }
}
```

### 3.2 Deep Linking

```typescript
// navigation/DeepLinking.ts
import * as Linking from 'expo-linking';
import { NavigationContainer } from '@react-navigation/native';

const linking = {
  prefixes: [
    'myapp://',
    'https://myapp.com',
    'https://*.myapp.com',
  ],
  
  config: {
    screens: {
      Main: {
        screens: {
          Home: 'home',
          Profile: 'profile/:userId?',
          Settings: 'settings',
        },
      },
      Auth: {
        screens: {
          Login: 'login',
          Register: 'register',
          ResetPassword: 'reset-password/:token',
        },
      },
      Modal: {
        screens: {
          TaskDetail: 'task/:taskId',
          MessageThread: 'messages/:threadId',
        },
      },
    },
  },
  
  // Custom getInitialURL for handling app launch from deep link
  async getInitialURL() {
    // First, check if app was opened from a deep link
    const url = await Linking.getInitialURL();
    
    if (url != null) {
      return url;
    }
    
    // Check for notification deep link
    // (handled separately in notification service)
    
    return null;
  },
  
  // Subscribe to incoming links
  subscribe(listener: (url: string) => void) {
    const linkingSubscription = Linking.addEventListener('url', ({ url }) => {
      listener(url);
    });
    
    return () => {
      linkingSubscription.remove();
    };
  },
};

// Usage in App.tsx
export default function App() {
  return (
    <NavigationContainer linking={linking}>
      {/* Your navigation */}
    </NavigationContainer>
  );
}

// Universal Links / App Links Configuration

// iOS: Associated Domains (apple-app-site-association)
// Place in public/.well-known/apple-app-site-association
{
  "applinks": {
    "apps": [],
    "details": [
      {
        "appID": "TEAM_ID.com.yourcompany.saas",
        "paths": ["/home/*", "/profile/*", "/task/*"]
      }
    ]
  }
}

// Android: Asset Links
// Place in public/.well-known/assetlinks.json
[
  {
    "relation": ["delegate_permission/common.handle_all_urls"],
    "target": {
      "namespace": "android_app",
      "package_name": "com.yourcompany.saas",
      "sha256_cert_fingerprints": ["YOUR_CERT_FINGERPRINT"]
    }
  }
]
```

### 3.3 Biometric Authentication

```typescript
// services/biometrics.ts
import * as LocalAuthentication from 'expo-local-authentication';
import { useAuthStore } from '../stores/authStore';

export class BiometricService {
  // Check if biometrics are available
  static async isAvailable(): Promise<boolean> {
    const compatible = await LocalAuthentication.hasHardwareAsync();
    const enrolled = await LocalAuthentication.isEnrolledAsync();
    return compatible && enrolled;
  }
  
  // Get available biometric types
  static async getBiometricTypes(): Promise<LocalAuthentication.SecurityLevel[]> {
    const types = await LocalAuthentication.supportedAuthenticationTypesAsync();
    return types;
  }
  
  // Authenticate with biometrics
  static async authenticate(
    promptMessage = 'Authenticate to continue'
  ): Promise<boolean> {
    try {
      const result = await LocalAuthentication.authenticateAsync({
        promptMessage,
        fallbackLabel: 'Use passcode',
        disableDeviceFallback: false,
        cancelLabel: 'Cancel',
      });
      
      return result.success;
    } catch (error) {
      console.error('Biometric authentication error:', error);
      return false;
    }
  }
  
  // Enable biometric login
  static async enableBiometricLogin(): Promise<boolean> {
    const authenticated = await this.authenticate(
      'Enable biometric login'
    );
    
    if (authenticated) {
      useAuthStore.getState().setBiometricEnabled(true);
      return true;
    }
    
    return false;
  }
  
  // Disable biometric login
  static async disableBiometricLogin(): Promise<void> {
    useAuthStore.getState().setBiometricEnabled(false);
  }
  
  // Check if biometric login is enabled
  static isBiometricEnabled(): boolean {
    return useAuthStore.getState().isBiometricEnabled;
  }
  
  // Attempt biometric login
  static async attemptBiometricLogin(): Promise<boolean> {
    if (!this.isBiometricEnabled()) {
      return false;
    }
    
    const authenticated = await this.authenticate();
    
    if (authenticated) {
      // Retrieve stored credentials and login
      // (Implement based on your auth flow)
      return true;
    }
    
    return false;
  }
}

// React Hook for biometric auth
export function useBiometricAuth() {
  const [isAvailable, setIsAvailable] = useState(false);
  const [isEnabled, setIsEnabled] = useState(false);
  
  useEffect(() => {
    checkAvailability();
  }, []);
  
  const checkAvailability = async () => {
    const available = await BiometricService.isAvailable();
    setIsAvailable(available);
    setIsEnabled(BiometricService.isBiometricEnabled());
  };
  
  const enable = async () => {
    const success = await BiometricService.enableBiometricLogin();
    if (success) {
      setIsEnabled(true);
    }
    return success;
  };
  
  const disable = async () => {
    await BiometricService.disableBiometricLogin();
    setIsEnabled(false);
  };
  
  const authenticate = () => BiometricService.authenticate();
  
  return {
    isAvailable,
    isEnabled,
    enable,
    disable,
    authenticate,
  };
}
```

### 3.4 Offline Support Strategy

```typescript
// lib/offline.ts
import NetInfo from '@react-native-community/netinfo';
import { MMKV } from 'react-native-mmkv';
import { QueryClient } from '@tanstack/react-query';

const offlineStorage = new MMKV({ id: 'offline-queue' });

interface QueuedAction {
  id: string;
  timestamp: number;
  method: 'POST' | 'PATCH' | 'DELETE';
  url: string;
  data?: unknown;
  retryCount: number;
}

export class OfflineManager {
  private static syncInProgress = false;
  
  // Initialize offline support
  static initialize(queryClient: QueryClient) {
    // Listen for network changes
    NetInfo.addEventListener((state) => {
      if (state.isConnected) {
        this.syncPendingActions();
      }
    });
    
    // Set up query client for offline support
    queryClient.setDefaultOptions({
      queries: {
        networkMode: 'offlineFirst',
      },
      mutations: {
        networkMode: 'offlineFirst',
      },
    });
  }
  
  // Queue action for later sync
  static queueAction(action: Omit<QueuedAction, 'id' | 'timestamp' | 'retryCount'>) {
    const queuedAction: QueuedAction = {
      ...action,
      id: `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
      timestamp: Date.now(),
      retryCount: 0,
    };
    
    const queue = this.getQueue();
    queue.push(queuedAction);
    offlineStorage.set('actionQueue', JSON.stringify(queue));
    
    return queuedAction.id;
  }
  
  // Get pending actions
  static getQueue(): QueuedAction[] {
    const queue = offlineStorage.getString('actionQueue');
    return queue ? JSON.parse(queue) : [];
  }
  
  // Remove action from queue
  static removeAction(id: string) {
    const queue = this.getQueue().filter((a) => a.id !== id);
    offlineStorage.set('actionQueue', JSON.stringify(queue));
  }
  
  // Sync pending actions
  static async syncPendingActions() {
    if (this.syncInProgress) return;
    
    const queue = this.getQueue();
    if (queue.length === 0) return;
    
    this.syncInProgress = true;
    
    for (const action of queue) {
      try {
        await this.executeAction(action);
        this.removeAction(action.id);
      } catch (error) {
        // Increment retry count
        action.retryCount++;
        
        // Remove if max retries reached
        if (action.retryCount >= 3) {
          this.removeAction(action.id);
          // Notify user of failed sync
        }
      }
    }
    
    this.syncInProgress = false;
  }
  
  private static async executeAction(action: QueuedAction) {
    const { api } = await import('./api');
    
    switch (action.method) {
      case 'POST':
        await api.post(action.url, action.data);
        break;
      case 'PATCH':
        await api.patch(action.url, action.data);
        break;
      case 'DELETE':
        await api.delete(action.url);
        break;
    }
  }
  
  // Check if online
  static async isOnline(): Promise<boolean> {
    const state = await NetInfo.fetch();
    return !!state.isConnected;
  }
  
  // Get connection type
  static async getConnectionType(): Promise<string> {
    const state = await NetInfo.fetch();
    return state.type;
  }
}

// Optimistic updates hook
export function useOptimisticMutation() {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: async (variables: any) => {
      // Check if online
      const isOnline = await OfflineManager.isOnline();
      
      if (!isOnline) {
        // Queue for later
        OfflineManager.queueAction({
          method: 'POST',
          url: variables.url,
          data: variables.data,
        });
        
        // Return optimistic data
        return { optimistic: true, ...variables.data };
      }
      
      // Execute normally
      return api.post(variables.url, variables.data);
    },
    onMutate: async (variables) => {
      // Cancel outgoing refetches
      await queryClient.cancelQueries({ queryKey: variables.queryKey });
      
      // Snapshot previous value
      const previousData = queryClient.getQueryData(variables.queryKey);
      
      // Optimistically update
      queryClient.setQueryData(variables.queryKey, (old: any) => ({
        ...old,
        ...variables.optimisticData,
      }));
      
      return { previousData };
    },
    onError: (err, variables, context) => {
      // Rollback on error
      queryClient.setQueryData(variables.queryKey, context?.previousData);
    },
    onSettled: (data, error, variables) => {
      // Refetch after mutation
      queryClient.invalidateQueries({ queryKey: variables.queryKey });
    },
  });
}
```

### 3.5 Image Handling & Camera Integration

```typescript
// services/media.ts
import * as ImagePicker from 'expo-image-picker';
import * as ImageManipulator from 'expo-image-manipulator';
import * as FileSystem from 'expo-file-system';
import { api } from '../lib/api';

export interface ImageUploadOptions {
  maxWidth?: number;
  maxHeight?: number;
  quality?: number;
  compress?: number;
  format?: 'jpeg' | 'png';
}

export class MediaService {
  // Request camera permissions
  static async requestCameraPermissions(): Promise<boolean> {
    const { status } = await ImagePicker.requestCameraPermissionsAsync();
    return status === 'granted';
  }
  
  // Request media library permissions
  static async requestMediaLibraryPermissions(): Promise<boolean> {
    const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
    return status === 'granted';
  }
  
  // Take photo with camera
  static async takePhoto(options: ImageUploadOptions = {}): Promise<string | null> {
    const hasPermission = await this.requestCameraPermissions();
    if (!hasPermission) {
      throw new Error('Camera permission denied');
    }
    
    const result = await ImagePicker.launchCameraAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      allowsEditing: true,
      aspect: [4, 3],
      quality: options.quality ?? 0.8,
    });
    
    if (result.canceled) return null;
    
    return this.processImage(result.assets[0].uri, options);
  }
  
  // Pick image from library
  static async pickImage(options: ImageUploadOptions = {}): Promise<string | null> {
    const hasPermission = await this.requestMediaLibraryPermissions();
    if (!hasPermission) {
      throw new Error('Media library permission denied');
    }
    
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      allowsEditing: true,
      aspect: [4, 3],
      quality: options.quality ?? 0.8,
      allowsMultipleSelection: false,
    });
    
    if (result.canceled) return null;
    
    return this.processImage(result.assets[0].uri, options);
  }
  
  // Process and optimize image
  static async processImage(
    uri: string,
    options: ImageUploadOptions
  ): Promise<string> {
    const manipulations: ImageManipulator.Action[] = [];
    
    // Resize if needed
    if (options.maxWidth || options.maxHeight) {
      manipulations.push({
        resize: {
          width: options.maxWidth,
          height: options.maxHeight,
        },
      });
    }
    
    // Compress image
    const processed = await ImageManipulator.manipulateAsync(
      uri,
      manipulations,
      {
        compress: options.compress ?? 0.8,
        format: options.format === 'png' 
          ? ImageManipulator.SaveFormat.PNG 
          : ImageManipulator.SaveFormat.JPEG,
      }
    );
    
    return processed.uri;
  }
  
  // Upload image to server
  static async uploadImage(
    uri: string,
    endpoint: string,
    onProgress?: (progress: number) => void
  ): Promise<any> {
    // Get file info
    const fileInfo = await FileSystem.getInfoAsync(uri);
    
    if (!fileInfo.exists) {
      throw new Error('File does not exist');
    }
    
    // Create form data
    const formData = new FormData();
    const filename = uri.split('/').pop() || 'image.jpg';
    const match = /\.([a-zA-Z]+)$/.exec(filename);
    const type = match ? `image/${match[1]}` : 'image/jpeg';
    
    formData.append('file', {
      uri,
      name: filename,
      type,
    } as any);
    
    // Upload with progress
    const response = await api.post(endpoint, formData, {
      headers: {
        'Content-Type': 'multipart/form-data',
      },
      onUploadProgress: onProgress
        ? (progressEvent) => {
            const progress = progressEvent.total
              ? Math.round((progressEvent.loaded * 100) / progressEvent.total)
              : 0;
            onProgress(progress);
          }
        : undefined,
    });
    
    return response.data;
  }
  
  // Cache image for offline viewing
  static async cacheImage(url: string): Promise<string> {
    const filename = url.split('/').pop() || 'cached_image';
    const localPath = `${FileSystem.cacheDirectory}${filename}`;
    
    // Check if already cached
    const fileInfo = await FileSystem.getInfoAsync(localPath);
    if (fileInfo.exists) {
      return localPath;
    }
    
    // Download and cache
    await FileSystem.downloadAsync(url, localPath);
    
    return localPath;
  }
  
  // Clear image cache
  static async clearImageCache(): Promise<void> {
    if (FileSystem.cacheDirectory) {
      const files = await FileSystem.readDirectoryAsync(FileSystem.cacheDirectory);
      
      for (const file of files) {
        if (file.match(/\.(jpg|jpeg|png|gif|webp)$/i)) {
          await FileSystem.deleteAsync(`${FileSystem.cacheDirectory}${file}`);
        }
      }
    }
  }
  
  // Get cache size
  static async getCacheSize(): Promise<number> {
    if (!FileSystem.cacheDirectory) return 0;
    
    let totalSize = 0;
    const files = await FileSystem.readDirectoryAsync(FileSystem.cacheDirectory);
    
    for (const file of files) {
      if (file.match(/\.(jpg|jpeg|png|gif|webp)$/i)) {
        const info = await FileSystem.getInfoAsync(`${FileSystem.cacheDirectory}${file}`);
        if (info.exists && 'size' in info) {
          totalSize += info.size;
        }
      }
    }
    
    return totalSize;
  }
}

// React Hook for image handling
export function useImagePicker() {
  const [isLoading, setIsLoading] = useState(false);
  const [progress, setProgress] = useState(0);
  
  const pickImage = async (options?: ImageUploadOptions) => {
    setIsLoading(true);
    try {
      const uri = await MediaService.pickImage(options);
      return uri;
    } finally {
      setIsLoading(false);
    }
  };
  
  const takePhoto = async (options?: ImageUploadOptions) => {
    setIsLoading(true);
    try {
      const uri = await MediaService.takePhoto(options);
      return uri;
    } finally {
      setIsLoading(false);
    }
  };
  
  const uploadImage = async (uri: string, endpoint: string) => {
    setIsLoading(true);
    setProgress(0);
    try {
      const result = await MediaService.uploadImage(uri, endpoint, setProgress);
      return result;
    } finally {
      setIsLoading(false);
      setProgress(0);
    }
  };
  
  return {
    pickImage,
    takePhoto,
    uploadImage,
    isLoading,
    progress,
  };
}
```

---

## 4. Security Considerations

### 4.1 Secure Token Storage

```typescript
// lib/security.ts
import * as SecureStore from 'expo-secure-store';
import { MMKV } from 'react-native-mmkv';
import CryptoES from 'crypto-es';

// Keychain/Keystore configuration
const SECURE_STORE_OPTIONS = {
  keychainService: 'com.yourcompany.saas.auth',
  keychainAccessible: SecureStore.WHEN_UNLOCKED_THIS_DEVICE_ONLY,
};

export class SecureTokenManager {
  private static readonly TOKEN_KEY = 'auth_token';
  private static readonly REFRESH_TOKEN_KEY = 'refresh_token';
  private static readonly KEYCHAIN_USER = 'saas_user';
  
  // Store tokens securely
  static async storeTokens(
    token: string,
    refreshToken: string
  ): Promise<void> {
    try {
      // Encrypt tokens before storing
      const encryptedToken = this.encrypt(token);
      const encryptedRefreshToken = this.encrypt(refreshToken);
      
      await SecureStore.setItemAsync(
        this.TOKEN_KEY,
        encryptedToken,
        SECURE_STORE_OPTIONS
      );
      
      await SecureStore.setItemAsync(
        this.REFRESH_TOKEN_KEY,
        encryptedRefreshToken,
        SECURE_STORE_OPTIONS
      );
    } catch (error) {
      console.error('Failed to store tokens:', error);
      throw new Error('Token storage failed');
    }
  }
  
  // Retrieve tokens
  static async getTokens(): Promise<{ token: string | null; refreshToken: string | null }> {
    try {
      const encryptedToken = await SecureStore.getItemAsync(
        this.TOKEN_KEY,
        SECURE_STORE_OPTIONS
      );
      
      const encryptedRefreshToken = await SecureStore.getItemAsync(
        this.REFRESH_TOKEN_KEY,
        SECURE_STORE_OPTIONS
      );
      
      return {
        token: encryptedToken ? this.decrypt(encryptedToken) : null,
        refreshToken: encryptedRefreshToken ? this.decrypt(encryptedRefreshToken) : null,
      };
    } catch (error) {
      console.error('Failed to retrieve tokens:', error);
      return { token: null, refreshToken: null };
    }
  }
  
  // Clear tokens
  static async clearTokens(): Promise<void> {
    await SecureStore.deleteItemAsync(this.TOKEN_KEY, SECURE_STORE_OPTIONS);
    await SecureStore.deleteItemAsync(this.REFRESH_TOKEN_KEY, SECURE_STORE_OPTIONS);
  }
  
  // Encrypt data
  private static encrypt(data: string): string {
    const key = this.getEncryptionKey();
    return CryptoES.AES.encrypt(data, key).toString();
  }
  
  // Decrypt data
  private static decrypt(encryptedData: string): string {
    const key = this.getEncryptionKey();
    const bytes = CryptoES.AES.decrypt(encryptedData, key);
    return bytes.toString(CryptoES.enc.Utf8);
  }
  
  // Get or create encryption key
  private static getEncryptionKey(): string {
    // In production, use a key from secure storage or Keychain
    // This is a simplified example
    const key = SecureStore.getItem('encryption_key');
    if (key) return key;
    
    const newKey = CryptoES.lib.WordArray.random(256 / 8).toString();
    SecureStore.setItem('encryption_key', newKey);
    return newKey;
  }
}

// Token rotation
export class TokenRotation {
  private static readonly ROTATION_INTERVAL = 1000 * 60 * 60; // 1 hour
  
  static async scheduleRotation(): Promise<void> {
    // Implement token rotation logic
    // This should be called periodically or on app foreground
  }
}
```

### 4.2 Certificate Pinning

```typescript
// lib/sslPinning.ts
import { Platform } from 'react-native';

// SSL Certificate Pinning Configuration
export const sslPinningConfig = {
  // iOS: Add to Info.plist
  ios: {
    NSAppTransportSecurity: {
      NSAllowsArbitraryLoads: false,
      NSExceptionDomains: {
        'api.yourapp.com': {
          NSExceptionMinimumTLSVersion: 'TLSv1.2',
          NSExceptionRequiresForwardSecrecy: true,
          NSExceptionAllowsInsecureHTTPLoads: false,
          NSIncludesSubdomains: true,
        },
      },
    },
  },
  
  // Android: network_security_config.xml
  android: `
<?xml version="1.0" encoding="utf-8"?>
<network-security-config>
    <domain-config cleartextTrafficPermitted="false">
        <domain includeSubdomains="true">api.yourapp.com</domain>
        <pin-set expiration="2025-01-01">
            <pin digest="SHA-256">sha256/AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA=</pin>
            <pin digest="SHA-256">sha256/BBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBB=</pin>
        </pin-set>
        <trust-anchors>
            <certificates src="system"/>
        </trust-anchors>
    </domain-config>
</network-security-config>
  `,
};

// For Expo, use expo-ssl-pinning or eject and configure natively
// Alternative: TrustKit for iOS and OkHttp CertificatePinner for Android
```

### 4.3 App Attestation

```typescript
// lib/attestation.ts
import * as Device from 'expo-device';
import { Platform } from 'react-native';

// iOS: DeviceCheck / App Attest
// Android: SafetyNet / Play Integrity API

export class AppAttestation {
  // Verify device integrity
  static async verifyIntegrity(): Promise<{
    isValid: boolean;
    attestation?: string;
  }> {
    if (Platform.OS === 'ios') {
      return this.verifyIOS();
    } else {
      return this.verifyAndroid();
    }
  }
  
  private static async verifyIOS() {
    // Use expo-device-check or native module
    // Requires ejecting from Expo or custom dev client
    
    // Simplified check
    const isSimulator = !Device.isDevice;
    
    return {
      isValid: !isSimulator,
      attestation: isSimulator ? undefined : 'ios_attestation_token',
    };
  }
  
  private static async verifyAndroid() {
    // Use SafetyNet or Play Integrity API
    // Requires native module integration
    
    return {
      isValid: true,
      attestation: 'android_attestation_token',
    };
  }
  
  // Jailbreak/Root detection
  static async detectCompromise(): Promise<boolean> {
    // Basic checks
    const checks = await Promise.all([
      this.checkForJailbreak(),
      this.checkForRoot(),
      this.checkForDebugger(),
    ]);
    
    return checks.some((check) => check);
  }
  
  private static async checkForJailbreak(): Promise<boolean> {
    if (Platform.OS !== 'ios') return false;
    
    // Check for common jailbreak indicators
    const jailbreakPaths = [
      '/Applications/Cydia.app',
      '/Library/MobileSubstrate',
      '/bin/bash',
      '/usr/sbin/sshd',
      '/etc/apt',
    ];
    
    // In production, use native module for file system checks
    return false;
  }
  
  private static async checkForRoot(): Promise<boolean> {
    if (Platform.OS !== 'android') return false;
    
    // Check for common root indicators
    const rootPaths = [
      '/system/app/Superuser.apk',
      '/sbin/su',
      '/system/bin/su',
      '/system/xbin/su',
      '/data/local/xbin/su',
      '/data/local/bin/su',
      '/system/sd/xbin/su',
      '/system/bin/failsafe/su',
      '/data/local/su',
    ];
    
    return false;
  }
  
  private static async checkForDebugger(): Promise<boolean> {
    // Check if app is being debugged
    return __DEV__;
  }
}

// Request signing for sensitive operations
export class SecureRequestSigner {
  static async signRequest(
    method: string,
    path: string,
    body: string,
    timestamp: number
  ): Promise<string> {
    // Create request signature using device-specific key
    const data = `${method}:${path}:${body}:${timestamp}`;
    
    // In production, use secure enclave/keychain for signing
    return `signed_${data}`;
  }
}
```

---

## 5. Performance Optimization

### 5.1 Bundle Size Optimization

```typescript
// metro.config.js
const { getDefaultConfig } = require('expo/metro-config');

const config = getDefaultConfig(__dirname);

// Enable tree shaking
config.transformer.minifierConfig = {
  keep_classnames: false,
  keep_fnames: false,
  mangle: {
    keep_classnames: false,
    keep_fnames: false,
  },
};

// Bundle splitting
config.serializer.customSerializer = ({ entryPoint, preModules, graph, options }) => {
  // Custom bundle splitting logic
  return require('metro/src/DeltaBundler/Serializers/plainJSBundle')(
    entryPoint,
    preModules,
    graph,
    options
  );
};

// Asset optimization
config.resolver.assetExts.push('webp');

module.exports = config;
```

**Code Splitting Strategy:**

```typescript
// Lazy load heavy components
const HeavyChart = React.lazy(() => import('./components/HeavyChart'));
const AnalyticsDashboard = React.lazy(() => import('./screens/AnalyticsDashboard'));

// Dynamic imports for features
const loadFeature = (featureName: string) => {
  switch (featureName) {
    case 'analytics':
      return import('./features/analytics');
    case 'reports':
      return import('./features/reports');
    default:
      return null;
  }
};
```

### 5.2 Image Optimization

```typescript
// components/OptimizedImage.tsx
import React, { useState, useCallback } from 'react';
import { Image, View, ActivityIndicator } from 'react-native';
import { useImageCache } from '../hooks/useImageCache';

interface OptimizedImageProps {
  source: { uri: string };
  style?: any;
  resizeMode?: 'cover' | 'contain' | 'stretch' | 'center';
  placeholder?: any;
  priority?: 'low' | 'normal' | 'high';
}

export const OptimizedImage: React.FC<OptimizedImageProps> = ({
  source,
  style,
  resizeMode = 'cover',
  placeholder,
  priority = 'normal',
}) => {
  const [isLoading, setIsLoading] = useState(true);
  const [hasError, setHasError] = useState(false);
  const cachedUri = useImageCache(source.uri);
  
  const onLoad = useCallback(() => {
    setIsLoading(false);
  }, []);
  
  const onError = useCallback(() => {
    setIsLoading(false);
    setHasError(true);
  }, []);
  
  return (
    <View style={style}>
      {(isLoading || hasError) && placeholder && (
        <View style={[style, { position: 'absolute' }]}>
          {placeholder}
        </View>
      )}
      
      <Image
        source={{ uri: cachedUri || source.uri }}
        style={style}
        resizeMode={resizeMode}
        onLoad={onLoad}
        onError={onError}
        // Priority loading
        progressiveRenderingEnabled={true}
      />
      
      {isLoading && (
        <View style={[style, { position: 'absolute', justifyContent: 'center', alignItems: 'center' }]}>
          <ActivityIndicator />
        </View>
      )}
    </View>
  );
};
```

### 5.3 List Virtualization

```typescript
// components/VirtualizedList.tsx
import React, { useCallback, useMemo } from 'react';
import {
  FlatList,
  View,
  Text,
  Dimensions,
  ActivityIndicator,
} from 'react-native';

interface VirtualizedListProps<T> {
  data: T[];
  renderItem: (item: T, index: number) => React.ReactNode;
  keyExtractor: (item: T, index: number) => string;
  onEndReached?: () => void;
  onEndReachedThreshold?: number;
  ListEmptyComponent?: React.ReactNode;
  ListFooterComponent?: React.ReactNode;
  estimatedItemHeight: number;
  numColumns?: number;
}

const { height: SCREEN_HEIGHT } = Dimensions.get('window');

export function VirtualizedList<T>({
  data,
  renderItem,
  keyExtractor,
  onEndReached,
  onEndReachedThreshold = 0.5,
  ListEmptyComponent,
  ListFooterComponent,
  estimatedItemHeight,
  numColumns = 1,
}: VirtualizedListProps<T>) {
  // Calculate optimal window size
  const windowSize = useMemo(() => {
    const visibleItems = Math.ceil(SCREEN_HEIGHT / estimatedItemHeight);
    return Math.max(visibleItems * 3, 21); // At least 3 screens worth
  }, [estimatedItemHeight]);
  
  // Memoized render function
  const renderItemCallback = useCallback(
    ({ item, index }: { item: T; index: number }) => renderItem(item, index),
    [renderItem]
  );
  
  // Get item layout for performance
  const getItemLayout = useCallback(
    (_: any, index: number) => ({
      length: estimatedItemHeight,
      offset: estimatedItemHeight * index,
      index,
    }),
    [estimatedItemHeight]
  );
  
  return (
    <FlatList
      data={data}
      renderItem={renderItemCallback}
      keyExtractor={keyExtractor}
      onEndReached={onEndReached}
      onEndReachedThreshold={onEndReachedThreshold}
      ListEmptyComponent={ListEmptyComponent}
      ListFooterComponent={ListFooterComponent}
      getItemLayout={getItemLayout}
      windowSize={windowSize}
      maxToRenderPerBatch={10}
      updateCellsBatchingPeriod={50}
      removeClippedSubviews={true}
      initialNumToRender={Math.ceil(SCREEN_HEIGHT / estimatedItemHeight)}
      numColumns={numColumns}
      // Performance optimizations
      disableVirtualization={false}
      maintainVisibleContentPosition={{
        minIndexForVisible: 0,
      }}
    />
  );
}
```

### 5.4 Memory Management

```typescript
// hooks/useMemoryManagement.ts
import { useEffect, useRef } from 'react';
import { AppState, AppStateStatus } from 'react-native';

export function useMemoryManagement() {
  const appState = useRef(AppState.currentState);
  
  useEffect(() => {
    const subscription = AppState.addEventListener('change', handleAppStateChange);
    
    return () => {
      subscription.remove();
    };
  }, []);
  
  const handleAppStateChange = (nextAppState: AppStateStatus) => {
    if (
      appState.current.match(/inactive|background/) &&
      nextAppState === 'active'
    ) {
      // App came to foreground - reload critical data
      console.log('App has come to the foreground!');
    } else if (
      appState.current === 'active' &&
      nextAppState.match(/inactive|background/)
    ) {
      // App went to background - cleanup memory
      console.log('App has gone to the background!');
      cleanupMemory();
    }
    
    appState.current = nextAppState;
  };
  
  const cleanupMemory = () => {
    // Clear image caches
    // Release unused resources
    // Cancel pending network requests
    // Clear non-essential state
  };
}

// Memory warning handler
export function useMemoryWarning() {
  useEffect(() => {
    // iOS memory warning
    const memoryWarningSubscription = AppState.addEventListener(
      'memoryWarning',
      () => {
        console.warn('Memory warning received!');
        // Emergency cleanup
        emergencyCleanup();
      }
    );
    
    return () => {
      memoryWarningSubscription.remove();
    };
  }, []);
  
  const emergencyCleanup = () => {
    // Clear all caches
    // Release heavy resources
    // Reduce quality of images
  };
}
```

---

## 6. CI/CD Pipeline

### 6.1 EAS Build Configuration

```json
// eas.json
{
  "cli": {
    "version": ">= 5.0.0"
  },
  "build": {
    "development": {
      "developmentClient": true,
      "distribution": "internal",
      "env": {
        "APP_ENV": "development"
      }
    },
    "preview": {
      "distribution": "internal",
      "android": {
        "buildType": "apk"
      },
      "env": {
        "APP_ENV": "staging"
      }
    },
    "production": {
      "autoIncrement": true,
      "env": {
        "APP_ENV": "production"
      }
    }
  },
  "submit": {
    "production": {
      "ios": {
        "ascAppId": "YOUR_APP_ID",
        "ascTeamId": "YOUR_TEAM_ID"
      },
      "android": {
        "track": "production"
      }
    }
  }
}
```

### 6.2 GitHub Actions Workflow

```yaml
# .github/workflows/mobile-ci.yml
name: Mobile CI/CD

on:
  push:
    branches: [main, develop]
  pull_request:
    branches: [main]

jobs:
  test:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
      
      - name: Setup Node.js
        uses: actions/setup-node@v3
        with:
          node-version: '18'
          cache: 'npm'
      
      - name: Install dependencies
        run: npm ci
      
      - name: Run linting
        run: npm run lint
      
      - name: Run type checking
        run: npm run typecheck
      
      - name: Run unit tests
        run: npm test -- --coverage
      
      - name: Upload coverage
        uses: codecov/codecov-action@v3

  build-preview:
    needs: test
    runs-on: ubuntu-latest
    if: github.ref == 'refs/heads/develop'
    steps:
      - uses: actions/checkout@v3
      
      - name: Setup Node.js
        uses: actions/setup-node@v3
        with:
          node-version: '18'
          cache: 'npm'
      
      - name: Install dependencies
        run: npm ci
      
      - name: Setup EAS
        uses: expo/expo-github-action@v8
        with:
          eas-version: latest
          token: ${{ secrets.EXPO_TOKEN }}
      
      - name: Build Preview
        run: eas build --platform all --profile preview --non-interactive

  build-production:
    needs: test
    runs-on: ubuntu-latest
    if: github.ref == 'refs/heads/main'
    steps:
      - uses: actions/checkout@v3
      
      - name: Setup Node.js
        uses: actions/setup-node@v3
        with:
          node-version: '18'
          cache: 'npm'
      
      - name: Install dependencies
        run: npm ci
      
      - name: Setup EAS
        uses: expo/expo-github-action@v8
        with:
          eas-version: latest
          token: ${{ secrets.EXPO_TOKEN }}
      
      - name: Build Production
        run: eas build --platform all --profile production --non-interactive

  deploy-ota:
    needs: test
    runs-on: ubuntu-latest
    if: github.ref == 'refs/heads/main'
    steps:
      - uses: actions/checkout@v3
      
      - name: Setup Node.js
        uses: actions/setup-node@v3
        with:
          node-version: '18'
          cache: 'npm'
      
      - name: Install dependencies
        run: npm ci
      
      - name: Setup EAS
        uses: expo/expo-github-action@v8
        with:
          eas-version: latest
          token: ${{ secrets.EXPO_TOKEN }}
      
      - name: Publish OTA Update
        run: eas update --auto --non-interactive
```

### 6.3 Code Signing Management

```bash
# iOS Code Signing Setup
# 1. Create certificates and provisioning profiles in Apple Developer Portal
# 2. Use EAS credentials management

# Store credentials securely
eas credentials:configure --platform ios

# Android Keystore
eas credentials:configure --platform android

# Automatic credentials (recommended for teams)
eas build --platform ios --auto-submit
```

### 6.4 Testing Strategy

```typescript
// Testing configuration
// jest.config.js
module.exports = {
  preset: 'jest-expo',
  setupFilesAfterEnv: ['<rootDir>/jest.setup.js'],
  transformIgnorePatterns: [
    'node_modules/(?!((jest-)?react-native|@react-native(-community)?)|expo(nent)?|@expo(nent)?/.*|@expo-google-fonts/.*|react-navigation|@react-navigation/.*|@unimodules/.*|unimodules|sentry-expo|native-base|react-native-svg)',
  ],
  moduleFileExtensions: ['ts', 'tsx', 'js', 'jsx'],
  collectCoverageFrom: [
    'src/**/*.{ts,tsx}',
    '!src/**/*.d.ts',
    '!src/**/*.stories.{ts,tsx}',
  ],
  coverageThreshold: {
    global: {
      branches: 70,
      functions: 70,
      lines: 70,
      statements: 70,
    },
  },
};

// E2E Testing with Detox
// .detoxrc.js
module.exports = {
  testRunner: 'jest',
  runnerConfig: 'e2e/config.json',
  skipLegacyWorkersInjection: true,
  apps: {
    'ios.debug': {
      type: 'ios.app',
      binaryPath: 'ios/build/Build/Products/Debug-iphonesimulator/YourApp.app',
      build: 'xcodebuild -workspace ios/YourApp.xcworkspace -scheme YourApp -configuration Debug -sdk iphonesimulator -derivedDataPath ios/build',
    },
    'android.debug': {
      type: 'android.apk',
      binaryPath: 'android/app/build/outputs/apk/debug/app-debug.apk',
      build: 'cd android && ./gradlew assembleDebug assembleAndroidTest -DtestBuildType=debug',
    },
  },
  devices: {
    simulator: {
      type: 'ios.simulator',
      device: {
        type: 'iPhone 14',
      },
    },
    emulator: {
      type: 'android.emulator',
      device: {
        avdName: 'Pixel_4_API_30',
      },
    },
  },
  configurations: {
    'ios.sim.debug': {
      device: 'simulator',
      app: 'ios.debug',
    },
    'android.emu.debug': {
      device: 'emulator',
      app: 'android.debug',
    },
  },
};
```

---

## 7. Project Structure

```
saas-mobile/
├── src/
│   ├── api/                    # API layer
│   │   ├── client.ts
│   │   ├── endpoints/
│   │   └── interceptors/
│   ├── components/             # Reusable components
│   │   ├── common/
│   │   ├── forms/
│   │   └── lists/
│   ├── hooks/                  # Custom hooks
│   │   ├── useAuth.ts
│   │   ├── useApi.ts
│   │   └── useOffline.ts
│   ├── navigation/             # Navigation setup
│   │   ├── AppNavigator.tsx
│   │   ├── AuthNavigator.tsx
│   │   └── linking.ts
│   ├── screens/                # Screen components
│   │   ├── auth/
│   │   ├── main/
│   │   └── modals/
│   ├── services/               # Business logic
│   │   ├── auth.ts
│   │   ├── notifications.ts
│   │   └── media.ts
│   ├── stores/                 # State management
│   │   ├── authStore.ts
│   │   └── uiStore.ts
│   ├── lib/                    # Utilities
│   │   ├── storage.ts
│   │   ├── offline.ts
│   │   └── security.ts
│   ├── types/                  # TypeScript types
│   └── utils/                  # Helper functions
├── assets/                     # Static assets
├── __tests__/                  # Test files
├── e2e/                        # E2E tests
├── .github/                    # GitHub Actions
├── app.json                    # Expo config
├── eas.json                    # EAS config
├── package.json
└── tsconfig.json
```

---

## 8. Dependencies Summary

```json
{
  "dependencies": {
    "expo": "~50.0.0",
    "expo-secure-store": "~12.8.0",
    "expo-local-authentication": "~13.8.0",
    "expo-notifications": "~0.27.0",
    "expo-camera": "~14.0.0",
    "expo-image-picker": "~14.7.0",
    "expo-image-manipulator": "~11.8.0",
    "expo-file-system": "~16.0.0",
    "expo-device": "~5.9.0",
    "expo-linking": "~6.2.0",
    "expo-updates": "~0.24.0",
    "@react-navigation/native": "^6.1.9",
    "@react-navigation/stack": "^6.3.20",
    "@react-navigation/bottom-tabs": "^6.5.11",
    "@tanstack/react-query": "^5.17.0",
    "zustand": "^4.4.7",
    "axios": "^1.6.2",
    "react-native-mmkv": "^2.11.0",
    "@react-native-community/netinfo": "^11.2.0",
    "react-native-device-info": "^10.12.0",
    "crypto-es": "^2.1.0"
  },
  "devDependencies": {
    "@types/react": "~18.2.45",
    "typescript": "^5.3.3",
    "jest-expo": "~50.0.0",
    "detox": "^20.14.0",
    "eslint": "^8.56.0",
    "prettier": "^3.1.1"
  }
}
```

---

## 9. Implementation Roadmap

### Phase 1: Foundation (Weeks 1-2)
- [ ] Set up Expo project with recommended configuration
- [ ] Implement navigation structure
- [ ] Set up state management (Zustand + TanStack Query)
- [ ] Configure API client with interceptors
- [ ] Implement secure token storage

### Phase 2: Core Features (Weeks 3-4)
- [ ] Authentication flow
- [ ] User profile management
- [ ] Basic CRUD operations
- [ ] Offline support foundation
- [ ] Error handling and logging

### Phase 3: Mobile Features (Weeks 5-6)
- [ ] Push notifications
- [ ] Deep linking
- [ ] Biometric authentication
- [ ] Camera and image handling
- [ ] File upload/download

### Phase 4: Polish & Performance (Weeks 7-8)
- [ ] Performance optimization
- [ ] Image optimization
- [ ] List virtualization
- [ ] Memory management
- [ ] Security hardening

### Phase 5: Testing & Deployment (Weeks 9-10)
- [ ] Unit tests
- [ ] Integration tests
- [ ] E2E tests
- [ ] CI/CD pipeline
- [ ] App store submission

---

## 10. Key Recommendations

1. **Start with Expo SDK** - Faster development, easier maintenance
2. **Use TanStack Query** - Excellent caching and synchronization
3. **Implement offline-first** - Critical for mobile UX
4. **Prioritize security** - Use SecureStore for tokens, implement certificate pinning
5. **Optimize images** - Essential for mobile performance
6. **Test on real devices** - Simulators don't catch all issues
7. **Monitor performance** - Use Flipper, React Native Performance Monitor
8. **Plan for updates** - EAS Update for OTA updates
9. **Document APIs** - Mobile-specific endpoints need clear documentation
10. **Consider battery impact** - Minimize background activity and network requests
