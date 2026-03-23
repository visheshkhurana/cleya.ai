const API_BASE = '/api';

function getCookie(name: string): string | null {
  if (typeof document === 'undefined') return null;
  const match = document.cookie.match(new RegExp('(?:^|; )' + name.replace(/([.$?*|{}()[\]\\/+^])/g, '\\$1') + '=([^;]*)'));
  return match ? decodeURIComponent(match[1]) : null;
}

class ApiClient {
  private token: string | null = null;
  private csrfToken: string | null = null;
  private csrfFetching: Promise<void> | null = null;

  setToken(token: string) {
    this.token = token;
    if (typeof window !== 'undefined') {
      localStorage.setItem('cleo_token', token);
    }
  }

  getToken(): string | null {
    if (this.token) return this.token;
    if (typeof window !== 'undefined') {
      this.token = localStorage.getItem('cleo_token');
    }
    return this.token;
  }

  clearToken() {
    this.token = null;
    if (typeof window !== 'undefined') {
      localStorage.removeItem('cleo_token');
    }
  }

  private async ensureCsrfToken(): Promise<string | null> {
    const existing = getCookie('cleo_csrf');
    if (existing) {
      this.csrfToken = existing;
      return existing;
    }
    if (this.csrfFetching) {
      await this.csrfFetching;
      return this.csrfToken;
    }
    this.csrfFetching = (async () => {
      try {
        const res = await fetch(`${API_BASE}/csrf-token`, { credentials: 'include' });
        const json = await res.json();
        if (json.data?.csrfToken) {
          this.csrfToken = json.data.csrfToken;
        }
      } catch {
        // non-fatal
      } finally {
        this.csrfFetching = null;
      }
    })();
    await this.csrfFetching;
    return this.csrfToken;
  }

  private async fetch<T = any>(path: string, options: RequestInit = {}): Promise<T> {
    const token = this.getToken();
    const method = (options.method || 'GET').toUpperCase();
    const needsCsrf = !['GET', 'HEAD', 'OPTIONS'].includes(method);

    let csrf: string | null = null;
    if (needsCsrf) {
      csrf = await this.ensureCsrfToken();
    }

    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...(csrf ? { 'x-csrf-token': csrf } : {}),
      ...(options.headers as Record<string, string> || {}),
    };

    const res = await fetch(`${API_BASE}${path}`, {
      ...options,
      headers,
      credentials: 'include',
    });

    const json = await res.json();

    if (!res.ok) {
      if (json.error?.code === 'CSRF_MISSING' || json.error?.code === 'CSRF_MISMATCH' || json.error?.code === 'CSRF_INVALID') {
        this.csrfToken = null;
        const newCsrf = await this.ensureCsrfToken();
        if (newCsrf) {
          headers['x-csrf-token'] = newCsrf;
          const retry = await fetch(`${API_BASE}${path}`, { ...options, headers, credentials: 'include' });
          const retryJson = await retry.json();
          if (!retry.ok) throw new Error(retryJson.error?.message || 'Request failed');
          return retryJson.data;
        }
      }
      const errMsg = json.error?.message || 'Request failed';
      const details = json.error?.details;
      if (details && Array.isArray(details) && details.length > 0) {
        const detailStr = details.map((d: any) => d.field ? `${d.field}: ${d.message}` : d.message).join('; ');
        throw new Error(`${errMsg} — ${detailStr}`);
      }
      throw new Error(errMsg);
    }

