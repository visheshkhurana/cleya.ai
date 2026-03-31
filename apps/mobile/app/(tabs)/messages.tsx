import { useState, useCallback, useRef } from 'react';
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
  KeyboardAvoidingView,
  Alert,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import * as Haptics from 'expo-haptics';
import { useAuth } from '@/contexts/AuthContext';
import { api, Conversation, DirectMessage } from '@/lib/api';
import { Colors, personaLabels } from '@/constants/colors';

export default function MessagesScreen() {
  const { user } = useAuth();
  const insets = useSafeAreaInsets();
  const queryClient = useQueryClient();
  const [selectedPartner, setSelectedPartner] = useState<Conversation | null>(null);

  const { data: conversations, isLoading, isError } = useQuery<Conversation[]>({
    queryKey: ['conversations'],
    queryFn: () => api.getConversations(),
    refetchInterval: 15000,
  });

  const [refreshing, setRefreshing] = useState(false);
  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await queryClient.invalidateQueries({ queryKey: ['conversations'] });
    setRefreshing(false);
  }, [queryClient]);

  const convos = Array.isArray(conversations) ? conversations : [];

  if (selectedPartner) {
    return (
      <ChatThread
        partner={selectedPartner}
        userId={user?.id || ''}
        onBack={() => {
          setSelectedPartner(null);
          queryClient.invalidateQueries({ queryKey: ['conversations'] });
        }}
        insets={insets}
      />
    );
  }

  return (
    <View style={[styles.container, { paddingTop: Platform.OS === 'web' ? 67 : insets.top }]}>
      <View style={styles.header}>
        <View style={styles.headerRow}>
          <View style={styles.logoIcon}>
            <Text style={styles.logoText}>C</Text>
          </View>
          <Text style={styles.headerTitle}>Messages</Text>
        </View>
      </View>

      {isLoading ? (
        <View style={styles.center}>
          <ActivityIndicator size="large" color={Colors.accent} />
        </View>
      ) : isError ? (
        <View style={styles.emptyState}>
          <Ionicons name="warning-outline" size={48} color={Colors.warning} />
          <Text style={styles.emptyTitle}>Could not load messages</Text>
          <Text style={styles.emptySubtitle}>Pull down to try again</Text>
        </View>
      ) : convos.length === 0 ? (
        <View style={styles.emptyState}>
          <Ionicons name="chatbubbles-outline" size={48} color={Colors.textMuted} />
          <Text style={styles.emptyTitle}>No messages yet</Text>
          <Text style={styles.emptySubtitle}>When you accept a match, you can start chatting here</Text>
        </View>
      ) : (
        <FlatList
          data={convos}
          keyExtractor={(item) => item.partnerId}
          renderItem={({ item }) => {
            const name = item.partner.name || item.partner.profile?.currentRole || item.partner.email.split('@')[0];
            const persona = item.partner.profile?.persona;
            const timeAgo = getTimeAgo(item.lastMessageAt);
            return (
              <TouchableOpacity
                style={styles.convoRow}
                onPress={() => setSelectedPartner(item)}
                activeOpacity={0.7}
              >
                <View style={styles.convoAvatar}>
                  <Text style={styles.convoAvatarText}>{(name[0] || '?').toUpperCase()}</Text>
                </View>
                <View style={styles.convoContent}>
                  <View style={styles.convoTopRow}>
                    <Text style={styles.convoName} numberOfLines={1}>{name}</Text>
                    <Text style={styles.convoTime}>{timeAgo}</Text>
                  </View>
                  {persona ? (
                    <Text style={styles.convoPersona}>{personaLabels[persona] || persona}</Text>
                  ) : null}
                  <Text style={styles.convoLastMsg} numberOfLines={1}>{item.lastMessage}</Text>
                </View>
                {item.unreadCount > 0 && (
                  <View style={styles.unreadBadge}>
                    <Text style={styles.unreadText}>{item.unreadCount}</Text>
                  </View>
                )}
              </TouchableOpacity>
            );
          }}
          refreshControl={
            <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={Colors.accent} colors={[Colors.accent]} />
          }
          showsVerticalScrollIndicator={false}
        />
      )}
    </View>
  );
}

