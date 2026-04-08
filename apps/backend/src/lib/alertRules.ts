import { logger } from './logger';
import { sendAlert, AlertSeverity } from './alerting';

interface AlertRule {
  name: string;
  severity: AlertSeverity;
  threshold: number;
  windowMs: number;
  service: string;
  message: string;
}

const ALERT_RULES: AlertRule[] = [
  {
    name: 'critical_errors',
    severity: AlertSeverity.P1_CRITICAL,
    threshold: 10,
    windowMs: 5 * 60 * 1000,
    service: 'api',
    message: 'Critical error rate exceeded: more than 10 errors in 5 minutes',
  },
  {
    name: 'agent_failures',
    severity: AlertSeverity.P2_HIGH,
    threshold: 3,
    windowMs: 10 * 60 * 1000,
    service: 'agent',
    message: 'Agent failure rate exceeded: more than 3 failures in 10 minutes',
  },
  {
    name: 'ai_provider_errors',
    severity: AlertSeverity.P2_HIGH,
    threshold: 5,
    windowMs: 5 * 60 * 1000,
    service: 'ai',
    message: 'AI provider error rate exceeded: more than 5 errors in 5 minutes',
  },
  {
    name: 'database_errors',
    severity: AlertSeverity.P1_CRITICAL,
    threshold: 3,
    windowMs: 5 * 60 * 1000,
    service: 'database',
    message: 'Database error rate exceeded: more than 3 errors in 5 minutes',
  },
];

interface EventRecord {
  timestamp: number;
}

const eventWindows = new Map<string, EventRecord[]>();
const alertCooldowns = new Map<string, number>();
const COOLDOWN_MS = 15 * 60 * 1000;

function pruneWindow(ruleName: string, windowMs: number): EventRecord[] {
  const now = Date.now();
  let events = eventWindows.get(ruleName) || [];
  events = events.filter(e => now - e.timestamp < windowMs);
  eventWindows.set(ruleName, events);
  return events;
}

export function recordEvent(ruleName: string): void {
  const rule = ALERT_RULES.find(r => r.name === ruleName);
  if (!rule) return;

  let events = eventWindows.get(ruleName) || [];
  events.push({ timestamp: Date.now() });
  eventWindows.set(ruleName, events);

  const activeEvents = pruneWindow(ruleName, rule.windowMs);

  if (activeEvents.length >= rule.threshold) {
    const lastAlert = alertCooldowns.get(ruleName) || 0;
    if (Date.now() - lastAlert > COOLDOWN_MS) {
      alertCooldowns.set(ruleName, Date.now());

      sendAlert({
        severity: rule.severity,
        title: `Alert Rule Triggered: ${rule.name}`,
        service: rule.service,
        message: `${rule.message} (${activeEvents.length} events in ${Math.round(rule.windowMs / 60000)} min window)`,
        errorRate: activeEvents.length,
      }).catch(err => {
        logger.error('Failed to send rule-based alert', { rule: ruleName, error: err.message });
      });

      logger.warn(`Alert rule triggered: ${ruleName}`, {
        events: activeEvents.length,
        threshold: rule.threshold,
        windowMs: rule.windowMs,
      });
    }
  }
}

export function getAlertRules() {
  return ALERT_RULES.map(rule => {
    const events = pruneWindow(rule.name, rule.windowMs);
    return {
      ...rule,
      currentCount: events.length,
      triggered: events.length >= rule.threshold,
    };
  });
}
