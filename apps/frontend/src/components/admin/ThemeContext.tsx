'use client';

import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';

type Theme = 'dark' | 'light';

interface ThemeContextValue {
  theme: Theme;
  toggleTheme: () => void;
  isDark: boolean;
}

const ThemeContext = createContext<ThemeContextValue>({
  theme: 'dark',
  toggleTheme: () => {},
  isDark: true,
});

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const [theme, setTheme] = useState<Theme>('dark');

  useEffect(() => {
    const saved = localStorage.getItem('ct-theme') as Theme | null;
    if (saved === 'light' || saved === 'dark') {
      setTheme(saved);
    }
  }, []);

  const toggleTheme = useCallback(() => {
    setTheme(prev => {
      const next = prev === 'dark' ? 'light' : 'dark';
      localStorage.setItem('ct-theme', next);
      return next;
    });
  }, []);

  return (
    <ThemeContext.Provider value={{ theme, toggleTheme, isDark: theme === 'dark' }}>
      {children}
    </ThemeContext.Provider>
  );
}

export function useTheme() {
  return useContext(ThemeContext);
}

export const t = {
  bg: (isDark: boolean) => isDark ? '#080D1A' : '#F5F7FA',
  bgSecondary: (isDark: boolean) => isDark ? 'rgba(8,13,26,0.95)' : 'rgba(255,255,255,0.97)',
  bgTertiary: (isDark: boolean) => isDark ? 'rgba(8,13,26,0.6)' : 'rgba(245,247,250,0.8)',
  bgCard: (isDark: boolean) => isDark ? 'rgba(255,255,255,0.04)' : 'rgba(0,0,0,0.02)',
  bgInput: (isDark: boolean) => isDark ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.04)',
  bgHover: (isDark: boolean) => isDark ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.04)',
  bgChat: (isDark: boolean) => isDark ? 'rgba(8,13,26,0.6)' : 'rgba(248,250,252,0.9)',
  bgDropdown: (isDark: boolean) => isDark ? 'rgba(15,20,35,0.98)' : 'rgba(255,255,255,0.98)',
  border: (isDark: boolean) => isDark ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.08)',
  borderInput: (isDark: boolean) => isDark ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.12)',
  text: (isDark: boolean) => isDark ? '#e2e8f0' : '#1a202c',
  textPrimary: (isDark: boolean) => isDark ? 'text-white' : 'text-gray-900',
  textSecondary: (isDark: boolean) => isDark ? 'text-white/70' : 'text-gray-600',
  textMuted: (isDark: boolean) => isDark ? 'text-white/40' : 'text-gray-400',
  textDimmed: (isDark: boolean) => isDark ? 'text-white/20' : 'text-gray-300',
  textLabel: (isDark: boolean) => isDark ? 'text-white/50' : 'text-gray-500',
};
