import { executeTool } from './agentTools';
import { supabaseSelect } from './supabaseClient';

// Pages to audit daily
const PAGES_TO_AUDIT = [
  'https://cleya.ai',
  'https://cleya.ai/privacy',
  'https://cleya.ai/controltower',
];

// Competitors (full analysis on Mondays)
const COMPETITOR_URLS = [
  'https://lunchclub.com',
  'https://shapr.co',
  'https://bumble.com/bizz',
];

// Target keywords to track
const TARGET_KEYWORDS = {
  primary: ['AI networking India', 'startup networking platform', 'founder investor matching'],
  secondary: ['AI matchmaking founders', 'startup connections India', 'professional networking AI'],
  local: ['startup networking Bangalore', 'investor network Delhi', 'founder community Mumbai'],
};

interface SEOIssue {
  url: string;
  issue: string;
  severity: 'critical' | 'high' | 'medium' | 'low';
}

interface PageAuditResult {
  url: string;
  success: boolean;
  score: number;
  issues: string[];
  metaTags: Record<string, string>;
  structuredData: any[];
  error?: string;
}

interface DailyReport {
  date: string;
  summary: string;
  pagesAudited: number;
  seoScore: number;
  geoScore: number;
  criticalIssues: number;
  highIssues: number;
  mediumIssues: number;
  auditResults: PageAuditResult[];
  indexingResults: any;
  competitorData: any | null;
  keywordRankings: typeof TARGET_KEYWORDS;
  recommendations: {
    critical: SEOIssue[];
    high: SEOIssue[];
    medium: SEOIssue[];
  };
  geoAnalysis: {
    factualClaims: boolean;
    faqContent: boolean;
    statisticsPresent: boolean;
    entityDefinitions: boolean;
    overallScore: number;
    suggestions: string[];
  };
}

/**
 * Run a full daily SEO optimization routine for cleya.ai.
 * Called by the Scout agent's scheduled run.
 */
