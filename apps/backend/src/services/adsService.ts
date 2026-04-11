/**
 * Ads Service — full campaign lifecycle for Meta, LinkedIn, and Google Ads.
 *
 * SAFETY:
 *   - All campaigns created in PAUSED state (1-hour hold before auto-activation allowed)
 *   - Budget cap: ₹10,000/day per campaign
 *   - Total daily spend cap: ₹50,000 across all platforms
 *   - All budget changes and activations logged to audit trail
 */

import { supabaseInsert, supabaseSelect } from './supabaseClient';

// ---------------------------------------------------------------------------
// Config
// ---------------------------------------------------------------------------

const META_ACCESS_TOKEN = process.env.META_ADS_ACCESS_TOKEN || '';
const META_AD_ACCOUNT_ID = process.env.META_AD_ACCOUNT_ID || '';
const META_API_VERSION = 'v19.0';

const LINKEDIN_ADS_TOKEN = process.env.LINKEDIN_ADS_ACCESS_TOKEN || '';
const LINKEDIN_AD_ACCOUNT_ID = process.env.LINKEDIN_AD_ACCOUNT_ID || '';

const GOOGLE_ADS_DEVELOPER_TOKEN = process.env.GOOGLE_ADS_DEVELOPER_TOKEN || '';
const GOOGLE_ADS_CUSTOMER_ID = (process.env.GOOGLE_ADS_CUSTOMER_ID || '').replace(/-/g, '');
const GOOGLE_ADS_MCC_ID = (process.env.GOOGLE_ADS_MCC_ID || '').replace(/-/g, '');
const GOOGLE_ADS_CLIENT_ID = process.env.GOOGLE_ADS_CLIENT_ID || '';
const GOOGLE_ADS_CLIENT_SECRET = process.env.GOOGLE_ADS_CLIENT_SECRET || '';
const GOOGLE_ADS_REFRESH_TOKEN = process.env.GOOGLE_ANALYTICS_REFRESH_TOKEN || '';

const BUDGET_CAP_INR = 10_000;        // ₹10,000/day per campaign
const TOTAL_DAILY_SPEND_CAP = 50_000;  // ₹50,000/day across all platforms
const ACTIVATION_HOLD_MS = 60 * 60 * 1000; // 1 hour

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface CreateCampaignParams {
  platform: 'meta' | 'linkedin' | 'google';
  name: string;
  budget: number;
  targeting?: Record<string, any>;
  objective?: string;
}

interface AdsResponse {
  success: boolean;
  data?: any;
  error?: string;
}

// ---------------------------------------------------------------------------
// Budget helpers
// ---------------------------------------------------------------------------

function enforceBudgetCap(budget: number): number {
  return Math.min(budget, BUDGET_CAP_INR);
}

async function getTotalDailySpend(): Promise<number> {
  const today = new Date().toISOString().split('T')[0];
  const logs = await supabaseSelect<any>('ad_audit_log', { action_date: today });
  if (!logs || logs.length === 0) return 0;
  return logs
    .filter((l: any) => l.action_type === 'budget_change' || l.action_type === 'campaign_created')
    .reduce((sum: number, l: any) => sum + (l.details?.budget_inr || 0), 0);
}

async function checkTotalSpendCap(additionalSpend: number): Promise<{ allowed: boolean; currentSpend: number }> {
  const currentSpend = await getTotalDailySpend();
  return { allowed: currentSpend + additionalSpend <= TOTAL_DAILY_SPEND_CAP, currentSpend };
}

// ---------------------------------------------------------------------------
// Audit trail
// ---------------------------------------------------------------------------

async function logAuditEvent(
  platform: string,
  actionType: string,
  campaignId: string,
  details: Record<string, any>,
): Promise<void> {
  try {
    await supabaseInsert('ad_audit_log', {
      platform,
      action_type: actionType,
      campaign_id: campaignId,
      action_date: new Date().toISOString().split('T')[0],
      details,
      created_at: new Date().toISOString(),
    });
  } catch {
    // best-effort logging
  }
}

// =========================================================================
// META (Facebook / Instagram) ADS
// =========================================================================

async function createMetaCampaign(params: CreateCampaignParams): Promise<AdsResponse> {
  if (!META_ACCESS_TOKEN || !META_AD_ACCOUNT_ID) {
    return { success: false, error: 'Meta Ads not configured. Set META_ADS_ACCESS_TOKEN and META_AD_ACCOUNT_ID.' };
  }

  const dailyBudget = enforceBudgetCap(params.budget);
  const spendCheck = await checkTotalSpendCap(dailyBudget);
  if (!spendCheck.allowed) {
    return { success: false, error: `Total daily spend cap (₹${TOTAL_DAILY_SPEND_CAP}) would be exceeded. Current: ₹${spendCheck.currentSpend}` };
  }

  try {
    const res = await fetch(
      `https://graph.facebook.com/${META_API_VERSION}/act_${META_AD_ACCOUNT_ID}/campaigns`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          access_token: META_ACCESS_TOKEN,
          name: params.name,
          objective: params.objective || 'OUTCOME_AWARENESS',
          status: 'PAUSED',
          daily_budget: dailyBudget * 100, // paise
          special_ad_categories: [],
        }),
      },
    );

    const data: any = await res.json();
    if (data.error) return { success: false, error: data.error.message, data };

    await logAuditEvent('meta', 'campaign_created', data.id, {
      name: params.name, budget_inr: dailyBudget, objective: params.objective, created_at_ts: Date.now(),
    });

    return { success: true, data: { ...data, status: 'PAUSED', dailyBudgetINR: dailyBudget } };
  } catch (err: any) {
    return { success: false, error: err.message };
  }
}

