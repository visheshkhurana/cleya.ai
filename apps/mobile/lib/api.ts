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
    return apiFetch('/ai-chat/message', {
      method: 'POST',
      body: JSON.stringify({ message, history }),
    });
  },

  async getIntroductions() {
    return apiFetch('/introductions');
  },

  async getConversations() {
    return apiFetch('/dm/conversations');
  },

  async getDirectMessages(partnerId: string, limit = 50) {
    return apiFetch(`/dm/${partnerId}?limit=${limit}`);
  },

  async sendDirectMessage(partnerId: string, content: string) {
    return apiFetch(`/dm/${partnerId}`, {
      method: 'POST',
      body: JSON.stringify({ content }),
    });
  },

  async forgotPassword(email: string) {
    return apiFetch('/auth/forgot-password', {
      method: 'POST',
      body: JSON.stringify({ email }),
    });
  },
};

export { getApiUrl, API_BASE };
