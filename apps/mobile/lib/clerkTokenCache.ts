import * as SecureStore from 'expo-secure-store';
import { Platform } from 'react-native';
import type { TokenCache } from '@clerk/clerk-expo/dist/cache';

export const tokenCache: TokenCache | undefined = Platform.OS === 'web'
  ? undefined
  : {
      async getToken(key: string) {
        try {
          return await SecureStore.getItemAsync(key);
        } catch {
          return null;
        }
      },
      async saveToken(key: string, value: string) {
        try {
          await SecureStore.setItemAsync(key, value);
        } catch {}
      },
    };