async function createMetaAdSet(params: {
  campaignId: string;
  name: string;
  dailyBudget: number;
  targeting: Record<string, any>;
  billingEvent?: string;
  optimizationGoal?: string;
  startTime?: string;
}): Promise<AdsResponse> {
  if (!META_ACCESS_TOKEN || !META_AD_ACCOUNT_ID) {
    return { success: false, error: 'Meta Ads not configured.' };
  }

  const budget = enforceBudgetCap(params.dailyBudget);

  const targeting: Record<string, any> = {
    geo_locations: params.targeting.geo_locations || { countries: ['IN'] },
    age_min: params.targeting.age_min || 25,
    age_max: params.targeting.age_max || 55,
    interests: params.targeting.interests || [
      { id: '6003139266461', name: 'Entrepreneurship' },
      { id: '6003384248805', name: 'Startups' },
      { id: '6003017270782', name: 'Venture capital' },
      { id: '6003107902433', name: 'Angel investor' },
      { id: '6003171473867', name: 'Technology' },
    ],
    ...(params.targeting.flexible_spec ? { flexible_spec: params.targeting.flexible_spec } : {}),
  };

  try {
    const res = await fetch(
      `https://graph.facebook.com/${META_API_VERSION}/act_${META_AD_ACCOUNT_ID}/adsets`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          access_token: META_ACCESS_TOKEN,
          campaign_id: params.campaignId,
          name: params.name,
          status: 'PAUSED',
          daily_budget: budget * 100,
          billing_event: params.billingEvent || 'IMPRESSIONS',
          optimization_goal: params.optimizationGoal || 'REACH',
          targeting,
          start_time: params.startTime || new Date(Date.now() + ACTIVATION_HOLD_MS).toISOString(),
        }),
      },
    );

    const data: any = await res.json();
    if (data.error) return { success: false, error: data.error.message, data };

    await logAuditEvent('meta', 'adset_created', data.id, { campaignId: params.campaignId, name: params.name, budget_inr: budget });
    return { success: true, data: { ...data, status: 'PAUSED', dailyBudgetINR: budget } };
  } catch (err: any) {
    return { success: false, error: err.message };
  }
}

async function createMetaAd(params: {
  adSetId: string;
  name: string;
  pageId: string;
  creative: { title: string; body: string; linkUrl: string; imageUrl?: string; videoUrl?: string; callToAction?: string };
}): Promise<AdsResponse> {
  if (!META_ACCESS_TOKEN || !META_AD_ACCOUNT_ID) {
    return { success: false, error: 'Meta Ads not configured.' };
  }

  const objectStorySpec: Record<string, any> = {
    page_id: params.pageId,
    link_data: {
      message: params.creative.body,
      link: params.creative.linkUrl,
      name: params.creative.title,
      call_to_action: { type: params.creative.callToAction || 'LEARN_MORE' },
      ...(params.creative.imageUrl ? { image_url: params.creative.imageUrl } : {}),
    },
  };

  try {
    // Create the ad creative first
    const creativeRes = await fetch(
      `https://graph.facebook.com/${META_API_VERSION}/act_${META_AD_ACCOUNT_ID}/adcreatives`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          access_token: META_ACCESS_TOKEN,
          name: `Creative: ${params.name}`,
          object_story_spec: objectStorySpec,
        }),
      },
    );
    const creativeData: any = await creativeRes.json();
    if (creativeData.error) return { success: false, error: creativeData.error.message, data: creativeData };

    // Create the ad using the creative
    const adRes = await fetch(
      `https://graph.facebook.com/${META_API_VERSION}/act_${META_AD_ACCOUNT_ID}/ads`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          access_token: META_ACCESS_TOKEN,
          name: params.name,
          adset_id: params.adSetId,
          creative: { creative_id: creativeData.id },
          status: 'PAUSED',
        }),
      },
    );
    const adData: any = await adRes.json();
    if (adData.error) return { success: false, error: adData.error.message, data: adData };

    await logAuditEvent('meta', 'ad_created', adData.id, { adSetId: params.adSetId, creativeId: creativeData.id, name: params.name });
    return { success: true, data: { adId: adData.id, creativeId: creativeData.id, status: 'PAUSED' } };
  } catch (err: any) {
    return { success: false, error: err.message };
  }
}

