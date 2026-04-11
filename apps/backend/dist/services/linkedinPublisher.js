"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.linkedinPublisher = void 0;
const LINKEDIN_ACCESS_TOKEN = process.env.LINKEDIN_PAGE_ACCESS_TOKEN;
const LINKEDIN_ORG_ID = process.env.LINKEDIN_ORG_ID;
const LI_BASE = 'https://api.linkedin.com/v2';
function isConfigured() {
    return !!(LINKEDIN_ACCESS_TOKEN && LINKEDIN_ORG_ID);
}
async function publishTextPost(text) {
    if (!isConfigured()) {
        return { success: false, error: 'LinkedIn publishing not configured. Set LINKEDIN_PAGE_ACCESS_TOKEN and LINKEDIN_ORG_ID.' };
    }
    try {
        const body = {
            author: `urn:li:organization:${LINKEDIN_ORG_ID}`,
            lifecycleState: 'PUBLISHED',
            specificContent: {
                'com.linkedin.ugc.ShareContent': {
                    shareCommentary: { text },
                    shareMediaCategory: 'NONE',
                },
            },
            visibility: {
                'com.linkedin.ugc.MemberNetworkVisibility': 'PUBLIC',
            },
        };
        const res = await fetch(`${LI_BASE}/ugcPosts`, {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${LINKEDIN_ACCESS_TOKEN}`,
                'Content-Type': 'application/json',
                'X-Restli-Protocol-Version': '2.0.0',
            },
            body: JSON.stringify(body),
        });
        if (!res.ok) {
            const errText = await res.text();
            return { success: false, error: `LinkedIn API error: ${res.status} - ${errText}` };
        }
        const postId = res.headers.get('x-restli-id') || '';
        return { success: true, postId };
    }
    catch (err) {
        return { success: false, error: err.message };
    }
}
async function publishImagePost(text, imageUrl) {
    if (!isConfigured()) {
        return { success: false, error: 'LinkedIn publishing not configured.' };
    }
    try {
        const body = {
            author: `urn:li:organization:${LINKEDIN_ORG_ID}`,
            lifecycleState: 'PUBLISHED',
            specificContent: {
                'com.linkedin.ugc.ShareContent': {
                    shareCommentary: { text },
                    shareMediaCategory: 'ARTICLE',
                    media: [{
                            status: 'READY',
                            originalUrl: imageUrl,
                        }],
                },
            },
            visibility: {
                'com.linkedin.ugc.MemberNetworkVisibility': 'PUBLIC',
            },
        };
        const res = await fetch(`${LI_BASE}/ugcPosts`, {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${LINKEDIN_ACCESS_TOKEN}`,
                'Content-Type': 'application/json',
                'X-Restli-Protocol-Version': '2.0.0',
            },
            body: JSON.stringify(body),
        });
        if (!res.ok) {
            const errText = await res.text();
            return { success: false, error: `LinkedIn API error: ${res.status} - ${errText}` };
        }
        const postId = res.headers.get('x-restli-id') || '';
        return { success: true, postId };
    }
    catch (err) {
        return { success: false, error: err.message };
    }
}
async function publishArticle(text, articleUrl, title, description) {
    if (!isConfigured()) {
        return { success: false, error: 'LinkedIn publishing not configured.' };
    }
    try {
        const body = {
            author: `urn:li:organization:${LINKEDIN_ORG_ID}`,
            lifecycleState: 'PUBLISHED',
            specificContent: {
                'com.linkedin.ugc.ShareContent': {
                    shareCommentary: { text },
                    shareMediaCategory: 'ARTICLE',
                    media: [{
                            status: 'READY',
                            originalUrl: articleUrl,
                            title: { text: title || '' },
                            description: { text: description || '' },
                        }],
                },
            },
            visibility: {
                'com.linkedin.ugc.MemberNetworkVisibility': 'PUBLIC',
            },
        };
        const res = await fetch(`${LI_BASE}/ugcPosts`, {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${LINKEDIN_ACCESS_TOKEN}`,
                'Content-Type': 'application/json',
                'X-Restli-Protocol-Version': '2.0.0',
            },
            body: JSON.stringify(body),
        });
        if (!res.ok) {
            const errText = await res.text();
            return { success: false, error: `LinkedIn API error: ${res.status} - ${errText}` };
        }
        const postId = res.headers.get('x-restli-id') || '';
        return { success: true, postId };
    }
    catch (err) {
        return { success: false, error: err.message };
    }
}
exports.linkedinPublisher = {
    isConfigured,
    publishTextPost,
    publishImagePost,
    publishArticle,
};
//# sourceMappingURL=linkedinPublisher.js.map