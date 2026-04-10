import { prisma } from '@cleya/db';
import { ensureFounderModeTables } from './founderModeService';

export async function ensureAgentTables(): Promise<void> {
  try {
    await prisma.$executeRawUnsafe(`
      CREATE TABLE IF NOT EXISTS dm_agent_state (
        id SERIAL PRIMARY KEY,
        agent_id TEXT UNIQUE NOT NULL,
        status TEXT DEFAULT 'idle',
        last_run_at TIMESTAMPTZ,
        last_run_duration INTEGER,
        last_run_status TEXT,
        enabled BOOLEAN DEFAULT true,
        cron_expression TEXT,
        cron_description TEXT,
        created_at TIMESTAMPTZ DEFAULT now(),
        updated_at TIMESTAMPTZ DEFAULT now()
      );
    `);

    try {
      await prisma.$executeRawUnsafe(`NOTIFY pgrst, 'reload schema';`);
    } catch {}

    console.log('[AgentMigration] dm_agent_state table ensured');
  } catch (err: any) {
    console.log(`[AgentMigration] Could not create dm_agent_state table: ${err.message}`);
  }

  await ensureFounderModeTables();
  await ensureAgentMessagesTables();
  await ensureContentCalendarTables();
  await ensureAuditAndSupportTables();
  await ensureCampaignMetricsTables();
}

async function ensureAgentMessagesTables(): Promise<void> {
  try {
    await prisma.$executeRawUnsafe(`
      CREATE TABLE IF NOT EXISTS dm_agent_messages (
        id SERIAL PRIMARY KEY,
        agent_id TEXT NOT NULL,
        direction TEXT DEFAULT 'inbound',
        message TEXT NOT NULL DEFAULT '',
        message_type TEXT DEFAULT 'text',
        read BOOLEAN DEFAULT false,
        metadata JSONB DEFAULT '{}',
        created_at TIMESTAMPTZ DEFAULT now()
      );
    `);
    await prisma.$executeRawUnsafe(`
      CREATE INDEX IF NOT EXISTS idx_agent_messages_agent ON dm_agent_messages(agent_id);
    `);
    console.log('[AgentMigration] dm_agent_messages table ensured');
  } catch (err: any) {
    console.log(`[AgentMigration] Could not create dm_agent_messages: ${err.message}`);
  }

  try {
    await prisma.$executeRawUnsafe(`
      CREATE TABLE IF NOT EXISTS dm_code_changes (
        id SERIAL PRIMARY KEY,
        agent_id TEXT NOT NULL,
        file_path TEXT DEFAULT '',
        change_type TEXT DEFAULT 'modify',
        description TEXT DEFAULT '',
        diff_summary TEXT DEFAULT '',
        status TEXT DEFAULT 'pending',
        metadata JSONB DEFAULT '{}',
        created_at TIMESTAMPTZ DEFAULT now()
      );
    `);
    await prisma.$executeRawUnsafe(`
      CREATE INDEX IF NOT EXISTS idx_code_changes_agent ON dm_code_changes(agent_id);
    `);
    console.log('[AgentMigration] dm_code_changes table ensured');
  } catch (err: any) {
    console.log(`[AgentMigration] Could not create dm_code_changes: ${err.message}`);
  }
}

