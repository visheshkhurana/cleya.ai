'use client';
import React, { useState } from 'react';
import { Brain, Lightbulb, Share2, Mail, Target, Globe, Zap, BarChart3, ChevronDown, ChevronRight, Clock, ArrowDown } from 'lucide-react';

type ArchTab = 'overview' | 'agents' | 'channels' | 'workflows' | 'toolstack' | 'kpis';

const AGENTS = [
  { id: 0, name: 'Orchestrator', role: 'Master coordinator & brand guardian', icon: 'Brain', color: 'purple', status: 'Build', trigger: 'Every Monday 8am IST', tools: ['Notion','Google Cal','Slack'], resp: ['Coordinates weekly content calendar across all channels','Enforces brand voice consistency','Manages publishing schedule','Triggers other agents based on calendar','Escalates decisions needing human approval'] },
  { id: 1, name: 'Content Strategist', role: 'Topic research & content calendar', icon: 'Lightbulb', color: 'green', status: 'Build', trigger: 'Every Sunday 6pm IST', tools: ['Notion','Web Search','Google Drive'], resp: ['Researches trending topics in Indian startup ecosystem','Generates weekly content calendar (5 LinkedIn, 3 IG, 1 newsletter, 1 blog)','Maps content to funnel stages','Creates briefs for Social Media and Email agents','Tracks competitor content and identifies gaps'] },
  { id: 2, name: 'Social Media Manager', role: 'LinkedIn & Instagram content + publishing', icon: 'Share2', color: 'blue', status: 'Build', trigger: 'Daily 7am IST + Mon/Wed/Fri 10am', tools: ['Canva','Notion','Web Search'], resp: ['Writes LinkedIn posts (thought leadership, founder stories)','Creates Instagram captions and carousel copy','Designs graphics via Canva','Schedules posts at optimal IST times','Monitors engagement and suggests replies'] },
  { id: 3, name: 'Email Marketing', role: 'Newsletters, drips & list management', icon: 'Mail', color: 'orange', status: 'Build', trigger: 'Wednesday 9am IST + automated drips', tools: ['MailerLite','Canva','Notion'], resp: ['Creates weekly newsletter for Cleya.ai community','Manages MailerLite segments (Founders, Investors, Operators)','Builds drip sequences for each ICP','A/B tests subject lines and formats','Manages signup forms and landing pages'] },
  { id: 4, name: 'Cold Outreach', role: 'Lead sourcing & multi-channel sequences', icon: 'Target', color: 'pink', status: 'Build', trigger: 'Daily 10am IST + Weekly Monday', tools: ['Lemlist','Gmail','Notion'], resp: ['Sources leads matching Cleya ICP','Enriches leads via Lemlist (email, LinkedIn, phone)','Creates personalized outreach sequences','Manages campaign performance','Pushes warm leads to MailerLite'] },
  { id: 5, name: 'SEO / GEO Optimizer', role: 'Search visibility + AI citability', icon: 'Globe', color: 'yellow', status: 'Plan', trigger: 'Bi-weekly audit + on publish', tools: ['Web Search','Vercel','Supabase','Notion'], resp: ['Audits cleya.ai for SEO fundamentals','Optimizes for AI search citability (GEO)','Researches keywords for Indian startup space','Creates SEO-optimized blog posts','Monitors rankings and AI mentions'] },
  { id: 6, name: 'Paid Ads Manager', role: 'LinkedIn Ads + Meta Ads optimization', icon: 'Zap', color: 'cyan', status: 'Plan', trigger: 'Daily optimization + weekly refresh', tools: ['Canva','Web Search','Notion'], resp: ['Creates LinkedIn ad campaigns','Creates Meta ad campaigns','Generates ad copy and creative briefs','Optimizes bidding and targeting','Reports on CAC, ROAS, conversions'] },
  { id: 7, name: 'Analytics & Reporting', role: 'Cross-channel performance tracking', icon: 'BarChart3', color: 'purple', status: 'Build', trigger: 'Friday 5pm IST + Monthly 1st', tools: ['MailerLite','Lemlist','Notion','Slack'], resp: ['Pulls metrics from all channels','Generates weekly performance dashboard','Identifies underperforming channels','Tracks full funnel metrics','Sends weekly summary to Slack'] },
];
const WORKFLOWS = [
  { name: 'Weekly Content Planning', freq: 'Sunday 6pm', agent: 'Content Strategist', actions: 'Research trends > Generate calendar > Create briefs > Notify Orchestrator', status: 'Build' },
  { name: 'Daily Social Media Drafts', freq: 'Daily 7am', agent: 'Social Media', actions: 'Read calendar > Write copy > Generate graphic > Save draft', status: 'Build' },
  { name: 'Newsletter Creation', freq: 'Wednesday 9am', agent: 'Email Marketing', actions: 'Curate content > Write newsletter > Create campaign > Schedule', status: 'Build' },
  { name: 'Outreach Campaign Check', freq: 'Daily 10am', agent: 'Cold Outreach', actions: 'Check stats > Pause underperforming > Adjust > Report', status: 'Build' },
  { name: 'New Lead Campaigns', freq: 'Monday 11am', agent: 'Cold Outreach', actions: 'Source leads > Enrich data > Create sequences > Launch', status: 'Build' },
  { name: 'Weekly Performance Report', freq: 'Friday 5pm', agent: 'Analytics', actions: 'Pull metrics > Generate dashboard > Identify wins > Post to Slack', status: 'Build' },
  { name: 'SEO/GEO Audit', freq: 'Bi-weekly Mon 2pm', agent: 'SEO/GEO', actions: 'Run audit > Check rankings > Update schema > Report', status: 'Plan' },
];