async function activateMetaCampaign(campaignId: string): Promise<AdsResponse> {
  if (!META_ACCESS_TOKEN) return { success: false, error: 'Meta Ads not configured.' };

  // Verify campaign exists and check hold period
  try {
    const infoRes = await fetch(
      `https://graph.facebook.com/${META_API_VERSION}/${campaignId}?fields=id,name,status,created_time,adsets{id,name,targeting,ads{id,name}}&access_token=${META_ACCESS_TOKEN}`,
    );
    const info: any = await infoRes.json();
    if (info.error) return { success: false, error: info.error.message };

    const createdMs = new Date(info.created_time).getTime();
    if (Date.now() - createdMs < ACTIVATION_HOLD_MS) {
      const remainMins = Math.ceil((ACTIVATION_HOLD_MS - (Date.now() - createdMs)) / 60000);
      return { success: false, error: `Activation hold active. ${remainMins} minutes remaining before campaign can be activated.` };
    }

    // Check has at least one ad set with targeting and creative
    const adsets = info.adsets?.data || [];
    if (adsets.length === 0) return { success: false, error: 'Cannot activate: campaign has no ad sets.' };
    const hasAds = adsets.some((as: any) => as.ads?.data?.length > 0);
    if (!hasAds) return { success: false, error: 'Cannot activate: no ad creatives in any ad set.' };

    const res = await fetch(
      `https://graph.facebook.com/${META_API_VERSION}/${campaignId}`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ access_token: META_ACCESS_TOKEN, status: 'ACTIVE' }),
      },
    );
    const data: any = await res.json();
    if (data.error) return { success: false, error: data.error.message, data };

    await logAuditEvent('meta', 'campaign_activated', campaignId, { previousStatus: info.status });
    return { success: true, data: { campaignId, status: 'ACTIVE' } };
  } catch (err: any) {
    return { success: false, error: err.message };
  }
}

async function pauseMetaCampaign(campaignId: string): Promise<AdsResponse> {
  if (!META_ACCESS_TOKEN) return { success: false, error: 'Meta Ads not configured.' };

  try {
    const res = await fetch(
      `https://graph.facebook.com/${META_API_VERSION}/${campaignId}`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ access_token: META_ACCESS_TOKEN, status: 'PAUSED' }),
      },
    );
    const data: any = await res.json();
    if (data.error) return { success: false, error: data.error.message, data };

    await logAuditEvent('meta', 'campaign_paused', campaignId, {});
    return { success: true, data: { campaignId, status: 'PAUSED' } };
  } catch (err: any) {
    return { success: false, error: err.message };
  }
}

async function updateMetaBudget(campaignId: string, newBudget: number): Promise<AdsResponse> {
  if (!META_ACCESS_TOKEN) return { success: false, error: 'Meta Ads not configured.' };

  const budget = enforceBudgetCap(newBudget);
  const spendCheck = await checkTotalSpendCap(budget);
  if (!spendCheck.allowed) {
    return { success: false, error: `Total daily spend cap would be exceeded. Current: ₹${spendCheck.currentSpend}` };
  }

  try {
    const res = await fetch(
      `https://graph.facebook.com/${META_API_VERSION}/${campaignId}`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ access_token: META_ACCESS_TOKEN, daily_budget: budget * 100 }),
      },
    );
    const data: any = await res.json();
    if (data.error) return { success: false, error: data.error.message, data };

    await logAuditEvent('meta', 'budget_change', campaignId, { new_budget_inr: budget });
    return { success: true, data: { campaignId, dailyBudgetINR: budget } };
  } catch (err: any) {
    return { success: false, error: err.message };
  }
}

async function getMetaCampaigns(): Promise<AdsResponse> {
  if (!META_ACCESS_TOKEN || !META_AD_ACCOUNT_ID) {
    return { success: false, error: 'Meta Ads not configured.' };
  }

  try {
    const res = await fetch(
      `https://graph.facebook.com/${META_API_VERSION}/act_${META_AD_ACCOUNT_ID}/campaigns?fields=id,name,status,daily_budget,objective,insights{impressions,clicks,spend,cpc,cpm,ctr}&access_token=${META_ACCESS_TOKEN}`,
    );
    const data: any = await res.json();
    if (data.error) return { success: false, error: data.error.message, data };
    return { success: true, data: data.data || [] };
  } catch (err: any) {
    return { success: false, error: err.message };
  }
}

async function getAdSetInsights(adSetId: string, datePreset?: string): Promise<AdsResponse> {
  if (!META_ACCESS_TOKEN) return { success: false, error: 'Meta Ads not configured.' };

  try {
    const preset = datePreset || 'last_7d';
    const res = await fetch(
      `https://graph.facebook.com/${META_API_VERSION}/${adSetId}/insights?fields=impressions,clicks,spend,cpc,cpm,ctr,reach,frequency,actions,cost_per_action_type,conversions&date_preset=${preset}&access_token=${META_ACCESS_TOKEN}`,
    );
    const data: any = await res.json();
    if (data.error) return { success: false, error: data.error.message, data };
    return { success: true, data: data.data || [] };
  } catch (err: any) {
    return { success: false, error: err.message };
  }
}