export async function runDailySEORoutine(): Promise<string> {
  const report: string[] = [];
  const startTime = Date.now();
  const today = new Date().toISOString().split('T')[0];
  const isMonday = new Date().getDay() === 1;

  console.log(`[SEOAutomation] Starting daily SEO routine for ${today}`);

  // Step 1: Audit pages
  report.push('## Step 1: Site Audit');
  const auditResults: PageAuditResult[] = [];

  for (const url of PAGES_TO_AUDIT) {
    const result = await executeTool('scout', 'analyze_seo', { url });
    if (result.success && result.result) {
      const data = result.result;
      auditResults.push({
        url,
        success: true,
        score: data.score ?? 0,
        issues: data.issues ?? [],
        metaTags: data.metaTags ?? {},
        structuredData: data.structuredData ?? [],
      });
      report.push(`- ${url}: Score ${data.score ?? 'N/A'}/100, ${(data.issues ?? []).length} issue(s)`);
    } else {
      auditResults.push({
        url,
        success: false,
        score: 0,
        issues: [],
        metaTags: {},
        structuredData: [],
        error: result.error || 'Unknown error',
      });
      report.push(`- ${url}: FAILED — ${result.error}`);
    }
  }

  // Step 2: Check indexing
  report.push('\n## Step 2: Indexing Status');
  const indexingResult = await executeTool('scout', 'check_indexing', { urls: PAGES_TO_AUDIT });
  const indexingData = indexingResult.success ? indexingResult.result : { results: [], error: indexingResult.error };

  if (indexingResult.success && indexingData.results) {
    for (const r of indexingData.results) {
      const status = r.noindex ? 'NOINDEX' : r.accessible ? 'OK' : 'UNREACHABLE';
      report.push(`- ${r.url}: ${status}`);
    }
  } else {
    report.push(`- Indexing check failed: ${indexingResult.error}`);
  }

  // Step 3: Competitor monitoring (Mondays only)
  let competitorData: any = null;
  report.push('\n## Step 3: Competitor Monitoring');
  if (isMonday) {
    const compResult = await executeTool('scout', 'analyze_competitors', { urls: COMPETITOR_URLS });
    if (compResult.success && compResult.result) {
      competitorData = compResult.result;
      const competitors = competitorData.competitors ?? [];
      for (const comp of competitors) {
        if (comp.error) {
          report.push(`- ${comp.url}: Error — ${comp.error}`);
        } else {
          report.push(`- ${comp.url}: ${comp.strengths?.length ?? 0} strength(s), ${comp.weaknesses?.length ?? 0} weakness(es), ~${comp.wordCount} words`);
        }
      }
    } else {
      report.push(`- Competitor analysis failed: ${compResult.error}`);
    }
  } else {
    report.push('- Skipped (runs on Mondays only)');
  }

  // Step 4: Keyword ranking check
  report.push('\n## Step 4: Keyword Rankings');
  const allKeywords = [...TARGET_KEYWORDS.primary, ...TARGET_KEYWORDS.secondary, ...TARGET_KEYWORDS.local];
  const keywordResult = await executeTool('scout', 'keyword_research', {
    topic: 'AI networking India startup platform',
    count: allKeywords.length,
  });

  if (keywordResult.success) {
    report.push(`- Tracked ${allKeywords.length} keywords across 3 tiers`);
    report.push(`- Primary: ${TARGET_KEYWORDS.primary.join(', ')}`);
    report.push(`- Secondary: ${TARGET_KEYWORDS.secondary.join(', ')}`);
    report.push(`- Local: ${TARGET_KEYWORDS.local.join(', ')}`);
  } else {
    report.push(`- Keyword check failed: ${keywordResult.error}`);
  }

  // Step 5: Generate prioritized recommendations
  report.push('\n## Step 5: SEO Recommendations');
  const allIssues = categorizeIssues(auditResults, indexingData);

  report.push(`### Critical (fix today): ${allIssues.critical.length}`);
  for (const issue of allIssues.critical) {
    report.push(`- [${issue.url}] ${issue.issue}`);
  }
  report.push(`### High (fix this week): ${allIssues.high.length}`);
  for (const issue of allIssues.high) {
    report.push(`- [${issue.url}] ${issue.issue}`);
  }
  report.push(`### Medium (ongoing): ${allIssues.medium.length}`);
  for (const issue of allIssues.medium) {
    report.push(`- [${issue.url}] ${issue.issue}`);
  }

  // Step 6: GEO analysis
  report.push('\n## Step 6: GEO (Generative Engine Optimization) Check');
  const geoAnalysis = analyzeGEOReadiness(auditResults);

  report.push(`- GEO Score: ${geoAnalysis.overallScore}/100`);
  report.push(`- Factual claims extractable by AI: ${geoAnalysis.factualClaims ? 'Yes' : 'No'}`);
  report.push(`- FAQ content present: ${geoAnalysis.faqContent ? 'Yes' : 'No'}`);
  report.push(`- Statistics/data points: ${geoAnalysis.statisticsPresent ? 'Yes' : 'No'}`);
  report.push(`- Entity definitions clear: ${geoAnalysis.entityDefinitions ? 'Yes' : 'No'}`);
  if (geoAnalysis.suggestions.length > 0) {
    report.push('- Suggestions:');
    for (const s of geoAnalysis.suggestions) {
      report.push(`  - ${s}`);
    }
  }

  // Calculate aggregate scores
  const validAudits = auditResults.filter(a => a.success);
  const avgSEOScore = validAudits.length > 0
    ? Math.round(validAudits.reduce((sum, a) => sum + a.score, 0) / validAudits.length)
    : 0;

  const summary = [
    `Daily SEO Report for ${today}`,
    `Pages audited: ${PAGES_TO_AUDIT.length}`,
    `Average SEO score: ${avgSEOScore}/100`,
    `GEO score: ${geoAnalysis.overallScore}/100`,
    `Issues: ${allIssues.critical.length} critical, ${allIssues.high.length} high, ${allIssues.medium.length} medium`,
    isMonday ? `Competitors analyzed: ${COMPETITOR_URLS.length}` : '',
  ].filter(Boolean).join(' | ');

  // Step 7: Save report to Supabase
  report.push('\n## Step 7: Report Saved');
  const dailyReport: DailyReport = {
    date: today,
    summary,
    pagesAudited: PAGES_TO_AUDIT.length,
    seoScore: avgSEOScore,
    geoScore: geoAnalysis.overallScore,
    criticalIssues: allIssues.critical.length,
    highIssues: allIssues.high.length,
    mediumIssues: allIssues.medium.length,
    auditResults,
    indexingResults: indexingData,
    competitorData,
    keywordRankings: TARGET_KEYWORDS,
    recommendations: allIssues,
    geoAnalysis,
  };

  try {
    await saveDailyReport(dailyReport);
    report.push('- Report saved to seo_daily_reports table');
  } catch (err: any) {
    report.push(`- Failed to save report: ${err.message}`);
    console.error('[SEOAutomation] Failed to save report:', err.message);
  }

  const duration = ((Date.now() - startTime) / 1000).toFixed(1);
  report.push(`\n---\nCompleted in ${duration}s`);

  console.log(`[SEOAutomation] Daily SEO routine completed in ${duration}s`);

  return report.join('\n');
}

