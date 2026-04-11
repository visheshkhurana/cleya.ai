"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.agentScheduler = void 0;
const node_cron_1 = __importDefault(require("node-cron"));
const agentRunner_1 = require("./agentRunner");
const supabaseClient_1 = require("./supabaseClient");
const publishingService_1 = require("./publishingService");
const founderModeService_1 = require("./founderModeService");
const agentNotifier_1 = require("./agentNotifier");
const founderSafetyService_1 = require("./founderSafetyService");
const modelRouter_1 = require("./modelRouter");
const seoAutomation_1 = require("./seoAutomation");
const qaAutomation_1 = require("./qaAutomation");
const autonomousWorkflows_1 = require("./autonomousWorkflows");
const ORCHESTRATOR_SUB_AGENT_MAP = {
    mavenTasks: 'maven',
    ledgerTasks: 'ledger',
    sentinelTasks: 'sentinel',
    allyTasks: 'ally',
    catalystTasks: 'catalyst',
    closerTasks: 'closer',
    outreachTasks: 'outreach',
};
class AgentScheduler {
    tasks = [];
    started = false;
    running = new Set();
    getScheduleInfo() {
        const statuses = (0, agentRunner_1.getAgentStatuses)();
        const info = {};
        for (const s of statuses) {
            if (s.cronExpression) {
                info[s.agentId] = s.nextRunAt || s.cronExpression;
            }
        }
        return info;
    }
    async start() {
        if (this.started) {
            console.log('[AgentScheduler] Already started, skipping');
            return;
        }
        await (0, agentRunner_1.hydrateAgentStatesFromDB)();
        await (0, founderSafetyService_1.ensureSafetyTables)();
        const statuses = (0, agentRunner_1.getAgentStatuses)();
        for (const agent of statuses) {
            if (!agent.cronExpression)
                continue;
            try {
                if (!node_cron_1.default.validate(agent.cronExpression)) {
                    console.log(`[AgentScheduler] Invalid cron for ${agent.agentId}: ${agent.cronExpression}`);
                    continue;
                }
                const task = node_cron_1.default.schedule(agent.cronExpression, () => {
                    if (!(0, agentRunner_1.isAgentEnabled)(agent.agentId)) {
                        console.log(`[AgentScheduler] ${agent.agentId} is disabled, skipping scheduled run`);
                        return;
                    }
                    this.executeAgent(agent.agentId).catch(err => console.error(`[AgentScheduler] ${agent.agentId} execution failed:`, err));
                }, { timezone: 'Asia/Kolkata' });
                this.tasks.push(task);
                if (agent.enabled) {
                    (0, agentRunner_1.setAgentScheduleStatus)(agent.agentId, 'scheduled');
                }
                console.log(`[AgentScheduler] Scheduled ${agent.agentId}: ${agent.cronExpression} (${agent.enabled ? 'enabled' : 'disabled'})`);
            }
            catch (err) {
                console.log(`[AgentScheduler] Failed to schedule ${agent.agentId}: ${err.message}`);
            }
        }
        const taskProcessingJob = node_cron_1.default.schedule('0 */4 * * *', () => {
            this.processAllTasks().catch(err => console.error('[AgentScheduler] Task processing failed:', err));
        }, { timezone: 'Asia/Kolkata' });
        this.tasks.push(taskProcessingJob);
        const contentCalendarJob = node_cron_1.default.schedule('*/15 * * * *', () => {
            this.processContentCalendarCron().catch(err => console.error('[AgentScheduler] Content calendar processing failed:', err));
        }, { timezone: 'Asia/Kolkata' });
        this.tasks.push(contentCalendarJob);
        const dailyBriefingJob = node_cron_1.default.schedule('0 8 * * *', () => {
            this.sendDailyBriefing().catch(err => console.error('[AgentScheduler] Daily briefing failed:', err));
        }, { timezone: 'Asia/Kolkata' });
        this.tasks.push(dailyBriefingJob);
        const escalationJob = node_cron_1.default.schedule('*/30 * * * *', () => {
            (0, founderSafetyService_1.processEscalations)().catch(err => console.error('[AgentScheduler] Escalation check failed:', err));
        }, { timezone: 'Asia/Kolkata' });
        this.tasks.push(escalationJob);
        console.log('[AgentScheduler] Escalation check scheduled every 30 minutes');
        const dailyAuditJob = node_cron_1.default.schedule('0 22 * * *', () => {
            (0, founderSafetyService_1.sendDailyAuditDigest)().catch(err => console.error('[AgentScheduler] Daily audit digest failed:', err));
        }, { timezone: 'Asia/Kolkata' });
        this.tasks.push(dailyAuditJob);
        console.log('[AgentScheduler] Daily audit digest scheduled at 10 PM IST');
        const weeklyReportJob = node_cron_1.default.schedule('0 7 * * 1', () => {
            (0, founderSafetyService_1.sendWeeklyPerformanceReport)().catch(err => console.error('[AgentScheduler] Weekly performance report failed:', err));
        }, { timezone: 'Asia/Kolkata' });
        this.tasks.push(weeklyReportJob);
        console.log('[AgentScheduler] Weekly performance report scheduled for Monday 7 AM IST');
        // Maven autonomous content posting — 3x daily (9 AM, 1 PM, 6 PM IST)
        const mavenMorningJob = node_cron_1.default.schedule('30 3 * * *', () => {
            if (!(0, agentRunner_1.isAgentEnabled)('maven'))
                return;
            this.runAutonomousWorkflow('maven', 'Morning Insight post', () => (0, autonomousWorkflows_1.runMavenContentPost)('morning'))
                .catch(err => console.error('[AgentScheduler] Maven morning post failed:', err));
        }, { timezone: 'UTC' });
        this.tasks.push(mavenMorningJob);
        const mavenAfternoonJob = node_cron_1.default.schedule('30 7 * * *', () => {
            if (!(0, agentRunner_1.isAgentEnabled)('maven'))
                return;
            this.runAutonomousWorkflow('maven', 'Founder Spotlight post', () => (0, autonomousWorkflows_1.runMavenContentPost)('afternoon'))
                .catch(err => console.error('[AgentScheduler] Maven afternoon post failed:', err));
        }, { timezone: 'UTC' });
        this.tasks.push(mavenAfternoonJob);
        const mavenEveningJob = node_cron_1.default.schedule('30 12 * * *', () => {
            if (!(0, agentRunner_1.isAgentEnabled)('maven'))
                return;
            this.runAutonomousWorkflow('maven', 'Evening Engagement post', () => (0, autonomousWorkflows_1.runMavenContentPost)('evening'))
                .catch(err => console.error('[AgentScheduler] Maven evening post failed:', err));
        }, { timezone: 'UTC' });
        this.tasks.push(mavenEveningJob);
        console.log('[AgentScheduler] Maven autonomous content posting: 9 AM, 1 PM, 6 PM IST');
        // Ad Campaign Automation — every 6 hours (2 AM, 8 AM, 2 PM, 8 PM IST)
        const adCampaignJob = node_cron_1.default.schedule('30 */6 * * *', () => {
            if (!(0, agentRunner_1.isAgentEnabled)('ledger'))
                return;
            this.runAutonomousWorkflow('ledger', 'Ad campaign automation', autonomousWorkflows_1.runAdCampaignAutomation)
                .catch(err => console.error('[AgentScheduler] Ad campaign automation failed:', err));
        }, { timezone: 'Asia/Kolkata' });
        this.tasks.push(adCampaignJob);
        console.log('[AgentScheduler] Ad campaign automation scheduled every 6 hours');
        this.started = true;
        console.log('[AgentScheduler] All agent schedules initialized');
        console.log('[AgentScheduler] Task processing scheduled every 4 hours');
        console.log('[AgentScheduler] Content calendar processor running every 15 minutes');
        console.log('[AgentScheduler] Daily briefing scheduled at 8:00 AM IST');
    }
    stop() {
        this.tasks.forEach(t => t.stop());
        this.tasks = [];
        this.started = false;
        console.log('[AgentScheduler] All scheduled agent tasks stopped');
    }
    async reload() {
        console.log('[AgentScheduler] Reloading schedules from database...');
        this.stop();
        await this.start();
    }
    async executeAgent(agentId, taskContext) {
        if (this.running.has(agentId)) {
            console.log(`[AgentScheduler] ${agentId} already running, skipping`);
            return { skipped: true };
        }
        const crisisActive = await (0, founderSafetyService_1.isCrisisModeActive)();
        if (crisisActive) {
            console.log(`[AgentScheduler] ${agentId} blocked — crisis mode is active`);
            return { blocked: true, reason: 'crisis_mode' };
        }
        this.running.add(agentId);
        try {
            const tasksProcessed = await (0, agentRunner_1.processAgentTasks)(agentId);
            if (tasksProcessed > 0) {
                console.log(`[AgentScheduler] Processed ${tasksProcessed} tasks for ${agentId}`);
            }
            const result = await (0, agentRunner_1.runAgent)(agentId, taskContext);
            if (agentId === 'nexus' && result.status === 'success') {
                await this.handleOrchestratorDelegation(result.fullOutput || result.outputSummary);
            }
            // Scout: run the daily SEO automation pipeline after the LLM run
            if (agentId === 'scout') {
                try {
                    console.log('[AgentScheduler] Running Scout daily SEO automation pipeline...');
                    const seoReport = await (0, seoAutomation_1.runDailySEORoutine)();
                    console.log(`[AgentScheduler] Scout SEO pipeline completed (${seoReport.length} chars)`);
                    // Log the SEO routine as a separate action
                    await (0, supabaseClient_1.supabaseInsert)('dm_agent_logs', {
                        agent_id: 'scout',
                        action: 'Daily SEO automation pipeline',
                        details: {
                            report_length: seoReport.length,
                            report_preview: seoReport.substring(0, 500),
                        },
                        status: 'success',
                        created_at: new Date().toISOString(),
                    });
                }
                catch (seoErr) {
                    console.error('[AgentScheduler] Scout SEO pipeline failed:', seoErr.message);
                    await (0, supabaseClient_1.supabaseInsert)('dm_agent_logs', {
                        agent_id: 'scout',
                        action: 'Daily SEO automation pipeline failed',
                        details: { error: seoErr.message },
                        status: 'error',
                        created_at: new Date().toISOString(),
                    }).catch(() => { });
                }
            }
            // Probe: run the daily QA automation pipeline after the LLM run
            if (agentId === 'probe') {
                try {
                    console.log('[AgentScheduler] Running Probe daily QA automation pipeline...');
                    const qaResult = await (0, qaAutomation_1.runDailyQARoutine)();
                    console.log(`[AgentScheduler] Probe QA pipeline completed — ${qaResult.results.length} tests run`);
                    await (0, supabaseClient_1.supabaseInsert)('dm_agent_logs', {
                        agent_id: 'probe',
                        action: 'Daily QA automation pipeline',
                        details: {
                            total_tests: qaResult.results.length,
                            passed: qaResult.results.filter((r) => r.status === 'pass').length,
                            failed: qaResult.results.filter((r) => r.status === 'fail').length,
                            warnings: qaResult.results.filter((r) => r.status === 'warning').length,
                            summary: qaResult.summary,
                        },
                        status: qaResult.results.some((r) => r.status === 'fail') ? 'warning' : 'success',
                        created_at: new Date().toISOString(),
                    });
                }
                catch (qaErr) {
                    console.error('[AgentScheduler] Probe QA pipeline failed:', qaErr.message);
                    await (0, supabaseClient_1.supabaseInsert)('dm_agent_logs', {
                        agent_id: 'probe',
                        action: 'Daily QA automation pipeline failed',
                        details: { error: qaErr.message },
                        status: 'error',
                        created_at: new Date().toISOString(),
                    }).catch(() => { });
                }
            }
            // Nexus: run daily operations brief after the LLM run
            if (agentId === 'nexus') {
                await this.runAutonomousWorkflow('nexus', 'Daily operations brief', autonomousWorkflows_1.runNexusDailyBrief);
            }
            // Ledger: run daily financial monitor + ad campaign automation after the LLM run
            if (agentId === 'ledger') {
                await this.runAutonomousWorkflow('ledger', 'Daily financial monitor', autonomousWorkflows_1.runLedgerFinancialMonitor);
                await this.runAutonomousWorkflow('ledger', 'Ad campaign automation', autonomousWorkflows_1.runAdCampaignAutomation);
                // Weekly review on Mondays
                if (new Date().getDay() === 1) {
                    await this.runAutonomousWorkflow('ledger', 'Weekly budget review', autonomousWorkflows_1.runLedgerWeeklyReview);
                }
            }
            // Sentinel: run system health check after the LLM run
            if (agentId === 'sentinel') {
                await this.runAutonomousWorkflow('sentinel', 'System health check', autonomousWorkflows_1.runSentinelHealthCheck);
            }
            // Ally: run member engagement check after the LLM run
            if (agentId === 'ally') {
                await this.runAutonomousWorkflow('ally', 'Member engagement check', autonomousWorkflows_1.runAllyEngagementCheck);
            }
            // Catalyst: run growth analysis after the LLM run
            if (agentId === 'catalyst') {
                await this.runAutonomousWorkflow('catalyst', 'Daily growth analysis', autonomousWorkflows_1.runCatalystGrowthAnalysis);
                // Weekly review on Wednesdays
                if (new Date().getDay() === 3) {
                    await this.runAutonomousWorkflow('catalyst', 'Weekly growth review', autonomousWorkflows_1.runCatalystWeeklyReview);
                }
            }
            // Closer: run sales pipeline after the LLM run
            if (agentId === 'closer') {
                await this.runAutonomousWorkflow('closer', 'Sales pipeline analysis', autonomousWorkflows_1.runCloserSalesPipeline);
            }
            return result;
        }
        finally {
            this.running.delete(agentId);
        }
    }
    async runAutonomousWorkflow(agentId, actionName, workflowFn) {
        try {
            console.log(`[AgentScheduler] Running ${agentId} autonomous workflow: ${actionName}...`);
            const result = await workflowFn();
            console.log(`[AgentScheduler] ${agentId} ${actionName} completed (${result.length} chars)`);
            await (0, supabaseClient_1.supabaseInsert)('dm_agent_logs', {
                agent_id: agentId,
                action: actionName,
                details: {
                    result_length: result.length,
                    result_preview: result.substring(0, 500),
                },
                status: 'success',
                created_at: new Date().toISOString(),
            });
        }
        catch (err) {
            console.error(`[AgentScheduler] ${agentId} ${actionName} failed:`, err.message);
            await (0, supabaseClient_1.supabaseInsert)('dm_agent_logs', {
                agent_id: agentId,
                action: `${actionName} failed`,
                details: { error: err.message },
                status: 'error',
                created_at: new Date().toISOString(),
            }).catch(() => { });
        }
    }
    async handleOrchestratorDelegation(output) {
        console.log('[AgentScheduler] Orchestrator completed, parsing delegation plan...');
        try {
            let plan;
            try {
                const jsonMatch = output.match(/\{[\s\S]*\}/);
                if (!jsonMatch) {
                    const fullLogs = await (0, supabaseClient_1.supabaseSelect)('dm_content_queue', {
                        agent_id: 'nexus',
                    }, { order: 'created_at.desc', limit: 1 });
                    if (fullLogs.length > 0) {
                        const bodyMatch = fullLogs[0].body.match(/\{[\s\S]*\}/);
                        if (bodyMatch) {
                            plan = JSON.parse(bodyMatch[0]);
                        }
                        else {
                            throw new Error('No JSON found in orchestrator output');
                        }
                    }
                    else {
                        throw new Error('No orchestrator output found');
                    }
                }
                else {
                    plan = JSON.parse(jsonMatch[0]);
                }
            }
            catch (parseErr) {
                console.log(`[AgentScheduler] Could not parse orchestrator JSON: ${parseErr.message}`);
                console.log('[AgentScheduler] Falling back to triggering all sub-agents...');
                const subAgents = Object.values(ORCHESTRATOR_SUB_AGENT_MAP);
                for (const subId of subAgents) {
                    if ((0, agentRunner_1.isAgentEnabled)(subId)) {
                        try {
                            await this.executeAgent(subId);
                        }
                        catch (err) {
                            console.error(`[AgentScheduler] Sub-agent ${subId} failed:`, err.message);
                        }
                    }
                }
                return;
            }
            let totalTasksCreated = 0;
            for (const [taskKey, subAgentId] of Object.entries(ORCHESTRATOR_SUB_AGENT_MAP)) {
                const tasks = plan[taskKey];
                if (!Array.isArray(tasks) || tasks.length === 0)
                    continue;
                for (const task of tasks) {
                    try {
                        const platforms = task.platforms || (subAgentId === 'maven' ? ['linkedin', 'instagram'] : []);
                        const contentPillars = task.content_pillars || task.contentPillars || [];
                        const targetDate = task.target_date || task.targetDate || new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString();
                        let assignedModel = task.assignedModel || task.assigned_model;
                        if (!assignedModel) {
                            const taskType = (0, modelRouter_1.inferTaskType)(subAgentId, task.description || task.title);
                            const routing = (0, modelRouter_1.routeModel)({ agentId: subAgentId, taskType });
                            assignedModel = routing.primaryModel;
                        }
                        await (0, supabaseClient_1.supabaseInsert)('dm_agent_tasks', {
                            agent_id: subAgentId,
                            title: task.title || 'Orchestrator-assigned task',
                            description: buildTaskDescription(task, subAgentId, platforms, contentPillars),
                            priority: task.priority || 'medium',
                            assigned_model: assignedModel,
                            status: 'pending',
                            due_date: targetDate,
                            output: {},
                            created_at: new Date().toISOString(),
                        });
                        totalTasksCreated++;
                        console.log(`[AgentScheduler] Task for ${subAgentId}: "${task.title}" → model: ${assignedModel}`);
                    }
                    catch (err) {
                        console.error(`[AgentScheduler] Failed to create task for ${subAgentId}:`, err.message);
                    }
                }
            }
            console.log(`[AgentScheduler] Created ${totalTasksCreated} tasks from orchestrator plan`);
            for (const subAgentId of Object.values(ORCHESTRATOR_SUB_AGENT_MAP)) {
                if ((0, agentRunner_1.isAgentEnabled)(subAgentId)) {
                    try {
                        await this.executeAgent(subAgentId);
                    }
                    catch (err) {
                        console.error(`[AgentScheduler] Sub-agent ${subAgentId} failed:`, err.message);
                    }
                }
            }
        }
        catch (err) {
            console.error('[AgentScheduler] Orchestrator delegation failed:', err.message);
        }
    }
    async processContentCalendarCron() {
        console.log('[AgentScheduler] Running content calendar publish processor...');
        try {
            const result = await (0, publishingService_1.processContentCalendar)();
            if (result.published > 0 || result.failed > 0) {
                console.log(`[AgentScheduler] Content calendar: ${result.published} published, ${result.failed} failed`);
            }
            if (result.errors.length > 0) {
                console.log(`[AgentScheduler] Content calendar errors: ${result.errors.join('; ')}`);
            }
        }
        catch (err) {
            console.error('[AgentScheduler] Content calendar processor error:', err.message);
        }
    }
    async sendDailyBriefing() {
        console.log('[AgentScheduler] Generating daily Nexus briefing...');
        try {
            const briefing = await (0, founderModeService_1.generateDailyBriefing)();
            await (0, agentNotifier_1.sendBriefingNotifications)(briefing);
            console.log('[AgentScheduler] Daily briefing sent successfully');
        }
        catch (err) {
            console.error('[AgentScheduler] Daily briefing failed:', err.message);
        }
    }
    async processAllTasks() {
        console.log('[AgentScheduler] Processing pending tasks for all agents...');
        const agentIds = Object.keys(agentRunner_1.AGENT_DEFINITIONS);
        let totalProcessed = 0;
        for (const agentId of agentIds) {
            if ((0, agentRunner_1.isAgentEnabled)(agentId)) {
                const processed = await (0, agentRunner_1.processAgentTasks)(agentId);
                totalProcessed += processed;
            }
        }
        if (totalProcessed > 0) {
            console.log(`[AgentScheduler] Processed ${totalProcessed} total tasks`);
        }
    }
    isStarted() {
        return this.started;
    }
    isRunning() {
        return this.started;
    }
}
function buildTaskDescription(task, subAgentId, platforms, contentPillars) {
    let description = task.description || '';
    if (subAgentId === 'maven' && platforms.length > 0) {
        description += `\n\nTarget Platforms: ${platforms.join(', ')}`;
    }
    if (contentPillars.length > 0) {
        description += `\nContent Pillars: ${contentPillars.join(', ')}`;
    }
    if (task.channel) {
        description += `\nChannel: ${task.channel}`;
    }
    return description.trim();
}
exports.agentScheduler = new AgentScheduler();
//# sourceMappingURL=agentScheduler.js.map