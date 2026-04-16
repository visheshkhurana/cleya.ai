import React, { useState } from 'react';
import { Pressable, Text, ActivityIndicator, View, StyleSheet } from 'react-native';
import { useSSO, useClerk } from '@clerk/clerk-expo';
import * as AuthSession from 'expo-auth-session';
import { useAuth } from '@/contexts/AuthContext';
import { Colors } from '@/constants/colors';

interface Props {
  onSuccess: () => void;
  onError: (msg: string) => void;
}

export default function ClerkContinueButton({ onSuccess, onError }: Props) {
  const { startSSOFlow } = useSSO();
  const { client } = useClerk();
  const { loginWithClerk } = useAuth();
  const [busy, setBusy] = useState(false);

  const handlePress = async () => {
    setBusy(true);
    try {
      const redirectUrl = AuthSession.makeRedirectUri({ scheme: 'cleya', path: 'clerk-callback' });
      const result = await startSSOFlow({ strategy: 'oauth_google', redirectUrl });
      const sessionId = result.createdSessionId;
      if (!sessionId) {
        throw new Error('Clerk sign-in cancelled');
      }
      if (result.setActive) {
        await result.setActive({ session: sessionId });
      }
      const session = client.sessions.find((s) => s.id === sessionId) || client.session;
      if (!session) throw new Error('No active Clerk session');
      const token = await session.getToken();
      if (!token) throw new Error('Could not get Clerk token');
      await loginWithClerk(token);
      onSuccess();
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Clerk sign-in failed';
      onError(message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <Pressable onPress={handlePress} disabled={busy} style={styles.button}>
      <View style={styles.row}>
        {busy ? (
          <ActivityIndicator size="small" color={Colors.text} />
        ) : (
          <View style={styles.dot} />
        )}
        <Text style={styles.label}>{busy ? 'Signing in…' : 'Continue with Clerk'}</Text>
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  button: {
    width: '100%',
    paddingVertical: 12,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.08)',
    backgroundColor: 'rgba(255,255,255,0.02)',
    alignItems: 'center',
    marginTop: 12,
  },
  row: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  dot: { width: 14, height: 14, borderRadius: 7, borderWidth: 1.5, borderColor: Colors.text },
  label: { color: Colors.text, fontSize: 14, fontWeight: '500' },
});
