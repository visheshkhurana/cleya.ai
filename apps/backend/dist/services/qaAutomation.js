"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
Object.defineProperty(exports, "__esModule", { value: true });
exports.runDailyQARoutine = runDailyQARoutine;
exports.runSinglePageTest = runSinglePageTest;
exports.runSingleAPITest = runSingleAPITest;
exports.runSingleAgentTest = runSingleAgentTest;
exports.getQAReports = getQAReports;
exports.getQAReportByDate = getQAReportByDate;
exports.getLatestQAReport = getLatestQAReport;
const supabaseClient_1 = require("./supabaseClient");
// === Configuration ===
const BASE_URL = 'https://cleya.ai';
const PAGES_TO_TEST = [
    { url: `${BASE_URL}`, name: 'Homepage' },
    { url: `${BASE_URL}/privacy`, name: 'Privacy Page' },
    { url: `${BASE_URL}/controltower`, name: 'Control Tower' },
    { url: `${BASE_URL}/login`, name: 'Login Page' },
    { url: `${BASE_URL}/signup`, name: 'Signup Page' },
    { url: `${BASE_URL}/dashboard`, name: 'Dashboard' },
    { url: `${BASE_URL}/profile`, name: 'Profile' },
];
const API_ENDPOINTS = [
    { url: `${BASE_URL}/api/health`, method: 'GET', name: 'Health Check' },
    { url: `${BASE_URL}/api/admin/integrations/status`, method: 'GET', name: 'Integrations Status' },
    { url: `${BASE_URL}/api/admin/seo/latest`, method: 'GET', name: 'SEO Report Endpoint' },
    { url: `${BASE_URL}/api/ads/status`, method: 'GET', name: 'Ads Status' },
];
const AGENT_IDS = ['nexus', 'maven', 'ledger', 'sentinel', 'ally', 'catalyst', 'closer', 'scout'];
// Thresholds
const PAGE_LOAD_WARN_MS = 3000;
const API_WARN_MS = 1000;
const AGENT_TIMEOUT_MS = 30000;
const FETCH_TIMEOUT_MS = 15000;
// === Helpers ===
async function timedFetch(url, options = {}, timeoutMs = FETCH_TIMEOUT_MS) {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), timeoutMs);
    const start = Date.now();
    try {
        const response = await fetch(url, {
            ...options,
            signal: controller.signal,
            headers: {
                'User-Agent': 'CleyaProbeBot/1.0 (+https://cleya.ai)',
                ...options.headers,
            },
        });
        const responseTime = Date.now() - start;
        return { response, responseTime };
    }
    finally {
        clearTimeout(timeout);
    }
}
// === Test Suites ===
async function runPageLoadTests() {
    const results = [];
    for (const page of PAGES_TO_TEST) {
        try {
            const { response, responseTime } = await timedFetch(page.url);
            const statusCode = response.status;
            let status = 'pass';
            let details = `${statusCode} in ${responseTime}ms`;
            if (statusCode >= 500) {
                status = 'fail';
                details = `Server error: ${statusCode} in ${responseTime}ms`;
            }
            else if (statusCode === 404) {
                status = 'fail';
                details = `Not found: 404 in ${responseTime}ms`;
            }
            else if (statusCode >= 400) {
                status = 'warning';
                details = `Client error: ${statusCode} in ${responseTime}ms`;
            }
            else if (responseTime > PAGE_LOAD_WARN_MS) {
                status = 'warning';
                details = `Slow load: ${responseTime}ms (threshold: ${PAGE_LOAD_WARN_MS}ms)`;
            }
            results.push({
                name: `Page Load: ${page.name}`,
                category: 'page_load',
                status,
                responseTime,
                statusCode,
                details,
            });
        }
        catch (err) {
            results.push({
                name: `Page Load: ${page.name}`,
                category: 'page_load',
                status: 'fail',
                error: err.name === 'AbortError' ? `Timeout after ${FETCH_TIMEOUT_MS}ms` : err.message,
                details: `Failed to reach ${page.url}`,
            });
        }
    }
    return results;
}
async function runAPITests() {
    const results = [];
    for (const endpoint of API_ENDPOINTS) {
        try {
            const { response, responseTime } = await timedFetch(endpoint.url, {
                method: endpoint.method,
            });
            const statusCode = response.status;
            let status = 'pass';
            let details = `${statusCode} in ${responseTime}ms`;
            // Check if JSON response
            const contentType = response.headers.get('content-type') || '';
            const isJson = contentType.includes('application/json');
            if (statusCode >= 500) {
                status = 'fail';
                details = `Server error: ${statusCode}`;
            }
            else if (statusCode >= 400) {
                // Some endpoints require auth — 401/403 is expected, not a failure
                status = statusCode === 401 || statusCode === 403 ? 'warning' : 'fail';
                details = `${statusCode} (${statusCode === 401 ? 'auth required' : 'client error'}) in ${responseTime}ms`;
            }
            else if (responseTime > API_WARN_MS) {
                status = 'warning';
                details = `Slow response: ${responseTime}ms (threshold: ${API_WARN_MS}ms)`;
            }
            else if (!isJson) {
                status = 'warning';
                details = `Non-JSON response (Content-Type: ${contentType})`;
            }
            results.push({
                name: `API: ${endpoint.name}`,
                category: 'api',
                status,
                responseTime,
                statusCode,
                details,
            });
        }
        catch (err) {
            results.push({
                name: `API: ${endpoint.name}`,
                category: 'api',
                status: 'fail',
                error: err.name === 'AbortError' ? `Timeout after ${FETCH_TIMEOUT_MS}ms` : err.message,
                details: `Failed to reach ${endpoint.url}`,
            });
        }
    }
    return results;
}
async function runAgentChatTests() {
    const results = [];
    // First authenticate to get a token
    let authToken = null;
    try {
        const { response, responseTime } = await timedFetch(`${BASE_URL}/api/auth/login`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                email: process.env.ADMIN_EMAIL || 'admin@cleo.ai',
                password: process.env.ADMIN_PASSWORD || 'CleyaAdmin2024!',
            }),
        });
        if (response.ok) {
            const data = await response.json();
            authToken = data.token || data.data?.token || null;
            results.push({
                name: 'Auth: Admin Login',
                category: 'auth',
                status: 'pass',
                responseTime,
                statusCode: response.status,
                details: 'Admin login successful',
            });
        }
        else {
            results.push({
                name: 'Auth: Admin Login',
                category: 'auth',
                status: 'warning',
                responseTime,
                statusCode: response.status,
                details: `Login returned ${response.status} — agent chat tests will be skipped`,
            });
        }
    }
    catch (err) {
        results.push({
            name: 'Auth: Admin Login',
            category: 'auth',
            status: 'warning',
            error: err.message,
            details: 'Could not authenticate — agent chat tests will be skipped',
        });
    }
    if (!authToken) {
        // Skip agent tests if we can't authenticate
        for (const agentId of AGENT_IDS) {
            results.push({
                name: `Agent Chat: ${agentId}`,
                category: 'agent',
                status: 'warning',
                details: 'Skipped — no auth token available',
            });
        }
        return results;
    }
    // Test each agent
    for (const agentId of AGENT_IDS) {
        try {
            const { response, responseTime } = await timedFetch(`${BASE_URL}/api/agent-chat/chat`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${authToken}`,
                },
                body: JSON.stringify({
                    message: 'ping',
                    agentId,
                    history: [],
                }),
            }, AGENT_TIMEOUT_MS);
            const statusCode = response.status;
            let status = 'pass';
            let details = `Responded in ${responseTime}ms`;
            if (statusCode >= 500) {
                status = 'fail';
                details = `Server error: ${statusCode}`;
            }
            else if (statusCode >= 400) {
                status = 'fail';
                details = `Error: ${statusCode}`;
            }
            else {
                // Verify JSON response with content
                try {
                    const data = await response.json();
                    if (!data.success || !data.data?.content) {
                        status = 'warning';
                        details = `Response missing content field (${responseTime}ms)`;
                    }
                }
                catch {
                    status = 'warning';
                    details = `Non-JSON response (${responseTime}ms)`;
                }
            }
            results.push({
                name: `Agent Chat: ${agentId}`,
                category: 'agent',
                status,
                responseTime,
                statusCode,
                details,
            });
        }
        catch (err) {
            results.push({
                name: `Agent Chat: ${agentId}`,
                category: 'agent',
                status: 'fail',
                error: err.name === 'AbortError' ? `Timeout after ${AGENT_TIMEOUT_MS}ms` : err.message,
                details: `Agent ${agentId} did not respond`,
            });
        }
    }
    return results;
}
async function runSecurityTests() {
    const results = [];
    // Check HTTPS works
    try {
        const { response, responseTime } = await timedFetch(BASE_URL);
        const isHttps = BASE_URL.startsWith('https://');
        results.push({
            name: 'Security: HTTPS',
            category: 'security',
            status: isHttps ? 'pass' : 'fail',
            responseTime,
            details: isHttps ? 'Site served over HTTPS' : 'Site not served over HTTPS',
        });
        // Check security headers
        const headers = response.headers;
        const securityHeaders = [
            { name: 'x-frame-options', label: 'X-Frame-Options' },
            { name: 'x-content-type-options', label: 'X-Content-Type-Options' },
            { name: 'strict-transport-security', label: 'Strict-Transport-Security (HSTS)' },
        ];
        for (const sh of securityHeaders) {
            const value = headers.get(sh.name);
            results.push({
                name: `Security: ${sh.label}`,
                category: 'security',
                status: value ? 'pass' : 'warning',
                details: value ? `Present: ${value}` : 'Header not set',
            });
        }
    }
    catch (err) {
        results.push({
            name: 'Security: HTTPS',
            category: 'security',
            status: 'fail',
            error: err.message,
            details: 'Could not check HTTPS/security headers',
        });
    }
    return results;
}
async function runNavigationTests() {
    const results = [];
    // Fetch homepage and extract internal links
    try {
        const { response } = await timedFetch(BASE_URL);
        const html = await response.text();
        // Extract internal links
        const linkRegex = /href=["'](\/[^"'#]*?)["']/g;
        const links = new Set();
        let match;
        while ((match = linkRegex.exec(html))) {
            const path = match[1];
            // Skip static assets, api routes, and anchors
            if (!path.startsWith('/api/') && !path.startsWith('/_next/') && !path.match(/\.\w+$/)) {
                links.add(path);
            }
        }
        const internalLinks = Array.from(links).slice(0, 15); // Limit to 15 links
        for (const path of internalLinks) {
            try {
                const { response: linkResp, responseTime } = await timedFetch(`${BASE_URL}${path}`);
                const statusCode = linkResp.status;
                let status = 'pass';
                if (statusCode === 404)
                    status = 'fail';
                else if (statusCode >= 400)
                    status = 'warning';
                results.push({
                    name: `Navigation: ${path}`,
                    category: 'navigation',
                    status,
                    responseTime,
                    statusCode,
                    details: `${statusCode} in ${responseTime}ms`,
                });
            }
            catch (err) {
                results.push({
                    name: `Navigation: ${path}`,
                    category: 'navigation',
                    status: 'fail',
                    error: err.message,
                    details: `Could not reach ${path}`,
                });
            }
        }
        if (internalLinks.length === 0) {
            results.push({
                name: 'Navigation: Link Extraction',
                category: 'navigation',
                status: 'warning',
                details: 'No internal links found on homepage',
            });
        }
    }
    catch (err) {
        results.push({
            name: 'Navigation: Link Checker',
            category: 'navigation',
            status: 'fail',
            error: err.message,
            details: 'Could not fetch homepage for link extraction',
        });
    }
    return results;
}
async function runPerformanceTests() {
    const results = [];
    const criticalPaths = [
        { url: `${BASE_URL}`, name: 'Homepage', threshold: 3000 },
        { url: `${BASE_URL}/api/health`, name: 'Health API', threshold: 1000 },
        { url: `${BASE_URL}/login`, name: 'Login Page', threshold: 3000 },
    ];
    for (const path of criticalPaths) {
        try {
            const { responseTime } = await timedFetch(path.url);
            let status = 'pass';
            let details = `${responseTime}ms (threshold: ${path.threshold}ms)`;
            if (responseTime > path.threshold * 2) {
                status = 'fail';
                details = `Very slow: ${responseTime}ms (2x threshold: ${path.threshold}ms)`;
            }
            else if (responseTime > path.threshold) {
                status = 'warning';
                details = `Slow: ${responseTime}ms (threshold: ${path.threshold}ms)`;
            }
            results.push({
                name: `Performance: ${path.name}`,
                category: 'performance',
                status,
                responseTime,
                details,
            });
        }
        catch (err) {
            results.push({
                name: `Performance: ${path.name}`,
                category: 'performance',
                status: 'fail',
                error: err.message,
                details: `Could not measure performance for ${path.name}`,
            });
        }
    }
    return results;
}
// === Main Daily Routine ===
async function runDailyQARoutine() {
    const startTime = Date.now();
    const today = new Date().toISOString().split('T')[0];
    console.log(`[QAAutomation] Starting daily QA routine for ${today}`);
    const allResults = [];
    // Run test suites sequentially (to not overwhelm the server)
    const pageResults = await runPageLoadTests();
    allResults.push(...pageResults);
    const apiResults = await runAPITests();
    allResults.push(...apiResults);
    const securityResults = await runSecurityTests();
    allResults.push(...securityResults);
    const navResults = await runNavigationTests();
    allResults.push(...navResults);
    const perfResults = await runPerformanceTests();
    allResults.push(...perfResults);
    // Agent chat tests last (they're slow and require auth)
    const agentResults = await runAgentChatTests();
    allResults.push(...agentResults);
    // Calculate summary
    const passed = allResults.filter(r => r.status === 'pass').length;
    const failed = allResults.filter(r => r.status === 'fail').length;
    const warnings = allResults.filter(r => r.status === 'warning').length;
    const totalTests = allResults.length;
    const responseTimes = allResults.filter(r => r.responseTime != null).map(r => r.responseTime);
    const avgResponseTime = responseTimes.length > 0
        ? Math.round(responseTimes.reduce((a, b) => a + b, 0) / responseTimes.length)
        : 0;
    const criticalFailures = allResults.filter(r => r.status === 'fail' && (r.category === 'page_load' || r.category === 'api'));
    const summary = [
        `Daily QA Report for ${today}`,
        `Tests: ${totalTests} total, ${passed} passed, ${failed} failed, ${warnings} warnings`,
        `Avg response time: ${avgResponseTime}ms`,
        criticalFailures.length > 0 ? `CRITICAL: ${criticalFailures.length} critical failure(s)` : 'No critical failures',
    ].join(' | ');
    // Save report to Supabase
    try {
        await saveDailyQAReport({
            date: today,
            summary,
            totalTests,
            passed,
            failed,
            warnings,
            avgResponseTime,
            criticalFailures,
            results: allResults,
        });
    }
    catch (err) {
        console.error(`[QAAutomation] Failed to save report: ${err.message}`);
    }
    const duration = ((Date.now() - startTime) / 1000).toFixed(1);
    console.log(`[QAAutomation] Daily QA routine completed in ${duration}s — ${passed}/${totalTests} passed`);
    return { summary, results: allResults };
}
// === Individual test runners (for tool calls) ===
async function runSinglePageTest(url) {
    try {
        const { response, responseTime } = await timedFetch(url);
        const statusCode = response.status;
        let status = 'pass';
        let details = `${statusCode} in ${responseTime}ms`;
        if (statusCode >= 500) {
            status = 'fail';
            details = `Server error: ${statusCode}`;
        }
        else if (statusCode === 404) {
            status = 'fail';
            details = `Not found: 404`;
        }
        else if (responseTime > PAGE_LOAD_WARN_MS) {
            status = 'warning';
            details = `Slow: ${responseTime}ms`;
        }
        return { name: `Page Test: ${url}`, category: 'page_load', status, responseTime, statusCode, details };
    }
    catch (err) {
        return { name: `Page Test: ${url}`, category: 'page_load', status: 'fail', error: err.message };
    }
}
async function runSingleAPITest(url, method = 'GET') {
    try {
        const { response, responseTime } = await timedFetch(url, { method });
        const statusCode = response.status;
        let status = 'pass';
        let details = `${statusCode} in ${responseTime}ms`;
        if (statusCode >= 500) {
            status = 'fail';
            details = `Server error: ${statusCode}`;
        }
        else if (statusCode >= 400 && statusCode !== 401 && statusCode !== 403) {
            status = 'fail';
            details = `Error: ${statusCode}`;
        }
        else if (responseTime > API_WARN_MS) {
            status = 'warning';
            details = `Slow: ${responseTime}ms`;
        }
        return { name: `API Test: ${url}`, category: 'api', status, responseTime, statusCode, details };
    }
    catch (err) {
        return { name: `API Test: ${url}`, category: 'api', status: 'fail', error: err.message };
    }
}
async function runSingleAgentTest(agentId) {
    // Try to authenticate and test one agent
    let authToken = null;
    try {
        const { response } = await timedFetch(`${BASE_URL}/api/auth/login`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                email: process.env.ADMIN_EMAIL || 'admin@cleo.ai',
                password: process.env.ADMIN_PASSWORD || 'CleyaAdmin2024!',
            }),
        });
        if (response.ok) {
            const data = await response.json();
            authToken = data.token || data.data?.token || null;
        }
    }
    catch {
        return {
            name: `Agent Test: ${agentId}`,
            category: 'agent',
            status: 'warning',
            details: 'Could not authenticate to test agent',
        };
    }
    if (!authToken) {
        return {
            name: `Agent Test: ${agentId}`,
            category: 'agent',
            status: 'warning',
            details: 'No auth token — cannot test agent',
        };
    }
    try {
        const { response, responseTime } = await timedFetch(`${BASE_URL}/api/agent-chat/chat`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${authToken}`,
            },
            body: JSON.stringify({ message: 'ping', agentId, history: [] }),
        }, AGENT_TIMEOUT_MS);
        const statusCode = response.status;
        let status = 'pass';
        let details = `Responded in ${responseTime}ms`;
        if (statusCode >= 400) {
            status = 'fail';
            details = `Error: ${statusCode}`;
        }
        return { name: `Agent Test: ${agentId}`, category: 'agent', status, responseTime, statusCode, details };
    }
    catch (err) {
        return {
            name: `Agent Test: ${agentId}`,
            category: 'agent',
            status: 'fail',
            error: err.name === 'AbortError' ? `Timeout after ${AGENT_TIMEOUT_MS}ms` : err.message,
        };
    }
}
// === Database operations ===
async function saveDailyQAReport(report) {
    const { prisma } = await Promise.resolve().then(() => __importStar(require('@cleya/db')));
    await prisma.$queryRawUnsafe(`INSERT INTO qa_daily_reports (report_date, summary, full_report, total_tests, passed, failed, warnings, avg_response_time, critical_failures)
     VALUES ($1::date, $2, $3::jsonb, $4, $5, $6, $7, $8, $9::jsonb)
     ON CONFLICT (report_date) DO UPDATE SET
       summary = EXCLUDED.summary,
       full_report = EXCLUDED.full_report,
       total_tests = EXCLUDED.total_tests,
       passed = EXCLUDED.passed,
       failed = EXCLUDED.failed,
       warnings = EXCLUDED.warnings,
       avg_response_time = EXCLUDED.avg_response_time,
       critical_failures = EXCLUDED.critical_failures`, report.date, report.summary, JSON.stringify(report.results), report.totalTests, report.passed, report.failed, report.warnings, report.avgResponseTime, JSON.stringify(report.criticalFailures));
    console.log(`[QAAutomation] Report saved for ${report.date}`);
}
async function getQAReports(limit = 30) {
    return (0, supabaseClient_1.supabaseSelect)('qa_daily_reports', undefined, {
        order: 'report_date.desc',
        limit,
    });
}
async function getQAReportByDate(date) {
    const rows = await (0, supabaseClient_1.supabaseSelect)('qa_daily_reports', { report_date: date }, { limit: 1 });
    return rows.length > 0 ? rows[0] : null;
}
async function getLatestQAReport() {
    const rows = await (0, supabaseClient_1.supabaseSelect)('qa_daily_reports', undefined, {
        order: 'report_date.desc',
        limit: 1,
    });
    return rows.length > 0 ? rows[0] : null;
}
//# sourceMappingURL=qaAutomation.js.map