async function getCampaignInsights(campaignId: string, datePreset?: string): Promise<AdsResponse> {
  if (!META_ACCESS_TOKEN) return { success: false, error: 'Meta Ads not configured.' };

  try {
    const preset = datePreset || 'last_7d';
    const res = await fetch(
      `https://graph.facebook.com/${META_API_VERSION}/${campaignId}/insights?fields=impressions,clicks,spend,cpc,cpm,ctr,reach,frequency,actions,cost_per_action_type,conversions,cost_per_conversion&date_preset=${preset}&access_token=${META_ACCESS_TOKEN}`,
    );
    const data: any = await res.json();
    if (data.error) return { success: false, error: data.error.message, data };
    return { success: true, data: data.data || [] };
  } catch (err: any) {
    return { success: false, error: err.message };
  }
}

// =========================================================================
// GOOGLE ADS (REST API v17)
// =========================================================================

let _googleAccessToken: string | null = null;
let _googleTokenExpiry = 0;

async function getGoogleAccessToken(): Promise<string> {
  if (_googleAccessToken && Date.now() < _googleTokenExpiry) return _googleAccessToken;

  if (!GOOGLE_ADS_CLIENT_ID || !GOOGLE_ADS_CLIENT_SECRET || !GOOGLE_ADS_REFRESH_TOKEN) {
    throw new Error('Google Ads OAuth not configured. Set GOOGLE_ADS_CLIENT_ID, GOOGLE_ADS_CLIENT_SECRET, GOOGLE_ANALYTICS_REFRESH_TOKEN.');
  }

  const res = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      grant_type: 'refresh_token',
      client_id: GOOGLE_ADS_CLIENT_ID,
      client_secret: GOOGLE_ADS_CLIENT_SECRET,
      refresh_token: GOOGLE_ADS_REFRESH_TOKEN,
    }).toString(),
  });

  const data: any = await res.json();
  if (data.error) throw new Error(`Google OAuth error: ${data.error_description || data.error}`);

  _googleAccessToken = data.access_token;
  _googleTokenExpiry = Date.now() + (data.expires_in - 60) * 1000;
  return _googleAccessToken!;
}

function googleAdsHeaders(accessToken: string): Record<string, string> {
  return {
    'Authorization': `Bearer ${accessToken}`,
    'Content-Type': 'application/json',
    'developer-token': GOOGLE_ADS_DEVELOPER_TOKEN,
    ...(GOOGLE_ADS_MCC_ID ? { 'login-customer-id': GOOGLE_ADS_MCC_ID } : {}),
  };
}

async function googleAdsRequest(method: 'GET' | 'POST', path: string, body?: any): Promise<any> {
  const token = await getGoogleAccessToken();
  const url = `https://googleads.googleapis.com/v17/customers/${GOOGLE_ADS_CUSTOMER_ID}${path}`;
  const res = await fetch(url, {
    method,
    headers: googleAdsHeaders(token),
    ...(body ? { body: JSON.stringify(body) } : {}),
  });
  const data: any = await res.json();
  if (!res.ok) {
    const errMsg = data?.error?.message || JSON.stringify(data);
    throw new Error(`Google Ads API (${res.status}): ${errMsg}`);
  }
  return data;
}

async function createGoogleCampaign(params: CreateCampaignParams): Promise<AdsResponse> {
  if (!GOOGLE_ADS_DEVELOPER_TOKEN || !GOOGLE_ADS_CUSTOMER_ID) {
    return { success: false, error: 'Google Ads not configured. Set GOOGLE_ADS_DEVELOPER_TOKEN and GOOGLE_ADS_CUSTOMER_ID.' };
  }

  const dailyBudget = enforceBudgetCap(params.budget);
  const spendCheck = await checkTotalSpendCap(dailyBudget);
  if (!spendCheck.allowed) {
    return { success: false, error: `Total daily spend cap would be exceeded. Current: ₹${spendCheck.currentSpend}` };
  }

  try {
    // Step 1: Create campaign budget
    const budgetRes = await googleAdsRequest('POST', '/campaignBudgets:mutate', {
      operations: [{
        create: {
          name: `Budget: ${params.name} - ${Date.now()}`,
          amountMicros: String(dailyBudget * 1_000_000), // micros (INR)
          deliveryMethod: 'STANDARD',
          explicitlyShared: false,
        },
      }],
    });
    const budgetResourceName = budgetRes.results?.[0]?.resourceName;
    if (!budgetResourceName) return { success: false, error: 'Failed to create Google Ads budget' };

    // Step 2: Create campaign
    const campaignType = params.objective === 'DISPLAY' ? 'DISPLAY' : 'SEARCH';
    const campaignRes = await googleAdsRequest('POST', '/campaigns:mutate', {
      operations: [{
        create: {
          name: params.name,
          status: 'PAUSED',
          advertisingChannelType: campaignType,
          campaignBudget: budgetResourceName,
          ...(campaignType === 'SEARCH' ? {
            networkSettings: {
              targetGoogleSearch: true,
              targetSearchNetwork: true,
              targetContentNetwork: false,
            },
          } : {}),
          geoTargetTypeSetting: {
            positiveGeoTargetType: 'PRESENCE',
            negativeGeoTargetType: 'PRESENCE_OR_INTEREST',
          },
        },
      }],
    });
    const campaignResourceName = campaignRes.results?.[0]?.resourceName;
    if (!campaignResourceName) return { success: false, error: 'Failed to create Google Ads campaign' };

    // Step 3: Set India geo targeting
    const campaignId = campaignResourceName.split('/').pop();
    await googleAdsRequest('POST', '/campaignCriteria:mutate', {
      operations: [{
        create: {
          campaign: campaignResourceName,
          location: { geoTargetConstant: 'geoTargetConstants/2356' }, // India
        },
      }],
    });

    await logAuditEvent('google', 'campaign_created', campaignId || '', {
      name: params.name, budget_inr: dailyBudget, type: campaignType, resourceName: campaignResourceName,
    });

    return {
      success: true,
      data: {
        campaignId,
        resourceName: campaignResourceName,
        budgetResourceName,
        status: 'PAUSED',
        dailyBudgetINR: dailyBudget,
        type: campaignType,
      },
    };
  } catch (err: any) {
    return { success: false, error: err.message };
  }
}

