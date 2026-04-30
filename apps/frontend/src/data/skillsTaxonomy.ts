export const SKILLS_TAXONOMY: string[] = [
  'Product Management', 'Product Strategy', 'Product Marketing', 'Growth', 'Growth Hacking',
  'User Research', 'UX Design', 'UI Design', 'Design Systems', 'Brand Design',
  'Engineering Management', 'Frontend Engineering', 'Backend Engineering', 'Full-Stack Engineering',
  'Mobile Engineering', 'iOS Development', 'Android Development', 'React', 'React Native',
  'Next.js', 'Node.js', 'TypeScript', 'Python', 'Go', 'Rust', 'Java', 'Kotlin', 'Swift',
  'DevOps', 'Site Reliability', 'Cloud Architecture', 'AWS', 'GCP', 'Azure', 'Kubernetes',
  'Data Engineering', 'Data Science', 'Data Analytics', 'SQL', 'Machine Learning',
  'Deep Learning', 'NLP', 'Computer Vision', 'MLOps', 'AI Engineering', 'LLMs',
  'Prompt Engineering', 'RAG Systems', 'Vector Databases',
  'Sales', 'Enterprise Sales', 'Inside Sales', 'SDR', 'Account Management',
  'Business Development', 'Partnerships', 'Channel Sales',
  'Marketing', 'Performance Marketing', 'Content Marketing', 'SEO', 'SEM',
  'Email Marketing', 'Social Media', 'Influencer Marketing', 'PR', 'Brand Strategy',
  'Customer Success', 'Customer Support', 'Onboarding', 'Community Building',
  'Operations', 'Strategy', 'Strategic Planning', 'Business Operations', 'RevOps',
  'Finance', 'Fundraising', 'Venture Capital', 'Private Equity', 'M&A', 'Due Diligence',
  'Financial Modeling', 'FP&A', 'Accounting', 'Tax', 'Compliance',
  'Legal', 'Corporate Law', 'IP Law', 'Contract Negotiation',
  'HR', 'People Operations', 'Recruiting', 'Tech Recruiting', 'Talent Acquisition',
  'Compensation', 'L&D',
  'Manufacturing', 'Supply Chain', 'Logistics', 'Procurement',
  'Hardware', 'Robotics', 'IoT', 'Embedded Systems',
  'Fintech', 'Healthtech', 'Edtech', 'SaaS', 'B2B', 'B2C', 'Marketplace',
  'E-commerce', 'D2C', 'Subscription', 'Enterprise Software',
  'Founding Engineer', 'Founding Designer', 'Founding PM', 'Co-founder',
  'CEO', 'CTO', 'CPO', 'CFO', 'COO', 'CMO', 'CRO', 'VP Engineering', 'VP Product',
  'VP Sales', 'VP Marketing', 'Head of Growth', 'Head of Design',
  'Angel Investing', 'Syndicate Lead', 'Scout', 'Limited Partner',
  'Public Speaking', 'Writing', 'Content Creation', 'Video Production', 'Podcasting',
  'Mentoring', 'Coaching', 'Advising',
];

export function searchSkills(query: string, exclude: string[] = [], limit = 8): string[] {
  const q = query.trim().toLowerCase();
  if (!q) return [];
  const excludeSet = new Set(exclude.map((s) => s.toLowerCase()));
  const startsWith: string[] = [];
  const includes: string[] = [];
  for (const skill of SKILLS_TAXONOMY) {
    if (excludeSet.has(skill.toLowerCase())) continue;
    const lower = skill.toLowerCase();
    if (lower.startsWith(q)) startsWith.push(skill);
    else if (lower.includes(q)) includes.push(skill);
    if (startsWith.length >= limit) break;
  }
  return [...startsWith, ...includes].slice(0, limit);
}
