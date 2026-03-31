import { useState, useCallback, useMemo } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  ScrollView,
  RefreshControl,
  ActivityIndicator,
  Platform,
  Alert,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import * as Haptics from 'expo-haptics';
import { api } from '@/lib/api';
import { Colors, personaLabels, industryOptions, formatIndustry } from '@/constants/colors';

const personaOptions = ['FOUNDER', 'INVESTOR', 'TALENT', 'DEAL_PARTNER', 'EVENT_PARTICIPANT', 'ADVISOR', 'OPERATOR', 'JOB_SEEKER'] as const;

const completenessFields = ['persona', 'headline', 'bio', 'companyName', 'currentRole', 'location', 'industries', 'linkedinUrl'] as const;

export default function ProfileScreen() {
  const insets = useSafeAreaInsets();
  const queryClient = useQueryClient();
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [successMsg, setSuccessMsg] = useState('');
  const [editData, setEditData] = useState<Record<string, string | number | string[] | undefined>>({});
  const [hasEdits, setHasEdits] = useState(false);
  const [customIndustry, setCustomIndustry] = useState('');

  const { data: rawProfile, isLoading } = useQuery({
    queryKey: ['profile'],
    queryFn: async () => {
      const data = await api.getProfile();
      if (data) {
        const { extraData, ...rest } = data;
        return { ...rest, ...(typeof extraData === 'object' && extraData ? extraData : {}) };
      }
      return data;
    },
  });

  const profile = hasEdits ? { ...rawProfile, ...editData } : rawProfile;

  const updateField = (key: string, value: string | number | string[] | undefined) => {
    setEditData((prev) => ({ ...prev, [key]: value }));
    setHasEdits(true);
  };

  const toggleIndustry = (ind: string) => {
    const current = profile?.industries || [];
    const updated = current.includes(ind)
      ? current.filter((i: string) => i !== ind)
      : [...current, ind];
    updateField('industries', updated);
  };

  const addCustomIndustry = () => {
    const trimmed = customIndustry.trim().toLowerCase().replace(/\s+/g, '_');
    if (!trimmed) return;
    const current: string[] = profile?.industries || [];
    if (!current.includes(trimmed)) {
      updateField('industries', [...current, trimmed]);
    }
    setCustomIndustry('');
    if (Platform.OS !== 'web') Haptics.selectionAsync();
  };

  const customIndustries = useMemo(() => {
    const current: string[] = profile?.industries || [];
    return current.filter((ind: string) => !industryOptions.includes(ind));
  }, [profile?.industries]);

  const handleSave = async () => {
    if (!profile?.persona) { setError('Please select a persona type'); return; }
    if (!profile?.currentRole?.trim()) { setError('Current Role is required'); return; }
    setSaving(true);
    setError('');
    setSuccessMsg('');
    try {
      const dataToSave = hasEdits ? { ...rawProfile, ...editData } : rawProfile;
      await api.updateProfile(dataToSave);
      if (Platform.OS !== 'web') Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      setSuccessMsg('Profile saved');
      setHasEdits(false);
      setEditData({});
      await queryClient.invalidateQueries({ queryKey: ['profile'] });
      setTimeout(() => setSuccessMsg(''), 3000);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Failed to save');
    } finally {
      setSaving(false);
    }
  };

  const getCompletenessScore = () => {
    if (!profile) return 0;
    let filled = 0;
    for (const field of completenessFields) {
      const val = profile[field];
      if (val && (Array.isArray(val) ? val.length > 0 : typeof val === 'string' ? val.trim() : true)) {
        filled++;
      }
    }
    return Math.round((filled / completenessFields.length) * 100);
  };

  const completeness = getCompletenessScore();
  const isFounder = profile?.persona === 'FOUNDER';
  const isInvestor = profile?.persona === 'INVESTOR' || profile?.persona === 'VENTURE_PARTNER';
  const isTalent = profile?.persona === 'TALENT' || profile?.persona === 'JOB_SEEKER';

  const [refreshing, setRefreshing] = useState(false);
  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await queryClient.invalidateQueries({ queryKey: ['profile'] });
    setRefreshing(false);
  }, [queryClient]);

  if (isLoading) {
    return (
      <View style={[styles.container, { paddingTop: Platform.OS === 'web' ? 67 : insets.top }]}>
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={Colors.primary} />
          <Text style={styles.loadingText}>Loading profile...</Text>
        </View>
      </View>
    );
  }

  return (
    <View style={[styles.container, { paddingTop: Platform.OS === 'web' ? 67 : insets.top }]}>
      <View style={styles.headerBar}>
        <View style={styles.headerRow}>
          <View style={styles.logoIcon}>
            <Text style={styles.logoIconText}>C</Text>
          </View>
          <Text style={styles.headerTitle}>Edit Profile</Text>
        </View>
        <TouchableOpacity
          style={[styles.saveButton, saving && styles.saveButtonDisabled]}
          onPress={handleSave}
          disabled={saving}
          activeOpacity={0.8}
        >
          {saving ? (
            <ActivityIndicator size="small" color="#fff" />
          ) : (
            <Text style={styles.saveButtonText}>{successMsg ? 'Saved ✓' : 'Save'}</Text>
          )}
        </TouchableOpacity>
      </View>

      <ScrollView
        showsVerticalScrollIndicator={false}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={Colors.accent} colors={[Colors.accent]} />}
        contentContainerStyle={{ paddingBottom: Platform.OS === 'web' ? 34 : insets.bottom + 20 }}
      >
        <View style={styles.content}>
          <View style={styles.completenessCard}>
            <View style={styles.completenessRow}>
              <Text style={styles.completenessLabel}>Profile Completion</Text>
              <Text style={[styles.completenessValue, completeness === 100 && { color: Colors.success }]}>{completeness}%</Text>
            </View>
            <View style={styles.progressTrack}>
              <View style={[styles.progressFill, { width: `${completeness}%`, backgroundColor: completeness === 100 ? Colors.success : Colors.primary }]} />
            </View>
          </View>

          {error ? (
            <View style={styles.errorBox}>
              <Ionicons name="alert-circle" size={16} color={Colors.error} />
              <Text style={styles.errorText}>{error}</Text>
            </View>
          ) : null}

          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Your Role</Text>
            <View style={styles.personaGrid}>
              {personaOptions.map((p) => (
                <TouchableOpacity
                  key={p}
                  style={[styles.personaChip, profile?.persona === p && styles.personaChipActive]}
                  onPress={() => { updateField('persona', p); if (Platform.OS !== 'web') Haptics.selectionAsync(); }}
                  activeOpacity={0.7}
                >
                  <Text style={[styles.personaChipText, profile?.persona === p && styles.personaChipTextActive]}>
                    {personaLabels[p] || p}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>
          </View>

          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Basic Information</Text>
            <View style={styles.fieldGroup}>
              <View style={styles.fieldLabelRow}>
                <Text style={styles.fieldLabel}>Headline</Text>
                {!profile?.headline?.trim() ? <Ionicons name="alert-circle" size={12} color={Colors.warning} /> : null}
              </View>
              <TextInput
                style={styles.textInput}
                value={profile?.headline || ''}
                onChangeText={(v) => updateField('headline', v)}
                placeholder="e.g. CEO at Acme Corp"
                placeholderTextColor={Colors.textMuted}
              />
            </View>
            <View style={styles.fieldGroup}>
              <View style={styles.fieldLabelRow}>
                <Text style={styles.fieldLabel}>Current Role</Text>
                {!profile?.currentRole?.trim() ? <Ionicons name="alert-circle" size={12} color={Colors.warning} /> : null}
              </View>
              <TextInput
                style={styles.textInput}
                value={profile?.currentRole || ''}
                onChangeText={(v) => updateField('currentRole', v)}
                placeholder="e.g. Co-founder & CEO"
                placeholderTextColor={Colors.textMuted}
              />
            </View>
            <View style={styles.fieldGroup}>
              <View style={styles.fieldLabelRow}>
                <Text style={styles.fieldLabel}>Company</Text>
                {!profile?.companyName?.trim() ? <Ionicons name="alert-circle" size={12} color={Colors.warning} /> : null}
              </View>
              <TextInput
                style={styles.textInput}
                value={profile?.companyName || ''}
                onChangeText={(v) => updateField('companyName', v)}
                placeholder="Company name"
                placeholderTextColor={Colors.textMuted}
              />
            </View>
            <View style={styles.fieldGroup}>
              <View style={styles.fieldLabelRow}>
                <Text style={styles.fieldLabel}>Location</Text>
                {!profile?.location?.trim() ? <Ionicons name="alert-circle" size={12} color={Colors.warning} /> : null}
              </View>
              <TextInput
                style={styles.textInput}
                value={profile?.location || ''}
                onChangeText={(v) => updateField('location', v)}
                placeholder="e.g. Bangalore, India"
                placeholderTextColor={Colors.textMuted}
              />
            </View>
            <View style={styles.fieldGroup}>
              <View style={styles.fieldLabelRow}>
                <Text style={styles.fieldLabel}>Bio</Text>
                {!profile?.bio?.trim() ? <Ionicons name="alert-circle" size={12} color={Colors.warning} /> : null}
              </View>
              <TextInput
                style={[styles.textInput, styles.textArea]}
                value={profile?.bio || ''}
                onChangeText={(v) => updateField('bio', v.slice(0, 1000))}
                placeholder="Tell people about yourself..."
                placeholderTextColor={Colors.textMuted}
                multiline
                numberOfLines={4}
                maxLength={1000}
                textAlignVertical="top"
              />
              <Text style={styles.charCount}>{(profile?.bio || '').length}/1000</Text>
            </View>
            <View style={styles.fieldGroup}>
              <View style={styles.fieldLabelRow}>
                <Text style={styles.fieldLabel}>LinkedIn URL</Text>
                {!profile?.linkedinUrl?.trim() ? <Ionicons name="alert-circle" size={12} color={Colors.warning} /> : null}
              </View>
              <TextInput
                style={styles.textInput}
                value={profile?.linkedinUrl || ''}
                onChangeText={(v) => updateField('linkedinUrl', v)}
                placeholder="https://linkedin.com/in/your-profile"
                placeholderTextColor={Colors.textMuted}
                autoCapitalize="none"
                keyboardType="url"
              />
            </View>
            <View style={styles.fieldGroup}>
              <Text style={styles.fieldLabel}>Website</Text>
              <TextInput
                style={styles.textInput}
                value={profile?.websiteUrl || ''}
                onChangeText={(v) => updateField('websiteUrl', v)}
                placeholder="https://..."
                placeholderTextColor={Colors.textMuted}
                autoCapitalize="none"
                keyboardType="url"
              />
            </View>
          </View>

          <View style={styles.section}>
            <View style={styles.fieldLabelRow}>
              <Text style={styles.sectionTitle}>Industries</Text>
              {!(profile?.industries?.length) ? <Ionicons name="alert-circle" size={12} color={Colors.warning} /> : null}
            </View>
            <View style={styles.industryGrid}>
              {industryOptions.map((ind) => {
                const selected = (profile?.industries || []).includes(ind);
                return (
                  <TouchableOpacity
                    key={ind}
                    style={[styles.industryChip, selected && styles.industryChipActive]}
                    onPress={() => toggleIndustry(ind)}
                    activeOpacity={0.7}
                  >
                    <Text style={[styles.industryChipText, selected && styles.industryChipTextActive]}>
                      {formatIndustry(ind)}
                    </Text>
                  </TouchableOpacity>
                );
              })}
              {customIndustries.map((ind: string) => (
                <TouchableOpacity
                  key={ind}
                  style={[styles.industryChip, styles.industryChipActive]}
                  onPress={() => toggleIndustry(ind)}
                  activeOpacity={0.7}
                >
                  <View style={styles.customIndustryChipContent}>
                    <Text style={[styles.industryChipText, styles.industryChipTextActive]}>
                      {formatIndustry(ind)}
                    </Text>
                    <Ionicons name="close" size={12} color={Colors.accentLight} />
                  </View>
                </TouchableOpacity>
              ))}
            </View>
            <View style={styles.customIndustryRow}>
              <TextInput
                style={styles.customIndustryInput}
                value={customIndustry}
                onChangeText={setCustomIndustry}
                placeholder="Add custom industry..."
                placeholderTextColor={Colors.textMuted}
                autoCapitalize="none"
                returnKeyType="done"
                onSubmitEditing={addCustomIndustry}
              />
              <TouchableOpacity
                style={[styles.customIndustryAdd, !customIndustry.trim() && styles.customIndustryAddDisabled]}
                onPress={addCustomIndustry}
                disabled={!customIndustry.trim()}
                activeOpacity={0.7}
              >
                <Ionicons name="add" size={18} color={customIndustry.trim() ? '#fff' : Colors.textMuted} />
              </TouchableOpacity>
            </View>
          </View>

          {isFounder ? (
            <View style={styles.section}>
              <Text style={styles.sectionTitle}>Founder Details</Text>
              <View style={styles.fieldGroup}>
                <Text style={styles.fieldLabel}>Company Stage</Text>
                <View style={styles.stageGrid}>
                  {['PRE_SEED', 'SEED', 'SERIES_A', 'SERIES_B', 'SERIES_C', 'GROWTH', 'PUBLIC', 'BOOTSTRAPPED'].map((stage) => (
                    <TouchableOpacity
                      key={stage}
                      style={[styles.stageChip, profile?.companyStage === stage && styles.stageChipActive]}
                      onPress={() => updateField('companyStage', stage)}
                      activeOpacity={0.7}
                    >
                      <Text style={[styles.stageChipText, profile?.companyStage === stage && styles.stageChipTextActive]}>
                        {stage.replace(/_/g, ' ').replace(/PLUS/g, '+').replace(/\b[a-z]/g, (c) => c.toUpperCase())}
                      </Text>
                    </TouchableOpacity>
                  ))}
                </View>
              </View>
            </View>
          ) : null}

          {isInvestor ? (
            <View style={styles.section}>
              <Text style={styles.sectionTitle}>Investor Details</Text>
              <View style={styles.fieldGroup}>
                <Text style={styles.fieldLabel}>Fund Name</Text>
                <TextInput
                  style={styles.textInput}
                  value={profile?.fundName || ''}
                  onChangeText={(v) => updateField('fundName', v)}
                  placeholder="Fund name"
                  placeholderTextColor={Colors.textMuted}
                />
              </View>
              <View style={styles.fieldGroup}>
                <Text style={styles.fieldLabel}>Portfolio Size</Text>
                <TextInput
                  style={styles.textInput}
                  value={profile?.portfolioSize?.toString() || ''}
                  onChangeText={(v) => updateField('portfolioSize', parseInt(v) || undefined)}
                  placeholder="Number of investments"
                  placeholderTextColor={Colors.textMuted}
                  keyboardType="number-pad"
                />
              </View>
            </View>
          ) : null}

          {isTalent ? (
            <View style={styles.section}>
              <Text style={styles.sectionTitle}>Talent Details</Text>
              <View style={styles.fieldGroup}>
                <Text style={styles.fieldLabel}>Years of Experience</Text>
                <TextInput
                  style={styles.textInput}
                  value={profile?.yearsExperience?.toString() || ''}
                  onChangeText={(v) => updateField('yearsExperience', parseInt(v) || undefined)}
                  placeholder="Years"
                  placeholderTextColor={Colors.textMuted}
                  keyboardType="number-pad"
                />
              </View>
              <View style={styles.fieldGroup}>
                <Text style={styles.fieldLabel}>Preferred Role</Text>
                <TextInput
                  style={styles.textInput}
                  value={profile?.preferredRole || ''}
                  onChangeText={(v) => updateField('preferredRole', v)}
                  placeholder="e.g. Senior Engineer"
                  placeholderTextColor={Colors.textMuted}
                />
              </View>
            </View>
          ) : null}

          <TouchableOpacity
            style={[styles.bigSaveButton, saving && styles.bigSaveButtonDisabled]}
            onPress={handleSave}
            disabled={saving}
            activeOpacity={0.8}
          >
            {saving ? (
              <ActivityIndicator size="small" color="#fff" />
            ) : (
              <Text style={styles.bigSaveButtonText}>{successMsg ? 'Saved ✓' : 'Save Changes'}</Text>
            )}
          </TouchableOpacity>
        </View>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.background,
  },
  loadingContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 12,
  },
  loadingText: {
    fontSize: 14,
    fontFamily: 'Inter_400Regular',
    color: Colors.textTertiary,
  },
  headerBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingVertical: 12,
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
  saveButton: {
    backgroundColor: Colors.primary,
    borderRadius: 10,
    paddingHorizontal: 18,
    paddingVertical: 8,
  },
  saveButtonDisabled: {
    opacity: 0.5,
  },
  saveButtonText: {
    fontSize: 14,
    fontFamily: 'Inter_600SemiBold',
    color: '#fff',
  },
  content: {
    paddingHorizontal: 20,
    gap: 16,
    paddingTop: 4,
  },
  completenessCard: {
    backgroundColor: Colors.surface,
    borderRadius: 14,
    padding: 14,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  completenessRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  completenessLabel: {
    fontSize: 12,
    fontFamily: 'Inter_600SemiBold',
    color: Colors.textTertiary,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  completenessValue: {
    fontSize: 14,
    fontFamily: 'Inter_700Bold',
    color: Colors.accentLight,
  },
  progressTrack: {
    height: 6,
    borderRadius: 3,
    backgroundColor: 'rgba(13,148,136,0.15)',
  },
  progressFill: {
    height: 6,
    borderRadius: 3,
  },
  errorBox: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: 'rgba(239,68,68,0.1)',
    borderWidth: 1,
    borderColor: 'rgba(239,68,68,0.2)',
    borderRadius: 12,
    padding: 12,
  },
  errorText: {
    color: Colors.error,
    fontSize: 13,
    fontFamily: 'Inter_400Regular',
    flex: 1,
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
  fieldGroup: {
    gap: 6,
  },
  fieldLabelRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  fieldLabel: {
    fontSize: 12,
    fontFamily: 'Inter_600SemiBold',
    color: Colors.textMuted,
    textTransform: 'uppercase',
    letterSpacing: 0.3,
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
  textArea: {
    minHeight: 80,
    paddingTop: 12,
  },
  charCount: {
    fontSize: 10,
    fontFamily: 'Inter_400Regular',
    color: Colors.textMuted,
    textAlign: 'right',
  },
  personaGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  personaChip: {
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: Colors.border,
    backgroundColor: 'rgba(255,255,255,0.03)',
  },
  personaChipActive: {
    borderColor: 'rgba(13,148,136,0.4)',
    backgroundColor: 'rgba(13,148,136,0.12)',
  },
  personaChipText: {
    fontSize: 13,
    fontFamily: 'Inter_500Medium',
    color: Colors.textTertiary,
  },
  personaChipTextActive: {
    color: Colors.accentLight,
  },
  industryGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  industryChip: {
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: Colors.border,
    backgroundColor: 'rgba(255,255,255,0.03)',
  },
  industryChipActive: {
    borderColor: 'rgba(13,148,136,0.4)',
    backgroundColor: 'rgba(13,148,136,0.12)',
  },
  industryChipText: {
    fontSize: 12,
    fontFamily: 'Inter_500Medium',
    color: Colors.textTertiary,
  },
  industryChipTextActive: {
    color: Colors.accentLight,
  },
  customIndustryChipContent: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  customIndustryRow: {
    flexDirection: 'row',
    gap: 8,
  },
  customIndustryInput: {
    flex: 1,
    backgroundColor: 'rgba(255,255,255,0.04)',
    borderRadius: 10,
    borderWidth: 1,
    borderColor: Colors.border,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 13,
    fontFamily: 'Inter_400Regular',
    color: Colors.text,
  },
  customIndustryAdd: {
    width: 40,
    height: 40,
    borderRadius: 10,
    backgroundColor: Colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  customIndustryAddDisabled: {
    backgroundColor: Colors.surfaceLight,
  },
  stageGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  stageChip: {
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: Colors.border,
    backgroundColor: 'rgba(255,255,255,0.03)',
  },
  stageChipActive: {
    borderColor: 'rgba(13,148,136,0.4)',
    backgroundColor: 'rgba(13,148,136,0.12)',
  },
  stageChipText: {
    fontSize: 12,
    fontFamily: 'Inter_500Medium',
    color: Colors.textTertiary,
  },
  stageChipTextActive: {
    color: Colors.accentLight,
  },
  bigSaveButton: {
    backgroundColor: Colors.primary,
    borderRadius: 16,
    paddingVertical: 16,
    alignItems: 'center',
    marginTop: 8,
    marginBottom: 20,
    shadowColor: Colors.primary,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 4,
  },
  bigSaveButtonDisabled: {
    opacity: 0.5,
  },
  bigSaveButtonText: {
    fontSize: 16,
    fontFamily: 'Inter_600SemiBold',
    color: '#fff',
  },
});