/**
 * Categorize audit issues by severity.
 */
function categorizeIssues(
  audits: PageAuditResult[],
  indexingData: any,
): { critical: SEOIssue[]; high: SEOIssue[]; medium: SEOIssue[] } {
  const critical: SEOIssue[] = [];
  const high: SEOIssue[] = [];
  const medium: SEOIssue[] = [];

  // Critical issues from audits
  for (const audit of audits) {
    if (!audit.success) {
      critical.push({ url: audit.url, issue: `Page unreachable: ${audit.error}`, severity: 'critical' });
      continue;
    }

    for (const issue of audit.issues) {
      const lower = issue.toLowerCase();
      if (lower.includes('noindex') || lower.includes('missing <title>') || lower.includes('missing h1')) {
        critical.push({ url: audit.url, issue, severity: 'critical' });
      } else if (lower.includes('missing meta description') || lower.includes('missing open graph') ||
                 lower.includes('no json-ld') || lower.includes('missing canonical')) {
        high.push({ url: audit.url, issue, severity: 'high' });
      } else {
        medium.push({ url: audit.url, issue, severity: 'medium' });
      }
    }
  }

  // Indexing issues
  if (indexingData?.results) {
    for (const r of indexingData.results) {
      if (r.noindex) {
        critical.push({ url: r.url, issue: 'Page has noindex directive — will not be indexed', severity: 'critical' });
      } else if (!r.accessible) {
        critical.push({ url: r.url, issue: `Page not accessible (status: ${r.statusCode})`, severity: 'critical' });
      }
    }
  }

  return { critical, high, medium };
}

/**
 * Analyze how well pages are optimized for AI/GEO citation.
 */