const CHANNELS = [
  { name: 'LinkedIn', sub: '5 posts/week', color: 'blue', items: ['Mon: Matching Monday insight','Tue: Founder spotlight','Wed: Educational carousel','Thu: Industry data/trend','Fri: Founder Friday Q&A'] },
  { name: 'Instagram', sub: '3 posts/week + daily stories', color: 'pink', items: ['Carousels 2x/week: Tips, data viz','Reels 1x/week: Founder tips, BTS','Stories daily: Polls, shoutouts, CTAs'] },
  { name: 'Email', sub: 'Newsletter + 3 drip sequences', color: 'orange', items: ['The Cleya Signal weekly digest','Founders Track: 7-email drip','Investors Track: 7-email drip','Operators Track: 5-email drip'] },
  { name: 'Cold Outreach', sub: '40 emails + 20 LinkedIn/day', color: 'pink', items: ['Founder Acquisition campaigns','Investor Acquisition campaigns','Event-Based outreach','4-step sequence: email > LinkedIn > follow-up > final'] },
  { name: 'SEO/GEO', sub: 'Organic + AI search', color: 'yellow', items: ['Target: startup networking India keywords','Pillar pages + 2x/month blog','FAQ schema for founder/investor questions'] },
  { name: 'Paid Ads', sub: 'LinkedIn + Meta Ads', color: 'cyan', items: ['LinkedIn 60% budget: Sponsored, conversation, lead gen','Meta 40%: Carousel, video, lead ads','Retargeting: scarcity-based urgency'] },
];

const KPIS = [
  { metric: 'Website Traffic', target: '10K/month', ch: 'SEO + Paid', time: '90 days' },
  { metric: 'LinkedIn Followers', target: '5,000', ch: 'Social Media', time: '90 days' },
  { metric: 'Email Subscribers', target: '2,000', ch: 'Email + Outreach', time: '90 days' },
  { metric: 'Qualified Leads/week', target: '50', ch: 'Outreach', time: '60 days' },
  { metric: 'New Members/month', target: '200', ch: 'All Channels', time: '90 days' },
  { metric: 'Email Open Rate', target: '>35%', ch: 'Email', time: 'Ongoing' },
  { metric: 'Outreach Reply Rate', target: '>15%', ch: 'Outreach', time: 'Ongoing' },
  { metric: 'CAC', target: '<500 INR', ch: 'Paid Ads', time: '90 days' },
];