async function ensureContentCalendarTables(): Promise<void> {
  try {
    await prisma.$executeRawUnsafe(`
      CREATE TABLE IF NOT EXISTS content_calendar (
        id SERIAL PRIMARY KEY,
        agent_id TEXT NOT NULL,
        platform TEXT NOT NULL,
        content_type TEXT NOT NULL,
        title TEXT NOT NULL DEFAULT '',
        body TEXT NOT NULL DEFAULT '',
        media_urls TEXT[] DEFAULT '{}',
        media_hints TEXT DEFAULT '',
        content_pillar TEXT DEFAULT '',
        hook TEXT DEFAULT '',
        cta TEXT DEFAULT '',
        target_audience TEXT DEFAULT '',
        funnel_stage TEXT DEFAULT '',
        scheduled_time TIMESTAMPTZ,
        published_at TIMESTAMPTZ,
        risk_score INTEGER DEFAULT 1,
        risk_factors JSONB DEFAULT '[]',
        status TEXT DEFAULT 'draft',
        approval_notes TEXT,
        publish_result JSONB DEFAULT '{}',
        metadata JSONB DEFAULT '{}',
        created_at TIMESTAMPTZ DEFAULT now(),
        updated_at TIMESTAMPTZ DEFAULT now()
      );
    `);

    await prisma.$executeRawUnsafe(`
      CREATE INDEX IF NOT EXISTS idx_content_calendar_status ON content_calendar(status);
    `);
    await prisma.$executeRawUnsafe(`
      CREATE INDEX IF NOT EXISTS idx_content_calendar_scheduled ON content_calendar(scheduled_time);
    `);
    await prisma.$executeRawUnsafe(`
      CREATE INDEX IF NOT EXISTS idx_content_calendar_agent ON content_calendar(agent_id);
    `);

    console.log('[AgentMigration] content_calendar table ensured');
  } catch (err: any) {
    console.log(`[AgentMigration] Could not create content_calendar: ${err.message}`);
  }

  try {
    await prisma.$executeRawUnsafe(`
      CREATE TABLE IF NOT EXISTS founder_approval_queue (
        id SERIAL PRIMARY KEY,
        content_calendar_id INTEGER REFERENCES content_calendar(id) ON DELETE CASCADE,
        agent_id TEXT NOT NULL,
        title TEXT NOT NULL DEFAULT '',
        summary TEXT DEFAULT '',
        risk_score INTEGER DEFAULT 1,
        risk_factors JSONB DEFAULT '[]',
        status TEXT DEFAULT 'pending',
        founder_notes TEXT,
        decided_at TIMESTAMPTZ,
        created_at TIMESTAMPTZ DEFAULT now()
      );
    `);

    await prisma.$executeRawUnsafe(`
      CREATE INDEX IF NOT EXISTS idx_approval_queue_status ON founder_approval_queue(status);
    `);

    console.log('[AgentMigration] founder_approval_queue table ensured');
  } catch (err: any) {
    console.log(`[AgentMigration] Could not create founder_approval_queue: ${err.message}`);
  }
}

