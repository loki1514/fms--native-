import React, { createContext, useContext, useState, useCallback } from 'react';
import { useColorScheme } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';

type Theme = 'light' | 'dark';

interface ThemeContextType {
  theme: Theme;
  toggleTheme: () => void;
  isDark: boolean;
  colors: typeof lightColors;
}

const lightColors = {
  background: '#FFFFFF',
  surface: '#FFFFFF',
  surfaceElevated: '#F8FAFC',
  border: '#E2E8F0',
  primary: '#7C3AED',
  primaryDark: '#6D28D9',
  secondary: '#F59E0B',
  textPrimary: '#1A2332',
  textSecondary: '#64748B',
  textTertiary: '#94A3B8',
  textInverse: '#FFFFFF',
  success: '#10B981',
  warning: '#F59E0B',
  error: '#EF4444',
  info: '#3B82F6',
};

const darkColors: typeof lightColors = {
  background: '#0D1117',
  surface: '#161B22',
  surfaceElevated: '#1C2128',
  border: '#30363D',
  primary: '#7C3AED',
  primaryDark: '#9F67FF',
  secondary: '#F59E0B',
  textPrimary: '#F0F6FC',
  textSecondary: '#8B949E',
  textTertiary: '#6E7681',
  textInverse: '#0D1117',
  success: '#10B981',
  warning: '#F59E0B',
  error: '#EF4444',
  info: '#3B82F6',
};

const ThemeContext = createContext<ThemeContextType | undefined>(undefined);

const THEME_KEY = '@autopilot_theme';

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const systemScheme = useColorScheme();
  const [theme, setTheme] = useState<Theme>(systemScheme === 'dark' ? 'dark' : 'light');

  // Load saved theme on mount
  React.useEffect(() => {
    AsyncStorage.getItem(THEME_KEY).then((saved) => {
      if (saved === 'light' || saved === 'dark') {
        setTheme(saved);
      }
    });
  }, []);

  const toggleTheme = useCallback(() => {
    const newTheme = theme === 'light' ? 'dark' : 'light';
    setTheme(newTheme);
    AsyncStorage.setItem(THEME_KEY, newTheme);
  }, [theme]);

  const isDark = theme === 'dark';
  const colors = isDark ? darkColors : lightColors;

  return (
    <ThemeContext.Provider value={{ theme, toggleTheme, isDark, colors }}>
      {children}
    </ThemeContext.Provider>
  );
}

export function useTheme() {
  const context = useContext(ThemeContext);
  if (context === undefined) {
    throw new Error('useTheme must be used within a ThemeProvider');
  }
  return context;
}

export { lightColors, darkColors };
