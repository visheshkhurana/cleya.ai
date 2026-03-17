const API_BASE = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001/api';

class ApiClient {
  private token: string | null = null;

  setToken(token: string) {
    this.token = token;
    if (typeof window !== 'undefined') {
      localStorage.setItem('boardy_token', token);
    }
  }

  getToken(): string | null {
    if (this.token) return this.token;
    if (typeof window !== 'undefined') {
      this.token = localStorage.getItem('boardy_token');
    }
    return this.token;
  }

  clearToken() {
    this.token = null;
    if (typeof window !== 'undefined') {
      localStorage.removeItem('boardy_token');
    }
  }

  private async fetch<T = any>(path: string, options: RequestInit = {}): Promise<T> {
    const token = this.getToken();
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...(options.headers as Record<string, string> || {}),
    };

    const res = await fetch(`${API_BASE}${path}`, {
      ...options,
      headers,
    });

    const json = await res.json();

    if (!res.ok) {
      throw new Error(json.error?.message || 'Request failed');
    }

    return json.data;
  }

  // Auth
  async signup(email: string, password: string, phone?: string) {
    const data = await this.fetch<{ user: any; token: string }>('/auth/signup', {
      method: 'POST',
      body: JSON.stringify({ email, password, phone }),
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
      method: 'PUT',
      body: JSON.stringify(data),
    });
  }

  // Matches
  async getMatches() {
    return this.fetch('/matches');
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
}

export const api = new ApiClient();