function ChatThread({
  partner,
  userId,
  onBack,
  insets,
}: {
  partner: Conversation;
  userId: string;
  onBack: () => void;
  insets: { top: number; bottom: number };
}) {
  const queryClient = useQueryClient();
  const [inputText, setInputText] = useState('');
  const [sending, setSending] = useState(false);
  const flatListRef = useRef<FlatList>(null);
  const partnerName = partner.partner.name || partner.partner.profile?.currentRole || partner.partner.email.split('@')[0];

  const { data: messages, isLoading } = useQuery<DirectMessage[]>({
    queryKey: ['dm', partner.partnerId],
    queryFn: () => api.getDirectMessages(partner.partnerId),
    refetchInterval: 5000,
  });


  const msgList = Array.isArray(messages) ? messages : [];

  const handleSend = async () => {
    const text = inputText.trim();
    if (!text || sending) return;
    setSending(true);
    setInputText('');
    try {
      await api.sendDirectMessage(partner.partnerId, text);
      await queryClient.invalidateQueries({ queryKey: ['dm', partner.partnerId] });
      if (Platform.OS !== 'web') Haptics.selectionAsync();
      setTimeout(() => flatListRef.current?.scrollToEnd({ animated: true }), 200);
    } catch (err: unknown) {
      Alert.alert('Error', err instanceof Error ? err.message : 'Could not send message');
      setInputText(text);
    } finally {
      setSending(false);
    }
  };

  return (
    <KeyboardAvoidingView
      style={[styles.container, { paddingTop: Platform.OS === 'web' ? 67 : insets.top }]}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <View style={styles.threadHeader}>
        <TouchableOpacity onPress={onBack} activeOpacity={0.7} style={styles.backButton}>
          <Ionicons name="chevron-back" size={22} color={Colors.text} />
        </TouchableOpacity>
        <View style={styles.threadAvatar}>
          <Text style={styles.threadAvatarText}>{(partnerName[0] || '?').toUpperCase()}</Text>
        </View>
        <View style={{ flex: 1 }}>
          <Text style={styles.threadName} numberOfLines={1}>{partnerName}</Text>
          {partner.partner.profile?.companyName ? (
            <Text style={styles.threadCompany}>{partner.partner.profile.companyName}</Text>
          ) : null}
        </View>
      </View>

      {isLoading ? (
        <View style={styles.center}>
          <ActivityIndicator size="large" color={Colors.accent} />
        </View>
      ) : (
        <FlatList
          ref={flatListRef}
          data={msgList}
          keyExtractor={(item) => item.id}
          renderItem={({ item }) => {
            const isMe = item.senderId === userId;
            return (
              <View style={[styles.dmBubbleRow, isMe && styles.dmBubbleRowMe]}>
                <View style={[styles.dmBubble, isMe ? styles.dmBubbleMe : styles.dmBubbleOther]}>
                  <Text style={styles.dmText}>{item.content}</Text>
                  <View style={styles.dmMeta}>
                    <Text style={styles.dmTime}>
                      {new Date(item.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                    </Text>
                    {isMe && item.readAt && (
                      <Ionicons name="checkmark-done" size={12} color={Colors.accentLight} />
                    )}
                    {isMe && !item.readAt && (
                      <Ionicons name="checkmark" size={12} color={Colors.textMuted} />
                    )}
                  </View>
                </View>
              </View>
            );
          }}
          contentContainerStyle={styles.dmList}
          showsVerticalScrollIndicator={false}
          onContentSizeChange={() => flatListRef.current?.scrollToEnd({ animated: false })}
        />
      )}

      <View style={[styles.dmInputBar, { paddingBottom: Platform.OS === 'web' ? 20 : insets.bottom + 8 }]}>
        <TextInput
          style={styles.dmInput}
          value={inputText}
          onChangeText={setInputText}
          placeholder={`Message ${partnerName}...`}
          placeholderTextColor={Colors.textMuted}
          multiline
          maxLength={2000}
          editable={!sending}
          returnKeyType="send"
          blurOnSubmit
          onSubmitEditing={handleSend}
        />
        <TouchableOpacity
          style={[styles.dmSendBtn, (!inputText.trim() || sending) && styles.dmSendBtnDisabled]}
          onPress={handleSend}
          disabled={!inputText.trim() || sending}
          activeOpacity={0.7}
        >
          {sending ? (
            <ActivityIndicator size="small" color="#fff" />
          ) : (
            <Ionicons name="send" size={16} color={inputText.trim() ? '#fff' : Colors.textMuted} />
          )}
        </TouchableOpacity>
      </View>
    </KeyboardAvoidingView>
  );
}

function getTimeAgo(dateStr: string): string {
  const diff = Date.now() - new Date(dateStr).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return 'now';
  if (mins < 60) return `${mins}m`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}h`;
  const days = Math.floor(hours / 24);
  if (days < 7) return `${days}d`;
  return new Date(dateStr).toLocaleDateString([], { month: 'short', day: 'numeric' });
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
  convoRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingVertical: 14,
    gap: 12,
    borderBottomWidth: 1,
    borderBottomColor: Colors.border,
  },
  convoAvatar: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: Colors.surfaceLight,
    alignItems: 'center',
    justifyContent: 'center',
  },
  convoAvatarText: {
    fontSize: 16,
    fontFamily: 'Inter_700Bold',
    color: Colors.accentLight,
  },
  convoContent: {
    flex: 1,
  },
  convoTopRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  convoName: {
    fontSize: 14,
    fontFamily: 'Inter_600SemiBold',
    color: Colors.text,
    flex: 1,
  },
  convoTime: {
    fontSize: 11,
    fontFamily: 'Inter_400Regular',
    color: Colors.textMuted,
  },
  convoPersona: {
    fontSize: 11,
    fontFamily: 'Inter_400Regular',
    color: Colors.accentLight,
  },
  convoLastMsg: {
    fontSize: 13,
    fontFamily: 'Inter_400Regular',
    color: Colors.textTertiary,
    marginTop: 2,
  },
  unreadBadge: {
    minWidth: 20,
    height: 20,
    borderRadius: 10,
    backgroundColor: Colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 6,
  },
  unreadText: {
    fontSize: 10,
    fontFamily: 'Inter_700Bold',
    color: '#fff',
  },
  threadHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 10,
    gap: 8,
    borderBottomWidth: 1,
    borderBottomColor: Colors.border,
  },
  backButton: {
    padding: 4,
  },
  threadAvatar: {
    width: 34,
    height: 34,
    borderRadius: 17,
    backgroundColor: Colors.surfaceLight,
    alignItems: 'center',
    justifyContent: 'center',
  },
  threadAvatarText: {
    fontSize: 13,
    fontFamily: 'Inter_700Bold',
    color: Colors.accentLight,
  },
  threadName: {
    fontSize: 15,
    fontFamily: 'Inter_600SemiBold',
    color: Colors.text,
  },
  threadCompany: {
    fontSize: 11,
    fontFamily: 'Inter_400Regular',
    color: Colors.textMuted,
  },
  dmList: {
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  dmBubbleRow: {
    flexDirection: 'row',
    marginBottom: 6,
  },
  dmBubbleRowMe: {
    justifyContent: 'flex-end',
  },
  dmBubble: {
    maxWidth: '80%',
    borderRadius: 16,
    paddingHorizontal: 14,
    paddingVertical: 8,
  },
  dmBubbleMe: {
    backgroundColor: Colors.primary,
    borderBottomRightRadius: 4,
  },
  dmBubbleOther: {
    backgroundColor: Colors.surface,
    borderBottomLeftRadius: 4,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  dmText: {
    fontSize: 14,
    fontFamily: 'Inter_400Regular',
    color: '#fff',
    lineHeight: 20,
  },
  dmMeta: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'flex-end',
    gap: 4,
    marginTop: 4,
  },
  dmTime: {
    fontSize: 10,
    fontFamily: 'Inter_400Regular',
    color: 'rgba(255,255,255,0.25)',
  },
  dmInputBar: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    gap: 8,
    paddingHorizontal: 16,
    paddingTop: 10,
    borderTopWidth: 1,
    borderTopColor: Colors.border,
  },
  dmInput: {
    flex: 1,
    backgroundColor: Colors.surface,
    borderRadius: 20,
    paddingHorizontal: 16,
    paddingVertical: 10,
    fontSize: 14,
    fontFamily: 'Inter_400Regular',
    color: Colors.text,
    maxHeight: 100,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  dmSendBtn: {
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: Colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  dmSendBtnDisabled: {
    backgroundColor: Colors.surfaceLight,
  },
});
