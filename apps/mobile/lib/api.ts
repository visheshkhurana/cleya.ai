import * as SecureStore from 'expo-secure-store';
import Constants from 'expo-constants';
import { Platform } from 'react-native';

const TOKEN_KEY = 'cleya_auth_token';

export interface AuthUser {
  id: string;
  email: string;
  name?: string;
  role: string;
}

export interface UserProfile {
  id: string;
  userId: string;
  persona?: string;
  headline?: string;
  bio?: string;
  companyName?: string;
  currentRole?: string;
  location?: string;
  industries?: string[];
  linkedinUrl?: string;
  websiteUrl?: string;
  phone?: string;
  phoneNumber?: string;
  companyStage?: string;
  fundName?: string;
  portfolioSize?: number;
  experienceYears?: number;
  preferredRole?: string;
  completenessScore?: number;
  extraData?: Record<string, unknown>;
  [key: string]: unknown;
}

export interface NotificationPrefs {
  matchNotify?: boolean;
  introNotify?: boolean;
  weeklyDigest?: boolean;
}

export interface UserSettings {
  notificationPrefs?: NotificationPrefs;
  [key: string]: unknown;
}

export interface MatchUser {
  id: string;
  name?: string;
  email?: string;
  profile?: UserProfile;
}

export interface MatchStats {
  total: number;
  pending: number;
  accepted: number;
}

export interface Introduction {
  id: string;
  matchId: string;
  status: string;
  introText?: string;
  talkingPoints: string[];
  outcome?: string;
  outcomeNotes?: string;
  sentAt?: string;
  followUpAt?: string;
  scheduledAt?: string;
  notes?: string;
  createdAt: string;
  match: { score: number; reason?: string };
  userA: { id: string; email: string; name?: string; profile?: UserProfile };
  userB: { id: string; email: string; name?: string; profile?: UserProfile };
}

export interface Conversation {
  partnerId: string;
  partner: {
    id: string;
    email: string;
    name?: string;
    profile?: { persona?: string; headline?: string; companyName?: string; currentRole?: string; location?: string };
  };
  lastMessage: string;
  lastMessageAt: string;
  unreadCount: number;
}

export interface DirectMessage {
  id: string;
  senderId: string;
  recipientId: string;
  content: string;
  createdAt: string;
  readAt?: string | null;
  sender: { id: string; name?: string; email: string };
}

export interface FlowChoice {
  label: string;
  value: string;
  next: string;
}

export interface FormField {
  name: string;
  type: 'text' | 'email' | 'phone' | 'select' | 'multiselect' | 'textarea' | 'number' | 'url';
  label: string;
  placeholder?: string;
  required?: boolean;
  options?: { label: string; value: string }[];
  validation?: { min?: number; max?: number; pattern?: string; message?: string };
  conditional?: { field: string; value: string };
}

export interface FlowNode {
  id: string;
  type: string;
  content?: string;
  choices?: FlowChoice[];
  formSchema?: FormField[];
  next?: string | null;
  metadata?: Record<string, unknown>;
}

export interface ConversationEngineResponse {
  conversationId: string;
  node: FlowNode;
  messages?: { sender: string; content: string; nodeId?: string; createdAt?: string }[];
  errors?: Record<string, string>;
}

export interface WhatsAppStatus {
  whatsappOptedIn: boolean;
  whatsappPhone: string | null;
  preferences?: {
    whatsappEnabled: boolean;
    whatsappMatchNotify: boolean;
    whatsappIntroNotify: boolean;
    whatsappWeeklyDigest: boolean;
  };
}

function getApiUrl(): string {
  const envUrl = Constants.expoConfig?.extra?.apiDomain
    || process.env.EXPO_PUBLIC_API_URL
    || '';
  if (envUrl) return envUrl.replace(/\/$/, '');
  if (Platform.OS === 'web' && typeof window !== 'undefined') {
    return `${window.location.protocol}//${window.location.hostname}:3001`;
  }
  const debuggerHost = Constants.expoConfig?.hostUri || Constants.debuggerHost;
  if (debuggerHost) {
    const lanHost = debuggerHost.split(':')[0];
    return `http://${lanHost}:3001`;
  }
  return 'http://localhost:3001';
}

const API_BASE = getApiUrl();

async function getToken(): Promise<string | null> {
  try {
    return await SecureStore.getItemAsync(TOKEN_KEY);
  } catch {
    return null;
  }
}

