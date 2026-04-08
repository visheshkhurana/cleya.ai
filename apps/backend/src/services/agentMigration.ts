import { prisma } from '@cleya/db';

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
}