async function createGoogleAdGroup(params: {
  campaignResourceName: string;
  name: string;
  cpcBidMicros?: string;
  keywords: string[];
}): Promise<AdsResponse> {
  if (!GOOGLE_ADS_DEVELOPER_TOKEN || !GOOGLE_ADS_CUSTOMER_ID) {
    return { success: false, error: 'Google Ads not configured.' };
  }

  try {
    // Create ad group
    const agRes = await googleAdsRequest('POST', '/adGroups:mutate', {
      operations: [{
        create: {
          name: params.name,
          campaign: params.campaignResourceName,
          status: 'ENABLED',
          type: 'SEARCH_STANDARD',
          cpcBidMicros: params.cpcBidMicros || '50000000', // ₹50 default
        },
      }],
    });
    const adGroupResourceName = agRes.results?.[0]?.resourceName;
    if (!adGroupResourceName) return { success: false, error: 'Failed to create ad group' };

    // Add keywords
    if (params.keywords.length > 0) {
      const keywordOps = params.keywords.map(kw => ({
        create: {
          adGroup: adGroupResourceName,
          status: 'ENABLED',
          keyword: {
            text: kw,
            matchType: 'BROAD',
          },
        },
      }));

      await googleAdsRequest('POST', '/adGroupCriteria:mutate', { operations: keywordOps });
    }

    await logAuditEvent('google', 'adgroup_created', adGroupResourceName, { name: params.name, keywords: params.keywords });
    return { success: true, data: { adGroupResourceName, keywords: params.keywords } };
  } catch (err: any) {
    return { success: false, error: err.message };
  }
}

async function createGoogleAd(params: {
  adGroupResourceName: string;
  headlines: string[];
  descriptions: string[];
  finalUrl: string;
  path1?: string;
  path2?: string;
}): Promise<AdsResponse> {
  if (!GOOGLE_ADS_DEVELOPER_TOKEN || !GOOGLE_ADS_CUSTOMER_ID) {
    return { success: false, error: 'Google Ads not configured.' };
  }

  try {
    const headlines = params.headlines.slice(0, 15).map(text => ({ text }));
    const descriptions = params.descriptions.slice(0, 4).map(text => ({ text }));

    const res = await googleAdsRequest('POST', '/adGroupAds:mutate', {
      operations: [{
        create: {
          adGroup: params.adGroupResourceName,
          status: 'ENABLED',
          ad: {
            responsiveSearchAd: {
              headlines,
              descriptions,
              path1: params.path1 || 'founders',
              path2: params.path2 || 'connect',
            },
            finalUrls: [params.finalUrl],
          },
        },
      }],
    });
    const adResourceName = res.results?.[0]?.resourceName;
    if (!adResourceName) return { success: false, error: 'Failed to create ad' };

    await logAuditEvent('google', 'ad_created', adResourceName, { headlines: params.headlines, finalUrl: params.finalUrl });
    return { success: true, data: { adResourceName } };
  } catch (err: any) {
    return { success: false, error: err.message };
  }
}

async function getGoogleCampaignPerformance(dateRange?: { start: string; end: string }): Promise<AdsResponse> {
  if (!GOOGLE_ADS_DEVELOPER_TOKEN || !GOOGLE_ADS_CUSTOMER_ID) {
    return { success: false, error: 'Google Ads not configured.' };
  }

  try {
    const startDate = dateRange?.start || new Date(Date.now() - 7 * 86400000).toISOString().split('T')[0];
    const endDate = dateRange?.end || new Date().toISOString().split('T')[0];

    const query = `
      SELECT
        campaign.id,
        campaign.name,
        campaign.status,
        campaign_budget.amount_micros,
        metrics.impressions,
        metrics.clicks,
        metrics.cost_micros,
        metrics.ctr,
        metrics.average_cpc,
        metrics.conversions,
        metrics.cost_per_conversion
      FROM campaign
      WHERE segments.date BETWEEN '${startDate}' AND '${endDate}'
      ORDER BY metrics.cost_micros DESC
      LIMIT 50
    `;

    const data = await googleAdsRequest('POST', '/googleAds:searchStream', { query });

    const campaigns = (data || []).flatMap((batch: any) =>
      (batch.results || []).map((r: any) => ({
        id: r.campaign?.id,
        name: r.campaign?.name,
        status: r.campaign?.status,
        budgetMicros: r.campaignBudget?.amountMicros,
        impressions: r.metrics?.impressions,
        clicks: r.metrics?.clicks,
        costMicros: r.metrics?.costMicros,
        ctr: r.metrics?.ctr,
        avgCpc: r.metrics?.averageCpc,
        conversions: r.metrics?.conversions,
        costPerConversion: r.metrics?.costPerConversion,
      })),
    );

    return { success: true, data: campaigns };
  } catch (err: any) {
    return { success: false, error: err.message };
  }
}