async function setToken(token: string): Promise<void> {
  try {
    await SecureStore.setItemAsync(TOKEN_KEY, token);
  } catch {}
}

async function clearToken(): Promise<void> {
  try {
    await SecureStore.deleteItemAsync(TOKEN_KEY);
  } catch {}
}

async function apiFetch<T = unknown>(path: string, options: RequestInit = {}): Promise<T> {
  const token = await getToken();
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
    ...(options.headers as Record<string, string> || {}),
  };

  let res: Response;
  try {
    res = await fetch(`${API_BASE}/api${path}`, {
      ...options,
      headers,
    });
  } catch (err: unknown) {
    throw new Error(err instanceof Error ? err.message : 'Network error — please check your connection');
  }

  let json: Record<string, unknown>;
  try {
    json = await res.json();
  } catch {
    if (!res.ok) throw new Error(`Request failed (${res.status})`);
    return undefined as T;
  }

  if (!res.ok) {
    if (res.status === 401) {
      await clearToken();
    }
    const errObj = json?.error as Record<string, unknown> | undefined;
    const errMsg = (errObj?.message as string) || (json?.message as string) || 'Request failed';
    const details = errObj?.details;
    if (details && Array.isArray(details) && details.length > 0) {
      const detailStr = details.map((d: Record<string, string>) => d.field ? `${d.field}: ${d.message}` : d.message).join('; ');
      throw new Error(`${errMsg} — ${detailStr}`);
    }
    throw new Error(errMsg);
  }

  return json.data as T;
}

