/**
 * Ayrshare Service — social media posting, scheduling, and analytics via Ayrshare API.
 * Docs: https://docs.ayrshare.com
 */

const AYRSHARE_API_KEY = process.env.AYRSHARE_API_KEY || '';
const AYRSHARE_BASE = 'https://app.ayrshare.com/api';

interface AyrsharePostParams {
  content: string;
  platforms: string[];
  mediaUrls?: string[];
}

interface AyrshareScheduleParams {
  content: string;
  platforms: string[];
  scheduledDate: string; // ISO 8601
  mediaUrls?: string[];
}

interface AyrshareAnalyticsParams {
  postId: string;
}

interface AyrshareResponse {
  success: boolean;
  data?: any;
  error?: string;
}

function isConfigured(): boolean {
  return !!AYRSHARE_API_KEY;
}

async function ayrshareRequest(endpoint: string, method: 'GET' | 'POST' | 'DELETE', body?: Record<string, any>): Promise<AyrshareResponse> {
  if (!isConfigured()) {
    return { success: false, error: 'Ayrshare not configured. Set AYRSHARE_API_KEY in environment.' };
  }

  try {
    const res = await fetch(`${AYRSHARE_BASE}${endpoint}`, {
      method,
      headers: {
        'Authorization': `Bearer ${AYRSHARE_API_KEY}`,
        'Content-Type': 'application/json',
      },
      ...(body ? { body: JSON.stringify(body) } : {}),
    });

    const data: any = await res.json();

    if (!res.ok) {
      return { success: false, error: data?.message || data?.error || `Ayrshare API error: ${res.status}`, data };
    }

    return { success: true, data };
  } catch (err: any) {
    return { success: false, error: err.message };
  }
}

async function post(params: AyrsharePostParams): Promise<AyrshareResponse> {
  const body: Record<string, any> = {
    post: params.content,
    platforms: params.platforms,
  };
  if (params.mediaUrls && params.mediaUrls.length > 0) {
    body.mediaUrls = params.mediaUrls;
  }
  return ayrshareRequest('/post', 'POST', body);
}

async function schedulePost(params: AyrshareScheduleParams): Promise<AyrshareResponse> {
  const body: Record<string, any> = {
    post: params.content,
    platforms: params.platforms,
    scheduleDate: params.scheduledDate,
  };
  if (params.mediaUrls && params.mediaUrls.length > 0) {
    body.mediaUrls = params.mediaUrls;
  }
  return ayrshareRequest('/post', 'POST', body);
}

async function getAnalytics(params: AyrshareAnalyticsParams): Promise<AyrshareResponse> {
  return ayrshareRequest(`/analytics/post`, 'POST', { id: params.postId });
}

async function getHistory(): Promise<AyrshareResponse> {
  return ayrshareRequest('/history', 'GET');
}

async function deletePost(postId: string): Promise<AyrshareResponse> {
  return ayrshareRequest('/delete', 'DELETE', { id: postId });
}

export const ayrshareService = {
  isConfigured,
  post,
  schedulePost,
  getAnalytics,
  getHistory,
  deletePost,
};
