import { useState, useCallback, useRef, useEffect } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  FlatList,
  ActivityIndicator,
  Platform,
  KeyboardAvoidingView,
  Alert,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { useAuth } from '@/contexts/AuthContext';
import { api } from '@/lib/api';
import { Colors } from '@/constants/colors';

interface ChatMessage {
  id: string;
  sender: 'AI' | 'USER';
  content: string;
  createdAt: Date;
}

function renderMarkdown(text: string) {
  const parts: { type: 'text' | 'bold' | 'italic' | 'bullet' | 'link'; content: string; url?: string }[] = [];
  const lines = text.split('\n');
  for (const line of lines) {
    if (line.startsWith('- ') || line.startsWith('• ')) {
      parts.push({ type: 'bullet', content: line.slice(2) });
    } else {
      parts.push({ type: 'text', content: line });
    }
  }
  return parts;
}

function MessageBubble({ message }: { message: ChatMessage }) {
  const isUser = message.sender === 'USER';
  const parts = isUser ? [{ type: 'text' as const, content: message.content }] : renderMarkdown(message.content);

  return (
    <View style={[styles.bubbleRow, isUser && styles.bubbleRowUser]}>
      {!isUser && (
        <View style={styles.avatarCircle}>
          <Text style={styles.avatarText}>C</Text>
        </View>
      )}
      <View style={[styles.bubble, isUser ? styles.bubbleUser : styles.bubbleAI]}>
        {parts.map((part, i) => {
          if (part.type === 'bullet') {
            return (
              <View key={i} style={styles.bulletRow}>
                <Text style={styles.bulletDot}>{'•'}</Text>
                <Text style={[styles.messageText, !isUser && styles.messageTextAI]}>{parseBoldItalic(part.content)}</Text>
              </View>
            );
          }
          return (
            <Text key={i} style={[styles.messageText, !isUser && styles.messageTextAI]}>
              {parseBoldItalic(part.content)}
            </Text>
          );
        })}
        <Text style={styles.timestamp}>
          {message.createdAt.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
        </Text>
      </View>
    </View>
  );
}

function parseBoldItalic(text: string): React.ReactNode {
  const boldRegex = /\*\*(.+?)\*\*/g;
  const segments: React.ReactNode[] = [];
  let lastIndex = 0;
  let match: RegExpExecArray | null;

  while ((match = boldRegex.exec(text)) !== null) {
    if (match.index > lastIndex) {
      segments.push(text.slice(lastIndex, match.index));
    }
    segments.push(
      <Text key={match.index} style={{ fontFamily: 'Inter_700Bold' }}>{match[1]}</Text>
    );
    lastIndex = match.index + match[0].length;
  }
  if (lastIndex < text.length) {
    segments.push(text.slice(lastIndex));
  }
  return segments.length > 0 ? segments : text;
}

function TypingIndicator() {
  return (
    <View style={[styles.bubbleRow]}>
      <View style={styles.avatarCircle}>
        <Text style={styles.avatarText}>C</Text>
      </View>
      <View style={[styles.bubble, styles.bubbleAI, styles.typingBubble]}>
        <View style={styles.typingDots}>
          <View style={[styles.typingDot, { opacity: 0.4 }]} />
          <View style={[styles.typingDot, { opacity: 0.6 }]} />
          <View style={[styles.typingDot, { opacity: 0.8 }]} />
        </View>
      </View>
    </View>
  );
}

export default function ChatScreen() {
  const { user } = useAuth();
  const insets = useSafeAreaInsets();
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [inputText, setInputText] = useState('');
  const [loading, setLoading] = useState(false);
  const [typing, setTyping] = useState(false);
  const flatListRef = useRef<FlatList>(null);
  const idCounter = useRef(0);

  useEffect(() => {
    if (messages.length === 0) {
      setMessages([{
        id: 'welcome',
        sender: 'AI',
        content: "Hey! I'm Cleya, your AI networking assistant. Ask me anything — I can help you find connections, improve your profile, suggest networking strategies, or answer questions about India's startup ecosystem.",
        createdAt: new Date(),
      }]);
    }
  }, []);

  const scrollToBottom = useCallback(() => {
    setTimeout(() => {
      flatListRef.current?.scrollToEnd({ animated: true });
    }, 100);
  }, []);

  const handleSend = async () => {
    const text = inputText.trim();
    if (!text || loading) return;

    const userMsg: ChatMessage = {
      id: `user-${++idCounter.current}`,
      sender: 'USER',
      content: text,
      createdAt: new Date(),
    };

    setMessages(prev => [...prev, userMsg]);
    setInputText('');
    setTyping(true);
    setLoading(true);
    scrollToBottom();

    try {
      const history = messages
        .filter(m => m.id !== 'welcome')
        .map(m => ({
          role: m.sender === 'AI' ? 'assistant' as const : 'user' as const,
          content: m.content,
        }));

      const result = await api.sendAIChat(text, history);
      const aiMsg: ChatMessage = {
        id: `ai-${++idCounter.current}`,
        sender: 'AI',
        content: result.content,
        createdAt: new Date(),
      };
      setMessages(prev => [...prev, aiMsg]);
      if (Platform.OS !== 'web') Haptics.selectionAsync();
    } catch (err: unknown) {
      const errorMsg: ChatMessage = {
        id: `ai-err-${++idCounter.current}`,
        sender: 'AI',
        content: "Sorry, I couldn't process that right now. Please try again!",
        createdAt: new Date(),
      };
      setMessages(prev => [...prev, errorMsg]);
    } finally {
      setTyping(false);
      setLoading(false);
      scrollToBottom();
    }
  };

  const quickPrompts = [
    "Help me improve my profile",
    "Suggest networking strategies",
    "How do introductions work?",
  ];

  return (
    <KeyboardAvoidingView
      style={[styles.container, { paddingTop: Platform.OS === 'web' ? 67 : insets.top }]}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      keyboardVerticalOffset={0}
    >
      <View style={styles.header}>
        <View style={styles.headerRow}>
          <View style={styles.logoIcon}>
            <Text style={styles.logoText}>C</Text>
          </View>
          <View>
            <Text style={styles.headerTitle}>Cleya AI</Text>
            <View style={styles.statusRow}>
              <View style={styles.statusDot} />
              <Text style={styles.statusText}>Active now</Text>
            </View>
          </View>
        </View>
      </View>

      <FlatList
        ref={flatListRef}
        data={messages}
        keyExtractor={(item) => item.id}
        renderItem={({ item }) => <MessageBubble message={item} />}
        contentContainerStyle={styles.messageList}
        showsVerticalScrollIndicator={false}
        onContentSizeChange={scrollToBottom}
        ListHeaderComponent={
          messages.length <= 1 ? (
            <View style={styles.quickPromptsContainer}>
              <Text style={styles.quickPromptsTitle}>Try asking:</Text>
              {quickPrompts.map((prompt) => (
                <TouchableOpacity
                  key={prompt}
                  style={styles.quickPromptChip}
                  onPress={() => {
                    setInputText(prompt);
                  }}
                  activeOpacity={0.7}
                >
                  <Text style={styles.quickPromptText}>{prompt}</Text>
                </TouchableOpacity>
              ))}
            </View>
          ) : null
        }
        ListFooterComponent={typing ? <TypingIndicator /> : null}
      />

      <View style={[styles.inputBar, { paddingBottom: Platform.OS === 'web' ? 20 : insets.bottom + 8 }]}>
        <TextInput
          style={styles.textInput}
          value={inputText}
          onChangeText={(v) => setInputText(v.slice(0, 500))}
          placeholder="Message Cleya..."
          placeholderTextColor={Colors.textMuted}
          multiline
          maxLength={500}
          editable={!loading}
          returnKeyType="send"
          blurOnSubmit
          onSubmitEditing={handleSend}
        />
        <TouchableOpacity
          style={[styles.sendButton, (!inputText.trim() || loading) && styles.sendButtonDisabled]}
          onPress={handleSend}
          disabled={!inputText.trim() || loading}
          activeOpacity={0.7}
          accessibilityLabel="Send message"
          accessibilityRole="button"
        >
          <Ionicons name="arrow-up" size={18} color={inputText.trim() && !loading ? '#fff' : Colors.textMuted} />
        </TouchableOpacity>
      </View>
      {inputText.length > 0 && (
        <Text style={[styles.charCount, inputText.length >= 480 && styles.charCountWarn]}>
          {inputText.length}/500
        </Text>
      )}
    </KeyboardAvoidingView>
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
    width: 36,
    height: 36,
    borderRadius: 18,
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
    fontSize: 16,
    fontFamily: 'Inter_700Bold',
    color: Colors.text,
  },
  statusRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  statusDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: Colors.success,
  },
  statusText: {
    fontSize: 11,
    fontFamily: 'Inter_400Regular',
    color: Colors.textMuted,
  },
  messageList: {
    paddingHorizontal: 16,
    paddingVertical: 12,
    gap: 4,
  },
  bubbleRow: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    gap: 8,
    marginBottom: 8,
  },
  bubbleRowUser: {
    flexDirection: 'row-reverse',
  },
  avatarCircle: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: Colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarText: {
    fontSize: 11,
    fontFamily: 'Inter_700Bold',
    color: '#fff',
  },
  bubble: {
    maxWidth: '80%',
    borderRadius: 18,
    paddingHorizontal: 14,
    paddingVertical: 10,
  },
  bubbleUser: {
    backgroundColor: Colors.primary,
    borderBottomRightRadius: 4,
  },
  bubbleAI: {
    backgroundColor: Colors.surface,
    borderBottomLeftRadius: 4,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  messageText: {
    fontSize: 14,
    fontFamily: 'Inter_400Regular',
    color: '#fff',
    lineHeight: 20,
  },
  messageTextAI: {
    color: 'rgba(255,255,255,0.85)',
  },
  bulletRow: {
    flexDirection: 'row',
    gap: 6,
    paddingLeft: 4,
  },
  bulletDot: {
    fontSize: 14,
    color: Colors.accentLight,
    lineHeight: 20,
  },
  timestamp: {
    fontSize: 10,
    fontFamily: 'Inter_400Regular',
    color: 'rgba(255,255,255,0.25)',
    marginTop: 4,
    textAlign: 'right',
  },
  typingBubble: {
    paddingVertical: 14,
    paddingHorizontal: 18,
  },
  typingDots: {
    flexDirection: 'row',
    gap: 4,
  },
  typingDot: {
    width: 7,
    height: 7,
    borderRadius: 3.5,
    backgroundColor: Colors.textMuted,
  },
  inputBar: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    gap: 8,
    paddingHorizontal: 16,
    paddingTop: 10,
    borderTopWidth: 1,
    borderTopColor: Colors.border,
  },
  textInput: {
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
  sendButton: {
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: Colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  sendButtonDisabled: {
    backgroundColor: Colors.surfaceLight,
  },
  charCount: {
    fontSize: 10,
    fontFamily: 'Inter_400Regular',
    color: Colors.textMuted,
    textAlign: 'right',
    paddingHorizontal: 20,
    paddingBottom: 4,
  },
  charCountWarn: {
    color: Colors.warning,
  },
  quickPromptsContainer: {
    alignItems: 'center',
    paddingVertical: 20,
    gap: 8,
  },
  quickPromptsTitle: {
    fontSize: 12,
    fontFamily: 'Inter_500Medium',
    color: Colors.textMuted,
    marginBottom: 4,
  },
  quickPromptChip: {
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: Colors.border,
    backgroundColor: 'rgba(13,148,136,0.06)',
  },
  quickPromptText: {
    fontSize: 13,
    fontFamily: 'Inter_400Regular',
    color: Colors.textSecondary,
  },
});