const TOOLS = [
  { name: 'MailerLite', cat: 'Email', purpose: 'Newsletter, drip sequences, subscriber management' },
  { name: 'Lemlist', cat: 'Outreach', purpose: 'Cold email + LinkedIn sequences, lead enrichment' },
  { name: 'Canva', cat: 'Design', purpose: 'Social graphics, ad creatives, email headers' },
  { name: 'Notion', cat: 'Planning', purpose: 'Content calendar, briefs, dashboards' },
  { name: 'Slack', cat: 'Comms', purpose: 'Agent notifications, human escalation, approvals' },
  { name: 'Google Calendar', cat: 'Scheduling', purpose: 'Publishing calendar, event triggers' },
  { name: 'Supabase', cat: 'Database', purpose: 'Agent state, task queue, metrics storage' },
  { name: 'Vercel', cat: 'Hosting', purpose: 'SEO audits, page speed, deployment' },
];

const ICON_MAP: Record<string, React.ReactNode> = {
  Brain: <Brain size={16} />, Lightbulb: <Lightbulb size={16} />, Share2: <Share2 size={16} />,
  Mail: <Mail size={16} />, Target: <Target size={16} />, Globe: <Globe size={16} />,
  Zap: <Zap size={16} />, BarChart3: <BarChart3 size={16} />,
};

const statusCls = (s: string) => s === 'Build' ? 'bg-green-500/20 text-green-400 border-green-500/30' : 'bg-yellow-500/20 text-yellow-400 border-yellow-500/30';
const colorText: Record<string,string> = { purple:'text-purple-400', green:'text-green-400', blue:'text-blue-400', orange:'text-orange-400', pink:'text-pink-400', yellow:'text-yellow-400', cyan:'text-cyan-400' };
const colorBorder: Record<string,string> = { purple:'border-purple-500/30 from-purple-500/20 to-purple-600/10', green:'border-green-500/30 from-green-500/20 to-green-600/10', blue:'border-blue-500/30 from-blue-500/20 to-blue-600/10', orange:'border-orange-500/30 from-orange-500/20 to-orange-600/10', pink:'border-pink-500/30 from-pink-500/20 to-pink-600/10', yellow:'border-yellow-500/30 from-yellow-500/20 to-yellow-600/10', cyan:'border-cyan-500/30 from-cyan-500/20 to-cyan-600/10' };

