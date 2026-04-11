import { useState, useEffect } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
  Platform,
} from 'react-native';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { api } from '@/lib/api';
import { useAuth } from '@/contexts/AuthContext';
import { Colors } from '@/constants/colors';

export default function VerifyEmailScreen() {
  const { token } = useLocalSearchParams<{ token?: string }>();
  const [status, setStatus] = useState<'loading' | 'success' | 'error' | 'pending'>(
    token ? 'loading' : 'pending'
  );
  const [error, setError] = useState('');
  const [resending, setResending] = useState(false);
  const [resendMsg, setResendMsg] = useState('');
  const { user } = useAuth();
  const router = useRouter();
  const insets = useSafeAreaInsets();

  useEffect(() => {
    if (!token) return;
    api.verifyEmail(token)
      .then(() => {
        setStatus('success');
        if (Platform.OS !== 'web') Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      })
      .catch((err: unknown) => {
        setStatus('error');
        setError(err instanceof Error ? err.message : 'Verification failed');
        if (Platform.OS !== 'web') Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
      });
  }, [token]);

  const handleResend = async () => {
    setResending(true);
    setResendMsg('');
    try {
      await api.sendVerification();
      setResendMsg('Verification email sent!');
      if (Platform.OS !== 'web') Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    } catch (err: unknown) {
      setResendMsg(err instanceof Error ? err.message : 'Failed to resend');
    } finally {
      setResending(false);
    }
  };

  return (
    <View
      style={[
        styles.container,
        {
          paddingTop: Platform.OS === 'web' ? 67 : insets.top + 40,
          paddingBottom: Platform.OS === 'web' ? 34 : insets.bottom + 20,
        },
      ]}
    >
      <View style={styles.content}>
        {status === 'pending' && (
          <>
            <View style={[styles.iconContainer, { backgroundColor: Colors.info }]}>
              <Ionicons name="mail-outline" size={32} color="#fff" />
            </View>
            <Text style={styles.title}>Check Your Email</Text>
            <Text style={styles.subtitle}>
              We've sent a verification link to your email address. Please check your inbox and tap the link to verify.
            </Text>

            {resendMsg ? (
              <View style={styles.resendMsgBox}>
                <Text style={styles.resendMsgText}>{resendMsg}</Text>
              </View>
            ) : null}

            {user ? (
              <TouchableOpacity
                style={[styles.resendButton, resending && styles.buttonDisabled]}
                onPress={handleResend}
                disabled={resending}
                activeOpacity={0.8}
              >
                {resending ? (
                  <ActivityIndicator color={Colors.accent} size="small" />
                ) : (
                  <Text style={styles.resendButtonText}>Resend Verification Email</Text>
                )}
              </TouchableOpacity>
            ) : null}

            <TouchableOpacity
              style={styles.button}
              onPress={() => router.replace('/(tabs)')}
              activeOpacity={0.8}
            >
              <Text style={styles.buttonText}>Continue to App</Text>
            </TouchableOpacity>
          </>
        )}

        {status === 'loading' && (
          <>
            <ActivityIndicator size="large" color={Colors.primary} style={{ marginBottom: 20 }} />
            <Text style={styles.title}>Verifying your email...</Text>
          </>
        )}

        {status === 'success' && (
          <>
            <View style={[styles.iconContainer, { backgroundColor: Colors.success }]}>
              <Ionicons name="checkmark" size={32} color="#fff" />
            </View>
            <Text style={styles.title}>Email Verified!</Text>
            <Text style={styles.subtitle}>Your email has been verified successfully.</Text>
            <TouchableOpacity
              style={styles.button}
              onPress={() => router.replace('/(tabs)')}
              activeOpacity={0.8}
            >
              <Text style={styles.buttonText}>Continue</Text>
            </TouchableOpacity>
          </>
        )}

        {status === 'error' && (
          <>
            <View style={[styles.iconContainer, { backgroundColor: Colors.error }]}>
              <Ionicons name="close" size={32} color="#fff" />
            </View>
            <Text style={styles.title}>Verification Failed</Text>
            <Text style={styles.subtitle}>{error}</Text>

            {resendMsg ? (
              <View style={styles.resendMsgBox}>
                <Text style={styles.resendMsgText}>{resendMsg}</Text>
              </View>
            ) : null}

            {user ? (
              <TouchableOpacity
                style={[styles.resendButton, resending && styles.buttonDisabled]}
                onPress={handleResend}
                disabled={resending}
                activeOpacity={0.8}
              >
                {resending ? (
                  <ActivityIndicator color={Colors.accent} size="small" />
                ) : (
                  <Text style={styles.resendButtonText}>Resend Verification Email</Text>
                )}
              </TouchableOpacity>
            ) : null}

            <TouchableOpacity
              style={styles.button}
              onPress={() => router.replace('/(auth)/login')}
              activeOpacity={0.8}
            >
              <Text style={styles.buttonText}>Back to Login</Text>
            </TouchableOpacity>
          </>
        )}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.background,
    justifyContent: 'center',
    paddingHorizontal: 24,
  },
  content: {
    alignItems: 'center',
  },
  iconContainer: {
    width: 72,
    height: 72,
    borderRadius: 22,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 24,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 12,
    elevation: 8,
  },
  title: {
    fontSize: 24,
    fontFamily: 'Inter_700Bold',
    color: Colors.text,
    marginBottom: 8,
    textAlign: 'center',
  },
  subtitle: {
    fontSize: 15,
    fontFamily: 'Inter_400Regular',
    color: Colors.textTertiary,
    textAlign: 'center',
    marginBottom: 24,
    paddingHorizontal: 20,
  },
  button: {
    backgroundColor: Colors.primary,
    borderRadius: 14,
    paddingVertical: 16,
    paddingHorizontal: 32,
    alignItems: 'center',
    marginTop: 12,
    width: '100%',
    shadowColor: Colors.primary,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 4,
  },
  buttonDisabled: {
    opacity: 0.6,
  },
  buttonText: {
    color: '#fff',
    fontSize: 16,
    fontFamily: 'Inter_600SemiBold',
  },
  resendButton: {
    borderRadius: 14,
    paddingVertical: 14,
    paddingHorizontal: 32,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: Colors.border,
    width: '100%',
  },
  resendButtonText: {
    color: Colors.accent,
    fontSize: 15,
    fontFamily: 'Inter_600SemiBold',
  },
  resendMsgBox: {
    backgroundColor: 'rgba(16,185,129,0.1)',
    borderRadius: 10,
    padding: 12,
    marginBottom: 12,
    width: '100%',
  },
  resendMsgText: {
    color: Colors.success,
    fontSize: 13,
    fontFamily: 'Inter_400Regular',
    textAlign: 'center',
  },
});
