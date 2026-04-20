import { useThemeContext } from '@/src/context/ThemeContext';

export function useColorScheme() {
  return useThemeContext().colorScheme;
}
