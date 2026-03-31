import { useCallback, useState } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  ScrollView,
  RefreshControl,
  ActivityIndicator,
  Platform,
} from 'react-native';
import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import * as Haptics from 'expo-haptics';
import { useAuth } from '@/contexts/AuthContext';
import { api } from '@/lib/api';
import { Colors, personaLabels } from '@/constants/colors';

export default function DashboardScreen() {
  const { user } = useAuth();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const queryClient = useQueryClient();
  const [findingMatches, setFindingMatches] = useState(false);

  const { data: profile, isLoading: profileLoading } = useQuery({
    queryKey: ['profile'],
    queryFn: () => api.getProfile(),
  });

  const { data: matchStats, isLoading: statsLoading } = useQuery({
    queryKey: ['matchStats'],
    queryFn: () => api.getMatchStats(),
  });

  const { data: rawMatches } = useQuery({
    queryKey: ['matches'],
    queryFn: () => api.getMatches(),
  });

  const matches = Array.isArray(rawMatches) ? rawMatches.slice(0, 3) : [];
  const loading = profileLoading || statsLoading;

  const [refreshing, setRefreshing] = useState(false);
  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await Promise.all([
      queryClient.invalidateQueries({ queryKey: ['profile'] }),
      queryClient.invalidateQueries({ queryKey: ['matchStats'] }),
      queryClient.invalidateQueries({ queryKey: ['matches'] }),
    ]);
    setRefreshing(false);
  }, [queryClient]);

  const handleFindMatches = async () => {
    setFindingMatches(true);
    try {
      await api.findAndPropose(5);
      if (Platform.OS !== 'web') Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ['matchStats'] }),
        queryClient.invalidateQueries({ queryKey: ['matches'] }),
      ]);
      router.push('/(tabs)/matches');
    } catch {
    } finally {
      setFindingMatches(false);
    }
  };

  const getOtherUser = (match: any) => {
    if (!user) return match.userB;
    return match.userAId === user.id ? match.userB : match.userA;
  };

  const completenessScore = profile?.completenessScore
    ? Math.round(profile.completenessScore * 100)
    : 0;

  return (
    <ScrollView
      style={styles.container}
      contentContainerStyle={{
        paddingTop: Platform.OS === 'web' ? 67 : insets.top,
        paddingBottom: Platform.OS === 'web' ? 34 : insets.bottom + 20,
      }}
      refreshControl={
        <RefreshControl
          refreshing={refreshing}
          onRefresh={onRefresh}
          tintColor={Colors.accent}
          colors={[Colors.accent]}
        />
      }
      showsVerticalScrollIndicator={false}
    >
      <View style={styles.headerBar}>
        <View style={styles.headerLeft}>
          <View style={styles.logoIcon}>
            <Text style={styles.logoText}>C</Text>
          </View>
          <Text style={styles.headerTitle}>Cleya.ai</Text>
        </View>
        <TouchableOpacity
          style={styles.notifButton}
          onPress={() => {}}
        >
          <Ionicons name="notifications-outline" size={22} color={Colors.textSecondary} />
        </TouchableOpacity>
      </View>

      <View style={styles.content}>
        {loading ? (
          <View style={styles.loadingContainer}>
            <ActivityIndicator size="large" color={Colors.primary} />
          </View>
        ) : (
          <>
            <View style={styles.profileCard}>
              <View style={styles.profileAvatar}>
                <Ionicons
                  name={profile?.persona === 'FOUNDER' ? 'rocket' : profile?.persona === 'INVESTOR' ? 'trending-up' : 'person'}
                  size={28}
                  color={Colors.accent}
                />
              </View>
              <View style={styles.profileInfo}>
                <Text style={styles.profileName} numberOfLines={1}>
                  {profile?.currentRole || user?.email?.split('@')[0] || 'Welcome'}
                </Text>
                {profile?.persona ? (
                  <View style={styles.personaBadge}>
                    <Text style={styles.personaBadgeText}>
                      {personaLabels[profile.persona] || profile.persona}
                    </Text>
                  </View>
                ) : null}
                <Text style={styles.profileHeadline} numberOfLines={1}>
                  {profile?.headline || 'Complete your profile to get matched'}
                </Text>
              </View>
            </View>

            {completenessScore < 100 ? (
              <TouchableOpacity
                style={styles.completenessCard}
                onPress={() => router.push('/(tabs)/profile')}
                activeOpacity={0.7}
              >
                <View style={styles.completenessHeader}>
                  <Text style={styles.completenessLabel}>Profile Completion</Text>
                  <Text style={styles.completenessValue}>{completenessScore}%</Text>
                </View>
                <View style={styles.progressTrack}>
                  <View style={[styles.progressFill, { width: `${completenessScore}%` as any }]} />
                </View>
                <Text style={styles.completenessHint}>
                  Tap to complete your profile and improve match quality
                </Text>
              </TouchableOpacity>
            ) : null}

            <View style={styles.statsRow}>
              {[
                { label: 'Total', value: matchStats?.total || 0, icon: 'people' as const, color: Colors.primary },
                { label: 'Pending', value: matchStats?.pending || 0, icon: 'time' as const, color: Colors.warning },
                { label: 'Accepted', value: matchStats?.accepted || 0, icon: 'checkmark-circle' as const, color: Colors.success },
              ].map((stat) => (
                <View key={stat.label} style={styles.statCard}>
                  <Ionicons name={stat.icon} size={20} color={stat.color} />
                  <Text style={styles.statValue}>{stat.value}</Text>
                  <Text style={styles.statLabel}>{stat.label}</Text>
                </View>
              ))}
            </View>

            <TouchableOpacity
              style={[styles.findButton, findingMatches && styles.findButtonDisabled]}
              onPress={handleFindMatches}
              disabled={findingMatches}
              activeOpacity={0.8}
            >
              {findingMatches ? (
                <ActivityIndicator color="#fff" size="small" />
              ) : (
                <>
                  <Ionicons name="search" size={20} color="#fff" />
                  <Text style={styles.findButtonText}>Find New Matches</Text>
                </>
              )}
            </TouchableOpacity>

            {matches.length > 0 ? (
              <View style={styles.section}>
                <View style={styles.sectionHeader}>
                  <Text style={styles.sectionTitle}>Recent Matches</Text>
                  <TouchableOpacity onPress={() => router.push('/(tabs)/matches')}>
                    <Text style={styles.seeAll}>See All</Text>
                  </TouchableOpacity>
                </View>
                {matches.map((match: any) => {
                  const other = getOtherUser(match);
                  const otherProfile = other?.profile;
                  const score = Math.round((match.score || 0) * 100);
                  return (
                    <TouchableOpacity
                      key={match.id}
                      style={styles.matchPreview}
                      onPress={() => router.push('/(tabs)/matches')}
                      activeOpacity={0.7}
                    >
                      <View style={styles.matchAvatar}>
                        <Ionicons name="person" size={20} color={Colors.textTertiary} />
                      </View>
                      <View style={styles.matchInfo}>
                        <Text style={styles.matchName} numberOfLines={1}>
                          {otherProfile?.currentRole || other?.email?.split('@')[0] || 'Match'}
                        </Text>
                        <Text style={styles.matchCompany} numberOfLines={1}>
                          {otherProfile?.companyName || otherProfile?.headline || ''}
                        </Text>
                      </View>
                      <View style={[styles.scoreBadge, score >= 80 ? styles.scoreHigh : score >= 60 ? styles.scoreMed : styles.scoreLow]}>
                        <Text style={[styles.scoreText, score >= 80 ? styles.scoreTextHigh : score >= 60 ? styles.scoreTextMed : styles.scoreTextLow]}>
                          {score}%
                        </Text>
                      </View>
                    </TouchableOpacity>
                  );
                })}
              </View>
            ) : (
              <View style={styles.emptyState}>
                <Ionicons name="sparkles" size={40} color={Colors.textMuted} />
                <Text style={styles.emptyTitle}>No matches yet</Text>
                <Text style={styles.emptySubtitle}>
                  Complete your profile and tap "Find New Matches" to get started
                </Text>
              </View>
            )}

            <View style={styles.quickActions}>
              <Text style={styles.sectionTitle}>Quick Actions</Text>
              <View style={styles.actionGrid}>
                {[
                  { icon: 'person' as const, label: 'Edit Profile', route: '/(tabs)/profile' },
                  { icon: 'people' as const, label: 'View Matches', route: '/(tabs)/matches' },
                  { icon: 'settings' as const, label: 'Settings', route: '/(tabs)/settings' },
                ].map((action) => (
                  <TouchableOpacity
                    key={action.label}
                    style={styles.actionCard}
                    onPress={() => router.push(action.route as any)}
                    activeOpacity={0.7}
                  >
                    <Ionicons name={action.icon} size={22} color={Colors.accent} />
                    <Text style={styles.actionLabel}>{action.label}</Text>
                  </TouchableOpacity>
                ))}
              </View>
            </View>
          </>
        )}
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
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingVertical: 12,
  },
  headerLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  logoIcon: {
    width: 36,
    height: 36,
    borderRadius: 12,
    backgroundColor: Colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  logoText: {
    fontSize: 16,
    fontFamily: 'Inter_700Bold',
    color: '#fff',
  },
  headerTitle: {
    fontSize: 18,
    fontFamily: 'Inter_600SemiBold',
    color: Colors.text,
  },
  notifButton: {
    width: 40,
    height: 40,
    borderRadius: 12,
    backgroundColor: Colors.surface,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: Colors.border,
  },
  content: {
    paddingHorizontal: 20,
    gap: 16,
    paddingBottom: 20,
  },
  loadingContainer: {
    paddingVertical: 60,
    alignItems: 'center',
  },
  profileCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.surface,
    borderRadius: 16,
    padding: 16,
    borderWidth: 1,
    borderColor: Colors.border,
    gap: 14,
  },
  profileAvatar: {
    width: 56,
    height: 56,
    borderRadius: 16,
    backgroundColor: 'rgba(13,148,136,0.12)',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: 'rgba(13,148,136,0.15)',
  },
  profileInfo: {
    flex: 1,
    gap: 4,
  },
  profileName: {
    fontSize: 17,
    fontFamily: 'Inter_700Bold',
    color: Colors.text,
  },
  personaBadge: {
    alignSelf: 'flex-start',
    backgroundColor: 'rgba(13,148,136,0.1)',
    borderWidth: 1,
    borderColor: 'rgba(13,148,136,0.2)',
    borderRadius: 6,
    paddingHorizontal: 8,
    paddingVertical: 2,
  },
  personaBadgeText: {
    fontSize: 11,
    fontFamily: 'Inter_500Medium',
    color: Colors.accentLight,
  },
  profileHeadline: {
    fontSize: 13,
    fontFamily: 'Inter_400Regular',
    color: Colors.textTertiary,
  },
  completenessCard: {
    backgroundColor: Colors.surface,
    borderRadius: 14,
    padding: 14,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  completenessHeader: {
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
    backgroundColor: Colors.primary,
  },
  completenessHint: {
    fontSize: 11,
    fontFamily: 'Inter_400Regular',
    color: Colors.textMuted,
    marginTop: 6,
  },
  statsRow: {
    flexDirection: 'row',
    gap: 10,
  },
  statCard: {
    flex: 1,
    backgroundColor: Colors.surface,
    borderRadius: 14,
    padding: 14,
    alignItems: 'center',
    gap: 6,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  statValue: {
    fontSize: 24,
    fontFamily: 'Inter_700Bold',
    color: Colors.text,
  },
  statLabel: {
    fontSize: 11,
    fontFamily: 'Inter_500Medium',
    color: Colors.textMuted,
    textTransform: 'uppercase',
    letterSpacing: 0.3,
  },
  findButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: Colors.primary,
    borderRadius: 14,
    paddingVertical: 16,
    shadowColor: Colors.primary,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 4,
  },
  findButtonDisabled: {
    opacity: 0.6,
  },
  findButtonText: {
    fontSize: 16,
    fontFamily: 'Inter_600SemiBold',
    color: '#fff',
  },
  section: {
    gap: 10,
  },
  sectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  sectionTitle: {
    fontSize: 13,
    fontFamily: 'Inter_600SemiBold',
    color: Colors.textTertiary,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  seeAll: {
    fontSize: 13,
    fontFamily: 'Inter_500Medium',
    color: Colors.accent,
  },
  matchPreview: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.surface,
    borderRadius: 14,
    padding: 14,
    borderWidth: 1,
    borderColor: Colors.border,
    gap: 12,
  },
  matchAvatar: {
    width: 44,
    height: 44,
    borderRadius: 14,
    backgroundColor: 'rgba(13,148,136,0.08)',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: 'rgba(13,148,136,0.1)',
  },
  matchInfo: {
    flex: 1,
    gap: 2,
  },
  matchName: {
    fontSize: 14,
    fontFamily: 'Inter_600SemiBold',
    color: Colors.text,
  },
  matchCompany: {
    fontSize: 12,
    fontFamily: 'Inter_400Regular',
    color: Colors.textTertiary,
  },
  scoreBadge: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 8,
  },
  scoreHigh: {
    backgroundColor: 'rgba(13,148,136,0.15)',
  },
  scoreMed: {
    backgroundColor: 'rgba(59,130,246,0.12)',
  },
  scoreLow: {
    backgroundColor: 'rgba(100,116,139,0.12)',
  },
  scoreText: {
    fontSize: 12,
    fontFamily: 'Inter_700Bold',
  },
  scoreTextHigh: {
    color: Colors.accentLight,
  },
  scoreTextMed: {
    color: '#93C5FD',
  },
  scoreTextLow: {
    color: '#94A3B8',
  },
  emptyState: {
    alignItems: 'center',
    paddingVertical: 32,
    gap: 8,
  },
  emptyTitle: {
    fontSize: 16,
    fontFamily: 'Inter_600SemiBold',
    color: Colors.text,
    marginTop: 4,
  },
  emptySubtitle: {
    fontSize: 13,
    fontFamily: 'Inter_400Regular',
    color: Colors.textTertiary,
    textAlign: 'center',
    paddingHorizontal: 40,
  },
  quickActions: {
    gap: 10,
  },
  actionGrid: {
    flexDirection: 'row',
    gap: 10,
  },
  actionCard: {
    flex: 1,
    backgroundColor: Colors.surface,
    borderRadius: 14,
    paddingVertical: 18,
    alignItems: 'center',
    gap: 8,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  actionLabel: {
    fontSize: 12,
    fontFamily: 'Inter_500Medium',
    color: Colors.textSecondary,
  },
});
