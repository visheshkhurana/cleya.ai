"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.addLead = addLead;
exports.getLead = getLead;
exports.markInterested = markInterested;
exports.markNotInterested = markNotInterested;
exports.unsubscribeLead = unsubscribeLead;
exports.pauseLead = pauseLead;
exports.resumeLead = resumeLead;
const env_1 = require("../config/env");
const LEMLIST_BASE = 'https://api.lemlist.com/api';
function getHeaders() {
    const apiKey = env_1.env.LEMLIST_API_KEY;
    if (!apiKey)
        throw new Error('LEMLIST_API_KEY is not configured');
    return {
        'Content-Type': 'application/json',
        'Authorization': `Basic ${Buffer.from(':' + apiKey).toString('base64')}`,
    };
}
async function lemlistRequest(method, path, body) {
    const resp = await fetch(`${LEMLIST_BASE}${path}`, {
        method,
        headers: getHeaders(),
        body: body ? JSON.stringify(body) : undefined,
    });
    const text = await resp.text();
    let data;
    try {
        data = JSON.parse(text);
    }
    catch {
        data = text;
    }
    if (!resp.ok) {
        return { success: false, error: data?.message || `Lemlist API error ${resp.status}` };
    }
    return { success: true, data };
}
async function addLead(params) {
    const body = {};
    if (params.firstName)
        body.firstName = params.firstName;
    if (params.lastName)
        body.lastName = params.lastName;
    if (params.companyName)
        body.companyName = params.companyName;
    if (params.linkedinUrl)
        body.linkedinUrl = params.linkedinUrl;
    if (params.icebreaker)
        body.icebreaker = params.icebreaker;
    if (params.phone)
        body.phone = params.phone;
    return lemlistRequest('POST', `/campaigns/${params.campaignId}/leads/${encodeURIComponent(params.email)}`, body);
}
async function getLead(email) {
    return lemlistRequest('GET', `/leads/${encodeURIComponent(email)}`);
}
async function markInterested(campaignId, email) {
    return lemlistRequest('PUT', `/campaigns/${campaignId}/leads/${encodeURIComponent(email)}/interested`);
}
async function markNotInterested(campaignId, email) {
    return lemlistRequest('PUT', `/campaigns/${campaignId}/leads/${encodeURIComponent(email)}/notinterested`);
}
async function unsubscribeLead(campaignId, email) {
    return lemlistRequest('DELETE', `/campaigns/${campaignId}/leads/${encodeURIComponent(email)}/unsubscribe`);
}
async function pauseLead(email) {
    return lemlistRequest('POST', `/leads/${encodeURIComponent(email)}/pause`);
}
async function resumeLead(email) {
    return lemlistRequest('POST', `/leads/${encodeURIComponent(email)}/resume`);
}
//# sourceMappingURL=lemlistService.js.map