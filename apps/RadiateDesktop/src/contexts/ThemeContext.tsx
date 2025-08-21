import React, { createContext, useContext, useState, useEffect } from 'react';
import { storage, STORAGE_KEYS } from '../config/api';

type Theme = 'dark' | 'light' | 'system';

interface ThemeContextType {
  theme: Theme;
  setTheme: (theme: Theme) => void;
  effectiveTheme: 'dark' | 'light';
}

const ThemeContext = createContext<ThemeContextType>({
  theme: 'dark',
  setTheme: () => {},
  effectiveTheme: 'dark',
});

export const useTheme = () => useContext(ThemeContext);

interface ThemeProviderProps {
  children: React.ReactNode;
}

export const ThemeProvider: React.FC<ThemeProviderProps> = ({ children }) => {
  const [theme, setThemeState] = useState<Theme>('dark');
  const [effectiveTheme, setEffectiveTheme] = useState<'dark' | 'light'>('dark');

  // Load theme from storage
  useEffect(() => {
    const loadTheme = async () => {
      const savedTheme = await storage.get(STORAGE_KEYS.THEME);
      if (savedTheme && ['dark', 'light', 'system'].includes(savedTheme)) {
        setThemeState(savedTheme as Theme);
      }
    };
    loadTheme();
  }, []);

  // Apply theme
  useEffect(() => {
    let actualTheme: 'dark' | 'light' = 'dark';

    if (theme === 'system') {
      // Check system preference
      const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
      actualTheme = prefersDark ? 'dark' : 'light';
    } else {
      actualTheme = theme === 'light' ? 'light' : 'dark';
    }

    setEffectiveTheme(actualTheme);

    // Apply theme to document
    document.documentElement.classList.remove('light', 'dark');
    document.documentElement.classList.add(actualTheme);

    // For glassmorphism, dark theme is default
    if (actualTheme === 'light') {
      document.documentElement.style.setProperty('--primary-color', '#64748b');
      document.documentElement.style.setProperty('--secondary-color', '#94a3b8');
      document.documentElement.style.setProperty('--bg-dark', '#f8fafc');
      document.documentElement.style.setProperty('--bg-medium', '#f1f5f9');
      document.documentElement.style.setProperty('--text-primary', '#0f172a');
      document.documentElement.style.setProperty('--text-secondary', '#334155');
      document.documentElement.style.setProperty('--text-muted', '#64748b');
    } else {
      // Reset to dark theme (default glassmorphism)
      document.documentElement.style.setProperty('--primary-color', '#a8b2d1');
      document.documentElement.style.setProperty('--secondary-color', '#ccd6f6');
      document.documentElement.style.setProperty('--bg-dark', '#0a0f1e');
      document.documentElement.style.setProperty('--bg-medium', '#141a2e');
      document.documentElement.style.setProperty('--text-primary', '#e6f1ff');
      document.documentElement.style.setProperty('--text-secondary', '#ccd6f6');
      document.documentElement.style.setProperty('--text-muted', '#8892b0');
    }
  }, [theme]);

  // Listen for system theme changes
  useEffect(() => {
    if (theme !== 'system') return;

    const mediaQuery = window.matchMedia('(prefers-color-scheme: dark)');
    const handleChange = (e: MediaQueryListEvent) => {
      setEffectiveTheme(e.matches ? 'dark' : 'light');
    };

    mediaQuery.addEventListener('change', handleChange);
    return () => mediaQuery.removeEventListener('change', handleChange);
  }, [theme]);

  const setTheme = async (newTheme: Theme) => {
    setThemeState(newTheme);
    await storage.set(STORAGE_KEYS.THEME, newTheme);
  };

  return (
    <ThemeContext.Provider value={{ theme, setTheme, effectiveTheme }}>
      {children}
    </ThemeContext.Provider>
  );
};

export default ThemeContext;
