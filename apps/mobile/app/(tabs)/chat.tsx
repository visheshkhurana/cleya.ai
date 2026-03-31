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
  ScrollView,
  Linking,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import * as Haptics from 'expo-haptics';
import { useAuth } from '@/contexts/AuthContext';
import { api, FlowNode, FormField } from '@/lib/api';
import { Colors } from '@/constants/colors';

interface ChatMessage {
  id: string;
  sender: 'AI' | 'USER';
  content: string;
  createdAt: Date;
}

const STEP_MAP: Record<string, number> = {
  welcome: 1,
  persona_select: 1,
  founder_details: 2,
  talent_details: 2,
  investor_details: 2,
  event_details: 2,
  deal_partner_details: 2,
  other_details: 2,
  founder_priorities: 3,
  common_details: 4,
  attribution: 5,
  completion: 5,
};
const TOTAL_STEPS = 5;

function parseMarkdown(text: string): React.ReactNode[] {
  const elements: React.ReactNode[] = [];
  const lines = text.split('\n');

  lines.forEach((line, lineIdx) => {
    if (line.startsWith('- ') || line.startsWith('* ')) {
      elements.push(
        <View key={`b-${lineIdx}`} style={s.bulletRow}>
          <Text style={s.bulletDot}>{'\u2022'}</Text>
          <Text style={s.messageTextAI}>{parseInline(line.slice(2))}</Text>
        </View>
      );
    } else if (line.match(/^\d+\. /)) {
      const num = line.match(/^(\d+)\. /)![1];
      elements.push(
        <View key={`ol-${lineIdx}`} style={s.bulletRow}>
          <Text style={s.bulletDot}>{num}.</Text>
          <Text style={s.messageTextAI}>{parseInline(line.replace(/^\d+\. /, ''))}</Text>
        </View>
      );
    } else {
      elements.push(
        <Text key={`t-${lineIdx}`} style={s.messageTextAI}>{parseInline(line)}</Text>
      );
    }
  });
  return elements;
}

function parseInline(text: string): React.ReactNode {
  const regex = /(\*\*(.+?)\*\*)|(\[([^\]]+)\]\(([^)]+)\))/g;
  const segments: React.ReactNode[] = [];
  let lastIndex = 0;
  let match: RegExpExecArray | null;

  while ((match = regex.exec(text)) !== null) {
    if (match.index > lastIndex) {
      segments.push(text.slice(lastIndex, match.index));
    }
    if (match[1]) {
      segments.push(
        <Text key={`b-${match.index}`} style={{ fontFamily: 'Inter_700Bold' }}>{match[2]}</Text>
      );
    } else if (match[3]) {
      const url = match[5];
      segments.push(
        <Text
          key={`l-${match.index}`}
          style={{ color: Colors.accentLight, textDecorationLine: 'underline' }}
          onPress={() => Linking.openURL(url)}
        >
          {match[4]}
        </Text>
      );
    }
    lastIndex = match.index + match[0].length;
  }
  if (lastIndex < text.length) {
    segments.push(text.slice(lastIndex));
  }
  return segments.length > 0 ? <>{segments}</> : text;
}