export const api = {
  getToken,
  setToken,
  clearToken,

  async login(email: string, password: string) {
    const data = await apiFetch<{ user: AuthUser; token: string }>('/auth/login', {
      method: 'POST',
      body: JSON.stringify({ email, password }),
    });
    if (data.token) await setToken(data.token);
    return data;
  },

  async signup(email: string, password: string, name?: string, persona?: string) {
    const data = await apiFetch<{ user: AuthUser; token: string }>('/auth/signup', {
      method: 'POST',
      body: JSON.stringify({ email, password, name, persona }),
    });
    if (data.token) await setToken(data.token);
    return data;
  },

  async logout() {
    await clearToken();
  },

  async getMe() {
    return apiFetch<AuthUser>('/auth/me');
  },

  async getProfile() {
    return apiFetch<UserProfile>('/users/profile');
  },

  async updateProfile(data: Record<string, string | number | boolean | string[] | undefined>) {
    return apiFetch('/users/profile', {
      method: 'PATCH',
      body: JSON.stringify(data),
    });
  },

  async getMatches() {
    return apiFetch('/matches');
  },

  async getMatchStats() {
    return apiFetch<MatchStats>('/matches/stats');
  },

  async findAndPropose(limit = 5) {
    return apiFetch('/matches/find-and-propose', {
      method: 'POST',
      body: JSON.stringify({ limit }),
    });
  },

  async respondToMatch(matchId: string, response: 'ACCEPTED' | 'REJECTED') {
    return apiFetch(`/matches/${matchId}/respond`, {
      method: 'POST',
      body: JSON.stringify({ response }),
    });
  },

  async submitMatchFeedback(matchId: string, rating: number, feedback?: string) {
    return apiFetch(`/matches/${matchId}/feedback`, {
      method: 'POST',
      body: JSON.stringify({ rating, feedback }),
    });
  },

  async getNotifications(limit = 20) {
    return apiFetch(`/notifications?limit=${limit}`);
  },

  async getSettings() {
    return apiFetch<UserSettings>('/users/settings');
  },

  async updateNotificationPrefs(prefs: { matchNotify?: boolean; introNotify?: boolean; weeklyDigest?: boolean }) {
    return apiFetch('/users/notification-preferences', {
      method: 'PATCH',
      body: JSON.stringify(prefs),
    });
  },

  async changePassword(currentPassword: string, newPassword: string) {
    return apiFetch('/users/change-password', {
      method: 'POST',
      body: JSON.stringify({ currentPassword, newPassword }),
    });
  },

  async deleteAccount() {
    return apiFetch('/users/account', { method: 'DELETE' });
  },

  async sendAIChat(message: string, history: { role: 'user' | 'assistant'; content: string }[] = []) {
    return apiFetch<{ content: string }>('/ai-chat/message', {
      method: 'POST',
      body: JSON.stringify({ message, history }),
    });
  },

  async startConversation(flowId: string) {
    return apiFetch<ConversationEngineResponse>('/conversations/start', {
      method: 'POST',
      body: JSON.stringify({ flowId }),
    });
  },

  async getConversation(conversationId: string) {
    return apiFetch<ConversationEngineResponse>(`/conversations/${conversationId}`);
  },

  async sendConversationMessage(
    conversationId: string,
    input: { choiceValue?: string; formData?: Record<string, unknown>; textInput?: string }
  ) {
    return apiFetch<ConversationEngineResponse>(`/conversations/${conversationId}/message`, {
      method: 'POST',
      body: JSON.stringify(input),
    });
  },

  async getIntroductions() {
    return apiFetch<Introduction[]>('/introductions');
  },

  async approveIntroduction(id: string) {
    return apiFetch(`/introductions/${id}/approve`, { method: 'POST' });
  },

  async editIntroductionText(id: string, introText: string) {
    return apiFetch(`/introductions/${id}/edit`, {
      method: 'PATCH',
      body: JSON.stringify({ introText }),
    });
  },

  async cancelIntroduction(id: string) {
    return apiFetch(`/introductions/${id}/cancel`, { method: 'POST' });
  },

  async recordIntroOutcome(id: string, outcome: string, outcomeNotes?: string) {
    return apiFetch(`/introductions/${id}/outcome`, {
      method: 'POST',
      body: JSON.stringify({ outcome, outcomeNotes }),
    });
  },

  async getConversations() {
    return apiFetch<Conversation[]>('/dm/conversations');
  },

  async getDirectMessages(partnerId: string, limit = 50) {
    return apiFetch<DirectMessage[]>(`/dm/${partnerId}?limit=${limit}`);
  },

  async sendDirectMessage(partnerId: string, content: string) {
    return apiFetch<DirectMessage>(`/dm/${partnerId}`, {
      method: 'POST',
      body: JSON.stringify({ content }),
    });
  },

  async whatsappStatus() {
    return apiFetch<WhatsAppStatus>('/whatsapp/status');
  },

  async whatsappOptIn(phoneNumber: string) {
    return apiFetch('/whatsapp/opt-in', {
      method: 'POST',
      body: JSON.stringify({ phoneNumber }),
    });
  },

  async whatsappOptOut() {
    return apiFetch('/whatsapp/opt-out', { method: 'POST' });
  },

  async forgotPassword(email: string) {
    return apiFetch('/auth/forgot-password', {
      method: 'POST',
      body: JSON.stringify({ email }),
    });
  },

  async resetPassword(token: string, password: string) {
    return apiFetch('/auth/reset-password', {
      method: 'POST',
      body: JSON.stringify({ token, password }),
    });
  },

  async verifyEmail(token: string) {
    return apiFetch('/auth/verify-email', {
      method: 'POST',
      body: JSON.stringify({ token }),
    });
  },

  async sendVerification() {
    return apiFetch('/auth/send-verification', { method: 'POST' });
  },

  async validateInvite(code: string) {
    return apiFetch<{ valid: boolean; inviterName?: string; inviterTitle?: string }>(`/invites/validate/${code}`);
  },

  async useInviteCode(code: string) {
    return apiFetch(`/invites/use/${code}`, { method: 'POST' });
  },

  async exportData(format: 'json' | 'csv' = 'json') {
    const token = await getToken();
    const headers: Record<string, string> = {
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    };
    const res = await fetch(`${API_BASE}/api/users/export?format=${format}`, { headers });
    if (!res.ok) throw new Error('Failed to export data');
    if (format === 'csv') {
      return res.text();
    }
    const json = await res.json();
    return json.data;
  },

  async zoomStatus() {
    return apiFetch<{ configured: boolean; connected: boolean }>('/zoom/status');
  },

  async zoomConnect() {
    return apiFetch<{ authUrl: string }>('/zoom/connect');
  },

  async zoomDisconnect() {
    return apiFetch('/zoom/disconnect', { method: 'POST' });
  },

  async calendarStatus() {
    return apiFetch<{ configured: boolean; connected: boolean; email?: string }>('/calendar/status');
  },

  async calendarConnect() {
    return apiFetch<{ authUrl: string }>('/calendar/connect');
  },

  async calendarDisconnect() {
    return apiFetch('/calendar/disconnect', { method: 'DELETE' });
  },
};

export { getApiUrl, API_BASE };
