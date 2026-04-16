import { useEffect } from 'react';
import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { QueryClientProvider } from '@tanstack/react-query';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { KeyboardProvider } from 'react-native-keyboard-controller';
import * as SplashScreen from 'expo-splash-screen';
import * as Linking from 'expo-linking';
import { useRouter } from 'expo-router';
import {
  useFonts,
  Inter_400Regular,
  Inter_500Medium,
  Inter_600SemiBold,
  Inter_700Bold,
} from '@expo-google-fonts/inter';
import { queryClient } from '@/lib/query-client';
import { AuthProvider } from '@/contexts/AuthContext';
import { Colors } from '@/constants/colors';
import { ClerkProvider } from '@clerk/clerk-expo';
import { tokenCache } from '@/lib/clerkTokenCache';
import ClerkSignOutBridge from '@/components/ClerkSignOutBridge';

const CLERK_PUBLISHABLE_KEY = process.env.EXPO_PUBLIC_CLERK_PUBLISHABLE_KEY;

SplashScreen.preventAutoHideAsync();

function DeepLinkHandler() {
  const router = useRouter();

  useEffect(() => {
    const handleUrl = (event: { url: string }) => {
      const parsed = Linking.parse(event.url);
      const path = parsed.path || '';
      const params = parsed.queryParams || {};

      if (path.startsWith('reset-password')) {
        router.push({ pathname: '/(auth)/reset-password', params: { token: params.token as string } });
      } else if (path.startsWith('verify-email')) {
        router.push({ pathname: '/(auth)/verify-email', params: { token: params.token as string } });
      } else if (path.startsWith('join/') || path.startsWith('join')) {
        const code = path.replace('join/', '').replace('join', '') || (params.code as string);
        if (code) {
          router.push({ pathname: '/(auth)/join', params: { code } });
        }
      }
    };

    const subscription = Linking.addEventListener('url', handleUrl);

    Linking.getInitialURL().then((url) => {
      if (url) handleUrl({ url });
    });

    return () => subscription.remove();
  }, [router]);

  return null;
}

export default function RootLayout() {
  const [fontsLoaded, fontError] = useFonts({
    Inter_400Regular,
    Inter_500Medium,
    Inter_600SemiBold,
    Inter_700Bold,
  });

  useEffect(() => {
    if (fontsLoaded || fontError) {
      SplashScreen.hideAsync();
    }
  }, [fontsLoaded, fontError]);

  if (!fontsLoaded && !fontError) return null;

  const inner = (
    <GestureHandlerRootView style={{ flex: 1, backgroundColor: Colors.background }}>
      <SafeAreaProvider>
        <KeyboardProvider>
          <QueryClientProvider client={queryClient}>
            <AuthProvider>
              <StatusBar style="light" />
              <DeepLinkHandler />
              <Stack
                screenOptions={{
                  headerShown: false,
                  contentStyle: { backgroundColor: Colors.background },
                  animation: 'fade',
                }}
              >
                <Stack.Screen name="(auth)" />
                <Stack.Screen name="(tabs)" />
              </Stack>
            </AuthProvider>
          </QueryClientProvider>
        </KeyboardProvider>
      </SafeAreaProvider>
    </GestureHandlerRootView>
  );

  if (!CLERK_PUBLISHABLE_KEY) {
    return inner;
  }

  return (
    <ClerkProvider publishableKey={CLERK_PUBLISHABLE_KEY} tokenCache={tokenCache}>
      <ClerkSignOutBridge />
      {inner}
    </ClerkProvider>
  );
}