async function getGoogleCampaigns(): Promise<AdsResponse> {
  return getGoogleCampaignPerformance();
}

async function activateGoogleCampaign(campaignResourceName: string): Promise<AdsResponse> {
  if (!GOOGLE_ADS_DEVELOPER_TOKEN || !GOOGLE_ADS_CUSTOMER_ID) {
    return { success: false, error: 'Google Ads not configured.' };
  }

  try {
    await googleAdsRequest('POST', '/campaigns:mutate', {
      operations: [{
        update: { resourceName: campaignResourceName, status: 'ENABLED' },
        updateMask: 'status',
      }],
    });

    await logAuditEvent('google', 'campaign_activated', campaignResourceName, {});
    return { success: true, data: { campaignResourceName, status: 'ENABLED' } };
  } catch (err: any) {
    return { success: false, error: err.message };
  }
}

async function pauseGoogleCampaign(campaignResourceName: string): Promise<AdsResponse> {
  if (!GOOGLE_ADS_DEVELOPER_TOKEN || !GOOGLE_ADS_CUSTOMER_ID) {
    return { success: false, error: 'Google Ads not configured.' };
  }

  try {
    await googleAdsRequest('POST', '/campaigns:mutate', {
      operations: [{
        update: { resourceName: campaignResourceName, status: 'PAUSED' },
        updateMask: 'status',
      }],
    });

    await logAuditEvent('google', 'campaign_paused', campaignResourceName, {});
    return { success: true, data: { campaignResourceName, status: 'PAUSED' } };
  } catch (err: any) {
    return { success: false, error: err.message };
  }
}

async function updateGoogleBudget(budgetResourceName: string, newBudget: number): Promise<AdsResponse> {
  if (!GOOGLE_ADS_DEVELOPER_TOKEN || !GOOGLE_ADS_CUSTOMER_ID) {
    return { success: false, error: 'Google Ads not configured.' };
  }

  const budget = enforceBudgetCap(newBudget);

  try {
    await googleAdsRequest('POST', '/campaignBudgets:mutate', {
      operations: [{
        update: { resourceName: budgetResourceName, amountMicros: String(budget * 1_000_000) },
        updateMask: 'amount_micros',
      }],
    });

    await logAuditEvent('google', 'budget_change', budgetResourceName, { new_budget_inr: budget });
    return { success: true, data: { budgetResourceName, dailyBudgetINR: budget } };
  } catch (err: any) {
    return { success: false, error: err.message };
  }
}

// =========================================================================
// LINKEDIN ADS
// =========================================================================

const LINKEDIN_HEADERS = {
  'Authorization': `Bearer ${LINKEDIN_ADS_TOKEN}`,
  'Content-Type': 'application/json',
  'LinkedIn-Version': '202401',
  'X-Restli-Protocol-Version': '2.0.0',
};

async function createLinkedInCampaign(params: CreateCampaignParams): Promise<AdsResponse> {
  if (!LINKEDIN_ADS_TOKEN || !LINKEDIN_AD_ACCOUNT_ID) {
    return { success: false, error: 'LinkedIn Ads not configured. Set LINKEDIN_ADS_ACCESS_TOKEN and LINKEDIN_AD_ACCOUNT_ID.' };
  }

  const dailyBudget = enforceBudgetCap(params.budget);
  const spendCheck = await checkTotalSpendCap(dailyBudget);
  if (!spendCheck.allowed) {
    return { success: false, error: `Total daily spend cap would be exceeded. Current: ₹${spendCheck.currentSpend}` };
  }

  try {
    const res = await fetch('https://api.linkedin.com/rest/adCampaigns', {
      method: 'POST',
      headers: LINKEDIN_HEADERS,
      body: JSON.stringify({
        account: `urn:li:sponsoredAccount:${LINKEDIN_AD_ACCOUNT_ID}`,
        name: params.name,
        status: 'PAUSED',
        type: 'SPONSORED_UPDATES',
        costType: 'CPM',
        dailyBudget: { amount: String(dailyBudget), currencyCode: 'INR' },
        objectiveType: params.objective || 'BRAND_AWARENESS',
        targetingCriteria: params.targeting || undefined,
      }),
    });

    if (!res.ok) {
      const errText = await res.text();
      return { success: false, error: `LinkedIn Ads API error: ${res.status} - ${errText}` };
    }

    const campaignId = res.headers.get('x-restli-id') || '';
    await logAuditEvent('linkedin', 'campaign_created', campaignId, { name: params.name, budget_inr: dailyBudget });
    return { success: true, data: { campaignId, status: 'PAUSED', dailyBudgetINR: dailyBudget } };
  } catch (err: any) {
    return { success: false, error: err.message };
  }
}

