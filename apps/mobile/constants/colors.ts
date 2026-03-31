export const Colors = {
  background: '#0F172A',
  surface: '#1E293B',
  surfaceLight: '#334155',
  primary: '#0D9488',
  primaryDark: '#0F766E',
  accent: '#2DD4BF',
  accentLight: '#5EEAD4',
  text: '#FFFFFF',
  textSecondary: 'rgba(255,255,255,0.6)',
  textTertiary: 'rgba(255,255,255,0.4)',
  textMuted: 'rgba(255,255,255,0.3)',
  border: 'rgba(255,255,255,0.08)',
  borderLight: 'rgba(255,255,255,0.12)',
  success: '#10B981',
  warning: '#F59E0B',
  error: '#EF4444',
  info: '#3B82F6',
};

export const Gradients = {
  primary: ['#0D9488', '#0F766E'] as const,
  primaryLight: ['#0D9488', '#2DD4BF'] as const,
};

export const personaLabels: Record<string, string> = {
  FOUNDER: 'Founder',
  INVESTOR: 'Investor',
  TALENT: 'Talent',
  DEAL_PARTNER: 'Deal Partner',
  EVENT_PARTICIPANT: 'The Pitch by Deel',
  VENTURE_PARTNER: 'Venture Partner',
  ADVISOR: 'Advisor',
  OPERATOR: 'Operator',
  JOB_SEEKER: 'Job Seeker',
  RECRUITER: 'Recruiter',
  FREELANCER: 'Freelancer',
  OTHER: 'Other',
};

export const industryOptions = [
  'ai_ml', 'fintech', 'saas', 'healthtech', 'edtech', 'e_commerce', 'biotech',
  'cleantech', 'cybersecurity', 'real_estate', 'media', 'gaming', 'logistics',
  'food_beverage', 'enterprise', 'consumer', 'climate', 'other',
];

export function formatIndustry(ind: string): string {
  return ind
    .replace(/_/g, ' ')
    .replace(/\b\w/g, (c) => c.toUpperCase())
    .replace(/\bAi Ml\b/, 'AI/ML')
    .replace(/\bSaas\b/, 'SaaS')
    .replace(/\bE Commerce\b/, 'E-Commerce');
}
