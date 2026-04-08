import { prisma } from '@cleya/db';
import { createAIService } from '@cleya/ai';
import crypto from 'crypto';

function generateId(): string {
  return crypto.randomUUID();
}

const SHORT_TERM_TTL_HOURS = 48;
const PROMOTION_THRESHOLD = 3;

interface MemoryContext {
  working: any | null;
  shortTerm: Array<{ category: string; content: string; createdAt: Date }>;
  longTerm: Array<{ category: string; pattern: string; confidence: number }>;
  episodic: Array<{ eventType: string; title: string; description: string; occurredAt: Date }>;
  semantic: Array<{ content: string; category: string; similarity?: number }>;
}

function getAI() {
  if (!process.env.OPENAI_API_KEY) return null;
  return createAIService({ provider: 'openai', model: 'gpt-4o-mini' });
}

// ── Working Memory ──

export async function getWorkingMemory(agentId: string): Promise<any | null> {
  const record = await prisma.agentWorkingMemory.findUnique({ where: { agentId } });
  return record?.data ?? null;
}

export async function setWorkingMemory(agentId: string, data: any, sessionId?: string): Promise<void> {
  await prisma.agentWorkingMemory.upsert({
    where: { agentId },
    create: { agentId, data, sessionId },
    update: { data, sessionId },
  });
}

export async function clearWorkingMemory(agentId: string): Promise<void> {
  await prisma.agentWorkingMemory.deleteMany({ where: { agentId } });
}

// ── Short-Term Memory ──

export async function addShortTermMemory(
  agentId: string,
  category: string,
  content: string,
  metadata?: any
): Promise<string> {
  const expiresAt = new Date(Date.now() + SHORT_TERM_TTL_HOURS * 60 * 60 * 1000);
  const record = await prisma.agentShortTermMemory.create({
    data: { agentId, category, content, metadata, expiresAt },
  });
  await checkAndPromote(agentId, category, content);
  return record.id;
}

export async function getShortTermMemories(
  agentId: string,
  category?: string,
  limit: number = 20
): Promise<any[]> {
  const now = new Date();
  const where: any = { agentId, expiresAt: { gt: now } };
  if (category) where.category = category;

  return prisma.agentShortTermMemory.findMany({
    where,
    orderBy: { createdAt: 'desc' },
    take: limit,
  });
}

export async function deleteShortTermMemory(id: string, agentId?: string): Promise<void> {
  if (agentId) {
    const mem = await prisma.agentShortTermMemory.findUnique({ where: { id } });
    if (!mem || mem.agentId !== agentId) throw new Error('Memory not found');
  }
  await prisma.agentShortTermMemory.delete({ where: { id } });
}

export async function cleanExpiredShortTermMemories(): Promise<number> {
  const result = await prisma.agentShortTermMemory.deleteMany({
    where: { expiresAt: { lt: new Date() } },
  });
  return result.count;
}

// ── Long-Term Memory ──

export async function addLongTermMemory(
  agentId: string,
  category: string,
  pattern: string,
  evidence: string[] = [],
  metadata?: any
): Promise<string> {
  const record = await prisma.agentLongTermMemory.create({
    data: { agentId, category, pattern, evidence, metadata },
  });
  return record.id;
}

export async function getLongTermMemories(
  agentId: string,
  category?: string,
  limit: number = 20
): Promise<any[]> {
  const where: any = { agentId };
  if (category) where.category = category;

  return prisma.agentLongTermMemory.findMany({
    where,
    orderBy: { confidence: 'desc' },
    take: limit,
  });
}

export async function deleteLongTermMemory(id: string, agentId?: string): Promise<void> {
  if (agentId) {
    const mem = await prisma.agentLongTermMemory.findUnique({ where: { id } });
    if (!mem || mem.agentId !== agentId) throw new Error('Memory not found');
  }
  await prisma.agentLongTermMemory.delete({ where: { id } });
}

