"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.ensureContactListTables = ensureContactListTables;
exports.createContactList = createContactList;
exports.addToContactList = addToContactList;
exports.getContactLists = getContactLists;
exports.getListContacts = getListContacts;
exports.importListToCampaign = importListToCampaign;
exports.deleteContactList = deleteContactList;
const db_1 = require("@cleya/db");
async function ensureContactListTables() {
    try {
        await db_1.prisma.$executeRawUnsafe(`
      CREATE TABLE IF NOT EXISTS contact_lists (
        id SERIAL PRIMARY KEY,
        list_id TEXT UNIQUE NOT NULL,
        name TEXT NOT NULL,
        description TEXT DEFAULT '',
        tags TEXT[] DEFAULT '{}',
        contact_count INTEGER DEFAULT 0,
        created_by TEXT DEFAULT 'system',
        created_at TIMESTAMPTZ DEFAULT now(),
        updated_at TIMESTAMPTZ DEFAULT now()
      );
    `);
        await db_1.prisma.$executeRawUnsafe(`
      CREATE TABLE IF NOT EXISTS contact_list_entries (
        id SERIAL PRIMARY KEY,
        list_id TEXT NOT NULL,
        email TEXT NOT NULL,
        first_name TEXT DEFAULT '',
        last_name TEXT DEFAULT '',
        company TEXT DEFAULT '',
        role TEXT DEFAULT '',
        phone TEXT DEFAULT '',
        linkedin_url TEXT DEFAULT '',
        tags TEXT[] DEFAULT '{}',
        custom_fields JSONB DEFAULT '{}',
        source TEXT DEFAULT 'manual',
        created_at TIMESTAMPTZ DEFAULT now(),
        UNIQUE(list_id, email)
      );
    `);
        await db_1.prisma.$executeRawUnsafe(`CREATE INDEX IF NOT EXISTS idx_contact_list_entries_list ON contact_list_entries(list_id);`);
        await db_1.prisma.$executeRawUnsafe(`CREATE INDEX IF NOT EXISTS idx_contact_list_entries_email ON contact_list_entries(email);`);
        console.log('[ContactList] Tables ensured');
    }
    catch (err) {
        console.log(`[ContactList] Could not create tables: ${err.message}`);
    }
}
function generateListId() {
    return `list_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
}
async function createContactList(params) {
    const listId = generateListId();
    try {
        await db_1.prisma.$executeRawUnsafe(`INSERT INTO contact_lists (list_id, name, description, tags) VALUES ($1, $2, $3, $4::text[])`, listId, params.name, params.description || '', params.tags || []);
        return { success: true, listId, name: params.name, message: `Contact list "${params.name}" created.` };
    }
    catch (err) {
        return { success: false, error: err.message };
    }
}
async function addToContactList(params) {
    try {
        const lists = await db_1.prisma.$queryRawUnsafe(`SELECT list_id FROM contact_lists WHERE list_id = $1`, params.listId);
        if (!lists.length)
            return { success: false, error: 'Contact list not found' };
        let added = 0;
        let skipped = 0;
        for (const c of params.contacts) {
            try {
                await db_1.prisma.$executeRawUnsafe(`INSERT INTO contact_list_entries (list_id, email, first_name, last_name, company, role, phone, linkedin_url, tags, custom_fields)
           VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9::text[], $10::jsonb)
           ON CONFLICT (list_id, email) DO UPDATE SET
             first_name = COALESCE(NULLIF(EXCLUDED.first_name, ''), contact_list_entries.first_name),
             last_name = COALESCE(NULLIF(EXCLUDED.last_name, ''), contact_list_entries.last_name),
             company = COALESCE(NULLIF(EXCLUDED.company, ''), contact_list_entries.company),
             role = COALESCE(NULLIF(EXCLUDED.role, ''), contact_list_entries.role),
             phone = COALESCE(NULLIF(EXCLUDED.phone, ''), contact_list_entries.phone),
             linkedin_url = COALESCE(NULLIF(EXCLUDED.linkedin_url, ''), contact_list_entries.linkedin_url)`, params.listId, c.email.toLowerCase().trim(), c.firstName || '', c.lastName || '', c.company || '', c.role || '', c.phone || '', c.linkedinUrl || '', c.tags || [], JSON.stringify(c.customFields || {}));
                added++;
            }
            catch {
                skipped++;
            }
        }
        await db_1.prisma.$executeRawUnsafe(`UPDATE contact_lists SET contact_count = (SELECT COUNT(*) FROM contact_list_entries WHERE list_id = $1), updated_at = now() WHERE list_id = $1`, params.listId);
        return { success: true, added, skipped, listId: params.listId };
    }
    catch (err) {
        return { success: false, error: err.message };
    }
}
async function getContactLists(tag) {
    try {
        let query = `SELECT list_id, name, description, tags, contact_count, created_by, created_at, updated_at FROM contact_lists`;
        const queryParams = [];
        if (tag) {
            query += ` WHERE $1 = ANY(tags)`;
            queryParams.push(tag);
        }
        query += ` ORDER BY created_at DESC`;
        const lists = await db_1.prisma.$queryRawUnsafe(query, ...queryParams);
        return { success: true, lists, total: lists.length };
    }
    catch (err) {
        return { success: false, error: err.message };
    }
}
async function getListContacts(params) {
    const limit = params.limit || 100;
    const offset = params.offset || 0;
    try {
        const contacts = await db_1.prisma.$queryRawUnsafe(`SELECT id, email, first_name, last_name, company, role, phone, linkedin_url, tags, custom_fields, source, created_at
       FROM contact_list_entries WHERE list_id = $1 ORDER BY created_at DESC LIMIT $2 OFFSET $3`, params.listId, limit, offset);
        return { success: true, contacts, count: contacts.length, listId: params.listId };
    }
    catch (err) {
        return { success: false, error: err.message };
    }
}
async function importListToCampaign(params) {
    try {
        const contacts = await db_1.prisma.$queryRawUnsafe(`SELECT email, first_name, last_name, company, role FROM contact_list_entries WHERE list_id = $1`, params.listId);
        if (!contacts.length)
            return { success: false, error: 'Contact list is empty' };
        const unsubs = await db_1.prisma.$queryRawUnsafe(`SELECT email FROM outreach_unsubscribes`);
        const unsubSet = new Set(unsubs.map((u) => u.email.toLowerCase()));
        let imported = 0;
        let skippedUnsub = 0;
        let skippedDupe = 0;
        for (const c of contacts) {
            if (unsubSet.has(c.email.toLowerCase())) {
                skippedUnsub++;
                continue;
            }
            try {
                await db_1.prisma.$executeRawUnsafe(`INSERT INTO outreach_recipients (campaign_id, email, first_name, last_name, company, role)
           VALUES ($1, $2, $3, $4, $5, $6)
           ON CONFLICT DO NOTHING`, params.campaignId, c.email.toLowerCase().trim(), c.first_name || '', c.last_name || '', c.company || '', c.role || '');
                imported++;
            }
            catch {
                skippedDupe++;
            }
        }
        await db_1.prisma.$executeRawUnsafe(`UPDATE outreach_campaigns SET total_recipients = (SELECT COUNT(*) FROM outreach_recipients WHERE campaign_id = $1), updated_at = now() WHERE campaign_id = $1`, params.campaignId);
        return { success: true, imported, skippedUnsub, skippedDupe, campaignId: params.campaignId, listId: params.listId };
    }
    catch (err) {
        return { success: false, error: err.message };
    }
}
async function deleteContactList(listId) {
    try {
        await db_1.prisma.$executeRawUnsafe(`DELETE FROM contact_list_entries WHERE list_id = $1`, listId);
        await db_1.prisma.$executeRawUnsafe(`DELETE FROM contact_lists WHERE list_id = $1`, listId);
        return { success: true, listId, message: `Contact list ${listId} deleted.` };
    }
    catch (err) {
        return { success: false, error: err.message };
    }
}
//# sourceMappingURL=contactListService.js.map