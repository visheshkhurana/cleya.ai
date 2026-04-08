const LINKEDIN_ACCESS_TOKEN = process.env.LINKEDIN_PAGE_ACCESS_TOKEN;
const LINKEDIN_ORG_ID = process.env.LINKEDIN_ORG_ID;

const LI_BASE = 'https://api.linkedin.com/v2';

interface LinkedInPostResult {
  success: boolean;
  postId?: string;
  error?: string;
}

function isConfigured(): boolean {
  return !!(LINKEDIN_ACCESS_TOKEN && LINKEDIN_ORG_ID);
}

async function publishTextPost(text: string): Promise<LinkedInPostResult> {
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
  } catch (err: any) {
    return { success: false, error: err.message };
  }
}

async function publishImagePost(text: string, imageUrl: string): Promise<LinkedInPostResult> {
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
  } catch (err: any) {
    return { success: false, error: err.message };
  }
}

async function publishArticle(text: string, articleUrl: string, title?: string, description?: string): Promise<LinkedInPostResult> {
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
  } catch (err: any) {
    return { success: false, error: err.message };
  }
}

export const linkedinPublisher = {
  isConfigured,
  publishTextPost,
  publishImagePost,
  publishArticle,
};