export function AgentArchitecture() {
  const [tab, setTab] = useState<ArchTab>('overview');
  const [expanded, setExpanded] = useState<number | null>(null);
  const tabs: { id: ArchTab; label: string }[] = [
    { id: 'overview', label: 'Overview' }, { id: 'agents', label: 'Agent Details' },
    { id: 'channels', label: 'Channel Playbooks' }, { id: 'workflows', label: 'Workflows' },
    { id: 'toolstack', label: 'Tool Stack' }, { id: 'kpis', label: 'KPIs & Metrics' },
  ];

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="relative overflow-hidden rounded-2xl border border-purple-500/20 bg-gradient-to-br from-purple-500/10 via-blue-500/5 to-transparent p-8 text-center">
        <span className="inline-block bg-purple-600 text-white text-xs font-semibold px-3 py-1 rounded-full uppercase tracking-wider mb-3">System Architecture v1.0</span>
        <h2 className="text-2xl font-bold text-white mb-2">Digital Marketing <span className="text-transparent bg-clip-text bg-gradient-to-r from-purple-400 to-cyan-400">Agent Architecture</span></h2>
        <p className="text-slate-400 max-w-2xl mx-auto text-sm">8 specialized AI agents orchestrating email, social, outreach, SEO, and paid ads.</p>
      </div>

      {/* Sub-tabs */}
      <div className="flex gap-1 p-1 rounded-xl bg-white/5 border border-white/10 overflow-x-auto">
        {tabs.map((t) => (
          <button key={t.id} onClick={() => setTab(t.id)} className={`px-4 py-2 rounded-lg text-xs font-medium transition-all whitespace-nowrap ${tab === t.id ? 'bg-purple-600/80 text-white shadow-lg' : 'text-slate-400 hover:text-white/60'}`}>{t.label}</button>
        ))}
      </div>

      {/* OVERVIEW */}
      {tab === 'overview' && (
        <div className="space-y-6">
          <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
            {[{ v:'8',l:'AI Agents',c:'text-purple-400' },{ v:'5',l:'Channels',c:'text-green-400' },{ v:'11',l:'Tools',c:'text-blue-400' },{ v:'7',l:'Workflows',c:'text-orange-400' },{ v:'24/7',l:'Always On',c:'text-cyan-400' }].map(k => (
              <div key={k.l} className="text-center p-4 rounded-xl bg-white/5 border border-white/10"><div className={`text-2xl font-bold ${k.c}`}>{k.v}</div><div className="text-xs text-slate-500 mt-1">{k.l}</div></div>
            ))}
          </div>
          <div className="rounded-xl border border-white/10 bg-white/5 p-6">
            <h3 className="text-sm font-semibold text-white mb-4">Agent Orchestration Flow</h3>
            <div className="flex flex-col items-center gap-3">
              <div className="bg-purple-600 text-white px-6 py-3 rounded-xl text-center"><div className="font-bold text-sm">ORCHESTRATOR</div><div className="text-xs opacity-70 mt-0.5">Coordinates all agents</div></div>
              <ArrowDown size={20} className="text-slate-500" />
              <div className="flex flex-wrap gap-2 justify-center">
                {[{l:'Content\nStrategy',c:'border-green-500 text-green-400 bg-green-500/10'},{l:'Social\nMedia',c:'border-blue-500 text-blue-400 bg-blue-500/10'},{l:'Email\nMarketing',c:'border-orange-500 text-orange-400 bg-orange-500/10'},{l:'Cold\nOutreach',c:'border-pink-500 text-pink-400 bg-pink-500/10'},{l:'SEO /\nGEO',c:'border-yellow-500 text-yellow-400 bg-yellow-500/10'},{l:'Paid\nAds',c:'border-cyan-500 text-cyan-400 bg-cyan-500/10'}].map(a => (
                  <div key={a.l} className={`px-4 py-2 rounded-lg border text-xs font-semibold text-center whitespace-pre-line ${a.c}`}>{a.l}</div>
                ))}
              </div>
              <ArrowDown size={20} className="text-slate-500" />
              <div className="border border-white/10 bg-white/5 px-6 py-3 rounded-xl text-center"><div className="font-bold text-sm text-white">ANALYTICS</div><div className="text-xs text-slate-400 mt-0.5">Cross-channel reporting</div></div>
            </div>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            {AGENTS.map(a => (
              <div key={a.id} className={`rounded-xl border bg-gradient-to-br p-4 ${colorBorder[a.color]}`}>
                <div className="flex items-center gap-3">
                  <div className="w-8 h-8 rounded-lg flex items-center justify-center bg-white/10"><span className={colorText[a.color]}>{ICON_MAP[a.icon]}</span></div>
                  <div className="flex-1"><div className="text-sm font-semibold text-white">Agent {a.id}: {a.name}</div><div className="text-xs text-slate-400">{a.role}</div></div>
                  <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-full border ${statusCls(a.status)}`}>{a.status}</span>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* AGENTS */}
      {tab === 'agents' && (
        <div className="space-y-3">
          {AGENTS.map(a => {
            const isExp = expanded === a.id;
            return (
              <div key={a.id} className={`rounded-xl border bg-gradient-to-br ${colorBorder[a.color]} overflow-hidden`}>
                <button onClick={() => setExpanded(isExp ? null : a.id)} className="w-full flex items-center gap-3 p-4 text-left">
                  <div className="w-9 h-9 rounded-lg flex items-center justify-center bg-white/10"><span className={colorText[a.color]}>{ICON_MAP[a.icon]}</span></div>
                  <div className="flex-1"><div className="text-sm font-semibold text-white">Agent {a.id}: {a.name}</div><div className="text-xs text-slate-400">{a.role}</div></div>
                  <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-full border mr-2 ${statusCls(a.status)}`}>{a.status}</span>
                  {isExp ? <ChevronDown size={16} className="text-slate-400" /> : <ChevronRight size={16} className="text-slate-400" />}
                </button>
                {isExp && (
                  <div className="px-4 pb-4 space-y-3 border-t border-white/5 pt-3">
                    <div><div className="text-xs font-semibold text-slate-300 mb-2">Responsibilities</div>
                      <ul className="space-y-1">{a.resp.map((r,i) => <li key={i} className="text-xs text-slate-400 flex gap-2"><span className="text-slate-500">&#8226;</span><span>{r}</span></li>)}</ul>
                    </div>
                    <div className="flex items-center gap-2 text-xs"><Clock size={12} className="text-slate-500" /><span className="text-slate-400">{a.trigger}</span></div>
                    <div className="flex flex-wrap gap-1.5">{a.tools.map(t => <span key={t} className="text-[10px] font-medium px-2 py-0.5 rounded-full bg-white/10 text-slate-300 border border-white/10">{t}</span>)}</div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* CHANNELS */}
      {tab === 'channels' && (
        <div className="space-y-3">
          {CHANNELS.map(ch => (
            <div key={ch.name} className={`rounded-xl border bg-gradient-to-br p-4 space-y-3 ${colorBorder[ch.color]}`}>
              <div className="text-sm font-semibold text-white">{ch.name} <span className="text-xs text-slate-400 font-normal ml-2">{ch.sub}</span></div>
              <ul className="space-y-1">{ch.items.map((s,i) => <li key={i} className="text-xs text-slate-400 flex gap-2"><span className="text-slate-500">&#8226;</span><span>{s}</span></li>)}</ul>
            </div>
          ))}
        </div>
      )}

      {/* WORKFLOWS */}
      {tab === 'workflows' && (
        <div className="rounded-xl border border-white/10 overflow-hidden"><div className="overflow-x-auto">
          <table className="w-full text-xs"><thead><tr className="bg-white/5 border-b border-white/10">
            <th className="text-left p-3 font-semibold text-slate-300">Workflow</th><th className="text-left p-3 font-semibold text-slate-300">Frequency</th>
            <th className="text-left p-3 font-semibold text-slate-300">Agent</th><th className="text-left p-3 font-semibold text-slate-300">Actions</th>
            <th className="text-left p-3 font-semibold text-slate-300">Status</th>
          </tr></thead><tbody>
            {WORKFLOWS.map((wf,i) => <tr key={i} className="border-b border-white/5 hover:bg-white/5">
              <td className="p-3 font-medium text-white">{wf.name}</td><td className="p-3 text-slate-400 whitespace-nowrap">{wf.freq}</td>
              <td className="p-3 text-slate-400">{wf.agent}</td><td className="p-3 text-slate-400">{wf.actions}</td>
              <td className="p-3"><span className={`text-[10px] font-semibold px-2 py-0.5 rounded-full ${statusCls(wf.status)}`}>{wf.status}</span></td>
            </tr>)}
          </tbody></table>
        </div></div>
      )}

      {/* TOOLSTACK */}
      {tab === 'toolstack' && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          {TOOLS.map(t => (
            <div key={t.name} className="rounded-xl border border-white/10 bg-white/5 p-4">
              <div className="flex items-center justify-between mb-2"><div className="text-sm font-semibold text-white">{t.name}</div>
                <span className="text-[10px] font-medium px-2 py-0.5 rounded-full bg-purple-500/20 text-purple-400 border border-purple-500/20">{t.cat}</span></div>
              <div className="text-xs text-slate-400">{t.purpose}</div>
            </div>
          ))}
        </div>
      )}

      {/* KPIS */}
      {tab === 'kpis' && (
        <div className="rounded-xl border border-white/10 overflow-hidden"><div className="overflow-x-auto">
          <table className="w-full text-xs"><thead><tr className="bg-white/5 border-b border-white/10">
            <th className="text-left p-3 font-semibold text-slate-300">Metric</th><th className="text-left p-3 font-semibold text-slate-300">Target</th>
            <th className="text-left p-3 font-semibold text-slate-300">Channel</th><th className="text-left p-3 font-semibold text-slate-300">Timeline</th>
          </tr></thead><tbody>
            {KPIS.map((k,i) => <tr key={i} className="border-b border-white/5 hover:bg-white/5">
              <td className="p-3 font-medium text-white">{k.metric}</td><td className="p-3 text-green-400 font-semibold">{k.target}</td>
              <td className="p-3 text-slate-400">{k.ch}</td><td className="p-3 text-slate-400">{k.time}</td>
            </tr>)}
          </tbody></table>
        </div></div>
      )}
    </div>
  );
}
