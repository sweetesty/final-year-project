/**
 * Clinical Theme System for Vitals Fusion
 * Designed for clarity, professionalism, and accessibility.
 */

export const Colors = {
  light: {
    text: '#11181C',
    background: '#FFFFFF',
    tint: '#1D4ED8', // Clinical Dark Blue
    tabIconDefault: '#9BA1A6',
    tabIconSelected: '#1D4ED8',
    card: '#F8F9FA',
    border: '#E9ECEF',
    notification: '#FF3B30',
    muted: '#687076',
    error: '#CF222E',
    success: '#2DA44E',
    secondary: '#1D4ED8',
    vital: '#10B981',
    emergency: '#EF4444',
    icon: '#687076',
  },
  dark: {
    text: '#ECEDEE',
    background: '#0D1117',
    tint: '#3B82F6', // Brighter blue for high contrast in dark mode
    tabIconDefault: '#9BA1A6',
    tabIconSelected: '#3B82F6',
    card: '#161B22',
    border: '#30363D',
    muted: '#8B949E',
    error: '#F85149',
    success: '#3FB950',
    secondary: '#3B82F6',
    vital: '#34D399',
    emergency: '#F87171',
    icon: '#9BA1A6',
  },
} as const;

export const Spacing = {
  xs: 4,
  sm: 8,
  md: 16,
  lg: 24,
  xl: 32,
  xxl: 48,
} as const;

export const BorderRadius = {
  xs: 4,
  sm: 8,
  md: 12,
  lg: 16,
  xl: 24,
  full: 9999,
} as const;

export const Shadows = {
  light: {
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 8,
    elevation: 2,
  },
  medium: {
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.1,
    shadowRadius: 12,
    elevation: 4,
  },
  heavy: {
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.15,
    shadowRadius: 24,
    elevation: 8,
  },
} as const;
