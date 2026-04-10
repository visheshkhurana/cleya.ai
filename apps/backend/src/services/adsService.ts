/**
 * Ads Service — campaign creation, stats, and optimization for Meta, LinkedIn, and Google Ads.
 *
 * SAFETY: All campaigns are created in PAUSED state. Budget cap: ₹10,000/day.
 */

const META_ACCESS_TOKEN = process.env.META_ADS_ACCESS_TOKEN || '';
const META_AD_ACCOUNT_ID = process.env.META_AD_ACCOUNT_ID || '';
const LINKEDIN_ADS_TOKEN = process.env.LINKEDIN_ADS_ACCESS_TOKEN || '';
const LINKEDIN_AD_ACCOUNT_ID = process.env.LINKEDIN_AD_ACCOUNT_ID || '';
const GOOGLE_ADS_DEVELOPER_TOKEN = process.env.GOOGLE_ADS_DEVELOPER_TOKEN || '';
const GOOGLE_ADS_CUSTOMER_ID = process.env.GOOGLE_ADS_CUSTOMER_ID || '';

const BUDGET_CAP_INR = 10_000; // ₹10,000/day hard cap

interface CreateCampaignParams {
  platform: 'meta' | 'linkedin' | 'google';
  name: string;
  budget: number; // daily budget in INR
  targeting?: Record<string, any>;
  objective?: string;
}

interface AdsResponse {
  success: boolean;
  data?: any;
  error?: string;
}

function enforceBudgetCap(budget: number): number {
  return Math.min(budget, BUDGET_CAP_INR);
}

// --- Meta (Facebook/Instagram) Ads ---

async function createMetaCampaign(params: CreateCampaignParams): Promise<AdsResponse> {
  if (!META_ACCESS_TOKEN || !META_AD_ACCOUNT_ID) {
    return { success: false, error: 'Meta Ads not configured. Set META_ADS_ACCESS_TOKEN and META_AD_ACCOUNT_ID.' };
  }

  const dailyBudget = enforceBudgetCap(params.budget);

  try {
    const res = await fetch(
      `https://graph.facebook.com/v19.0/act_${META_AD_ACCOUNT_ID}/campaigns`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          access_token: META_ACCESS_TOKEN,
          name: params.name,
          objective: params.objective || 'OUTCOME_AWARENESS',
          status: 'PAUSED', // SAFETY: always paused
          daily_budget: dailyBudget * 100, // Meta uses paise/cents
          special_ad_categories: [],
        }),
      }
    );

    const data: any = await res.json();
    if (data.error) {
      return { success: false, error: data.error.message, data };
    }
    return { success: true, data: { ...data, status: 'PAUSED', dailyBudgetINR: dailyBudget } };
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
      `https://graph.facebook.com/v19.0/act_${META_AD_ACCOUNT_ID}/campaigns?fields=id,name,status,daily_budget,objective,insights{impressions,clicks,spend,cpc,cpm,ctr}&access_token=${META_ACCESS_TOKEN}`
    );
    const data: any = await res.json();
    if (data.error) {
      return { success: false, error: data.error.message, data };
    }
    return { success: true, data: data.data || [] };
  } catch (err: any) {
    return { success: false, error: err.message };
  }
}

// --- LinkedIn Ads ---

async function createLinkedInCampaign(params: CreateCampaignParams): Promise<AdsResponse> {
  if (!LINKEDIN_ADS_TOKEN || !LINKEDIN_AD_ACCOUNT_ID) {
    return { success: false, error: 'LinkedIn Ads not configured. Set LINKEDIN_ADS_ACCESS_TOKEN and LINKEDIN_AD_ACCOUNT_ID.' };
  }

  const dailyBudget = enforceBudgetCap(params.budget);

  try {
    const res = await fetch(
      'https://api.linkedin.com/rest/adCampaigns',
      {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${LINKEDIN_ADS_TOKEN}`,
          'Content-Type': 'application/json',
          'LinkedIn-Version': '202401',
          'X-Restli-Protocol-Version': '2.0.0',
        },
        body: JSON.stringify({
          account: `urn:li:sponsoredAccount:${LINKEDIN_AD_ACCOUNT_ID}`,
          name: params.name,
          status: 'PAUSED', // SAFETY: always paused
          type: 'SPONSORED_UPDATES',
          costType: 'CPM',
          dailyBudget: { amount: String(dailyBudget), currencyCode: 'INR' },
          objectiveType: params.objective || 'BRAND_AWARENESS',
        }),
      }
    );

    if (!res.ok) {
      const errText = await res.text();
      return { success: false, error: `LinkedIn Ads API error: ${res.status} - ${errText}` };
    }

    const campaignId = res.headers.get('x-restli-id') || '';
    return { success: true, data: { campaignId, status: 'PAUSED', dailyBudgetINR: dailyBudget } };
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
      {
        headers: {
          'Authorization': `Bearer ${LINKEDIN_ADS_TOKEN}`,
          'LinkedIn-Version': '202401',
          'X-Restli-Protocol-Version': '2.0.0',
        },
      }
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

// --- Google Ads (placeholder — requires OAuth + google-ads-api client) ---

async function createGoogleCampaign(params: CreateCampaignParams): Promise<AdsResponse> {
  if (!GOOGLE_ADS_DEVELOPER_TOKEN || !GOOGLE_ADS_CUSTOMER_ID) {
    return { success: false, error: 'Google Ads not configured. Set GOOGLE_ADS_DEVELOPER_TOKEN and GOOGLE_ADS_CUSTOMER_ID.' };
  }

  // Google Ads API requires a proper client library (google-ads-api) and OAuth flow.
  // This is a placeholder returning the intended campaign config.
  const dailyBudget = enforceBudgetCap(params.budget);
  return {
    success: true,
    data: {
      placeholder: true,
      message: 'Google Ads campaign creation requires google-ads-api client. Campaign config prepared.',
      config: {
        name: params.name,
        status: 'PAUSED',
        dailyBudgetINR: dailyBudget,
        targeting: params.targeting,
      },
    },
  };
}

async function getGoogleCampaigns(): Promise<AdsResponse> {
  if (!GOOGLE_ADS_DEVELOPER_TOKEN || !GOOGLE_ADS_CUSTOMER_ID) {
    return { success: false, error: 'Google Ads not configured.' };
  }

  return {
    success: true,
    data: {
      placeholder: true,
      message: 'Google Ads campaign listing requires google-ads-api client.',
    },
  };
}

// --- Unified interface ---

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

async function optimizeCampaigns(platform: string): Promise<AdsResponse> {
  // Fetch current campaigns and return optimization suggestions
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

export const adsService = {
  createCampaign,
  getCampaigns,
  optimizeCampaigns,
  enforceBudgetCap,
  BUDGET_CAP_INR,
};
