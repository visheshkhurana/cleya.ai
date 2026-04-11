"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.supabaseInsert = supabaseInsert;
exports.supabaseSelect = supabaseSelect;
exports.supabaseUpdate = supabaseUpdate;
exports.supabaseUpsert = supabaseUpsert;
exports.supabaseRpc = supabaseRpc;
const client_1 = require("@prisma/client");
const prisma = new client_1.PrismaClient();
function castPlaceholder(col, idx, value) {
    const tsColumns = ['created_at', 'updated_at', 'last_run_at', 'scheduled_for', 'executed_at', 'occurredAt', 'expiresAt', 'scheduled_time', 'published_at', 'decided_at', 'resolved_at', 'started_at', 'ended_at', 'last_contacted_at', 'next_follow_up', 'completed_at'];
    if (tsColumns.includes(col))
        return `$${idx}::timestamptz`;
    const jsonColumns = ['details', 'metadata', 'data', 'guardrails', 'risk_factors', 'publish_result', 'output'];
    if (jsonColumns.includes(col) && typeof value === 'object' && value !== null)
        return `$${idx}::jsonb`;
    return `$${idx}`;
}
function prepareValue(col, value) {
    const jsonColumns = ['details', 'metadata', 'data', 'guardrails', 'risk_factors', 'publish_result', 'output'];
    if (jsonColumns.includes(col) && typeof value === 'object' && value !== null) {
        return JSON.stringify(value);
    }
    if (Array.isArray(value)) {
        return value;
    }
    return value;
}
async function supabaseInsert(table, data) {
    const columns = Object.keys(data);
    const values = columns.map(col => prepareValue(col, data[col]));
    const placeholders = columns.map((col, i) => castPlaceholder(col, i + 1, data[col]));
    const query = `INSERT INTO "${table}" (${columns.map(c => `"${c}"`).join(', ')}) VALUES (${placeholders.join(', ')}) RETURNING *`;
    const result = await prisma.$queryRawUnsafe(query, ...values);
    return (Array.isArray(result) ? result : [result]);
}
async function supabaseSelect(table, filters, options) {
    let query = `SELECT ${options?.select || '*'} FROM "${table}"`;
    const values = [];
    if (filters && Object.keys(filters).length > 0) {
        const conditions = Object.entries(filters).map(([key, value], i) => {
            values.push(value);
            return `"${key}" = $${i + 1}`;
        });
        query += ` WHERE ${conditions.join(' AND ')}`;
    }
    if (options?.order) {
        const [col, dir] = options.order.split('.');
        query += ` ORDER BY "${col}" ${dir === 'desc' ? 'DESC' : 'ASC'}`;
    }
    if (options?.limit) {
        query += ` LIMIT ${options.limit}`;
    }
    const result = await prisma.$queryRawUnsafe(query, ...values);
    return (Array.isArray(result) ? result : []);
}
async function supabaseUpdate(table, filters, data) {
    const setCols = Object.keys(data);
    const setValues = setCols.map(col => prepareValue(col, data[col]));
    const setClause = setCols.map((col, i) => `"${col}" = ${castPlaceholder(col, i + 1, data[col])}`).join(', ');
    const filterEntries = Object.entries(filters);
    const whereClause = filterEntries
        .map(([key, value], i) => {
        setValues.push(value);
        return `"${key}" = $${setCols.length + i + 1}`;
    })
        .join(' AND ');
    const query = `UPDATE "${table}" SET ${setClause} WHERE ${whereClause}`;
    await prisma.$queryRawUnsafe(query, ...setValues);
}
async function supabaseUpsert(table, data, onConflict) {
    const columns = Object.keys(data);
    const values = Object.values(data);
    const placeholders = columns.map((_, i) => `$${i + 1}`);
    const updateCols = columns
        .filter(c => c !== onConflict)
        .map(c => `"${c}" = EXCLUDED."${c}"`)
        .join(', ');
    const query = `INSERT INTO "${table}" (${columns.map(c => `"${c}"`).join(', ')}) VALUES (${placeholders.join(', ')}) ON CONFLICT ("${onConflict}") DO UPDATE SET ${updateCols} RETURNING *`;
    const result = await prisma.$queryRawUnsafe(query, ...values);
    return (Array.isArray(result) ? result : [result]);
}
async function supabaseRpc(functionName, params) {
    console.log(`[supabaseRpc] Function ${functionName} called with params:`, params);
    return {};
}
//# sourceMappingURL=supabaseClient.js.map