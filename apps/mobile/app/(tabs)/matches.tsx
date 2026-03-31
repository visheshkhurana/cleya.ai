import { useState, useCallback } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  FlatList,
  RefreshControl,
  ActivityIndicator,
  Platform,
  Modal,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import * as Haptics from 'expo-haptics';
import { useAuth } from '@/contexts/AuthContext';
import { api } from '@/lib/api';
import { Colors, personaLabels, formatIndustry } from '@/constants/colors';

type Tab = 'pending' | 'accepted';

interface MatchProfile {
  persona?: string;
  headline?: string;
  currentRole?: string;
  companyName?: string;
  companyStage?: string;
  industries?: string[];
  location?: string;
  bio?: string;
}

interface MatchUser {
  id: string;
  email: string;
  profile?: MatchProfile;
}

interface ScoreBreakdown {
  industryScore?: number;
  stageScore?: number;
  locationScore?: number;
  goalsScore?: number;
  skillsScore?: number;
  personaScore?: number;
}

interface MatchData {
  id: string;
  status: string;
  score: number;
  reason?: string;
  scoreBreakdown?: ScoreBreakdown;
  userAId: string;
  userBId: string;
  userAResponse: string;
  userBResponse: string;
  createdAt: string;
  userA: MatchUser;
  userB: MatchUser;
}