async function checkAndPromote(agentId: string, category: string, content: string): Promise<void> {
  try {
    const recentSimilar = await prisma.agentShortTermMemory.findMany({
      where: {
        agentId,
        category,
        expiresAt: { gt: new Date() },
      },
      orderBy: { createdAt: 'desc' },
      take: 50,
    });

    const contentLower = content.toLowerCase();
    const keywords = contentLower.split(/\s+/).filter(w => w.length > 4);

    let matchCount = 0;
    const matchingContents: string[] = [];

    for (const mem of recentSimilar) {
      const memLower = mem.content.toLowerCase();
      const overlap = keywords.filter(kw => memLower.includes(kw)).length;
      if (overlap >= Math.max(2, keywords.length * 0.3)) {
        matchCount++;
        matchingContents.push(mem.content);
      }
    }

    if (matchCount >= PROMOTION_THRESHOLD) {
      const existing = await prisma.agentLongTermMemory.findMany({
        where: { agentId, category },
      });

      const alreadyStored = existing.find(e =>
        e.pattern.toLowerCase().includes(contentLower.substring(0, 50))
      );

      if (alreadyStored) {
        await prisma.agentLongTermMemory.update({
          where: { id: alreadyStored.id },
          data: {
            occurrenceCount: { increment: 1 },
            confidence: Math.min(1, alreadyStored.confidence + 0.1),
            evidence: [...alreadyStored.evidence, content].slice(-10),
          },
        });
      } else {
        await prisma.agentLongTermMemory.create({
          data: {
            agentId,
            category,
            pattern: content,
            evidence: matchingContents.slice(0, 5),
            confidence: 0.6,
            occurrenceCount: matchCount,
          },
        });
      }
    }
  } catch (err) {
    console.error(`[AgentMemory] Promotion check failed:`, err);
  }
}

// ── Episodic Memory ──

export async function addEpisodicMemory(
  agentId: string,
  eventType: string,
  title: string,
  description: string,
  impact?: string,
  tags: string[] = [],
  metadata?: any,
  occurredAt?: Date
): Promise<string> {
  const record = await prisma.agentEpisodicMemory.create({
    data: {
      agentId,
      eventType,
      title,
      description,
      impact,
      tags,
      metadata,
      occurredAt: occurredAt || new Date(),
    },
  });
  return record.id;
}

export async function getEpisodicMemories(
  agentId: string,
  eventType?: string,
  limit: number = 10
): Promise<any[]> {
  const where: any = { agentId };
  if (eventType) where.eventType = eventType;

  return prisma.agentEpisodicMemory.findMany({
    where,
    orderBy: { occurredAt: 'desc' },
    take: limit,
  });
}

export async function deleteEpisodicMemory(id: string, agentId?: string): Promise<void> {
  if (agentId) {
    const mem = await prisma.agentEpisodicMemory.findUnique({ where: { id } });
    if (!mem || mem.agentId !== agentId) throw new Error('Memory not found');
  }
  await prisma.agentEpisodicMemory.delete({ where: { id } });
}

// ── Semantic Memory ──

export async function addSemanticMemory(
  agentId: string,
  content: string,
  category: string,
  metadata?: any
): Promise<string | null> {
  const ai = getAI();
  if (!ai) {
    console.warn('[AgentMemory] No AI service for embeddings, skipping semantic memory');
    return null;
  }

  const embResult = await ai.embed(content);
  const vectorStr = `[${embResult.vector.join(',')}]`;

  const id = generateId();
  await prisma.$queryRawUnsafe(
    `INSERT INTO agent_semantic_memory (id, "agentId", content, category, embedding, metadata, "createdAt", "updatedAt")
     VALUES ($1, $2, $3, $4, $5::vector, $6::jsonb, now(), now())`,
    id,
    agentId,
    content,
    category,
    vectorStr,
    JSON.stringify(metadata || {})
  );

  return id;
}

export async function searchSemanticMemory(
  agentId: string,
  query: string,
  limit: number = 5,
  minSimilarity: number = 0.3
): Promise<Array<{ id: string; content: string; category: string; similarity: number }>> {
  const ai = getAI();
  if (!ai) return [];

  const embResult = await ai.embed(query);
  const vectorStr = `[${embResult.vector.join(',')}]`;

  const results = await prisma.$queryRawUnsafe<any[]>(
    `SELECT id, content, category,
            1 - (embedding <=> $1::vector) AS similarity
     FROM agent_semantic_memory
     WHERE "agentId" = $2
       AND 1 - (embedding <=> $1::vector) >= $3
     ORDER BY embedding <=> $1::vector
     LIMIT $4`,
    vectorStr,
    agentId,
    minSimilarity,
    limit
  );

  return results.map(r => ({
    id: r.id,
    content: r.content,
    category: r.category,
    similarity: parseFloat(String(r.similarity)),
  }));
}

export async function getSemanticMemories(
  agentId: string,
  category?: string,
  limit: number = 20
): Promise<any[]> {
  const where: any = { agentId };
  if (category) where.category = category;

  const results = await prisma.$queryRawUnsafe<any[]>(
    category
      ? `SELECT id, "agentId", content, category, metadata, "createdAt", "updatedAt"
         FROM agent_semantic_memory WHERE "agentId" = $1 AND category = $2
         ORDER BY "createdAt" DESC LIMIT $3`
      : `SELECT id, "agentId", content, category, metadata, "createdAt", "updatedAt"
         FROM agent_semantic_memory WHERE "agentId" = $1
         ORDER BY "createdAt" DESC LIMIT $2`,
    ...(category ? [agentId, category, limit] : [agentId, limit])
  );

  return results;
}

