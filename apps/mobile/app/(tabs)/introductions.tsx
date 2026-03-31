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
  Alert,
  Modal,
  ScrollView,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import * as Haptics from 'expo-haptics';
import { useAuth } from '@/contexts/AuthContext';
import { api, Introduction } from '@/lib/api';
import { Colors, personaLabels } from '@/constants/colors';

const statusConfig: Record<string, { color: string; bg: string; label: string }> = {
  PENDING_APPROVAL: { color: '#fbbf24', bg: 'rgba(245,158,11,0.15)', label: 'Review Required' },
  APPROVED: { color: '#93c5fd', bg: 'rgba(59,130,246,0.15)', label: 'Approved' },
  SENT: { color: Colors.accentLight, bg: 'rgba(13,148,136,0.15)', label: 'Sent' },
  VIEWED: { color: '#93c5fd', bg: 'rgba(59,130,246,0.15)', label: 'Viewed' },
  RESPONDED: { color: '#6ee7b7', bg: 'rgba(16,185,129,0.15)', label: 'Responded' },
  FOLLOWED_UP: { color: '#fbbf24', bg: 'rgba(245,158,11,0.15)', label: 'Follow-up Sent' },
  COMPLETED: { color: Colors.success, bg: 'rgba(16,185,129,0.2)', label: 'Completed' },
  CANCELLED: { color: '#f87171', bg: 'rgba(239,68,68,0.15)', label: 'Cancelled' },
};

const outcomeLabels: Record<string, { label: string; color: string }> = {
  GREAT_MEETING: { label: 'Great meeting', color: Colors.success },
  GOOD_CHAT: { label: 'Good chat', color: Colors.primary },
  DIDNT_MEET: { label: "Didn't meet", color: Colors.warning },
  NOT_A_FIT: { label: 'Not a fit', color: Colors.error },
};