async function ensureAuditAndSupportTables(): Promise<void> {
  try {
    await prisma.$executeRawUnsafe(`
      CREATE TABLE IF NOT EXISTS audit_log (
        id SERIAL PRIMARY KEY,
        agent_id TEXT NOT NULL,
        action_type TEXT NOT NULL,
        action_description TEXT DEFAULT '',
        entity_type TEXT DEFAULT '',
        entity_id TEXT DEFAULT '',
        risk_score INTEGER DEFAULT 1,
        cost_amount NUMERIC DEFAULT 0,
        cost_currency TEXT DEFAULT 'USD',
        input_summary TEXT DEFAULT '',
        output_summary TEXT DEFAULT '',
        status TEXT DEFAULT 'success',
        metadata JSONB DEFAULT '{}',
        created_at TIMESTAMPTZ DEFAULT now()
      );
    `);

    await prisma.$executeRawUnsafe(`
      CREATE INDEX IF NOT EXISTS idx_audit_log_agent ON audit_log(agent_id);
    `);
    await prisma.$executeRawUnsafe(`
      CREATE INDEX IF NOT EXISTS idx_audit_log_action ON audit_log(action_type);
    `);

    console.log('[AgentMigration] audit_log table ensured');
  } catch (err: any) {
    console.log(`[AgentMigration] Could not create audit_log: ${err.message}`);
  }

  try {
    await prisma.$executeRawUnsafe(`
      CREATE TABLE IF NOT EXISTS tickets (
        id SERIAL PRIMARY KEY,
        user_id TEXT,
        subject TEXT NOT NULL DEFAULT '',
        body TEXT DEFAULT '',
        channel TEXT DEFAULT 'email',
        priority TEXT DEFAULT 'medium',
        status TEXT DEFAULT 'open',
        assigned_agent TEXT DEFAULT 'ally',
        resolution TEXT,
        resolved_at TIMESTAMPTZ,
        metadata JSONB DEFAULT '{}',
        created_at TIMESTAMPTZ DEFAULT now(),
        updated_at TIMESTAMPTZ DEFAULT now()
      );
    `);
    console.log('[AgentMigration] tickets table ensured');
  } catch (err: any) {
    console.log(`[AgentMigration] Could not create tickets: ${err.message}`);
  }

  try {
    await prisma.$executeRawUnsafe(`
      CREATE TABLE IF NOT EXISTS faq_kb (
        id SERIAL PRIMARY KEY,
        question TEXT NOT NULL,
        answer TEXT NOT NULL DEFAULT '',
        category TEXT DEFAULT 'general',
        source TEXT DEFAULT 'agent',
        helpful_count INTEGER DEFAULT 0,
        view_count INTEGER DEFAULT 0,
        status TEXT DEFAULT 'active',
        created_at TIMESTAMPTZ DEFAULT now(),
        updated_at TIMESTAMPTZ DEFAULT now()
      );
    `);
    console.log('[AgentMigration] faq_kb table ensured');
  } catch (err: any) {
    console.log(`[AgentMigration] Could not create faq_kb: ${err.message}`);
  }

  try {
    await prisma.$executeRawUnsafe(`
      CREATE TABLE IF NOT EXISTS experiments (
        id SERIAL PRIMARY KEY,
        agent_id TEXT DEFAULT 'catalyst',
        name TEXT NOT NULL,
        hypothesis TEXT DEFAULT '',
        variant_a TEXT DEFAULT '',
        variant_b TEXT DEFAULT '',
        metric TEXT DEFAULT '',
        target_sample_size INTEGER DEFAULT 100,
        current_sample_size INTEGER DEFAULT 0,
        result_a NUMERIC,
        result_b NUMERIC,
        winner TEXT,
        status TEXT DEFAULT 'draft',
        started_at TIMESTAMPTZ,
        ended_at TIMESTAMPTZ,
        metadata JSONB DEFAULT '{}',
        created_at TIMESTAMPTZ DEFAULT now(),
        updated_at TIMESTAMPTZ DEFAULT now()
      );
    `);
    console.log('[AgentMigration] experiments table ensured');
  } catch (err: any) {
    console.log(`[AgentMigration] Could not create experiments: ${err.message}`);
  }

  try {
    await prisma.$executeRawUnsafe(`
      CREATE TABLE IF NOT EXISTS outreach_crm (
        id SERIAL PRIMARY KEY,
        agent_id TEXT DEFAULT 'closer',
        contact_name TEXT NOT NULL DEFAULT '',
        contact_email TEXT DEFAULT '',
        contact_linkedin TEXT DEFAULT '',
        company TEXT DEFAULT '',
        role TEXT DEFAULT '',
        stage TEXT DEFAULT 'prospect',
        last_contacted_at TIMESTAMPTZ,
        next_follow_up TIMESTAMPTZ,
        sequence_step INTEGER DEFAULT 0,
        notes TEXT DEFAULT '',
        score INTEGER DEFAULT 0,
        metadata JSONB DEFAULT '{}',
        created_at TIMESTAMPTZ DEFAULT now(),
        updated_at TIMESTAMPTZ DEFAULT now()
      );
    `);
    console.log('[AgentMigration] outreach_crm table ensured');
  } catch (err: any) {
    console.log(`[AgentMigration] Could not create outreach_crm: ${err.message}`);
  }

  try {
    await prisma.$executeRawUnsafe(`
      CREATE TABLE IF NOT EXISTS ad_performance (
        id SERIAL PRIMARY KEY,
        platform TEXT NOT NULL,
        campaign_name TEXT NOT NULL DEFAULT '',
        ad_set TEXT DEFAULT '',
        spend NUMERIC DEFAULT 0,
        impressions INTEGER DEFAULT 0,
        clicks INTEGER DEFAULT 0,
        conversions INTEGER DEFAULT 0,
        ctr NUMERIC DEFAULT 0,
        cpc NUMERIC DEFAULT 0,
        cpa NUMERIC DEFAULT 0,
        roas NUMERIC DEFAULT 0,
        date DATE NOT NULL DEFAULT CURRENT_DATE,
        metadata JSONB DEFAULT '{}',
        created_at TIMESTAMPTZ DEFAULT now()
      );
    `);
    console.log('[AgentMigration] ad_performance table ensured');
  } catch (err: any) {
    console.log(`[AgentMigration] Could not create ad_performance: ${err.message}`);
  }
}

async function ensureCampaignMetricsTables(): Promise<void> {
  try {
    await prisma.$executeRawUnsafe(`
      CREATE TABLE IF NOT EXISTS dm_campaign_metrics (
        id SERIAL PRIMARY KEY,
        agent_id TEXT NOT NULL,
        campaign_name TEXT DEFAULT '',
        platform TEXT DEFAULT '',
        status TEXT DEFAULT 'active',
        impressions INTEGER DEFAULT 0,
        clicks INTEGER DEFAULT 0,
        conversions INTEGER DEFAULT 0,
        spend NUMERIC DEFAULT 0,
        revenue NUMERIC DEFAULT 0,
        roas NUMERIC DEFAULT 0,
        start_date DATE,
        end_date DATE,
        metadata JSONB DEFAULT '{}',
        created_at TIMESTAMPTZ DEFAULT now(),
        updated_at TIMESTAMPTZ DEFAULT now()
      );
    `);
    console.log('[AgentMigration] dm_campaign_metrics table ensured');
  } catch (err: any) {
    console.log(`[AgentMigration] Could not create dm_campaign_metrics: ${err.message}`);
  }
}
