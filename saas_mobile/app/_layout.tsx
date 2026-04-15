import React, { useEffect, Component, ReactNode } from 'react';
import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { useFonts } from 'expo-font';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import * as SplashScreen from 'expo-splash-screen';
import { AuthProvider, ThemeProvider } from '@/context';
import { useColorScheme, View, Text, StyleSheet } from 'react-native';

// Global error handler to catch silent crashes
if (typeof window !== 'undefined') {
  window.onerror = (msg, src, line, col, err) => {
    console.log('[GLOBAL ERROR]', msg, 'at', src, 'line:', line, 'col:', col, err?.stack);
    return false;
  };
  window.onunhandledrejection = (e) => {
    console.log('[UNHANDLED REJECTION]', e.reason);
  };
}

// Keep splash screen visible while loading
SplashScreen.preventAutoHideAsync();

// Error boundary to catch silent crashes
class ErrorBoundary extends Component<{ children: ReactNode; fallback?: ReactNode }, { hasError: boolean; error?: Error }> {
  constructor(props: { children: ReactNode; fallback?: ReactNode }) {
    super(props);
    this.state = { hasError: false };
  }
  static getDerivedStateFromError(error: Error) {
    return { hasError: true, error };
  }
  componentDidCatch(error: Error, info: React.ErrorInfo) {
    console.log('[ErrorBoundary] Caught:', error.message, info.componentStack);
  }
  render() {
    if (this.state.hasError) {
      return (
        <View style={styles.errorContainer}>
          <Text style={styles.errorTitle}>App Error</Text>
          <Text style={styles.errorMsg}>{this.state.error?.message}</Text>
          <Text style={styles.errorStack}>{this.state.error?.stack?.slice(0, 500)}</Text>
        </View>
      );
    }
    return this.props.children;
  }
}

const styles = StyleSheet.create({
  errorContainer: { flex: 1, backgroundColor: '#ffcccc', padding: 20, justifyContent: 'center' },
  errorTitle: { fontSize: 20, fontWeight: '700', color: '#cc0000', marginBottom: 8 },
  errorMsg: { fontSize: 14, color: '#333', marginBottom: 8 },
  errorStack: { fontSize: 10, color: '#666', fontFamily: 'monospace' },
});

export default function RootLayout() {
  const colorScheme = useColorScheme();
  console.log('[RootLayout] Rendering...');

  // Load custom fonts
  const [fontsLoaded, fontError] = useFonts({
    // Poppins
    'Poppins-Regular': require('../assets/fonts/Poppins-Regular.ttf'),
    'Poppins-Medium': require('../assets/fonts/Poppins-Medium.ttf'),
    'Poppins-SemiBold': require('../assets/fonts/Poppins-SemiBold.ttf'),
    'Poppins-Bold': require('../assets/fonts/Poppins-Bold.ttf'),
    // Urbanist (Fallback to main ttf if weights are missing)
    'Urbanist-Regular': require('../assets/fonts/Urbanist.ttf'),
    'Urbanist-Medium': require('../assets/fonts/Urbanist.ttf'),
    'Urbanist-SemiBold': require('../assets/fonts/Urbanist.ttf'),
    'Urbanist-Bold': require('../assets/fonts/Urbanist.ttf'),
    // Pixel/dot-matrix font for property brand names (Nothing OS style)
    'PressStart2P': require('../assets/fonts/PressStart2P.ttf'),
    'NDot57': require('../assets/fonts/NDot57.ttf'),
  });

  useEffect(() => {
    // Safety timeout to ensure splash screen hides even if fonts/context hang
    const timer = setTimeout(() => {
      SplashScreen.hideAsync().catch(() => {});
    }, 2000);

    if (fontsLoaded || fontError) {
      clearTimeout(timer);
      SplashScreen.hideAsync().catch(() => {});
    }

    return () => clearTimeout(timer);
  }, [fontsLoaded, fontError]);

  // Always render something so we can see if the error is in rendering
  const fontStatus = fontsLoaded ? 'FONTS OK' : fontError ? 'FONT ERROR' : 'LOADING FONTS';

  return (
    <ErrorBoundary>
      <GestureHandlerRootView style={{ flex: 1 }}>
        <SafeAreaProvider>
          <ThemeProvider>
            <AuthProvider>
              <Stack screenOptions={{ headerShown: false }} />
              <StatusBar style={colorScheme === 'dark' ? 'light' : 'dark'} />
            </AuthProvider>
          </ThemeProvider>
        </SafeAreaProvider>
      </GestureHandlerRootView>
    </ErrorBoundary>
  );
}