export default function IntroductionsScreen() {
  const { user } = useAuth();
  const insets = useSafeAreaInsets();
  const queryClient = useQueryClient();
  const [selectedIntro, setSelectedIntro] = useState<Introduction | null>(null);
  const [editMode, setEditMode] = useState(false);
  const [editText, setEditText] = useState('');
  const [actionLoading, setActionLoading] = useState('');
  const [showOutcomeModal, setShowOutcomeModal] = useState(false);

  const { data: introductions, isLoading, isError } = useQuery<Introduction[]>({
    queryKey: ['introductions'],
    queryFn: () => api.getIntroductions(),
  });

  const [refreshing, setRefreshing] = useState(false);
  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await queryClient.invalidateQueries({ queryKey: ['introductions'] });
    setRefreshing(false);
  }, [queryClient]);

  const intros = Array.isArray(introductions) ? introductions : [];
  const pendingCount = intros.filter(i => i.status === 'PENDING_APPROVAL').length;

  const getOtherUser = (intro: Introduction) => {
    if (!user) return intro.userB;
    return intro.userA.id === user.id ? intro.userB : intro.userA;
  };

  const handleApprove = async (intro: Introduction) => {
    setActionLoading('approve');
    try {
      await api.approveIntroduction(intro.id);
      if (Platform.OS !== 'web') Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      await queryClient.invalidateQueries({ queryKey: ['introductions'] });
      setSelectedIntro(null);
    } catch (err: unknown) {
      Alert.alert('Error', err instanceof Error ? err.message : 'Failed to approve');
    } finally {
      setActionLoading('');
    }
  };

  const handleSaveEdit = async (intro: Introduction) => {
    if (!editText.trim() || editText.trim().length < 10) {
      Alert.alert('Error', 'Introduction text must be at least 10 characters');
      return;
    }
    setActionLoading('edit');
    try {
      await api.editIntroductionText(intro.id, editText.trim());
      setEditMode(false);
      await queryClient.invalidateQueries({ queryKey: ['introductions'] });
      setSelectedIntro(null);
    } catch (err: unknown) {
      Alert.alert('Error', err instanceof Error ? err.message : 'Failed to save edit');
    } finally {
      setActionLoading('');
    }
  };

  const handleCancel = async (intro: Introduction) => {
    Alert.alert('Cancel Introduction', 'Are you sure you want to cancel this introduction?', [
      { text: 'No', style: 'cancel' },
      {
        text: 'Yes, cancel',
        style: 'destructive',
        onPress: async () => {
          setActionLoading('cancel');
          try {
            await api.cancelIntroduction(intro.id);
            await queryClient.invalidateQueries({ queryKey: ['introductions'] });
            setSelectedIntro(null);
          } catch (err: unknown) {
            Alert.alert('Error', err instanceof Error ? err.message : 'Failed to cancel');
          } finally {
            setActionLoading('');
          }
        },
      },
    ]);
  };

  const handleOutcome = async (intro: Introduction, outcome: string) => {
    setActionLoading('outcome');
    try {
      await api.recordIntroOutcome(intro.id, outcome);
      if (Platform.OS !== 'web') Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      setShowOutcomeModal(false);
      await queryClient.invalidateQueries({ queryKey: ['introductions'] });
      setSelectedIntro(null);
    } catch (err: unknown) {
      Alert.alert('Error', err instanceof Error ? err.message : 'Failed to record outcome');
    } finally {
      setActionLoading('');
    }
  };

  return (
    <View style={[styles.container, { paddingTop: Platform.OS === 'web' ? 67 : insets.top }]}>
      <View style={styles.header}>
        <View style={styles.headerRow}>
          <View style={styles.logoIcon}>
            <Text style={styles.logoText}>C</Text>
          </View>
          <Text style={styles.headerTitle}>Introductions</Text>
          {pendingCount > 0 && (
            <View style={styles.pendingBadge}>
              <Text style={styles.pendingBadgeText}>{pendingCount} to review</Text>
            </View>
          )}
        </View>
      </View>

      {isLoading ? (
        <View style={styles.center}>
          <ActivityIndicator size="large" color={Colors.accent} />
        </View>
      ) : isError ? (
        <View style={styles.emptyState}>
          <Ionicons name="warning-outline" size={48} color={Colors.warning} />
          <Text style={styles.emptyTitle}>Could not load introductions</Text>
          <Text style={styles.emptySubtitle}>Pull down to try again</Text>
        </View>
      ) : intros.length === 0 ? (
        <View style={styles.emptyState}>
          <Ionicons name="people-outline" size={48} color={Colors.textMuted} />
          <Text style={styles.emptyTitle}>No introductions yet</Text>
          <Text style={styles.emptySubtitle}>When both sides accept a match, Cleya drafts a warm introduction for you</Text>
        </View>
      ) : (
        <FlatList
          data={intros}
          keyExtractor={(item) => item.id}
          renderItem={({ item }) => {
            const other = getOtherUser(item);
            const profile = other.profile;
            const sc = statusConfig[item.status] || statusConfig.SENT;
            const otherName = other.name || profile?.currentRole || other.email.split('@')[0];

            return (
              <TouchableOpacity
                style={[styles.introCard, item.status === 'PENDING_APPROVAL' && styles.introCardPending]}
                onPress={() => {
                  setSelectedIntro(item);
                  setEditMode(false);
                  setShowOutcomeModal(false);
                }}
                activeOpacity={0.7}
              >
                <View style={styles.introCardTop}>
                  <View style={styles.introAvatar}>
                    <Text style={styles.introAvatarText}>{(otherName[0] || '?').toUpperCase()}</Text>
                  </View>
                  <View style={styles.introInfo}>
                    <Text style={styles.introName} numberOfLines={1}>{otherName}</Text>
                    <View style={[styles.statusBadge, { backgroundColor: sc.bg }]}>
                      <Text style={[styles.statusBadgeText, { color: sc.color }]}>{sc.label}</Text>
                    </View>
                    {item.outcome && (
                      <View style={[styles.statusBadge, { backgroundColor: `${outcomeLabels[item.outcome]?.color}15` }]}>
                        <Text style={[styles.statusBadgeText, { color: outcomeLabels[item.outcome]?.color }]}>
                          {outcomeLabels[item.outcome]?.label}
                        </Text>
                      </View>
                    )}
                  </View>
                  <Ionicons name="chevron-forward" size={16} color={Colors.textMuted} />
                </View>
                {profile?.companyName ? <Text style={styles.introCompany}>{profile.companyName}</Text> : null}
                {item.introText ? (
                  <Text style={styles.introPreview} numberOfLines={2}>"{item.introText.slice(0, 120)}..."</Text>
                ) : null}
                <Text style={styles.introDate}>
                  {item.sentAt
                    ? `Sent ${new Date(item.sentAt).toLocaleDateString([], { month: 'short', day: 'numeric' })}`
                    : `Created ${new Date(item.createdAt).toLocaleDateString([], { month: 'short', day: 'numeric' })}`
                  }
                </Text>
              </TouchableOpacity>
            );
          }}
          contentContainerStyle={styles.list}
          refreshControl={
            <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={Colors.accent} colors={[Colors.accent]} />
          }
          showsVerticalScrollIndicator={false}
        />
      )}

      <Modal
        visible={selectedIntro !== null}
        animationType="slide"
        transparent
        onRequestClose={() => setSelectedIntro(null)}
      >
        {selectedIntro && (
          <IntroDetail
            intro={selectedIntro}
            userId={user?.id || ''}
            editMode={editMode}
            editText={editText}
            actionLoading={actionLoading}
            showOutcomeModal={showOutcomeModal}
            onClose={() => { setSelectedIntro(null); setEditMode(false); setShowOutcomeModal(false); }}
            onApprove={() => handleApprove(selectedIntro)}
            onStartEdit={() => { setEditText(selectedIntro.introText || ''); setEditMode(true); }}
            onCancelEdit={() => setEditMode(false)}
            onSaveEdit={() => handleSaveEdit(selectedIntro)}
            onEditTextChange={setEditText}
            onCancel={() => handleCancel(selectedIntro)}
            onShowOutcome={() => setShowOutcomeModal(true)}
            onHideOutcome={() => setShowOutcomeModal(false)}
            onRecordOutcome={(outcome) => handleOutcome(selectedIntro, outcome)}
            getOtherUser={getOtherUser}
          />
        )}
      </Modal>
    </View>
  );
}