    return json.data;
  }

  async getGoogleAuthStatus() {
    return this.fetch<{ enabled: boolean }>('/auth/google/status');
  }

  // Auth
  async signup(email: string, password: string, phone?: string, utm?: { utmSource?: string; utmMedium?: string; utmCampaign?: string }, name?: string, persona?: string) {
    const data = await this.fetch<{ user: any; token: string }>('/auth/signup', {
      method: 'POST',
      body: JSON.stringify({ email, password, phone, name, persona, ...utm }),
    });
    this.setToken(data.token);
    return data;
  }

  async login(email: string, password: string) {
    const data = await this.fetch<{ user: any; token: string }>('/auth/login', {
      method: 'POST',
      body: JSON.stringify({ email, password }),
    });
    this.setToken(data.token);
    return data;
  }

  async getMe() {
    return this.fetch('/auth/me');
  }

  async useInviteCode(code: string) {
    return this.fetch(`/invites/use/${code}`, { method: 'POST' });
  }

  // Conversations
  async startConversation(flowId?: string) {
    return this.fetch('/conversations/start', {
      method: 'POST',
      body: JSON.stringify({ flowId }),
    });
  }

  async getConversation(id: string) {
    return this.fetch(`/conversations/${id}`);
  }

  async sendMessage(conversationId: string, input: {
    choiceValue?: string;
    formData?: Record<string, any>;
    textInput?: string;
  }) {
    return this.fetch(`/conversations/${conversationId}/message`, {
      method: 'POST',
      body: JSON.stringify(input),
    });
  }

  // Profile
  async getProfile() {
    return this.fetch('/users/profile');
  }

  async updateProfile(data: Record<string, any>) {
    return this.fetch('/users/profile', {
      method: 'PATCH',
      body: JSON.stringify(data),
    });
  }

  // Matches
  async getMatches() {
    return this.fetch('/matches');
  }

  async getMatchStats() {
    return this.fetch('/matches/stats');
  }

  async findMatches(limit = 10) {
    return this.fetch('/matches/find', {
      method: 'POST',
      body: JSON.stringify({ limit }),
    });
  }

  async findAndPropose(limit = 5) {
    return this.fetch('/matches/find-and-propose', {
      method: 'POST',
      body: JSON.stringify({ limit }),
    });
  }

  async respondToMatch(matchId: string, response: 'ACCEPTED' | 'REJECTED') {
    return this.fetch(`/matches/${matchId}/respond`, {
      method: 'POST',
      body: JSON.stringify({ response }),
    });
  }

  // Notifications
  async getNotifications(limit = 20) {
    return this.fetch(`/notifications?limit=${limit}`);
  }

  async markNotificationRead(id: string) {
    return this.fetch(`/notifications/${id}/read`, { method: 'PATCH' });
  }

  async markAllNotificationsRead() {
    return this.fetch('/notifications/read-all', { method: 'POST' });
  }

  // Settings
  async getSettings() {
    return this.fetch('/users/settings');
  }

  async updateNotificationPrefs(prefs: { matchNotify?: boolean; introNotify?: boolean; weeklyDigest?: boolean }) {
    return this.fetch('/users/notification-preferences', {
      method: 'PATCH',
      body: JSON.stringify(prefs),
    });
  }

  async changePassword(currentPassword: string, newPassword: string) {
    return this.fetch('/users/change-password', {
      method: 'POST',
      body: JSON.stringify({ currentPassword, newPassword }),
    });
  }

  async deleteAccount() {
    return this.fetch('/users/account', { method: 'DELETE' });
  }

  async exportMyData(format: 'json' | 'csv' = 'json') {
    const token = this.getToken();
    const res = await fetch(`${API_BASE}/users/export?format=${format}`, {
      headers: { ...(token ? { Authorization: `Bearer ${token}` } : {}), 'x-csrf-token': this.csrfToken || getCookie('cleo_csrf') || '' },
    });
    if (!res.ok) throw new Error('Export failed');
    const blob = await res.blob();
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `cleo-data-export.${format === 'csv' ? 'csv' : 'json'}`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  }

  // Admin Analytics
  async getAdminAnalytics() {
    return this.fetch('/admin/analytics');
  }

  async sendWeeklyDigest() {
    return this.fetch('/admin/send-digest', { method: 'POST' });
  }

  // Admin
  async getAdminStats() {
    return this.fetch('/admin/stats');
  }

  async getAdminUsers(page = 1, limit = 20) {
    return this.fetch(`/admin/users?page=${page}&limit=${limit}`);
  }

  async getAdminFunnel() {
    return this.fetch('/admin/funnel');
  }

  async getAdminCommunications() {
    return this.fetch('/admin/communications');
  }

  async adminTriggerCall(userId: string, phoneNumber: string) {
    return this.fetch(`/admin/trigger/call/${userId}`, {
      method: 'POST',
      body: JSON.stringify({ phoneNumber }),
    });
  }

  async adminTriggerMessage(userId: string, phoneNumber: string, channel: 'SMS' | 'WHATSAPP', message: string) {
    return this.fetch(`/admin/trigger/message/${userId}`, {
      method: 'POST',
      body: JSON.stringify({ phoneNumber, channel, message }),
    });
  }

  async getAdminDeals() {
    return this.fetch('/deals/admin/all');
  }

  async getAdminEvents() {
    return this.fetch('/events/admin/all');
  }

  async createEvent(data: { name: string; description?: string; date: string; endDate?: string; location?: string; isVirtual?: boolean; maxCapacity?: number }) {
    return this.fetch('/events', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  }

  async updateEvent(id: string, data: Record<string, any>) {
    return this.fetch(`/events/${id}`, {
      method: 'PATCH',
      body: JSON.stringify(data),
    });
  }

  async updateDeal(id: string, data: Record<string, any>) {
    return this.fetch(`/deals/${id}`, {
      method: 'PATCH',
      body: JSON.stringify(data),
    });
  }

  async submitMatchFeedback(matchId: string, rating: number, feedback?: string) {
    return this.fetch(`/matches/${matchId}/feedback`, {
      method: 'POST',
      body: JSON.stringify({ rating, feedback }),
    });
  }

  async getConversationMessages(conversationId: string) {
    return this.fetch(`/conversations/${conversationId}`);
  }

  async sendAIChat(message: string, history: { role: 'user' | 'assistant'; content: string }[] = []) {
    return this.fetch('/ai-chat/message', {
      method: 'POST',
      body: JSON.stringify({ message, history }),
    });
  }

  async getIntroductions() {
    return this.fetch('/introductions');
  }

  async getIntroduction(id: string) {
    return this.fetch(`/introductions/${id}`);
  }

  async updateIntroductionStatus(id: string, status: string, data?: { scheduledAt?: string; notes?: string }) {
    return this.fetch(`/introductions/${id}/status`, {
      method: 'PATCH',
      body: JSON.stringify({ status, ...data }),
    });
  }

  async approveIntroduction(id: string) {
    return this.fetch(`/introductions/${id}/approve`, { method: 'POST' });
  }

  async editIntroductionText(id: string, introText: string) {
    return this.fetch(`/introductions/${id}/edit`, {
      method: 'PATCH',
      body: JSON.stringify({ introText }),
    });
  }

  async cancelIntroduction(id: string) {
    return this.fetch(`/introductions/${id}/cancel`, { method: 'POST' });
  }

  async recordIntroOutcome(id: string, outcome: string, outcomeNotes?: string) {
    return this.fetch(`/introductions/${id}/outcome`, {
      method: 'POST',
      body: JSON.stringify({ outcome, outcomeNotes }),
    });
  }

  async updateParticipant(eventId: string, userId: string, data: { status?: string; checkedIn?: boolean }) {
    return this.fetch(`/events/${eventId}/participants/${userId}`, {
      method: 'PATCH',
      body: JSON.stringify(data),
    });
  }

  async forgotPassword(email: string) {
    return this.fetch('/auth/forgot-password', {
      method: 'POST',
      body: JSON.stringify({ email }),
    });
  }

  async resetPassword(token: string, password: string) {
    return this.fetch('/auth/reset-password', {
      method: 'POST',
      body: JSON.stringify({ token, password }),
    });
  }

  async sendVerificationEmail() {
    return this.fetch('/auth/send-verification', { method: 'POST' });
  }

  async verifyEmail(token: string) {
    return this.fetch('/auth/verify-email', {
      method: 'POST',
      body: JSON.stringify({ token }),
    });
  }
}

export const api = new ApiClient();