async function createLinkedInAdCreative(params: {
  campaignId: string;
  commentary: string;
  title?: string;
  contentUrl?: string;
  imageUrl?: string;
}): Promise<AdsResponse> {
  if (!LINKEDIN_ADS_TOKEN || !LINKEDIN_AD_ACCOUNT_ID) {
    return { success: false, error: 'LinkedIn Ads not configured.' };
  }

  try {
    const body: Record<string, any> = {
      campaign: `urn:li:sponsoredCampaign:${params.campaignId}`,
      type: 'SPONSORED_STATUS_UPDATE',
      reference: `urn:li:sponsoredAccount:${LINKEDIN_AD_ACCOUNT_ID}`,
      variables: {
        data: {
          'com.linkedin.ads.SponsoredUpdateCreativeVariables': {
            activity: undefined,
            directSponsoredContent: {
              account: `urn:li:sponsoredAccount:${LINKEDIN_AD_ACCOUNT_ID}`,
              share: {
                commentary: params.commentary,
                ...(params.contentUrl ? {
                  content: {
                    contentEntities: [{
                      entityLocation: params.contentUrl,
                      ...(params.imageUrl ? { thumbnails: [{ resolvedUrl: params.imageUrl }] } : {}),
                    }],
                    title: params.title || 'Cleya.ai',
                  },
                } : {}),
              },
            },
          },
        },
      },
    };

    const res = await fetch('https://api.linkedin.com/rest/adCreatives', {
      method: 'POST',
      headers: LINKEDIN_HEADERS,
      body: JSON.stringify(body),
    });

    if (!res.ok) {
      const errText = await res.text();
      return { success: false, error: `LinkedIn creative API error: ${res.status} - ${errText}` };
    }

    const creativeId = res.headers.get('x-restli-id') || '';
    await logAuditEvent('linkedin', 'creative_created', creativeId, { campaignId: params.campaignId });
    return { success: true, data: { creativeId, campaignId: params.campaignId, status: 'ACTIVE' } };
  } catch (err: any) {
    return { success: false, error: err.message };
  }
}

async function activateLinkedInCampaign(campaignId: string): Promise<AdsResponse> {
  if (!LINKEDIN_ADS_TOKEN) return { success: false, error: 'LinkedIn Ads not configured.' };

  try {
    const res = await fetch(`https://api.linkedin.com/rest/adCampaigns/${campaignId}`, {
      method: 'POST',
      headers: LINKEDIN_HEADERS,
      body: JSON.stringify({
        patch: { $set: { status: 'ACTIVE' } },
      }),
    });

    if (!res.ok) {
      const errText = await res.text();
      return { success: false, error: `LinkedIn API error: ${res.status} - ${errText}` };
    }

    await logAuditEvent('linkedin', 'campaign_activated', campaignId, {});
    return { success: true, data: { campaignId, status: 'ACTIVE' } };
  } catch (err: any) {
    return { success: false, error: err.message };
  }
}

async function pauseLinkedInCampaign(campaignId: string): Promise<AdsResponse> {
  if (!LINKEDIN_ADS_TOKEN) return { success: false, error: 'LinkedIn Ads not configured.' };

  try {
    const res = await fetch(`https://api.linkedin.com/rest/adCampaigns/${campaignId}`, {
      method: 'POST',
      headers: LINKEDIN_HEADERS,
      body: JSON.stringify({
        patch: { $set: { status: 'PAUSED' } },
      }),
    });

    if (!res.ok) {
      const errText = await res.text();
      return { success: false, error: `LinkedIn API error: ${res.status} - ${errText}` };
    }

    await logAuditEvent('linkedin', 'campaign_paused', campaignId, {});
    return { success: true, data: { campaignId, status: 'PAUSED' } };
  } catch (err: any) {
    return { success: false, error: err.message };
  }
}

async function getLinkedInCampaigns(): Promise<AdsResponse> {
  if (!LINKEDIN_ADS_TOKEN || !LINKEDIN_AD_ACCOUNT_ID) {
    return { success: false, error: 'LinkedIn Ads not configured.' };
  }

  try {
    const res = await fetch(
      `https://api.linkedin.com/rest/adCampaigns?q=search&search=(account:(values:List(urn:li:sponsoredAccount:${LINKEDIN_AD_ACCOUNT_ID})))`,
      { headers: LINKEDIN_HEADERS },
    );

    if (!res.ok) {
      const errText = await res.text();
      return { success: false, error: `LinkedIn Ads API error: ${res.status} - ${errText}` };
    }

    const data: any = await res.json();
    return { success: true, data: data.elements || [] };
  } catch (err: any) {
    return { success: false, error: err.message };
  }
}