export default function MatchesScreen() {
  const { user } = useAuth();
  const insets = useSafeAreaInsets();
  const queryClient = useQueryClient();
  const [activeTab, setActiveTab] = useState<Tab>('pending');
  const [respondingId, setRespondingId] = useState<string | null>(null);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');

  const [feedbackMatchId, setFeedbackMatchId] = useState<string | null>(null);
  const [feedbackRating, setFeedbackRating] = useState(0);
  const [feedbackText, setFeedbackText] = useState('');
  const [submittingFeedback, setSubmittingFeedback] = useState(false);

  const { data: rawMatches, isLoading } = useQuery({
    queryKey: ['matches'],
    queryFn: () => api.getMatches(),
  });

  const matches: MatchData[] = Array.isArray(rawMatches) ? rawMatches : [];

  const getOtherUser = (match: MatchData): MatchUser => {
    if (!user) return match.userB;
    return match.userAId === user.id ? match.userB : match.userA;
  };

  const getMyResponse = (match: MatchData): string => {
    if (!user) return 'PENDING';
    return match.userAId === user.id ? match.userAResponse : match.userBResponse;
  };

  const isPending = (match: MatchData): boolean => {
    const myResp = getMyResponse(match);
    return myResp === 'PENDING' && match.status !== 'REJECTED' && match.status !== 'ACCEPTED';
  };

  const matchesSearch = (match: MatchData, query: string): boolean => {
    if (!query.trim()) return true;
    const q = query.toLowerCase();
    const other = getOtherUser(match);
    const profile = other?.profile;
    const searchable = [
      profile?.currentRole,
      profile?.companyName,
      profile?.headline,
      profile?.location,
      profile?.persona ? personaLabels[profile.persona] : undefined,
      ...(profile?.industries?.map(formatIndustry) || []),
    ]
      .filter(Boolean)
      .join(' ')
      .toLowerCase();
    return searchable.includes(q);
  };

  const pendingMatches = matches
    .filter(isPending)
    .filter((m) => matchesSearch(m, searchQuery))
    .sort((a, b) => (b.score || 0) - (a.score || 0));
  const acceptedMatches = matches
    .filter((m) => m.status === 'ACCEPTED')
    .filter((m) => matchesSearch(m, searchQuery))
    .sort((a, b) => (b.score || 0) - (a.score || 0));

  const currentList = activeTab === 'pending' ? pendingMatches : acceptedMatches;

  const handleRespond = async (matchId: string, response: 'ACCEPTED' | 'REJECTED') => {
    setRespondingId(matchId);
    try {
      await api.respondToMatch(matchId, response);
      if (Platform.OS !== 'web') {
        Haptics.notificationAsync(
          response === 'ACCEPTED'
            ? Haptics.NotificationFeedbackType.Success
            : Haptics.NotificationFeedbackType.Warning
        );
      }
      await queryClient.invalidateQueries({ queryKey: ['matches'] });
      await queryClient.invalidateQueries({ queryKey: ['matchStats'] });
      setFeedbackMatchId(matchId);
      setFeedbackRating(0);
      setFeedbackText('');
    } catch {
    } finally {
      setRespondingId(null);
    }
  };

  const handleSubmitFeedback = async () => {
    if (!feedbackMatchId || feedbackRating === 0) return;
    setSubmittingFeedback(true);
    try {
      await api.submitMatchFeedback(feedbackMatchId, feedbackRating, feedbackText || undefined);
      if (Platform.OS !== 'web') Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    } catch {
    } finally {
      setSubmittingFeedback(false);
      setFeedbackMatchId(null);
    }
  };

  const [refreshing, setRefreshing] = useState(false);
  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await queryClient.invalidateQueries({ queryKey: ['matches'] });
    setRefreshing(false);
  }, [queryClient]);

  const ScoreBar = ({ label, value, icon }: { label: string; value: number; icon: string }) => {
    const pct = Math.round(value * 100);
    const barColor = pct >= 70 ? Colors.primary : pct >= 40 ? Colors.info : '#64748B';
    return (
      <View style={styles.scoreBarRow}>
        <Text style={styles.scoreBarIcon}>{icon}</Text>
        <Text style={styles.scoreBarLabel}>{label}</Text>
        <View style={styles.scoreBarTrack}>
          <View style={[styles.scoreBarFill, { width: `${pct}%`, backgroundColor: barColor }]} />
        </View>
        <Text style={[styles.scoreBarValue, { color: pct >= 70 ? Colors.accentLight : '#94A3B8' }]}>{pct}%</Text>
      </View>
    );
  };

  const renderMatch = ({ item: match }: { item: MatchData }) => {
    const other = getOtherUser(match);
    const profile = other?.profile;
    const score = Math.round((match.score || 0) * 100);
    const isExpanded = expandedId === match.id;
    const isAccepted = match.status === 'ACCEPTED';
    const showActions = activeTab === 'pending';
    const breakdown = match.scoreBreakdown;

    return (
      <View style={styles.matchCard}>
        <View style={styles.matchBody}>
          <View style={styles.matchRow}>
            <View style={styles.matchAvatar}>
              <Ionicons name="person" size={22} color={Colors.textTertiary} />
            </View>
            <View style={styles.matchInfo}>
              <Text style={styles.matchName} numberOfLines={1}>
                {profile?.currentRole || other?.email?.split('@')[0] || 'Match'}
              </Text>
              {profile?.companyName ? (
                <Text style={styles.matchCompany} numberOfLines={1}>{profile.companyName}</Text>
              ) : null}
              {profile?.persona ? (
                <View style={styles.personaTag}>
                  <Text style={styles.personaTagText}>{personaLabels[profile.persona] || profile.persona}</Text>
                </View>
              ) : null}
            </View>
            <TouchableOpacity
              style={[styles.scorePill, score >= 80 ? styles.scoreHigh : score >= 60 ? styles.scoreMed : styles.scoreLow]}
              onPress={() => setExpandedId(isExpanded ? null : match.id)}
              activeOpacity={0.7}
            >
              <Text style={[styles.scoreText, score >= 80 ? styles.scoreTextHigh : score >= 60 ? styles.scoreTextMed : styles.scoreTextLow]}>
                {score}%
              </Text>
              <Ionicons
                name={isExpanded ? 'chevron-up' : 'chevron-down'}
                size={12}
                color={score >= 80 ? Colors.accentLight : score >= 60 ? '#93C5FD' : '#94A3B8'}
              />
            </TouchableOpacity>
          </View>

          {profile?.headline ? (
            <Text style={styles.matchHeadline} numberOfLines={2}>{profile.headline}</Text>
          ) : null}

          {isExpanded && breakdown && typeof breakdown === 'object' ? (
            <View style={styles.breakdownContainer}>
              {[
                { key: 'industryScore' as const, label: 'Industry', icon: '🏭' },
                { key: 'stageScore' as const, label: 'Stage', icon: '📊' },
                { key: 'locationScore' as const, label: 'Location', icon: '📍' },
                { key: 'goalsScore' as const, label: 'Goals', icon: '🎯' },
                { key: 'skillsScore' as const, label: 'Skills', icon: '💡' },
                { key: 'personaScore' as const, label: 'Role Fit', icon: '👤' },
              ].filter(f => breakdown[f.key] != null).map(f => (
                <ScoreBar key={f.key} label={f.label} value={breakdown[f.key] ?? 0} icon={f.icon} />
              ))}
            </View>
          ) : null}

          {match.reason ? (
            <View style={styles.reasonBox}>
              <Text style={styles.reasonLabel}>Why connect</Text>
              <Text style={styles.reasonText}>{match.reason}</Text>
            </View>
          ) : null}

          {profile?.industries && profile.industries.length > 0 ? (
            <View style={styles.industryRow}>
              {profile.industries.slice(0, 3).map((ind: string) => (
                <View key={ind} style={styles.industryChip}>
                  <Text style={styles.industryText}>{formatIndustry(ind)}</Text>
                </View>
              ))}
              {profile.industries.length > 3 ? (
                <Text style={styles.moreIndustries}>+{profile.industries.length - 3}</Text>
              ) : null}
            </View>
          ) : null}

          {isAccepted ? (
            <View style={styles.acceptedInfo}>
              <Ionicons name="checkmark-circle" size={16} color={Colors.success} />
              <Text style={styles.acceptedText}>Contact: {other?.email}</Text>
            </View>
          ) : null}
        </View>

        {showActions ? (
          <View style={styles.actions}>
            <TouchableOpacity
              style={styles.passButton}
              onPress={() => handleRespond(match.id, 'REJECTED')}
              disabled={respondingId === match.id}
              activeOpacity={0.7}
            >
              <Text style={styles.passText}>
                {respondingId === match.id ? '...' : 'Pass'}
              </Text>
            </TouchableOpacity>
            <View style={styles.actionDivider} />
            <TouchableOpacity
              style={styles.connectButton}
              onPress={() => handleRespond(match.id, 'ACCEPTED')}
              disabled={respondingId === match.id}
              activeOpacity={0.7}
            >
              <Ionicons name="checkmark" size={16} color={Colors.accentLight} />
              <Text style={styles.connectText}>
                {respondingId === match.id ? '...' : 'Connect'}
              </Text>
            </TouchableOpacity>
          </View>
        ) : null}
      </View>
    );
  };

  return (
    <View style={[styles.container, { paddingTop: Platform.OS === 'web' ? 67 : insets.top }]}>
      <View style={styles.header}>
        <Text style={styles.headerTitle}>Matches</Text>
        <View style={styles.searchContainer}>
          <Ionicons name="search" size={16} color={Colors.textMuted} style={styles.searchIcon} />
          <TextInput
            style={styles.searchInput}
            value={searchQuery}
            onChangeText={setSearchQuery}
            placeholder="Search by role, company, industry..."
            placeholderTextColor={Colors.textMuted}
            autoCapitalize="none"
            autoCorrect={false}
          />
          {searchQuery ? (
            <TouchableOpacity onPress={() => setSearchQuery('')} style={styles.searchClear}>
              <Ionicons name="close-circle" size={16} color={Colors.textMuted} />
            </TouchableOpacity>
          ) : null}
        </View>
        <View style={styles.tabBar}>
          {(['pending', 'accepted'] as Tab[]).map((tab) => (
            <TouchableOpacity
              key={tab}
              style={[styles.tab, activeTab === tab && styles.tabActive]}
              onPress={() => setActiveTab(tab)}
              activeOpacity={0.7}
            >
              <Text style={[styles.tabText, activeTab === tab && styles.tabTextActive]}>
                {tab === 'pending' ? `Pending (${pendingMatches.length})` : `Accepted (${acceptedMatches.length})`}
              </Text>
            </TouchableOpacity>
          ))}
        </View>
      </View>

      {isLoading ? (
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={Colors.primary} />
        </View>
      ) : (
        <FlatList
          data={currentList}
          renderItem={renderMatch}
          keyExtractor={(item) => item.id}
          contentContainerStyle={[styles.listContent, { paddingBottom: Platform.OS === 'web' ? 34 : insets.bottom + 20 }]}
          refreshControl={
            <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={Colors.accent} colors={[Colors.accent]} />
          }
          scrollEnabled={currentList.length > 0}
          showsVerticalScrollIndicator={false}
          ListEmptyComponent={
            <View style={styles.emptyState}>
              <Ionicons name={activeTab === 'pending' ? 'search' : 'people'} size={40} color={Colors.textMuted} />
              <Text style={styles.emptyTitle}>
                {searchQuery
                  ? 'No matches found'
                  : activeTab === 'pending'
                  ? 'No pending matches'
                  : 'No accepted matches yet'}
              </Text>
              <Text style={styles.emptySubtitle}>
                {searchQuery
                  ? 'Try a different search term'
                  : activeTab === 'pending'
                  ? 'Go to Dashboard and find new matches'
                  : 'Accept matches from the Pending tab to start connecting'}
              </Text>
            </View>
          }
        />
      )}

      <Modal
        visible={feedbackMatchId !== null}
        transparent
        animationType="fade"
        onRequestClose={() => setFeedbackMatchId(null)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.feedbackModal}>
            <Text style={styles.feedbackTitle}>Rate this match</Text>
            <Text style={styles.feedbackSubtitle}>How relevant was this match for you?</Text>
            <View style={styles.starRow}>
              {[1, 2, 3, 4, 5].map((star) => (
                <TouchableOpacity
                  key={star}
                  onPress={() => {
                    setFeedbackRating(star);
                    if (Platform.OS !== 'web') Haptics.selectionAsync();
                  }}
                  activeOpacity={0.7}
                >
                  <Ionicons
                    name={star <= feedbackRating ? 'star' : 'star-outline'}
                    size={32}
                    color={star <= feedbackRating ? Colors.warning : Colors.textMuted}
                  />
                </TouchableOpacity>
              ))}
            </View>
            <TextInput
              style={styles.feedbackInput}
              value={feedbackText}
              onChangeText={setFeedbackText}
              placeholder="Any additional feedback? (optional)"
              placeholderTextColor={Colors.textMuted}
              multiline
              numberOfLines={3}
              maxLength={500}
              textAlignVertical="top"
            />
            <View style={styles.feedbackActions}>
              <TouchableOpacity
                style={styles.feedbackSkip}
                onPress={() => setFeedbackMatchId(null)}
                activeOpacity={0.7}
              >
                <Text style={styles.feedbackSkipText}>Skip</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.feedbackSubmit, (feedbackRating === 0 || submittingFeedback) && styles.feedbackSubmitDisabled]}
                onPress={handleSubmitFeedback}
                disabled={feedbackRating === 0 || submittingFeedback}
                activeOpacity={0.8}
              >
                {submittingFeedback ? (
                  <ActivityIndicator size="small" color="#fff" />
                ) : (
                  <Text style={styles.feedbackSubmitText}>Submit</Text>
                )}
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.background,
  },
  header: {
    paddingHorizontal: 20,
    paddingTop: 12,
    paddingBottom: 12,
    gap: 10,
  },
  headerTitle: {
    fontSize: 22,
    fontFamily: 'Inter_700Bold',
    color: Colors.text,
  },
  searchContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.surface,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  searchIcon: {
    paddingLeft: 12,
  },
  searchInput: {
    flex: 1,
    paddingVertical: 10,
    paddingHorizontal: 8,
    fontSize: 14,
    fontFamily: 'Inter_400Regular',
    color: Colors.text,
  },
  searchClear: {
    paddingHorizontal: 10,
    paddingVertical: 10,
  },
  tabBar: {
    flexDirection: 'row',
    backgroundColor: 'rgba(13,148,136,0.08)',
    borderRadius: 10,
    padding: 3,
  },
  tab: {
    flex: 1,
    paddingVertical: 8,
    alignItems: 'center',
    borderRadius: 8,
  },
  tabActive: {
    backgroundColor: Colors.primary,
  },
  tabText: {
    fontSize: 13,
    fontFamily: 'Inter_500Medium',
    color: Colors.textTertiary,
  },
  tabTextActive: {
    color: '#fff',
  },
  loadingContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  listContent: {
    paddingHorizontal: 20,
    gap: 12,
    paddingTop: 4,
  },
  matchCard: {
    backgroundColor: Colors.surface,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: Colors.border,
    overflow: 'hidden',
  },
  matchBody: {
    padding: 16,
    gap: 10,
  },
  matchRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  matchAvatar: {
    width: 48,
    height: 48,
    borderRadius: 16,
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
    fontSize: 15,
    fontFamily: 'Inter_600SemiBold',
    color: Colors.text,
  },
  matchCompany: {
    fontSize: 12,
    fontFamily: 'Inter_400Regular',
    color: Colors.textTertiary,
  },
  personaTag: {
    alignSelf: 'flex-start',
    backgroundColor: 'rgba(13,148,136,0.08)',
    borderRadius: 6,
    borderWidth: 1,
    borderColor: 'rgba(13,148,136,0.15)',
    paddingHorizontal: 6,
    paddingVertical: 1,
    marginTop: 2,
  },
  personaTagText: {
    fontSize: 10,
    fontFamily: 'Inter_500Medium',
    color: Colors.accentLight,
  },
  scorePill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 10,
    paddingVertical: 5,
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
  matchHeadline: {
    fontSize: 13,
    fontFamily: 'Inter_400Regular',
    color: Colors.textSecondary,
  },
  breakdownContainer: {
    backgroundColor: 'rgba(15,23,42,0.6)',
    borderRadius: 12,
    padding: 12,
    borderWidth: 1,
    borderColor: Colors.border,
    gap: 6,
  },
  scoreBarRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  scoreBarIcon: {
    fontSize: 11,
    width: 16,
  },
  scoreBarLabel: {
    fontSize: 10,
    fontFamily: 'Inter_400Regular',
    color: Colors.textTertiary,
    width: 55,
  },
  scoreBarTrack: {
    flex: 1,
    height: 4,
    borderRadius: 2,
    backgroundColor: 'rgba(255,255,255,0.05)',
  },
  scoreBarFill: {
    height: 4,
    borderRadius: 2,
  },
  scoreBarValue: {
    fontSize: 10,
    fontFamily: 'Inter_600SemiBold',
    width: 30,
    textAlign: 'right',
  },
  reasonBox: {
    backgroundColor: 'rgba(13,148,136,0.06)',
    borderRadius: 10,
    borderWidth: 1,
    borderColor: 'rgba(13,148,136,0.08)',
    padding: 10,
  },
  reasonLabel: {
    fontSize: 11,
    fontFamily: 'Inter_600SemiBold',
    color: 'rgba(45,212,191,0.7)',
    marginBottom: 4,
  },
  reasonText: {
    fontSize: 12,
    fontFamily: 'Inter_400Regular',
    color: Colors.textSecondary,
    lineHeight: 18,
  },
  industryRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
    alignItems: 'center',
  },
  industryChip: {
    backgroundColor: 'rgba(255,255,255,0.03)',
    borderRadius: 6,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.06)',
    paddingHorizontal: 8,
    paddingVertical: 3,
  },
  industryText: {
    fontSize: 10,
    fontFamily: 'Inter_400Regular',
    color: Colors.textTertiary,
  },
  moreIndustries: {
    fontSize: 10,
    fontFamily: 'Inter_400Regular',
    color: Colors.textMuted,
  },
  acceptedInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: 'rgba(16,185,129,0.06)',
    borderRadius: 10,
    borderWidth: 1,
    borderColor: 'rgba(16,185,129,0.12)',
    padding: 10,
  },
  acceptedText: {
    fontSize: 12,
    fontFamily: 'Inter_400Regular',
    color: Colors.textSecondary,
  },
  actions: {
    flexDirection: 'row',
    borderTopWidth: 1,
    borderTopColor: Colors.border,
  },
  passButton: {
    flex: 1,
    paddingVertical: 14,
    alignItems: 'center',
  },
  passText: {
    fontSize: 14,
    fontFamily: 'Inter_500Medium',
    color: Colors.textMuted,
  },
  actionDivider: {
    width: 1,
    backgroundColor: Colors.border,
  },
  connectButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 14,
    gap: 6,
  },
  connectText: {
    fontSize: 14,
    fontFamily: 'Inter_500Medium',
    color: Colors.accentLight,
  },
  emptyState: {
    alignItems: 'center',
    paddingVertical: 48,
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
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.6)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 24,
  },
  feedbackModal: {
    backgroundColor: Colors.surface,
    borderRadius: 20,
    padding: 24,
    width: '100%',
    maxWidth: 360,
    borderWidth: 1,
    borderColor: Colors.border,
    gap: 12,
  },
  feedbackTitle: {
    fontSize: 18,
    fontFamily: 'Inter_700Bold',
    color: Colors.text,
    textAlign: 'center',
  },
  feedbackSubtitle: {
    fontSize: 13,
    fontFamily: 'Inter_400Regular',
    color: Colors.textTertiary,
    textAlign: 'center',
  },
  starRow: {
    flexDirection: 'row',
    justifyContent: 'center',
    gap: 12,
    paddingVertical: 8,
  },
  feedbackInput: {
    backgroundColor: 'rgba(255,255,255,0.04)',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: Colors.border,
    paddingHorizontal: 14,
    paddingVertical: 10,
    fontSize: 14,
    fontFamily: 'Inter_400Regular',
    color: Colors.text,
    minHeight: 70,
  },
  feedbackActions: {
    flexDirection: 'row',
    gap: 10,
    marginTop: 4,
  },
  feedbackSkip: {
    flex: 1,
    paddingVertical: 12,
    alignItems: 'center',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  feedbackSkipText: {
    fontSize: 14,
    fontFamily: 'Inter_500Medium',
    color: Colors.textTertiary,
  },
  feedbackSubmit: {
    flex: 1,
    paddingVertical: 12,
    alignItems: 'center',
    borderRadius: 12,
    backgroundColor: Colors.primary,
  },
  feedbackSubmitDisabled: {
    opacity: 0.5,
  },
  feedbackSubmitText: {
    fontSize: 14,
    fontFamily: 'Inter_600SemiBold',
    color: '#fff',
  },
});
