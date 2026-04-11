"use strict";
/**
 * Ayrshare Service — social media posting, scheduling, and analytics via Ayrshare API.
 * Docs: https://docs.ayrshare.com
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.ayrshareService = void 0;
const AYRSHARE_API_KEY = process.env.AYRSHARE_API_KEY || '';
const AYRSHARE_BASE = 'https://app.ayrshare.com/api';
function isConfigured() {
    return !!AYRSHARE_API_KEY;
}
async function ayrshareRequest(endpoint, method, body) {
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
        const data = await res.json();
        if (!res.ok) {
            return { success: false, error: data?.message || data?.error || `Ayrshare API error: ${res.status}`, data };
        }
        return { success: true, data };
    }
    catch (err) {
        return { success: false, error: err.message };
    }
}
async function post(params) {
    const body = {
        post: params.content,
        platforms: params.platforms,
    };
    if (params.mediaUrls && params.mediaUrls.length > 0) {
        body.mediaUrls = params.mediaUrls;
    }
    return ayrshareRequest('/post', 'POST', body);
}
async function schedulePost(params) {
    const body = {
        post: params.content,
        platforms: params.platforms,
        scheduleDate: params.scheduledDate,
    };
    if (params.mediaUrls && params.mediaUrls.length > 0) {
        body.mediaUrls = params.mediaUrls;
    }
    return ayrshareRequest('/post', 'POST', body);
}
async function getAnalytics(params) {
    return ayrshareRequest(`/analytics/post`, 'POST', { id: params.postId });
}
async function getHistory() {
    return ayrshareRequest('/history', 'GET');
}
async function deletePost(postId) {
    return ayrshareRequest('/delete', 'DELETE', { id: postId });
}
exports.ayrshareService = {
    isConfigured,
    post,
    schedulePost,
    getAnalytics,
    getHistory,
    deletePost,
};
//# sourceMappingURL=ayrshareService.js.map