function analyzeGEOReadiness(audits: PageAuditResult[]): {
  factualClaims: boolean;
  faqContent: boolean;
  statisticsPresent: boolean;
  entityDefinitions: boolean;
  overallScore: number;
  suggestions: string[];
} {
  let factualClaims = false;
  let faqContent = false;
  let statisticsPresent = false;
  let entityDefinitions = false;
  const suggestions: string[] = [];

  for (const audit of audits) {
    if (!audit.success) continue;

    // Check structured data for FAQ schema
    for (const sd of audit.structuredData) {
      if (sd['@type'] === 'FAQPage' || sd['@type'] === 'Question') faqContent = true;
      if (sd['@type'] === 'Organization' || sd['@type'] === 'WebSite') entityDefinitions = true;
    }

    // Check meta tags for data-rich content signals
    const desc = audit.metaTags['description'] || '';
    if (/\d+%|\d+\+|\d{4,}|\d+x/i.test(desc)) statisticsPresent = true;
    if (/is a|platform|connects|matches/i.test(desc)) factualClaims = true;
  }

  if (!factualClaims) suggestions.push('Add clear factual claims AI can extract (e.g., "Cleya.ai connects 10,000+ founders...")');
  if (!faqContent) suggestions.push('Add FAQ structured data (FAQPage schema) for AI-search-friendly Q&A content');
  if (!statisticsPresent) suggestions.push('Include statistics and data points in meta descriptions and content');
  if (!entityDefinitions) suggestions.push('Add Organization/WebSite JSON-LD schema to clearly define Cleya.ai as an entity');

  let score = 0;
  if (factualClaims) score += 25;
  if (faqContent) score += 25;
  if (statisticsPresent) score += 25;
  if (entityDefinitions) score += 25;

  return { factualClaims, faqContent, statisticsPresent, entityDefinitions, overallScore: score, suggestions };
}

/**
 * Save the daily SEO report to Supabase using upsert on report_date.
 */
async function saveDailyReport(report: DailyReport): Promise<void> {
  const { prisma } = await import('@cleya/db');

  // Upsert: if a report for today already exists, update it
  await prisma.$queryRawUnsafe(
    `INSERT INTO seo_daily_reports (report_date, summary, full_report, pages_audited, critical_issues, high_issues, medium_issues, seo_score, geo_score, competitor_data, keyword_rankings, recommendations)
     VALUES ($1::date, $2, $3::jsonb, $4, $5, $6, $7, $8, $9, $10::jsonb, $11::jsonb, $12::jsonb)
     ON CONFLICT (report_date) DO UPDATE SET
       summary = EXCLUDED.summary,
       full_report = EXCLUDED.full_report,
       pages_audited = EXCLUDED.pages_audited,
       critical_issues = EXCLUDED.critical_issues,
       high_issues = EXCLUDED.high_issues,
       medium_issues = EXCLUDED.medium_issues,
       seo_score = EXCLUDED.seo_score,
       geo_score = EXCLUDED.geo_score,
       competitor_data = EXCLUDED.competitor_data,
       keyword_rankings = EXCLUDED.keyword_rankings,
       recommendations = EXCLUDED.recommendations`,
    report.date,
    report.summary,
    JSON.stringify({
      auditResults: report.auditResults,
      indexingResults: report.indexingResults,
      geoAnalysis: report.geoAnalysis,
      generatedAt: new Date().toISOString(),
    }),
    report.pagesAudited,
    report.criticalIssues,
    report.highIssues,
    report.mediumIssues,
    report.seoScore,
    report.geoScore,
    report.competitorData ? JSON.stringify(report.competitorData) : null,
    JSON.stringify(report.keywordRankings),
    JSON.stringify(report.recommendations),
  );

  console.log(`[SEOAutomation] Report saved for ${report.date}`);
}

/**
 * Fetch SEO daily reports from Supabase.
 */
export async function getSEOReports(limit = 30): Promise<any[]> {
  return supabaseSelect('seo_daily_reports', undefined, {
    order: 'report_date.desc',
    limit,
  });
}

/**
 * Fetch a specific day's SEO report.
 */
export async function getSEOReportByDate(date: string): Promise<any | null> {
  const rows = await supabaseSelect('seo_daily_reports', { report_date: date }, { limit: 1 });
  return rows.length > 0 ? rows[0] : null;
}

/**
 * Fetch the most recent SEO report.
 */
export async function getLatestSEOReport(): Promise<any | null> {
  const rows = await supabaseSelect('seo_daily_reports', undefined, {
    order: 'report_date.desc',
    limit: 1,
  });
  return rows.length > 0 ? rows[0] : null;
}
