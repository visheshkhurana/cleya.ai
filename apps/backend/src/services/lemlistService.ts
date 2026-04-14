import { env } from '../config/env';

const LEMLIST_BASE = 'https://api.lemlist.com/api';

function getHeaders(): Record<string, string> {
  const apiKey = env.LEMLIST_API_KEY;
  if (!apiKey) throw new Error('LEMLIST_API_KEY is not configured');
  return {
    'Content-Type': 'application/json',
    'Authorization': `Basic ${Buffer.from(':' + apiKey).toString('base64')}`,
  };
}

async function lemlistRequest(method: string, path: string, body?: Record<string, any>): Promise<any> {
  const resp = await fetch(`${LEMLIST_BASE}${path}`, {
    method,
    headers: getHeaders(),
    body: body ? JSON.stringify(body) : undefined,
  });

  const text = await resp.text();
  let data: any;
  try { data = JSON.parse(text); } catch { data = text; }

  if (!resp.ok) {
    return { success: false, error: data?.message || `Lemlist API error ${resp.status}` };
  }
  return { success: true, data };
}

export async function addLead(params: {
  campaignId: string;
  email: string;
  firstName?: string;
  lastName?: string;
  companyName?: string;
  linkedinUrl?: string;
  icebreaker?: string;
  phone?: string;
}): Promise<any> {
  const body: Record<string, any> = {};
  if (params.firstName) body.firstName = params.firstName;
  if (params.lastName) body.lastName = params.lastName;
  if (params.companyName) body.companyName = params.companyName;
  if (params.linkedinUrl) body.linkedinUrl = params.linkedinUrl;
  if (params.icebreaker) body.icebreaker = params.icebreaker;
  if (params.phone) body.phone = params.phone;

  return lemlistRequest('POST', `/campaigns/${params.campaignId}/leads/${encodeURIComponent(params.email)}`, body);
}

export async function getLead(email: string): Promise<any> {
  return lemlistRequest('GET', `/leads/${encodeURIComponent(email)}`);
}

export async function markInterested(campaignId: string, email: string): Promise<any> {
  return lemlistRequest('PUT', `/campaigns/${campaignId}/leads/${encodeURIComponent(email)}/interested`);
}

export async function markNotInterested(campaignId: string, email: string): Promise<any> {
  return lemlistRequest('PUT', `/campaigns/${campaignId}/leads/${encodeURIComponent(email)}/notinterested`);
}

export async function unsubscribeLead(campaignId: string, email: string): Promise<any> {
  return lemlistRequest('DELETE', `/campaigns/${campaignId}/leads/${encodeURIComponent(email)}/unsubscribe`);
}

export async function pauseLead(email: string): Promise<any> {
  return lemlistRequest('POST', `/leads/${encodeURIComponent(email)}/pause`);
}

export async function resumeLead(email: string): Promise<any> {
  return lemlistRequest('POST', `/leads/${encodeURIComponent(email)}/resume`);
}
