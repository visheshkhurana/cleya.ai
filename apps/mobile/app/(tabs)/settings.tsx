import { useState, useEffect } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  ScrollView,
  Switch,
  ActivityIndicator,
  Platform,
  Alert,
} from 'react-native';
import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import * as Haptics from 'expo-haptics';
import { useAuth } from '@/contexts/AuthContext';
import { api, UserSettings, WhatsAppStatus } from '@/lib/api';
import { Colors } from '@/constants/colors';

export default function SettingsScreen() {
  const { user, logout } = useAuth();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const queryClient = useQueryClient();

  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [changingPassword, setChangingPassword] = useState(false);
  const [passwordMsg, setPasswordMsg] = useState('');
  const [passwordError, setPasswordError] = useState('');

  const { data: settings } = useQuery<UserSettings>({
    queryKey: ['settings'],
    queryFn: () => api.getSettings(),
  });

  const { data: whatsappStatus, refetch: refetchWhatsApp } = useQuery<WhatsAppStatus>({
    queryKey: ['whatsapp-status'],
    queryFn: () => api.whatsappStatus(),
  });

  const [matchNotify, setMatchNotify] = useState<boolean | null>(null);
  const [introNotify, setIntroNotify] = useState<boolean | null>(null);
  const [weeklyDigest, setWeeklyDigest] = useState<boolean | null>(null);
  const [whatsappPhone, setWhatsappPhone] = useState('');
  const [whatsappLoading, setWhatsappLoading] = useState(false);
  const [whatsappMsg, setWhatsappMsg] = useState('');
  const [whatsappError, setWhatsappError] = useState('');

  useEffect(() => {
    if (whatsappStatus?.whatsappPhone) {
      setWhatsappPhone(whatsappStatus.whatsappPhone);
    }
  }, [whatsappStatus?.whatsappPhone]);

  const prefs = settings?.notificationPrefs;
  const effectiveMatchNotify = matchNotify ?? prefs?.matchNotify ?? true;
  const effectiveIntroNotify = introNotify ?? prefs?.introNotify ?? true;
  const effectiveWeeklyDigest = weeklyDigest ?? prefs?.weeklyDigest ?? true;

  const handleToggleNotification = async (key: 'matchNotify' | 'introNotify' | 'weeklyDigest', value: boolean) => {
    if (key === 'matchNotify') setMatchNotify(value);
    if (key === 'introNotify') setIntroNotify(value);
    if (key === 'weeklyDigest') setWeeklyDigest(value);
    try {
      await api.updateNotificationPrefs({ [key]: value });
      await queryClient.invalidateQueries({ queryKey: ['settings'] });
    } catch (err: unknown) {
      Alert.alert('Error', err instanceof Error ? err.message : 'Could not update notification preferences');
    }
  };

  const handleWhatsAppOptIn = async () => {
    const phone = whatsappPhone.trim();
    if (!phone || phone.length < 10) {
      setWhatsappError('Please enter a valid phone number with country code (e.g. +91...)');
      return;
    }
    setWhatsappLoading(true);
    setWhatsappError('');
    setWhatsappMsg('');
    try {
      await api.whatsappOptIn(phone);
      if (Platform.OS !== 'web') Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      setWhatsappMsg('WhatsApp notifications enabled!');
      await refetchWhatsApp();
      setTimeout(() => setWhatsappMsg(''), 3000);
    } catch (err: unknown) {
      setWhatsappError(err instanceof Error ? err.message : 'Failed to enable WhatsApp');
    } finally {
      setWhatsappLoading(false);
    }
  };

  const handleWhatsAppOptOut = async () => {
    setWhatsappLoading(true);
    setWhatsappError('');
    setWhatsappMsg('');
    try {
      await api.whatsappOptOut();
      setWhatsappMsg('WhatsApp notifications disabled');
      await refetchWhatsApp();
      setTimeout(() => setWhatsappMsg(''), 3000);
    } catch (err: unknown) {
      setWhatsappError(err instanceof Error ? err.message : 'Failed to disable WhatsApp');
    } finally {
      setWhatsappLoading(false);
    }
  };

  const handleChangePassword = async () => {
    if (!currentPassword || !newPassword) { setPasswordError('Both fields are required'); return; }
    if (newPassword.length < 8) { setPasswordError('New password must be at least 8 characters'); return; }
    setChangingPassword(true);
    setPasswordError('');
    setPasswordMsg('');
    try {
      await api.changePassword(currentPassword, newPassword);
      if (Platform.OS !== 'web') Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      setPasswordMsg('Password changed successfully');
      setCurrentPassword('');
      setNewPassword('');
      setTimeout(() => setPasswordMsg(''), 3000);
    } catch (err: unknown) {
      setPasswordError(err instanceof Error ? err.message : 'Failed to change password');
    } finally {
      setChangingPassword(false);
    }
  };

  const handleLogout = async () => {
    if (Platform.OS === 'web') {
      await logout();
      router.replace('/(auth)/login');
      return;
    }
    Alert.alert('Sign Out', 'Are you sure you want to sign out?', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Sign Out',
        style: 'destructive',
        onPress: async () => {
          await logout();
          router.replace('/(auth)/login');
        },
      },
    ]);
  };

  const handleDeleteAccount = async () => {
    const doDelete = async () => {
      try {
        await api.deleteAccount();
        await logout();
        router.replace('/(auth)/login');
      } catch {}
    };

    if (Platform.OS === 'web') {
      if (confirm('Are you sure? This action cannot be undone.')) {
        await doDelete();
      }
      return;
    }
    Alert.alert(
      'Delete Account',
      'This action cannot be undone. All your data will be permanently deleted.',
      [
        { text: 'Cancel', style: 'cancel' },
        { text: 'Delete', style: 'destructive', onPress: doDelete },
      ]
    );
  };

  return (
    <ScrollView
      style={[styles.container, { paddingTop: Platform.OS === 'web' ? 67 : insets.top }]}
      contentContainerStyle={{ paddingBottom: Platform.OS === 'web' ? 34 : insets.bottom + 20 }}
      showsVerticalScrollIndicator={false}
    >
      <View style={styles.headerBar}>
        <View style={styles.headerRow}>
          <View style={styles.logoIcon}>
            <Text style={styles.logoIconText}>C</Text>
          </View>
          <Text style={styles.headerTitle}>Settings</Text>
        </View>
      </View>

      <View style={styles.content}>
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Account</Text>
          <View style={styles.infoRow}>
            <Ionicons name="mail-outline" size={18} color={Colors.textTertiary} />
            <Text style={styles.infoLabel}>Email</Text>
            <Text style={styles.infoValue} numberOfLines={1}>{user?.email}</Text>
          </View>
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Notifications</Text>
          <View style={styles.toggleRow}>
            <View style={styles.toggleInfo}>
              <Ionicons name="people-outline" size={18} color={Colors.textTertiary} />
              <Text style={styles.toggleLabel}>Match Notifications</Text>
            </View>
            <Switch
              value={effectiveMatchNotify}
              onValueChange={(v) => handleToggleNotification('matchNotify', v)}
              trackColor={{ false: Colors.surfaceLight, true: 'rgba(13,148,136,0.4)' }}
              thumbColor={effectiveMatchNotify ? Colors.primary : '#94A3B8'}
            />
          </View>
          <View style={styles.toggleRow}>
            <View style={styles.toggleInfo}>
              <Ionicons name="hand-left-outline" size={18} color={Colors.textTertiary} />
              <Text style={styles.toggleLabel}>Introduction Notifications</Text>
            </View>
            <Switch
              value={effectiveIntroNotify}
              onValueChange={(v) => handleToggleNotification('introNotify', v)}
              trackColor={{ false: Colors.surfaceLight, true: 'rgba(13,148,136,0.4)' }}
              thumbColor={effectiveIntroNotify ? Colors.primary : '#94A3B8'}
            />
          </View>
          <View style={styles.toggleRow}>
            <View style={styles.toggleInfo}>
              <Ionicons name="newspaper-outline" size={18} color={Colors.textTertiary} />
              <Text style={styles.toggleLabel}>Weekly Digest</Text>
            </View>
            <Switch
              value={effectiveWeeklyDigest}
              onValueChange={(v) => handleToggleNotification('weeklyDigest', v)}
              trackColor={{ false: Colors.surfaceLight, true: 'rgba(13,148,136,0.4)' }}
              thumbColor={effectiveWeeklyDigest ? Colors.primary : '#94A3B8'}
            />
          </View>
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>WhatsApp Notifications</Text>
          <Text style={styles.whatsappDesc}>
            Get match and introduction updates on WhatsApp
          </Text>
          {whatsappError ? (
            <View style={styles.errorBox}>
              <Ionicons name="alert-circle" size={14} color={Colors.error} />
              <Text style={styles.errorText}>{whatsappError}</Text>
            </View>
          ) : null}
          {whatsappMsg ? (
            <View style={styles.successBox}>
              <Ionicons name="checkmark-circle" size={14} color={Colors.success} />
              <Text style={styles.successText}>{whatsappMsg}</Text>
            </View>
          ) : null}
          {whatsappStatus?.whatsappOptedIn ? (
            <View style={styles.whatsappActiveRow}>
              <View style={styles.whatsappActiveInfo}>
                <Ionicons name="logo-whatsapp" size={20} color={Colors.success} />
                <View>
                  <Text style={styles.whatsappActiveLabel}>Active</Text>
                  <Text style={styles.whatsappActivePhone}>{whatsappStatus.whatsappPhone}</Text>
                </View>
              </View>
              <TouchableOpacity
                style={styles.whatsappOptOutButton}
                onPress={handleWhatsAppOptOut}
                disabled={whatsappLoading}
                activeOpacity={0.7}
              >
                {whatsappLoading ? (
                  <ActivityIndicator size="small" color={Colors.error} />
                ) : (
                  <Text style={styles.whatsappOptOutText}>Disable</Text>
                )}
              </TouchableOpacity>
            </View>
          ) : (
            <>
              <View style={styles.whatsappInputRow}>
                <Ionicons name="logo-whatsapp" size={20} color={Colors.textMuted} style={{ marginTop: 12 }} />
                <TextInput
                  style={[styles.textInput, { flex: 1 }]}
                  value={whatsappPhone}
                  onChangeText={setWhatsappPhone}
                  placeholder="+91 98765 43210"
                  placeholderTextColor={Colors.textMuted}
                  keyboardType="phone-pad"
                />
              </View>
              <TouchableOpacity
                style={[styles.changeButton, whatsappLoading && styles.changeButtonDisabled]}
                onPress={handleWhatsAppOptIn}
                disabled={whatsappLoading}
                activeOpacity={0.8}
              >
                {whatsappLoading ? (
                  <ActivityIndicator size="small" color="#fff" />
                ) : (
                  <Text style={styles.changeButtonText}>Enable WhatsApp</Text>
                )}
              </TouchableOpacity>
            </>
          )}
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Change Password</Text>
          {passwordError ? (
            <View style={styles.errorBox}>
              <Ionicons name="alert-circle" size={14} color={Colors.error} />
              <Text style={styles.errorText}>{passwordError}</Text>
            </View>
          ) : null}
          {passwordMsg ? (
            <View style={styles.successBox}>
              <Ionicons name="checkmark-circle" size={14} color={Colors.success} />
              <Text style={styles.successText}>{passwordMsg}</Text>
            </View>
          ) : null}
          <TextInput
            style={styles.textInput}
            value={currentPassword}
            onChangeText={setCurrentPassword}
            placeholder="Current password"
            placeholderTextColor={Colors.textMuted}
            secureTextEntry
          />
          <TextInput
            style={styles.textInput}
            value={newPassword}
            onChangeText={setNewPassword}
            placeholder="New password (min 8 chars)"
            placeholderTextColor={Colors.textMuted}
            secureTextEntry
          />
          <TouchableOpacity
            style={[styles.changeButton, changingPassword && styles.changeButtonDisabled]}
            onPress={handleChangePassword}
            disabled={changingPassword}
            activeOpacity={0.8}
          >
            {changingPassword ? (
              <ActivityIndicator size="small" color="#fff" />
            ) : (
              <Text style={styles.changeButtonText}>Change Password</Text>
            )}
          </TouchableOpacity>
        </View>

        <TouchableOpacity style={styles.logoutButton} onPress={handleLogout} activeOpacity={0.7}>
          <Ionicons name="log-out-outline" size={20} color={Colors.text} />
          <Text style={styles.logoutText}>Sign Out</Text>
        </TouchableOpacity>

        <TouchableOpacity style={styles.deleteButton} onPress={handleDeleteAccount} activeOpacity={0.7}>
          <Ionicons name="trash-outline" size={18} color={Colors.error} />
          <Text style={styles.deleteText}>Delete Account</Text>
        </TouchableOpacity>
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.background,
  },
  headerBar: {
    paddingHorizontal: 20,
    paddingTop: 12,
    paddingBottom: 12,
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  logoIcon: {
    width: 32,
    height: 32,
    borderRadius: 10,
    backgroundColor: Colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  logoIconText: {
    fontSize: 14,
    fontFamily: 'Inter_700Bold',
    color: '#fff',
  },
  headerTitle: {
    fontSize: 22,
    fontFamily: 'Inter_700Bold',
    color: Colors.text,
  },
  content: {
    paddingHorizontal: 20,
    gap: 16,
  },
  section: {
    backgroundColor: Colors.surface,
    borderRadius: 16,
    padding: 16,
    borderWidth: 1,
    borderColor: Colors.border,
    gap: 12,
  },
  sectionTitle: {
    fontSize: 13,
    fontFamily: 'Inter_600SemiBold',
    color: Colors.textTertiary,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  infoRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  infoLabel: {
    fontSize: 14,
    fontFamily: 'Inter_500Medium',
    color: Colors.textSecondary,
  },
  infoValue: {
    flex: 1,
    fontSize: 14,
    fontFamily: 'Inter_400Regular',
    color: Colors.textTertiary,
    textAlign: 'right',
  },
  toggleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  toggleInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    flex: 1,
  },
  toggleLabel: {
    fontSize: 14,
    fontFamily: 'Inter_500Medium',
    color: Colors.textSecondary,
  },
  textInput: {
    backgroundColor: 'rgba(255,255,255,0.04)',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: Colors.border,
    paddingHorizontal: 14,
    paddingVertical: 12,
    fontSize: 14,
    fontFamily: 'Inter_400Regular',
    color: Colors.text,
  },
  errorBox: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: 'rgba(239,68,68,0.1)',
    borderRadius: 8,
    padding: 10,
  },
  errorText: {
    color: Colors.error,
    fontSize: 12,
    fontFamily: 'Inter_400Regular',
  },
  successBox: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: 'rgba(16,185,129,0.1)',
    borderRadius: 8,
    padding: 10,
  },
  successText: {
    color: Colors.success,
    fontSize: 12,
    fontFamily: 'Inter_400Regular',
  },
  changeButton: {
    backgroundColor: Colors.primary,
    borderRadius: 12,
    paddingVertical: 12,
    alignItems: 'center',
  },
  changeButtonDisabled: {
    opacity: 0.5,
  },
  changeButtonText: {
    fontSize: 14,
    fontFamily: 'Inter_600SemiBold',
    color: '#fff',
  },
  logoutButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
    backgroundColor: Colors.surface,
    borderRadius: 14,
    paddingVertical: 14,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  logoutText: {
    fontSize: 15,
    fontFamily: 'Inter_600SemiBold',
    color: Colors.text,
  },
  deleteButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingVertical: 14,
    marginBottom: 20,
  },
  deleteText: {
    fontSize: 14,
    fontFamily: 'Inter_500Medium',
    color: Colors.error,
  },
  whatsappDesc: {
    fontSize: 13,
    fontFamily: 'Inter_400Regular',
    color: Colors.textMuted,
  },
  whatsappInputRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 10,
  },
  whatsappActiveRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  whatsappActiveInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  whatsappActiveLabel: {
    fontSize: 14,
    fontFamily: 'Inter_600SemiBold',
    color: Colors.success,
  },
  whatsappActivePhone: {
    fontSize: 12,
    fontFamily: 'Inter_400Regular',
    color: Colors.textMuted,
  },
  whatsappOptOutButton: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: 'rgba(239,68,68,0.3)',
  },
  whatsappOptOutText: {
    fontSize: 12,
    fontFamily: 'Inter_500Medium',
    color: Colors.error,
  },
});