function MessageBubble({ message }: { message: ChatMessage }) {
  const isUser = message.sender === 'USER';

  return (
    <View style={[s.bubbleRow, isUser && s.bubbleRowUser]}>
      {!isUser && (
        <View style={s.avatarCircle}>
          <Text style={s.avatarText}>C</Text>
        </View>
      )}
      <View style={[s.bubble, isUser ? s.bubbleUser : s.bubbleAI]}>
        {isUser ? (
          <Text style={s.messageText}>{message.content}</Text>
        ) : (
          <>{parseMarkdown(message.content)}</>
        )}
        <Text style={s.timestamp}>
          {message.createdAt.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
        </Text>
      </View>
    </View>
  );
}

function TypingIndicator() {
  return (
    <View style={s.bubbleRow}>
      <View style={s.avatarCircle}>
        <Text style={s.avatarText}>C</Text>
      </View>
      <View style={[s.bubble, s.bubbleAI, s.typingBubble]}>
        <View style={s.typingDots}>
          <View style={[s.typingDot, { opacity: 0.4 }]} />
          <View style={[s.typingDot, { opacity: 0.6 }]} />
          <View style={[s.typingDot, { opacity: 0.8 }]} />
        </View>
      </View>
    </View>
  );
}

function StepProgress({ nodeId }: { nodeId: string }) {
  const step = STEP_MAP[nodeId] || 1;
  return (
    <View style={s.progressBar}>
      {Array.from({ length: TOTAL_STEPS }).map((_, i) => (
        <View
          key={i}
          style={[
            s.progressDot,
            i < step && s.progressDotActive,
            i === step - 1 && s.progressDotCurrent,
          ]}
        />
      ))}
      <Text style={s.progressLabel}>Step {step} of {TOTAL_STEPS}</Text>
    </View>
  );
}

const LETTERS = ['A', 'B', 'C', 'D', 'E', 'F', 'G', 'H'];

function ChoiceButtons({
  choices,
  onSelect,
  disabled,
}: {
  choices: { label: string; value: string }[];
  onSelect: (value: string) => void;
  disabled: boolean;
}) {
  const [selected, setSelected] = useState<string | null>(null);

  const handleSelect = (value: string) => {
    if (disabled || selected) return;
    setSelected(value);
    onSelect(value);
  };

  return (
    <View style={s.choicesContainer}>
      {choices.map((c, i) => (
        <TouchableOpacity
          key={c.value}
          style={[
            s.choiceButton,
            selected === c.value && s.choiceButtonSelected,
            selected && selected !== c.value && s.choiceButtonDimmed,
          ]}
          onPress={() => handleSelect(c.value)}
          disabled={disabled || !!selected}
          activeOpacity={0.7}
          accessibilityLabel={c.label}
          accessibilityRole="button"
        >
          <View style={[s.choiceLetter, selected === c.value && s.choiceLetterSelected]}>
            <Text style={[s.choiceLetterText, selected === c.value && { color: '#fff' }]}>
              {LETTERS[i] || String(i + 1)}
            </Text>
          </View>
          <Text style={s.choiceLabel}>{c.label}</Text>
        </TouchableOpacity>
      ))}
    </View>
  );
}

function DynamicForm({
  fields,
  onSubmit,
  disabled,
}: {
  fields: FormField[];
  onSubmit: (data: Record<string, unknown>) => void;
  disabled: boolean;
}) {
  const [formData, setFormData] = useState<Record<string, unknown>>({});
  const [errors, setErrors] = useState<Record<string, string>>({});

  const setValue = (name: string, value: unknown) => {
    setFormData(prev => ({ ...prev, [name]: value }));
    setErrors(prev => { const next = { ...prev }; delete next[name]; return next; });
  };

  const toggleMultiselect = (name: string, value: string) => {
    const current = (formData[name] as string[]) || [];
    if (current.includes(value)) {
      setValue(name, current.filter(v => v !== value));
    } else {
      setValue(name, [...current, value]);
    }
  };

  const validate = (): boolean => {
    const newErrors: Record<string, string> = {};
    for (const field of visibleFields) {
      const val = formData[field.name];
      if (field.required && (!val || (typeof val === 'string' && !val.trim()) || (Array.isArray(val) && val.length === 0))) {
        newErrors[field.name] = `${field.label} is required`;
      }
    }
    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = () => {
    if (disabled) return;
    if (!validate()) return;
    onSubmit(formData);
  };

  const visibleFields = fields.filter(f => {
    if (!f.conditional) return true;
    return formData[f.conditional.field] === f.conditional.value;
  });

  return (
    <View style={s.formContainer}>
      {visibleFields.map(field => (
        <View key={field.name} style={s.formField}>
          <Text style={s.formLabel}>
            {field.label}
            {field.required && <Text style={{ color: Colors.error }}> *</Text>}
          </Text>

          {(field.type === 'text' || field.type === 'email' || field.type === 'phone' || field.type === 'url' || field.type === 'number') && (
            <TextInput
              style={[s.formInput, errors[field.name] && s.formInputError]}
              value={(formData[field.name] as string) || ''}
              onChangeText={v => setValue(field.name, v)}
              placeholder={field.placeholder || ''}
              placeholderTextColor={Colors.textMuted}
              keyboardType={
                field.type === 'email' ? 'email-address' :
                field.type === 'phone' ? 'phone-pad' :
                field.type === 'number' ? 'numeric' :
                field.type === 'url' ? 'url' : 'default'
              }
              autoCapitalize={field.type === 'email' || field.type === 'url' ? 'none' : 'sentences'}
            />
          )}

          {field.type === 'textarea' && (
            <TextInput
              style={[s.formInput, s.formTextArea, errors[field.name] && s.formInputError]}
              value={(formData[field.name] as string) || ''}
              onChangeText={v => setValue(field.name, v)}
              placeholder={field.placeholder || ''}
              placeholderTextColor={Colors.textMuted}
              multiline
              numberOfLines={3}
              textAlignVertical="top"
            />
          )}

          {field.type === 'select' && field.options && (
            <View style={s.selectGrid}>
              {field.options.map(opt => (
                <TouchableOpacity
                  key={opt.value}
                  style={[s.selectOption, formData[field.name] === opt.value && s.selectOptionActive]}
                  onPress={() => setValue(field.name, opt.value)}
                  activeOpacity={0.7}
                >
                  <Text style={[s.selectOptionText, formData[field.name] === opt.value && s.selectOptionTextActive]}>
                    {opt.label}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>
          )}

          {field.type === 'multiselect' && field.options && (
            <View style={s.selectGrid}>
              {field.options.map(opt => {
                const selected = ((formData[field.name] as string[]) || []).includes(opt.value);
                return (
                  <TouchableOpacity
                    key={opt.value}
                    style={[s.selectOption, selected && s.selectOptionActive]}
                    onPress={() => toggleMultiselect(field.name, opt.value)}
                    activeOpacity={0.7}
                  >
                    <Text style={[s.selectOptionText, selected && s.selectOptionTextActive]}>
                      {opt.label}
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </View>
          )}

          {errors[field.name] && (
            <Text style={s.formError}>{errors[field.name]}</Text>
          )}
        </View>
      ))}

      <TouchableOpacity
        style={[s.formSubmitButton, disabled && { opacity: 0.5 }]}
        onPress={handleSubmit}
        disabled={disabled}
        activeOpacity={0.7}
        accessibilityLabel="Continue"
        accessibilityRole="button"
      >
        <Text style={s.formSubmitText}>Continue</Text>
      </TouchableOpacity>
    </View>
  );
}

export default function ChatScreen() {
  const { user } = useAuth();
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [inputText, setInputText] = useState('');
  const [initialLoading, setInitialLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const [typing, setTyping] = useState(false);
  const [isOnboarded, setIsOnboarded] = useState(false);
  const [currentNode, setCurrentNode] = useState<FlowNode | null>(null);
  const [conversationId, setConversationId] = useState<string | null>(null);
  const [redirecting, setRedirecting] = useState(false);
  const flatListRef = useRef<FlatList>(null);
  const idCounter = useRef(0);

  useEffect(() => {
    startChat();
  }, []);

  const nextId = () => `msg-${++idCounter.current}`;

  const scrollToBottom = useCallback(() => {
    setTimeout(() => flatListRef.current?.scrollToEnd({ animated: true }), 100);
  }, []);

  const addAIMessage = (content: string) => {
    setMessages(prev => [...prev, { id: nextId(), sender: 'AI', content, createdAt: new Date() }]);
  };

  const addUserMessage = (content: string) => {
    setMessages(prev => [...prev, { id: nextId(), sender: 'USER', content, createdAt: new Date() }]);
  };

  const startChat = async () => {
    try {
      const profile = await api.getProfile().catch(() => null);
      if (profile?.isComplete) {
        setIsOnboarded(true);
        setMessages([{
          id: 'welcome',
          sender: 'AI',
          content: "Welcome back! I'm Cleya, your AI networking assistant. Ask me anything \u2014 I can help you find connections, improve your profile, suggest networking strategies, or answer questions about India's startup ecosystem.",
          createdAt: new Date(),
        }]);
        setCurrentNode({ id: 'ai_chat', type: 'ai_response' });
        setInitialLoading(false);
        return;
      }

      const data = await api.startConversation('onboarding_v1');
      setConversationId(data.conversationId);
      setCurrentNode(data.node);
      if (data.messages) {
        setMessages(data.messages.map(m => ({
          id: nextId(),
          sender: (m.sender === 'AI' ? 'AI' : 'USER') as 'AI' | 'USER',
          content: m.content,
          createdAt: m.createdAt ? new Date(m.createdAt) : new Date(),
        })));
      }
    } catch (err: unknown) {
      addAIMessage("Hi! I'm Cleya. It looks like I couldn't start the onboarding right now. You can still chat with me freely!");
      setIsOnboarded(true);
      setCurrentNode({ id: 'ai_chat', type: 'ai_response' });
    } finally {
      setInitialLoading(false);
    }
  };

  const sendOnboardingMessage = async (input: {
    choiceValue?: string;
    formData?: Record<string, unknown>;
    textInput?: string;
  }) => {
    if (!conversationId) return;

    const userContent = input.textInput || input.choiceValue || (input.formData ? 'Submitted details' : '');
    if (userContent) addUserMessage(userContent);

    setTyping(true);
    setCurrentNode(null);
    setSending(true);
    scrollToBottom();

    try {
      await new Promise(r => setTimeout(r, 500 + Math.random() * 500));
      const data = await api.sendConversationMessage(conversationId, input);

      if (data.errors) {
        setCurrentNode(currentNode);
        setTyping(false);
        setSending(false);
        return;
      }

      if (data.node) {
        setCurrentNode(data.node);
        if (data.node.content) {
          addAIMessage(data.node.content);
        }

        if (data.node.metadata?.action === 'complete_onboarding' || data.node.next === null) {
          setRedirecting(true);
          setCurrentNode(null);
          addAIMessage("\ud83c\udf89 **You're all set!** Your profile has been created and Cleya is already looking for great connections for you.\n\nTaking you to your dashboard...");
          if (Platform.OS !== 'web') Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
          setTimeout(() => router.replace('/(tabs)/'), 3000);
        }
      }
    } catch (err: unknown) {
      Alert.alert('Error', 'Something went wrong. Please try again.');
    } finally {
      setTyping(false);
      setSending(false);
      scrollToBottom();
    }
  };

  const handleAIChat = async (msg: string) => {
    addUserMessage(msg);
    setTyping(true);
    setSending(true);
    scrollToBottom();
    try {
      const history = messages
        .filter(m => m.id !== 'welcome')
        .map(m => ({
          role: m.sender === 'AI' ? 'assistant' as const : 'user' as const,
          content: m.content,
        }));
      const result = await api.sendAIChat(msg, history);
      addAIMessage(result.content);
      if (Platform.OS !== 'web') Haptics.selectionAsync();
    } catch {
      addAIMessage("Sorry, I couldn't process that right now. Please try again!");
    } finally {
      setTyping(false);
      setSending(false);
      scrollToBottom();
    }
  };

  const handleTextSubmit = () => {
    const text = inputText.trim();
    if (!text || sending) return;
    setInputText('');
    if (isOnboarded) {
      handleAIChat(text);
    } else {
      sendOnboardingMessage({ textInput: text });
    }
  };

  const showTextInput = isOnboarded || currentNode?.type === 'ai_response';

  const quickPrompts = [
    "Help me improve my profile",
    "Suggest networking strategies",
    "How do introductions work?",
  ];

  if (initialLoading) {
    return (
      <View style={[s.container, { paddingTop: Platform.OS === 'web' ? 67 : insets.top }]}>
        <View style={s.loadingCenter}>
          <View style={s.logoIcon}>
            <Text style={s.logoText}>C</Text>
          </View>
          <Text style={s.loadingText}>Starting conversation...</Text>
        </View>
      </View>
    );
  }

  return (
    <KeyboardAvoidingView
      style={[s.container, { paddingTop: Platform.OS === 'web' ? 67 : insets.top }]}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      keyboardVerticalOffset={0}
    >
      <View style={s.header}>
        <View style={s.headerRow}>
          <View style={s.logoIcon}>
            <Text style={s.logoText}>C</Text>
          </View>
          <View>
            <Text style={s.headerTitle}>{isOnboarded ? 'Cleya AI' : 'Welcome to Cleya'}</Text>
            <View style={s.statusRow}>
              <View style={s.statusDot} />
              <Text style={s.statusText}>{isOnboarded ? 'Active now' : 'Onboarding'}</Text>
            </View>
          </View>
        </View>
      </View>

      {!isOnboarded && currentNode && STEP_MAP[currentNode.id] && (
        <StepProgress nodeId={currentNode.id} />
      )}

      <FlatList
        ref={flatListRef}
        data={messages}
        keyExtractor={(item) => item.id}
        renderItem={({ item }) => <MessageBubble message={item} />}
        contentContainerStyle={s.messageList}
        showsVerticalScrollIndicator={false}
        onContentSizeChange={scrollToBottom}
        ListHeaderComponent={
          isOnboarded && messages.length <= 1 ? (
            <View style={s.quickPromptsContainer}>
              <Text style={s.quickPromptsTitle}>Try asking:</Text>
              {quickPrompts.map((prompt) => (
                <TouchableOpacity
                  key={prompt}
                  style={s.quickPromptChip}
                  onPress={() => setInputText(prompt)}
                  activeOpacity={0.7}
                >
                  <Text style={s.quickPromptText}>{prompt}</Text>
                </TouchableOpacity>
              ))}
            </View>
          ) : null
        }
        ListFooterComponent={
          <>
            {typing && <TypingIndicator />}
            {!typing && !isOnboarded && currentNode?.type === 'choices' && currentNode.choices && (
              <ChoiceButtons
                choices={currentNode.choices}
                onSelect={(value) => sendOnboardingMessage({ choiceValue: value })}
                disabled={sending}
              />
            )}
            {!typing && !isOnboarded && currentNode?.formSchema && currentNode.formSchema.length > 0 && (
              <DynamicForm
                fields={currentNode.formSchema}
                onSubmit={(data) => sendOnboardingMessage({ formData: data })}
                disabled={sending}
              />
            )}
          </>
        }
      />

      {showTextInput && !redirecting && (
        <View style={[s.inputBar, { paddingBottom: Platform.OS === 'web' ? 20 : insets.bottom + 8 }]}>
          <TextInput
            style={s.textInput}
            value={inputText}
            onChangeText={(v) => setInputText(v.slice(0, 500))}
            placeholder="Message Cleya..."
            placeholderTextColor={Colors.textMuted}
            multiline
            maxLength={500}
            editable={!sending}
            returnKeyType="send"
            blurOnSubmit
            onSubmitEditing={handleTextSubmit}
          />
          <TouchableOpacity
            style={[s.sendButton, (!inputText.trim() || sending) && s.sendButtonDisabled]}
            onPress={handleTextSubmit}
            disabled={!inputText.trim() || sending}
            activeOpacity={0.7}
            accessibilityLabel="Send message"
            accessibilityRole="button"
          >
            <Ionicons name="arrow-up" size={18} color={inputText.trim() && !sending ? '#fff' : Colors.textMuted} />
          </TouchableOpacity>
        </View>
      )}
    </KeyboardAvoidingView>
  );
}

const s = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.background,
  },
  loadingCenter: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 12,
  },
  loadingText: {
    fontSize: 13,
    fontFamily: 'Inter_400Regular',
    color: Colors.textMuted,
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
  progressBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: Colors.border,
  },
  progressDot: {
    width: 24,
    height: 4,
    borderRadius: 2,
    backgroundColor: Colors.surfaceLight,
  },
  progressDotActive: {
    backgroundColor: Colors.primary,
  },
  progressDotCurrent: {
    backgroundColor: Colors.accent,
  },
  progressLabel: {
    fontSize: 10,
    fontFamily: 'Inter_500Medium',
    color: Colors.textMuted,
    marginLeft: 8,
  },
  messageList: {
    paddingHorizontal: 16,
    paddingVertical: 12,
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
    fontSize: 14,
    fontFamily: 'Inter_400Regular',
    color: 'rgba(255,255,255,0.85)',
    lineHeight: 20,
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
  choicesContainer: {
    gap: 8,
    marginBottom: 12,
    paddingLeft: 36,
    maxWidth: '85%',
  },
  choiceButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: Colors.border,
    paddingHorizontal: 14,
    paddingVertical: 12,
    backgroundColor: Colors.surface,
  },
  choiceButtonSelected: {
    borderColor: Colors.primary,
    backgroundColor: 'rgba(13,148,136,0.1)',
  },
  choiceButtonDimmed: {
    opacity: 0.3,
  },
  choiceLetter: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: 'rgba(255,255,255,0.08)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  choiceLetterSelected: {
    backgroundColor: Colors.primary,
  },
  choiceLetterText: {
    fontSize: 12,
    fontFamily: 'Inter_700Bold',
    color: Colors.textSecondary,
  },
  choiceLabel: {
    fontSize: 14,
    fontFamily: 'Inter_500Medium',
    color: Colors.textSecondary,
    flex: 1,
  },
  formContainer: {
    gap: 14,
    marginBottom: 12,
    paddingLeft: 36,
    backgroundColor: Colors.surface,
    borderRadius: 16,
    padding: 16,
    borderWidth: 1,
    borderColor: Colors.border,
    maxWidth: '90%',
  },
  formField: {
    gap: 6,
  },
  formLabel: {
    fontSize: 13,
    fontFamily: 'Inter_500Medium',
    color: Colors.textSecondary,
  },
  formInput: {
    backgroundColor: 'rgba(255,255,255,0.04)',
    borderRadius: 10,
    borderWidth: 1,
    borderColor: Colors.border,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 14,
    fontFamily: 'Inter_400Regular',
    color: Colors.text,
  },
  formInputError: {
    borderColor: Colors.error,
  },
  formTextArea: {
    minHeight: 80,
    textAlignVertical: 'top',
  },
  formError: {
    fontSize: 11,
    fontFamily: 'Inter_400Regular',
    color: Colors.error,
  },
  selectGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
  },
  selectOption: {
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: Colors.border,
    backgroundColor: 'rgba(255,255,255,0.03)',
  },
  selectOptionActive: {
    borderColor: Colors.primary,
    backgroundColor: 'rgba(13,148,136,0.12)',
  },
  selectOptionText: {
    fontSize: 12,
    fontFamily: 'Inter_400Regular',
    color: Colors.textTertiary,
  },
  selectOptionTextActive: {
    color: Colors.accent,
    fontFamily: 'Inter_600SemiBold',
  },
  formSubmitButton: {
    backgroundColor: Colors.primary,
    borderRadius: 12,
    paddingVertical: 12,
    alignItems: 'center',
    marginTop: 4,
  },
  formSubmitText: {
    fontSize: 14,
    fontFamily: 'Inter_600SemiBold',
    color: '#fff',
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