export async function deleteSemanticMemory(id: string, agentId?: string): Promise<void> {
  if (agentId) {
    const rows = await prisma.$queryRawUnsafe<any[]>(
      `SELECT id FROM agent_semantic_memory WHERE id = $1 AND "agentId" = $2`, id, agentId
    );
    if (!rows.length) throw new Error('Memory not found');
  }
  await prisma.$queryRawUnsafe(`DELETE FROM agent_semantic_memory WHERE id = $1`, id);
}

// ── Retrieval: Assemble relevant memories for an agent run ──

export async function assembleMemoryContext(
  agentId: string,
  taskContext?: string
): Promise<MemoryContext> {
  const [working, shortTerm, longTerm, episodic] = await Promise.all([
    getWorkingMemory(agentId),
    getShortTermMemories(agentId, undefined, 10),
    getLongTermMemories(agentId, undefined, 10),
    getEpisodicMemories(agentId, undefined, 5),
  ]);

  let semantic: any[] = [];
  if (taskContext) {
    try {
      semantic = await searchSemanticMemory(agentId, taskContext, 5, 0.25);
    } catch {
      // semantic search may fail if no AI service
    }
  }

  return {
    working,
    shortTerm: shortTerm.map(m => ({ category: m.category, content: m.content, createdAt: m.createdAt })),
    longTerm: longTerm.map(m => ({ category: m.category, pattern: m.pattern, confidence: m.confidence })),
    episodic: episodic.map(m => ({ eventType: m.eventType, title: m.title, description: m.description, occurredAt: m.occurredAt })),
    semantic: semantic.map(m => ({ content: m.content, category: m.category, similarity: m.similarity })),
  };
}

export function formatMemoryForPrompt(memory: MemoryContext): string {
  const sections: string[] = [];

  if (memory.working) {
    sections.push(`## Active Context\n${JSON.stringify(memory.working, null, 2)}`);
  }

  if (memory.shortTerm.length > 0) {
    const items = memory.shortTerm
      .map(m => `- [${m.category}] ${m.content}`)
      .join('\n');
    sections.push(`## Recent Context (Last 48h)\n${items}`);
  }

  if (memory.longTerm.length > 0) {
    const items = memory.longTerm
      .map(m => `- [${m.category}] ${m.pattern} (confidence: ${(m.confidence * 100).toFixed(0)}%)`)
      .join('\n');
    sections.push(`## Learned Patterns\n${items}`);
  }

  if (memory.episodic.length > 0) {
    const items = memory.episodic
      .map(m => `- [${m.eventType}] ${m.title}: ${m.description} (${new Date(m.occurredAt).toLocaleDateString()})`)
      .join('\n');
    sections.push(`## Notable Events\n${items}`);
  }

  if (memory.semantic.length > 0) {
    const items = memory.semantic
      .map(m => `- [${m.category}] ${m.content}`)
      .join('\n');
    sections.push(`## Relevant Knowledge\n${items}`);
  }

  if (sections.length === 0) return '';

  return `\n\n--- AGENT MEMORY ---\n${sections.join('\n\n')}\n--- END MEMORY ---\n`;
}

export async function storeRunMemories(
  agentId: string,
  runResult: { status: string; outputSummary: string; duration: number; error?: string }
): Promise<void> {
  try {
    const summary = runResult.status === 'success'
      ? `Run completed in ${(runResult.duration / 1000).toFixed(1)}s. Output: ${runResult.outputSummary.substring(0, 300)}`
      : `Run failed after ${(runResult.duration / 1000).toFixed(1)}s. Error: ${runResult.error || 'Unknown'}`;

    await addShortTermMemory(agentId, 'run_result', summary, {
      status: runResult.status,
      duration: runResult.duration,
    });

    if (runResult.status === 'error' && runResult.error) {
      await addEpisodicMemory(
        agentId,
        'failure',
        `Run failure: ${runResult.error.substring(0, 100)}`,
        `Agent run failed with error: ${runResult.error}`,
        'negative'
      );
    }
  } catch (err) {
    console.error(`[AgentMemory] Failed to store run memories:`, err);
  }
}

// ── Get all memories for admin UI ──

export async function getAllMemories(agentId: string): Promise<{
  working: any | null;
  shortTerm: any[];
  longTerm: any[];
  episodic: any[];
  semantic: any[];
}> {
  const [working, shortTerm, longTerm, episodic, semantic] = await Promise.all([
    getWorkingMemory(agentId),
    getShortTermMemories(agentId, undefined, 50),
    getLongTermMemories(agentId, undefined, 50),
    getEpisodicMemories(agentId, undefined, 50),
    getSemanticMemories(agentId, undefined, 50),
  ]);

  return { working, shortTerm, longTerm, episodic, semantic };
}
