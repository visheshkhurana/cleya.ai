"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.instagramService = void 0;
const env_1 = require("../config/env");
const INSTAGRAM_ACCESS_TOKEN = env_1.env.INSTAGRAM_ACCESS_TOKEN;
const INSTAGRAM_BUSINESS_ACCOUNT_ID = env_1.env.INSTAGRAM_BUSINESS_ACCOUNT_ID;
const META_ADS_ACCESS_TOKEN = env_1.env.META_ADS_ACCESS_TOKEN;
const AYRSHARE_API_KEY = env_1.env.AYRSHARE_API_KEY;
const IG_BASE = 'https://graph.facebook.com/v19.0';
function isConfigured() {
    return !!((INSTAGRAM_ACCESS_TOKEN && INSTAGRAM_BUSINESS_ACCOUNT_ID) ||
        META_ADS_ACCESS_TOKEN ||
        AYRSHARE_API_KEY);
}
function getConnectionMethod() {
    if (INSTAGRAM_ACCESS_TOKEN && INSTAGRAM_BUSINESS_ACCOUNT_ID)
        return 'graph_api';
    if (META_ADS_ACCESS_TOKEN)
        return 'meta_ads';
    if (AYRSHARE_API_KEY)
        return 'ayrshare';
    return 'none';
}
async function igFetch(url) {
    const separator = url.includes('?') ? '&' : '?';
    const res = await fetch(`${url}${separator}access_token=${INSTAGRAM_ACCESS_TOKEN}`);
    if (!res.ok) {
        const err = await res.text();
        if (err.includes('OAuthException') || err.includes('expired') || err.includes('Invalid OAuth') || err.includes('"code":190') || err.includes('"code": 190')) {
            throw new Error(`Instagram token expired or invalid (HTTP ${res.status}). Generate a new long-lived access token.`);
        }
        throw new Error(`Instagram API error: ${res.status} - ${err}`);
    }
    return res.json();
}
async function getMetrics(dateRange = '30d') {
    if (!isConfigured())
        return null;
    try {
        const accountId = INSTAGRAM_BUSINESS_ACCOUNT_ID;
        const accountData = await igFetch(`${IG_BASE}/${accountId}?fields=username,name,followers_count,follows_count,media_count,profile_picture_url`);
        const days = dateRange === '7d' ? 7 : dateRange === '30d' ? 30 : 90;
        const since = Math.floor((Date.now() - days * 24 * 60 * 60 * 1000) / 1000);
        const until = Math.floor(Date.now() / 1000);
        let postReach = 0;
        let impressions = 0;
        try {
            const insightsData = await igFetch(`${IG_BASE}/${accountId}/insights?metric=reach,impressions&period=day&since=${since}&until=${until}`);
            for (const metric of insightsData.data || []) {
                const total = (metric.values || []).reduce((s, v) => s + (v.value || 0), 0);
                if (metric.name === 'reach')
                    postReach = total;
                if (metric.name === 'impressions')
                    impressions = total;
            }
        }
        catch {
            // insights may not be available for all account types
        }
        let followerGrowth = 0;
        try {
            const followerData = await igFetch(`${IG_BASE}/${accountId}/insights?metric=follower_count&period=day&since=${since}&until=${until}`);
            const values = followerData.data?.[0]?.values || [];
            if (values.length >= 2) {
                followerGrowth = (values[values.length - 1]?.value || 0) - (values[0]?.value || 0);
            }
        }
        catch {
            // follower insights may not be available
        }
        const mediaData = await igFetch(`${IG_BASE}/${accountId}/media?fields=id,caption,media_url,media_type,like_count,comments_count,timestamp&limit=25`);
        const mediaItems = mediaData.data || [];
        const topPosts = [...mediaItems]
            .sort((a, b) => ((b.like_count || 0) + (b.comments_count || 0)) - ((a.like_count || 0) + (a.comments_count || 0)))
            .slice(0, 6)
            .map((p) => ({
            id: p.id || '',
            caption: (p.caption || '').slice(0, 100),
            mediaUrl: p.media_url || '',
            mediaType: p.media_type || 'IMAGE',
            likeCount: p.like_count || 0,
            commentsCount: p.comments_count || 0,
            timestamp: p.timestamp || '',
        }));
        const totalEngagement = mediaItems.reduce((s, p) => s + (p.like_count || 0) + (p.comments_count || 0), 0);
        const engagementRate = (accountData.followers_count || 0) > 0
            ? Math.round((totalEngagement / (mediaItems.length || 1) / (accountData.followers_count || 1)) * 10000) / 100
            : 0;
        const audienceDemographics = {
            cities: [],
            countries: [],
            genderAge: [],
        };
        try {
            const demoData = await igFetch(`${IG_BASE}/${accountId}/insights?metric=audience_city,audience_country,audience_gender_age&period=lifetime`);
            for (const metric of demoData.data || []) {
                const rawValue = metric.values?.[0]?.value || {};
                const entries = Object.entries(rawValue)
                    .map(([name, value]) => ({ name, value }))
                    .sort((a, b) => b.value - a.value)
                    .slice(0, 10);
                if (metric.name === 'audience_city')
                    audienceDemographics.cities = entries;
                if (metric.name === 'audience_country')
                    audienceDemographics.countries = entries;
                if (metric.name === 'audience_gender_age')
                    audienceDemographics.genderAge = entries;
            }
        }
        catch {
            // demographics may not be available
        }
        return {
            accountInfo: {
                username: accountData.username || '',
                name: accountData.name || '',
                followersCount: accountData.followers_count || 0,
                followsCount: accountData.follows_count || 0,
                mediaCount: accountData.media_count || 0,
                profilePictureUrl: accountData.profile_picture_url || '',
            },
            followerGrowth,
            postReach,
            impressions,
            engagementRate,
            topPosts,
            audienceDemographics,
        };
    }
    catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        console.error('Instagram fetch error:', message);
        throw error;
    }
}
async function publishSingleImage(imageUrl, caption) {
    if (!isConfigured()) {
        return { success: false, error: 'Instagram publishing not configured. Set INSTAGRAM_ACCESS_TOKEN and INSTAGRAM_BUSINESS_ACCOUNT_ID.' };
    }
    try {
        const accountId = INSTAGRAM_BUSINESS_ACCOUNT_ID;
        const containerRes = await igFetch(`${IG_BASE}/${accountId}/media?image_url=${encodeURIComponent(imageUrl)}&caption=${encodeURIComponent(caption)}`);
        if (!containerRes.id) {
            return { success: false, error: 'Failed to create media container' };
        }
        const publishRes = await igFetch(`${IG_BASE}/${accountId}/media_publish?creation_id=${containerRes.id}`);
        return { success: true, postId: publishRes.id };
    }
    catch (err) {
        return { success: false, error: err.message };
    }
}
async function publishCarousel(imageUrls, caption) {
    if (!isConfigured()) {
        return { success: false, error: 'Instagram publishing not configured.' };
    }
    if (imageUrls.length < 2 || imageUrls.length > 10) {
        return { success: false, error: 'Carousel requires 2-10 images' };
    }
    try {
        const accountId = INSTAGRAM_BUSINESS_ACCOUNT_ID;
        const childIds = [];
        for (const url of imageUrls) {
            const child = await igFetch(`${IG_BASE}/${accountId}/media?image_url=${encodeURIComponent(url)}&is_carousel_item=true`);
            if (!child.id) {
                return { success: false, error: `Failed to create carousel item for ${url}` };
            }
            childIds.push(child.id);
        }
        const containerRes = await igFetch(`${IG_BASE}/${accountId}/media?media_type=CAROUSEL&caption=${encodeURIComponent(caption)}&children=${childIds.join(',')}`);
        if (!containerRes.id) {
            return { success: false, error: 'Failed to create carousel container' };
        }
        const publishRes = await igFetch(`${IG_BASE}/${accountId}/media_publish?creation_id=${containerRes.id}`);
        return { success: true, postId: publishRes.id };
    }
    catch (err) {
        return { success: false, error: err.message };
    }
}
async function publishTextPost(caption) {
    return { success: false, error: 'Instagram does not support text-only posts. An image URL is required.' };
}
exports.instagramService = { isConfigured, getConnectionMethod, getMetrics, publishSingleImage, publishCarousel, publishTextPost };
//# sourceMappingURL=instagramService.js.map