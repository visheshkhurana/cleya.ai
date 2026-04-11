"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.recordEvent = recordEvent;
exports.getAlertRules = getAlertRules;
const logger_1 = require("./logger");
const alerting_1 = require("./alerting");
const ALERT_RULES = [
    {
        name: 'critical_errors',
        severity: alerting_1.AlertSeverity.P1_CRITICAL,
        threshold: 10,
        windowMs: 5 * 60 * 1000,
        service: 'api',
        message: 'Critical error rate exceeded: more than 10 errors in 5 minutes',
    },
    {
        name: 'agent_failures',
        severity: alerting_1.AlertSeverity.P2_HIGH,
        threshold: 3,
        windowMs: 10 * 60 * 1000,
        service: 'agent',
        message: 'Agent failure rate exceeded: more than 3 failures in 10 minutes',
    },
    {
        name: 'ai_provider_errors',
        severity: alerting_1.AlertSeverity.P2_HIGH,
        threshold: 5,
        windowMs: 5 * 60 * 1000,
        service: 'ai',
        message: 'AI provider error rate exceeded: more than 5 errors in 5 minutes',
    },
    {
        name: 'database_errors',
        severity: alerting_1.AlertSeverity.P1_CRITICAL,
        threshold: 3,
        windowMs: 5 * 60 * 1000,
        service: 'database',
        message: 'Database error rate exceeded: more than 3 errors in 5 minutes',
    },
];
const eventWindows = new Map();
const alertCooldowns = new Map();
const COOLDOWN_MS = 15 * 60 * 1000;
function pruneWindow(ruleName, windowMs) {
    const now = Date.now();
    let events = eventWindows.get(ruleName) || [];
    events = events.filter(e => now - e.timestamp < windowMs);
    eventWindows.set(ruleName, events);
    return events;
}
function recordEvent(ruleName) {
    const rule = ALERT_RULES.find(r => r.name === ruleName);
    if (!rule)
        return;
    let events = eventWindows.get(ruleName) || [];
    events.push({ timestamp: Date.now() });
    eventWindows.set(ruleName, events);
    const activeEvents = pruneWindow(ruleName, rule.windowMs);
    if (activeEvents.length >= rule.threshold) {
        const lastAlert = alertCooldowns.get(ruleName) || 0;
        if (Date.now() - lastAlert > COOLDOWN_MS) {
            alertCooldowns.set(ruleName, Date.now());
            (0, alerting_1.sendAlert)({
                severity: rule.severity,
                title: `Alert Rule Triggered: ${rule.name}`,
                service: rule.service,
                message: `${rule.message} (${activeEvents.length} events in ${Math.round(rule.windowMs / 60000)} min window)`,
                errorRate: activeEvents.length,
            }).catch(err => {
                logger_1.logger.error('Failed to send rule-based alert', { rule: ruleName, error: err.message });
            });
            logger_1.logger.warn(`Alert rule triggered: ${ruleName}`, {
                events: activeEvents.length,
                threshold: rule.threshold,
                windowMs: rule.windowMs,
            });
        }
    }
}
function getAlertRules() {
    return ALERT_RULES.map(rule => {
        const events = pruneWindow(rule.name, rule.windowMs);
        return {
            ...rule,
            currentCount: events.length,
            triggered: events.length >= rule.threshold,
        };
    });
}
//# sourceMappingURL=alertRules.js.map