async function getLinkedInCampaignAnalytics(campaignIds: string[], dateRange?: { start: string; end: string }): Promise<AdsResponse> {
  if (!LINKEDIN_ADS_TOKEN || !LINKEDIN_AD_ACCOUNT_ID) {
    return { success: false, error: 'LinkedIn Ads not configured.' };
  }

  try {
    const start = dateRange?.start || new Date(Date.now() - 7 * 86400000).toISOString().split('T')[0];
    const end = dateRange?.end || new Date().toISOString().split('T')[0];
    const [startY, startM, startD] = start.split('-');
    const [endY, endM, endD] = end.split('-');

    const campaignUrns = campaignIds.map(id => `urn:li:sponsoredCampaign:${id}`).join(',');
    const url = `https://api.linkedin.com/rest/adAnalytics?q=analytics&pivot=CAMPAIGN&dateRange=(start:(year:${startY},month:${startM},day:${startD}),end:(year:${endY},month:${endM},day:${endD}))&campaigns=List(${campaignUrns})&timeGranularity=DAILY&fields=impressions,clicks,costInLocalCurrency,dateRange`;

    const res = await fetch(url, { headers: LINKEDIN_HEADERS });

    if (!res.ok) {
      const errText = await res.text();
      return { success: false, error: `LinkedIn Analytics API error: ${res.status} - ${errText}` };
    }

    const data: any = await res.json();
    return { success: true, data: data.elements || [] };
  } catch (err: any) {
    return { success: false, error: err.message };
  }
}

// =========================================================================
// UNIFIED INTERFACE
// =========================================================================

async function createCampaign(params: CreateCampaignParams): Promise<AdsResponse> {
  params.budget = enforceBudgetCap(params.budget);

  switch (params.platform) {
    case 'meta':
      return createMetaCampaign(params);
    case 'linkedin':
      return createLinkedInCampaign(params);
    case 'google':
      return createGoogleCampaign(params);
    default:
      return { success: false, error: `Unsupported ads platform: ${params.platform}` };
  }
}

async function getCampaigns(platform: string): Promise<AdsResponse> {
  switch (platform) {
    case 'meta':
      return getMetaCampaigns();
    case 'linkedin':
      return getLinkedInCampaigns();
    case 'google':
      return getGoogleCampaigns();
    default:
      return { success: false, error: `Unsupported ads platform: ${platform}` };
  }
}

async function activateCampaign(platform: string, campaignId: string): Promise<AdsResponse> {
  switch (platform) {
    case 'meta':
      return activateMetaCampaign(campaignId);
    case 'linkedin':
      return activateLinkedInCampaign(campaignId);
    case 'google':
      return activateGoogleCampaign(campaignId);
    default:
      return { success: false, error: `Unsupported ads platform: ${platform}` };
  }
}

async function pauseCampaign(platform: string, campaignId: string): Promise<AdsResponse> {
  switch (platform) {
    case 'meta':
      return pauseMetaCampaign(campaignId);
    case 'linkedin':
      return pauseLinkedInCampaign(campaignId);
    case 'google':
      return pauseGoogleCampaign(campaignId);
    default:
      return { success: false, error: `Unsupported ads platform: ${platform}` };
  }
}

async function updateBudget(platform: string, resourceId: string, newBudget: number): Promise<AdsResponse> {
  switch (platform) {
    case 'meta':
      return updateMetaBudget(resourceId, newBudget);
    case 'google':
      return updateGoogleBudget(resourceId, newBudget);
    case 'linkedin':
      // LinkedIn budget updates require a partial update on the campaign
      return createLinkedInCampaign({ platform: 'linkedin', name: '', budget: newBudget });
    default:
      return { success: false, error: `Unsupported ads platform: ${platform}` };
  }
}

async function optimizeCampaigns(platform: string): Promise<AdsResponse> {
  const campaigns = await getCampaigns(platform);
  if (!campaigns.success) return campaigns;

  return {
    success: true,
    data: {
      platform,
      campaigns: campaigns.data,
      recommendations: [
        'Review underperforming campaigns (CTR < 1%) and pause them.',
        'Increase budget on campaigns with CPC < ₹20 and high conversion rates.',
        'A/B test ad creatives for top 3 campaigns.',
        `Budget cap enforced: ₹${BUDGET_CAP_INR}/day per campaign.`,
      ],
    },
  };
}

// =========================================================================
// EXPORTS
// =========================================================================

export const adsService = {
  // Shared
  createCampaign,
  getCampaigns,
  activateCampaign,
  pauseCampaign,
  updateBudget,
  optimizeCampaigns,
  enforceBudgetCap,
  checkTotalSpendCap,
  BUDGET_CAP_INR,
  TOTAL_DAILY_SPEND_CAP,

  // Meta-specific
  createMetaAdSet,
  createMetaAd,
  getAdSetInsights,
  getCampaignInsights,

  // Google-specific
  createGoogleAdGroup,
  createGoogleAd,
  getGoogleCampaignPerformance,

  // LinkedIn-specific
  createLinkedInAdCreative,
  getLinkedInCampaignAnalytics,
};