function IntroDetail({
  intro, userId, editMode, editText, actionLoading, showOutcomeModal,
  onClose, onApprove, onStartEdit, onCancelEdit, onSaveEdit, onEditTextChange,
  onCancel, onShowOutcome, onHideOutcome, onRecordOutcome, getOtherUser,
}: {
  intro: Introduction; userId: string; editMode: boolean; editText: string; actionLoading: string;
  showOutcomeModal: boolean;
  onClose: () => void; onApprove: () => void; onStartEdit: () => void;
  onCancelEdit: () => void; onSaveEdit: () => void; onEditTextChange: (t: string) => void;
  onCancel: () => void; onShowOutcome: () => void; onHideOutcome: () => void;
  onRecordOutcome: (o: string) => void;
  getOtherUser: (intro: Introduction) => Introduction['userA'];
}) {
  const other = getOtherUser(intro);
  const profile = other.profile;
  const otherName = other.name || profile?.currentRole || other.email.split('@')[0];
  const sc = statusConfig[intro.status] || statusConfig.SENT;
  const isPending = intro.status === 'PENDING_APPROVAL';
  const canFeedback = ['SENT', 'VIEWED', 'FOLLOWED_UP'].includes(intro.status);

  return (
    <View style={styles.modalOverlay}>
      <View style={styles.modalContent}>
        <ScrollView showsVerticalScrollIndicator={false}>
          <View style={styles.modalHeader}>
            <View style={styles.modalHeaderLeft}>
              <View style={styles.introAvatar}>
                <Text style={styles.introAvatarText}>{(otherName[0] || '?').toUpperCase()}</Text>
              </View>
              <View>
                <Text style={styles.modalName}>{otherName}</Text>
                {profile?.companyName ? <Text style={styles.modalCompany}>{profile.companyName}</Text> : null}
              </View>
            </View>
            <TouchableOpacity onPress={onClose} activeOpacity={0.7}>
              <Ionicons name="close" size={24} color={Colors.textMuted} />
            </TouchableOpacity>
          </View>

          <View style={[styles.statusBadge, { backgroundColor: sc.bg, alignSelf: 'flex-start', marginBottom: 16 }]}>
            <Text style={[styles.statusBadgeText, { color: sc.color }]}>{sc.label}</Text>
          </View>

          {intro.introText && (
            <View style={styles.detailSection}>
              <Text style={styles.detailLabel}>Introduction Preview</Text>
              {editMode ? (
                <TextInput
                  style={styles.editTextArea}
                  value={editText}
                  onChangeText={onEditTextChange}
                  multiline
                  autoFocus
                />
              ) : (
                <Text style={styles.detailText}>{intro.introText}</Text>
              )}
            </View>
          )}

          {intro.talkingPoints && intro.talkingPoints.length > 0 && !editMode && (
            <View style={styles.detailSection}>
              <Text style={styles.detailLabel}>Talking Points</Text>
              {intro.talkingPoints.map((tp, i) => (
                <View key={i} style={styles.talkingPointRow}>
                  <Text style={styles.talkingPointDot}>{'•'}</Text>
                  <Text style={styles.talkingPointText}>{tp}</Text>
                </View>
              ))}
            </View>
          )}

          <View style={styles.detailSection}>
            <Text style={styles.detailMeta}>Created: {new Date(intro.createdAt).toLocaleDateString()}</Text>
            {intro.sentAt && <Text style={styles.detailMeta}>Sent: {new Date(intro.sentAt).toLocaleDateString()}</Text>}
          </View>
        </ScrollView>

        <View style={styles.modalActions}>
          {isPending && !editMode && (
            <View style={styles.actionRow}>
              <TouchableOpacity
                style={[styles.primaryButton, actionLoading === 'approve' && styles.buttonDisabled]}
                onPress={onApprove}
                disabled={!!actionLoading}
                activeOpacity={0.7}
              >
                <Text style={styles.primaryButtonText}>
                  {actionLoading === 'approve' ? 'Sending...' : 'Approve & Send'}
                </Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.secondaryButton} onPress={onStartEdit} activeOpacity={0.7}>
                <Text style={styles.secondaryButtonText}>Edit</Text>
              </TouchableOpacity>
            </View>
          )}

          {isPending && editMode && (
            <View style={styles.actionRow}>
              <TouchableOpacity
                style={[styles.primaryButton, actionLoading === 'edit' && styles.buttonDisabled]}
                onPress={onSaveEdit}
                disabled={!!actionLoading}
                activeOpacity={0.7}
              >
                <Text style={styles.primaryButtonText}>
                  {actionLoading === 'edit' ? 'Saving...' : 'Save Changes'}
                </Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.secondaryButton} onPress={onCancelEdit} activeOpacity={0.7}>
                <Text style={styles.secondaryButtonText}>Cancel</Text>
              </TouchableOpacity>
            </View>
          )}

          {canFeedback && !showOutcomeModal && (
            <TouchableOpacity style={styles.primaryButton} onPress={onShowOutcome} activeOpacity={0.7}>
              <Text style={styles.primaryButtonText}>How did it go? Share feedback</Text>
            </TouchableOpacity>
          )}

          {showOutcomeModal && (
            <View style={styles.outcomeGrid}>
              <Text style={styles.outcomeTitle}>How did your conversation go?</Text>
              {Object.entries(outcomeLabels).map(([key, val]) => (
                <TouchableOpacity
                  key={key}
                  style={[styles.outcomeButton, actionLoading === 'outcome' && styles.buttonDisabled]}
                  onPress={() => onRecordOutcome(key)}
                  disabled={!!actionLoading}
                  activeOpacity={0.7}
                >
                  <Text style={[styles.outcomeButtonText, { color: val.color }]}>{val.label}</Text>
                </TouchableOpacity>
              ))}
              <TouchableOpacity onPress={onHideOutcome} activeOpacity={0.7}>
                <Text style={styles.outcomeCancel}>Not now</Text>
              </TouchableOpacity>
            </View>
          )}

          {isPending && !editMode && (
            <TouchableOpacity
              style={styles.cancelIntroButton}
              onPress={onCancel}
              disabled={!!actionLoading}
              activeOpacity={0.7}
            >
              <Text style={styles.cancelIntroText}>Cancel Introduction</Text>
            </TouchableOpacity>
          )}
        </View>
      </View>
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
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: Colors.border,
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
  logoText: {
    fontSize: 14,
    fontFamily: 'Inter_700Bold',
    color: '#fff',
  },
  headerTitle: {
    fontSize: 22,
    fontFamily: 'Inter_700Bold',
    color: Colors.text,
    flex: 1,
  },
  pendingBadge: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 10,
    backgroundColor: 'rgba(245,158,11,0.15)',
  },
  pendingBadgeText: {
    fontSize: 10,
    fontFamily: 'Inter_700Bold',
    color: '#fbbf24',
  },
  center: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  emptyState: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 40,
    gap: 8,
  },
  emptyTitle: {
    fontSize: 16,
    fontFamily: 'Inter_700Bold',
    color: Colors.text,
    marginTop: 8,
  },
  emptySubtitle: {
    fontSize: 13,
    fontFamily: 'Inter_400Regular',
    color: Colors.textMuted,
    textAlign: 'center',
  },
  list: {
    padding: 16,
    gap: 12,
  },
  introCard: {
    backgroundColor: Colors.surface,
    borderRadius: 16,
    padding: 16,
    borderWidth: 1,
    borderColor: Colors.border,
    marginBottom: 12,
  },
  introCardPending: {
    borderColor: 'rgba(245,158,11,0.2)',
    backgroundColor: 'rgba(245,158,11,0.03)',
  },
  introCardTop: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  introAvatar: {
    width: 40,
    height: 40,
    borderRadius: 12,
    backgroundColor: Colors.surfaceLight,
    alignItems: 'center',
    justifyContent: 'center',
  },
  introAvatarText: {
    fontSize: 15,
    fontFamily: 'Inter_700Bold',
    color: Colors.accentLight,
  },
  introInfo: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    flexWrap: 'wrap',
    gap: 6,
  },
  introName: {
    fontSize: 14,
    fontFamily: 'Inter_600SemiBold',
    color: Colors.text,
  },
  statusBadge: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 8,
  },
  statusBadgeText: {
    fontSize: 10,
    fontFamily: 'Inter_700Bold',
  },
  introCompany: {
    fontSize: 12,
    fontFamily: 'Inter_400Regular',
    color: Colors.textMuted,
    marginTop: 4,
    marginLeft: 52,
  },
  introPreview: {
    fontSize: 12,
    fontFamily: 'Inter_400Regular',
    color: Colors.textTertiary,
    fontStyle: 'italic',
    marginTop: 8,
  },
  introDate: {
    fontSize: 10,
    fontFamily: 'Inter_400Regular',
    color: Colors.textMuted,
    marginTop: 8,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.7)',
    justifyContent: 'flex-end',
  },
  modalContent: {
    backgroundColor: Colors.surface,
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    maxHeight: '85%',
    padding: 20,
  },
  modalHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 16,
  },
  modalHeaderLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  modalName: {
    fontSize: 16,
    fontFamily: 'Inter_700Bold',
    color: Colors.text,
  },
  modalCompany: {
    fontSize: 12,
    fontFamily: 'Inter_400Regular',
    color: Colors.textMuted,
  },
  detailSection: {
    marginBottom: 16,
  },
  detailLabel: {
    fontSize: 10,
    fontFamily: 'Inter_600SemiBold',
    color: Colors.textMuted,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginBottom: 8,
  },
  detailText: {
    fontSize: 14,
    fontFamily: 'Inter_400Regular',
    color: 'rgba(255,255,255,0.7)',
    lineHeight: 22,
  },
  detailMeta: {
    fontSize: 11,
    fontFamily: 'Inter_400Regular',
    color: Colors.textMuted,
  },
  editTextArea: {
    backgroundColor: 'rgba(255,255,255,0.04)',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: 'rgba(13,148,136,0.3)',
    padding: 12,
    fontSize: 14,
    fontFamily: 'Inter_400Regular',
    color: Colors.text,
    minHeight: 120,
    textAlignVertical: 'top',
  },
  talkingPointRow: {
    flexDirection: 'row',
    gap: 8,
    marginBottom: 4,
  },
  talkingPointDot: {
    fontSize: 14,
    color: Colors.accentLight,
    lineHeight: 20,
  },
  talkingPointText: {
    fontSize: 13,
    fontFamily: 'Inter_400Regular',
    color: Colors.textTertiary,
    flex: 1,
    lineHeight: 20,
  },
  modalActions: {
    paddingTop: 16,
    borderTopWidth: 1,
    borderTopColor: Colors.border,
    gap: 8,
  },
  actionRow: {
    flexDirection: 'row',
    gap: 8,
  },
  primaryButton: {
    flex: 1,
    backgroundColor: Colors.primary,
    paddingVertical: 12,
    borderRadius: 12,
    alignItems: 'center',
  },
  primaryButtonText: {
    fontSize: 14,
    fontFamily: 'Inter_600SemiBold',
    color: '#fff',
  },
  secondaryButton: {
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: Colors.borderLight,
    alignItems: 'center',
  },
  secondaryButtonText: {
    fontSize: 14,
    fontFamily: 'Inter_500Medium',
    color: Colors.textSecondary,
  },
  buttonDisabled: {
    opacity: 0.5,
  },
  cancelIntroButton: {
    paddingVertical: 8,
    alignItems: 'center',
  },
  cancelIntroText: {
    fontSize: 12,
    fontFamily: 'Inter_400Regular',
    color: 'rgba(239,68,68,0.5)',
  },
  outcomeGrid: {
    gap: 8,
  },
  outcomeTitle: {
    fontSize: 12,
    fontFamily: 'Inter_400Regular',
    color: Colors.textMuted,
    textAlign: 'center',
    marginBottom: 4,
  },
  outcomeButton: {
    paddingVertical: 12,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: Colors.borderLight,
    alignItems: 'center',
    backgroundColor: 'rgba(30,41,59,0.8)',
  },
  outcomeButtonText: {
    fontSize: 14,
    fontFamily: 'Inter_500Medium',
  },
  outcomeCancel: {
    fontSize: 12,
    fontFamily: 'Inter_400Regular',
    color: Colors.textMuted,
    textAlign: 'center',
    paddingVertical: 4,
  },
});
