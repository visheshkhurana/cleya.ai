'use client';
import { useEffect, useState } from 'react';
import { api } from '@/lib/api';
import { useRouter } from 'next/navigation';
import AppNav from '@/components/AppNav';
import PhoneInput, { validatePhone } from '@/components/PhoneInput';
import { analytics } from '@/lib/posthog';
import { useToast } from '@/components/Toast';
import AppFooter from '@/components/AppFooter';
import AppShell from '@/components/AppShell';

interface ProfileData {
  persona?: string;
  headline?: string;
  bio?: string;
  avatarUrl?: string;
  companyName?: string;
  companyStage?: string;
  currentRole?: string;
  location?: string;
  industries?: string[];
  skills?: string[];
  linkedinUrl?: string;
  websiteUrl?: string;
  lookingFor?: string[];
  investmentFocus?: string[];
  investmentRange?: { min?: number; max?: number };
  fundName?: string;
  portfolioSize?: number;
  yearsExperience?: number;
  preferredRole?: string;
  salaryRange?: string;
  availability?: string;
  phoneNumber?: string;
  linkedinVerified?: boolean;
  monthlyRevenue?: string;
  growthRate?: string;
  activeUsers?: string;
  burnRate?: string;
  portfolioCompanies?: string[];
  dealsPerYear?: number;
  leadsRounds?: boolean;
  introPreference?: string;
  openToMeeting?: boolean;
  maxIntrosPerWeek?: number;
  equityExpectation?: string;
  preferredStage?: string;
  workStyle?: string;
  functionalArea?: string;
  preferredStageRange?: string;
  sectorFocus?: string[];
  checkSizeRange?: string;
}

const personaLabel: Record<string, string> = {
  FOUNDER: 'Founder', INVESTOR: 'Investor', TALENT: 'Talent', DEAL_PARTNER: 'Deal Partner',
  EVENT_PARTICIPANT: 'Event Participant', VENTURE_PARTNER: 'Venture Partner', ADVISOR: 'Advisor',
  OPERATOR: 'Operator', JOB_SEEKER: 'Job Seeker', RECRUITER: 'Recruiter', FREELANCER: 'Freelancer', OTHER: 'Other',
};

const personaIcon: Record<string, string> = {
  FOUNDER: '🚀', INVESTOR: '💰', TALENT: '🎯', DEAL_PARTNER: '🤝',
  EVENT_PARTICIPANT: '🏆', VENTURE_PARTNER: '🏦', ADVISOR: '🧠',
  OPERATOR: '⚙️', JOB_SEEKER: '💼', RECRUITER: '👔', FREELANCER: '✨', OTHER: '💬',
};

const industryOptions = [
  'ai_ml', 'fintech', 'saas', 'healthtech', 'edtech', 'e_commerce', 'biotech',
  'cleantech', 'cybersecurity', 'real_estate', 'media', 'gaming', 'logistics', 'food_beverage',
  'enterprise', 'consumer', 'climate', 'other',
];

const completenessFields = [
  { key: 'persona', label: 'Persona' },
  { key: 'headline', label: 'Headline' },
  { key: 'bio', label: 'Bio' },
  { key: 'companyName', label: 'Company Name' },
  { key: 'currentRole', label: 'Current Role' },
  { key: 'location', label: 'Location' },
  { key: 'industries', label: 'Industries' },
  { key: 'linkedinUrl', label: 'LinkedIn URL' },
] as const;

export default function ProfilePage() {
  const [profile, setProfile] = useState<ProfileData>({});
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState('');
  const [customIndustry, setCustomIndustry] = useState('');
  const [showCustomIndustry, setShowCustomIndustry] = useState(false);
  const toast = useToast();
  const router = useRouter();

  useEffect(() => {
    api.getMe().then((user) => {
      if (!user) { router.push('/?action=login'); return; }
      api.setToken('authenticated');
      loadProfile();
    }).catch(() => { router.push('/?action=login'); });
  }, []);

  const loadProfile = async () => {
    try {
      const data = await api.getProfile();
      if (data) {
        const { extraData, ...rest } = data;
        const merged = { ...rest, ...(typeof extraData === 'object' && extraData ? extraData : {}) };
        setProfile(merged);
      }
    } catch (err: any) {
      if (err.message?.includes('Unauthorized')) router.push('/');
    } finally {
      setLoading(false);
    }
  };

  const handleSave = async () => {
    setSaving(true);
    setError('');
    setSaved(false);
    if (!profile.persona) {
      setError('Please select a persona type before saving.');
      setSaving(false);
      return;
    }
    if (!profile.currentRole?.trim()) {
      setError('Current Role is required.');
      setSaving(false);
      return;
    }
    if (profile.persona === 'FOUNDER' && !profile.companyName?.trim()) {
      setError('Company Name is required for Founders.');
      setSaving(false);
      return;
    }
    if (profile.phoneNumber) {
      const phoneErr = validatePhone(profile.phoneNumber);
      if (phoneErr) { setError(phoneErr); setSaving(false); return; }
    }
    try {
      const updated = await api.updateProfile(profile);
      if (updated) {
        const { extraData, ...rest } = updated;
        const merged = { ...rest, ...(typeof extraData === 'object' && extraData ? extraData : {}) };
        setProfile(merged);
      }
      setSaved(true);
      toast.success('Profile updated successfully!');
      analytics.profileUpdated(Object.keys(profile));
      setTimeout(() => setSaved(false), 3000);
    } catch (err: any) {
      setError(err.message || 'Failed to save');
      toast.error(err.message || 'Failed to save profile');
    } finally {
      setSaving(false);
    }
  };

  const updateField = (key: string, value: any) => {
    setProfile((prev) => ({ ...prev, [key]: value }));
  };

  const toggleIndustry = (ind: string) => {
    if (ind === 'other') {
      setShowCustomIndustry(!showCustomIndustry);
      return;
    }
    const current = profile.industries || [];
    if (current.includes(ind)) {
      updateField('industries', current.filter((i) => i !== ind));
    } else {
      updateField('industries', [...current, ind]);
    }
  };

  const addCustomIndustry = () => {
    const trimmed = customIndustry.trim().toLowerCase().replace(/\s+/g, '_');
    if (!trimmed) return;
    const current = profile.industries || [];
    if (!current.includes(trimmed)) {
      updateField('industries', [...current, trimmed]);
    }
    setCustomIndustry('');
    setShowCustomIndustry(false);
  };

  const getMissingFields = () => {
    const missing: string[] = [];
    for (const field of completenessFields) {
      const val = profile[field.key as keyof ProfileData];
      if (!val || (Array.isArray(val) && val.length === 0) || (typeof val === 'string' && !val.trim())) {
        missing.push(field.label);
      }
    }
    return missing;
  };

  const completenessScore = Math.round(((completenessFields.length - getMissingFields().length) / completenessFields.length) * 100);

  if (loading) {
    return (
      <AppShell className="flex items-center justify-center">
        <div className="flex items-center gap-3">
          <div className="w-5 h-5 border-2 border-blue-400 border-t-transparent rounded-full animate-spin" />
          <p className="text-slate-400 text-sm">Loading profile...</p>
        </div>
      </AppShell>
    );
  }

  const persona = profile.persona || 'OTHER';
  const isFounder = persona === 'FOUNDER';
  const isInvestor = persona === 'INVESTOR' || persona === 'VENTURE_PARTNER';
  const isTalent = persona === 'TALENT' || persona === 'JOB_SEEKER' || persona === 'FREELANCER';
  const isDealPartner = persona === 'DEAL_PARTNER';

  return (
    <AppShell>
      <AppNav rightContent={
        <div className="flex items-center gap-2">
          {saved && <span className="text-xs text-green-400 hidden sm:inline">Saved ✓</span>}
          <button onClick={handleSave} disabled={saving}
            className="px-4 py-1.5 text-xs font-medium rounded-lg text-white transition disabled:opacity-40"
            style={{ background: 'linear-gradient(135deg, #3B82F6, #8B5CF6)' }}>
            {saving ? 'Saving...' : 'Save'}
          </button>
        </div>
      } />

      <div className="max-w-3xl mx-auto px-6 lg:px-8 py-8 space-y-6">
        <div className="rounded-2xl border border-white/5 p-6 flex items-center gap-4" style={{ background: 'rgba(10,10,26,0.8)' }}>
          {profile.avatarUrl ? (
            <img src={profile.avatarUrl} alt={profile.currentRole || 'Profile'} referrerPolicy="no-referrer"
              className="w-16 h-16 rounded-2xl object-cover flex-shrink-0 border border-white/10" />
          ) : (
            <div className="w-16 h-16 rounded-2xl flex items-center justify-center text-3xl"
              style={{ background: 'linear-gradient(135deg, #3B82F620, #8B5CF620)', border: '1px solid rgba(59,130,246,0.15)' }}>
              {personaIcon[persona] || '💬'}
            </div>
          )}
          <div>
            <div className="flex items-center gap-2">
              <h2 className="text-xl font-bold text-white">{profile.currentRole || 'Your Profile'}</h2>
              <span className="px-2.5 py-0.5 rounded-full text-[11px] font-medium border"
                style={{ background: 'rgba(59,130,246,0.1)', borderColor: 'rgba(59,130,246,0.2)', color: '#93C5FD' }}>
                {personaLabel[persona] || persona}
              </span>
              {profile.linkedinVerified && (
                <span className="px-2 py-0.5 rounded-full text-[10px] font-medium border"
                  style={{ background: 'rgba(59,130,246,0.1)', borderColor: 'rgba(59,130,246,0.2)', color: '#93C5FD' }}>
                  ✓ LinkedIn
                </span>
              )}
            </div>
            <p className="text-sm text-white/40 mt-0.5">{profile.headline || 'Add a headline'}</p>
          </div>
        </div>

        <div className="rounded-2xl border border-white/5 p-4" style={{ background: 'rgba(10,10,26,0.8)' }}>
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs font-semibold text-white/50 uppercase tracking-wide">Profile Completion</span>
            <span className="text-sm font-bold" style={{ color: completenessScore === 100 ? '#10b981' : '#93C5FD' }}>{completenessScore}%</span>
          </div>
          <div className="h-2 rounded-full overflow-hidden" style={{ background: 'rgba(255,255,255,0.06)' }}>
            <div className="h-full rounded-full transition-all duration-500" style={{ width: `${completenessScore}%`, background: completenessScore === 100 ? '#10b981' : 'linear-gradient(90deg, #3B82F6, #60A5FA)' }} />
          </div>
          {getMissingFields().length > 0 && (
            <p className="text-[11px] mt-2" style={{ color: '#94A3B8' }}>
              Missing: {getMissingFields().join(', ')}
            </p>
          )}
        </div>

        {error && (
          <div className="rounded-xl p-3 text-sm text-red-400 bg-red-500/10 border border-red-500/20">{error}</div>
        )}

        <div className="rounded-2xl border border-white/5 p-6 space-y-5" style={{ background: 'rgba(10,10,26,0.8)' }}>
          <h3 className="text-sm font-semibold text-white/60 uppercase tracking-wider">Basic Information</h3>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-semibold text-white/40 mb-1.5 uppercase tracking-wide">Headline</label>
              <input type="text" value={profile.headline || ''} onChange={(e) => updateField('headline', e.target.value)}
                placeholder="e.g. CEO at Acme Corp" className="input-dark" />
            </div>
            <div>
              <label className="block text-xs font-semibold text-white/40 mb-1.5 uppercase tracking-wide">Current Role</label>
              <input type="text" value={profile.currentRole || ''} onChange={(e) => updateField('currentRole', e.target.value)}
                placeholder="e.g. Co-founder & CEO" className="input-dark" />
            </div>
            <div>
              <label className="block text-xs font-semibold text-white/40 mb-1.5 uppercase tracking-wide">Company</label>
              <input type="text" value={profile.companyName || ''} onChange={(e) => updateField('companyName', e.target.value)}
                placeholder="Company name" className="input-dark" />
            </div>
            <div>
              <label className="block text-xs font-semibold text-white/40 mb-1.5 uppercase tracking-wide">Location</label>
              <input type="text" value={profile.location || ''} onChange={(e) => updateField('location', e.target.value)}
                placeholder="e.g. Bangalore, India" className="input-dark" />
            </div>
          </div>

          <div>
            <label className="block text-xs font-semibold text-white/40 mb-1.5 uppercase tracking-wide">Phone Number</label>
            <PhoneInput
              value={profile.phoneNumber || ''}
              onChange={(val) => updateField('phoneNumber', val)}
              placeholder="98765 43210"
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-white/40 mb-1.5 uppercase tracking-wide">Bio</label>
            <textarea value={profile.bio || ''} onChange={(e) => updateField('bio', e.target.value.slice(0, 1000))}
              placeholder="Tell people about yourself..." rows={3}
              className="input-dark resize-none" maxLength={1000} />
            <p className="text-[10px] text-right mt-1" style={{ color: (profile.bio?.length || 0) > 900 ? '#ef4444' : '#94A3B8' }}>
              {profile.bio?.length || 0}/1000
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-semibold text-white/40 mb-1.5 uppercase tracking-wide">LinkedIn URL</label>
              <div className="flex items-center rounded-2xl border border-white/10 bg-white/5 overflow-hidden focus-within:ring-2 focus-within:ring-cleya-500 transition-all backdrop-blur-sm">
                <span className="pl-4 pr-1 text-sm text-white/30 whitespace-nowrap select-none">linkedin.com/in/</span>
                <input type="text"
                  value={(profile.linkedinUrl || '').replace(/^https?:\/\/(www\.)?linkedin\.com\/in\/?/i, '')}
                  onChange={(e) => {
                    const raw = e.target.value.replace(/^https?:\/\/(www\.)?linkedin\.com\/in\/?/i, '').replace(/^\/+/, '');
                    const slug = raw.split(/[?#/]/)[0].trim();
                    updateField('linkedinUrl', slug ? `https://linkedin.com/in/${slug}` : '');
                  }}
                  placeholder="your-profile"
                  className="flex-1 px-2 py-3 bg-transparent text-white text-sm placeholder-white/30 focus:outline-none" />
              </div>
            </div>
            <div>
              <label className="block text-xs font-semibold text-white/40 mb-1.5 uppercase tracking-wide">Website</label>
              <input type="url" value={profile.websiteUrl || ''} onChange={(e) => updateField('websiteUrl', e.target.value)}
                placeholder="https://..." className="input-dark" />
            </div>
          </div>
        </div>

        <div className="rounded-2xl border border-white/5 p-6 space-y-4" style={{ background: 'rgba(10,10,26,0.8)' }}>
          <h3 className="text-sm font-semibold text-white/60 uppercase tracking-wider">Industries</h3>
          <div className="flex flex-wrap gap-2">
            {industryOptions.map((ind) => {
              const selected = ind === 'other' ? showCustomIndustry : (profile.industries || []).includes(ind);
              return (
                <button key={ind} onClick={() => toggleIndustry(ind)}
                  className={`px-3 py-1.5 rounded-full text-xs font-medium border transition ${
                    selected
                      ? 'border-blue-500/40 text-blue-300'
                      : 'border-white/10 text-white/40 hover:border-white/20 hover:text-white/60'
                  }`}
                  style={selected ? { background: 'rgba(59,130,246,0.15)' } : { background: 'rgba(255,255,255,0.03)' }}>
                  {ind === 'other' ? 'Other' : ind.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase()).replace(/\bAi Ml\b/, 'AI/ML').replace(/\bSaas\b/, 'SaaS').replace(/\bE Commerce\b/, 'E-Commerce')}
                </button>
              );
            })}
          </div>
          {showCustomIndustry && (
            <div className="flex items-center gap-2 mt-2">
              <input type="text" value={customIndustry} onChange={(e) => setCustomIndustry(e.target.value)}
                placeholder="Enter your industry" className="input-dark flex-1"
                onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); addCustomIndustry(); } }} />
              <button onClick={addCustomIndustry}
                className="px-4 py-3 rounded-2xl text-xs font-semibold text-white transition"
                style={{ background: '#3B82F6' }}>
                Add
              </button>
            </div>
          )}
          {(profile.industries || []).filter(i => !industryOptions.includes(i)).length > 0 && (
            <div className="flex flex-wrap gap-2 mt-2">
              {(profile.industries || []).filter(i => !industryOptions.includes(i)).map(ind => (
                <span key={ind} className="px-3 py-1.5 rounded-full text-xs font-medium border border-blue-500/40 text-blue-300 flex items-center gap-1.5"
                  style={{ background: 'rgba(59,130,246,0.15)' }}>
                  {ind.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase())}
                  <button onClick={() => updateField('industries', (profile.industries || []).filter(i => i !== ind))}
                    className="text-white/40 hover:text-white/70 text-xs">×</button>
                </span>
              ))}
            </div>
          )}
        </div>

        {isFounder && (
          <div className="rounded-2xl border border-white/5 p-6 space-y-4" style={{ background: 'rgba(10,10,26,0.8)' }}>
            <h3 className="text-sm font-semibold text-white/60 uppercase tracking-wider">Founder Details</h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-semibold text-white/40 mb-1.5 uppercase tracking-wide">Company Stage</label>
                <select value={profile.companyStage || ''} onChange={(e) => updateField('companyStage', e.target.value)}
                  className="input-dark">
                  <option value="">Select stage</option>
                  <option value="PRE_SEED">Pre-Seed</option>
                  <option value="SEED">Seed</option>
                  <option value="SERIES_A">Series A</option>
                  <option value="SERIES_B">Series B</option>
                  <option value="SERIES_C_PLUS">Series C+</option>
                  <option value="GROWTH">Growth</option>
                </select>
              </div>
            </div>
            <h4 className="text-xs font-semibold text-white/50 uppercase tracking-wide pt-2">Traction Metrics</h4>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-semibold text-white/40 mb-1.5 uppercase tracking-wide">Monthly Revenue (MRR)</label>
                <input type="text" value={profile.monthlyRevenue || ''} onChange={(e) => updateField('monthlyRevenue', e.target.value)}
                  placeholder="e.g. $50K" className="input-dark" />
              </div>
              <div>
                <label className="block text-xs font-semibold text-white/40 mb-1.5 uppercase tracking-wide">Growth Rate</label>
                <input type="text" value={profile.growthRate || ''} onChange={(e) => updateField('growthRate', e.target.value)}
                  placeholder="e.g. 15% MoM" className="input-dark" />
              </div>
              <div>
                <label className="block text-xs font-semibold text-white/40 mb-1.5 uppercase tracking-wide">Active Users</label>
                <input type="text" value={profile.activeUsers || ''} onChange={(e) => updateField('activeUsers', e.target.value)}
                  placeholder="e.g. 10,000 MAU" className="input-dark" />
              </div>
              <div>
                <label className="block text-xs font-semibold text-white/40 mb-1.5 uppercase tracking-wide">Burn Rate</label>
                <input type="text" value={profile.burnRate || ''} onChange={(e) => updateField('burnRate', e.target.value)}
                  placeholder="e.g. $80K/mo" className="input-dark" />
              </div>
            </div>
          </div>
        )}

        {isInvestor && (
          <div className="rounded-2xl border border-white/5 p-6 space-y-4" style={{ background: 'rgba(10,10,26,0.8)' }}>
            <h3 className="text-sm font-semibold text-white/60 uppercase tracking-wider">Investor Details</h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-semibold text-white/40 mb-1.5 uppercase tracking-wide">Fund Name</label>
                <input type="text" value={profile.fundName || ''} onChange={(e) => updateField('fundName', e.target.value)}
                  placeholder="Fund name" className="input-dark" />
              </div>
              <div>
                <label className="block text-xs font-semibold text-white/40 mb-1.5 uppercase tracking-wide">Deals Per Year</label>
                <input type="number" value={profile.dealsPerYear ?? ''} onChange={(e) => updateField('dealsPerYear', parseInt(e.target.value) || undefined)}
                  placeholder="e.g. 8" className="input-dark" />
              </div>
              <div>
                <label className="block text-xs font-semibold text-white/40 mb-1.5 uppercase tracking-wide">Leads Rounds?</label>
                <select value={profile.leadsRounds === true ? 'true' : profile.leadsRounds === false ? 'false' : ''} onChange={(e) => updateField('leadsRounds', e.target.value === 'true' ? true : e.target.value === 'false' ? false : undefined)}
                  className="input-dark">
                  <option value="">Select</option>
                  <option value="true">Yes, I lead rounds</option>
                  <option value="false">No, I co-invest</option>
                </select>
              </div>
            </div>
            <div>
              <label className="block text-xs font-semibold text-white/40 mb-1.5 uppercase tracking-wide">Portfolio Companies</label>
              <textarea value={(profile.portfolioCompanies || []).join(', ')}
                onChange={(e) => updateField('portfolioCompanies', e.target.value.split(',').map(s => s.trim()).filter(Boolean))}
                placeholder="List portfolio companies, comma-separated" rows={2}
                className="input-dark resize-none" />
            </div>
          </div>
        )}

        {isTalent && (
          <div className="rounded-2xl border border-white/5 p-6 space-y-4" style={{ background: 'rgba(10,10,26,0.8)' }}>
            <h3 className="text-sm font-semibold text-white/60 uppercase tracking-wider">Talent Details</h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-semibold text-white/40 mb-1.5 uppercase tracking-wide">Years of Experience</label>
                <input type="number" value={profile.yearsExperience || ''} onChange={(e) => updateField('yearsExperience', parseInt(e.target.value) || undefined)}
                  placeholder="Years" className="input-dark" />
              </div>
              <div>
                <label className="block text-xs font-semibold text-white/40 mb-1.5 uppercase tracking-wide">Equity Expectation</label>
                <input type="text" value={profile.equityExpectation || ''} onChange={(e) => updateField('equityExpectation', e.target.value)}
                  placeholder="e.g. 0.5% - 2%" className="input-dark" />
              </div>
              <div>
                <label className="block text-xs font-semibold text-white/40 mb-1.5 uppercase tracking-wide">Preferred Company Stage</label>
                <select value={profile.preferredStage || ''} onChange={(e) => updateField('preferredStage', e.target.value || undefined)}
                  className="input-dark">
                  <option value="">Select stage</option>
                  <option value="PRE_SEED">Pre-Seed</option>
                  <option value="SEED">Seed</option>
                  <option value="SERIES_A">Series A</option>
                  <option value="SERIES_B">Series B</option>
                  <option value="SERIES_C_PLUS">Series C+</option>
                  <option value="GROWTH">Growth</option>
                </select>
              </div>
              <div>
                <label className="block text-xs font-semibold text-white/40 mb-1.5 uppercase tracking-wide">Work Style</label>
                <select value={profile.workStyle || ''} onChange={(e) => updateField('workStyle', e.target.value || undefined)}
                  className="input-dark">
                  <option value="">Select preference</option>
                  <option value="REMOTE">Remote</option>
                  <option value="IN_OFFICE">In-Office</option>
                  <option value="HYBRID">Hybrid</option>
                </select>
              </div>
              <div>
                <label className="block text-xs font-semibold text-white/40 mb-1.5 uppercase tracking-wide">Functional Area</label>
                <input type="text" value={profile.functionalArea || ''} onChange={(e) => updateField('functionalArea', e.target.value)}
                  placeholder="e.g. Engineering, Product, Design" className="input-dark" />
              </div>
            </div>
          </div>
        )}

        {isDealPartner && (
          <div className="rounded-2xl border border-white/5 p-6 space-y-4" style={{ background: 'rgba(10,10,26,0.8)' }}>
            <h3 className="text-sm font-semibold text-white/60 uppercase tracking-wider">Deal Partner Preferences</h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-semibold text-white/40 mb-1.5 uppercase tracking-wide">Preferred Stage Range</label>
                <input type="text" value={profile.preferredStageRange || ''} onChange={(e) => updateField('preferredStageRange', e.target.value)}
                  placeholder="e.g. Pre-Seed to Series A" className="input-dark" />
              </div>
              <div>
                <label className="block text-xs font-semibold text-white/40 mb-1.5 uppercase tracking-wide">Check Size Range</label>
                <input type="text" value={profile.checkSizeRange || ''} onChange={(e) => updateField('checkSizeRange', e.target.value)}
                  placeholder="e.g. $50K - $500K" className="input-dark" />
              </div>
            </div>
            <div>
              <label className="block text-xs font-semibold text-white/40 mb-1.5 uppercase tracking-wide">Sector Focus</label>
              <textarea value={(profile.sectorFocus || []).join(', ')}
                onChange={(e) => updateField('sectorFocus', e.target.value.split(',').map(s => s.trim()).filter(Boolean))}
                placeholder="e.g. AI/ML, Fintech, Healthcare (comma-separated)" rows={2}
                className="input-dark resize-none" />
            </div>
          </div>
        )}

        <div className="rounded-2xl border border-white/5 p-6 space-y-4" style={{ background: 'rgba(10,10,26,0.8)' }}>
          <h3 className="text-sm font-semibold text-white/60 uppercase tracking-wider">Availability & Intro Preferences</h3>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-semibold text-white/40 mb-1.5 uppercase tracking-wide">Intro Preference</label>
              <select value={profile.introPreference || ''} onChange={(e) => updateField('introPreference', e.target.value || undefined)}
                className="input-dark">
                <option value="">Select preference</option>
                <option value="WARM_ONLY">Warm intros only</option>
                <option value="COLD_OK">Cold outreach is OK</option>
                <option value="OPEN_TO_BOTH">Open to both</option>
              </select>
            </div>
            <div>
              <label className="block text-xs font-semibold text-white/40 mb-1.5 uppercase tracking-wide">Max Intros Per Week</label>
              <input type="number" value={profile.maxIntrosPerWeek ?? ''} onChange={(e) => updateField('maxIntrosPerWeek', parseInt(e.target.value) || undefined)}
                placeholder="e.g. 3" min={1} max={20} className="input-dark" />
            </div>
          </div>
          <div className="flex items-center gap-3 pt-1">
            <button
              onClick={() => updateField('openToMeeting', !profile.openToMeeting)}
              className={`relative w-11 h-6 rounded-full transition-colors ${profile.openToMeeting !== false ? 'bg-blue-500' : 'bg-white/10'}`}>
              <span className={`absolute top-0.5 left-0.5 w-5 h-5 rounded-full bg-white transition-transform ${profile.openToMeeting !== false ? 'translate-x-5' : ''}`} />
            </button>
            <span className="text-sm text-white/60">Open to meeting new people</span>
          </div>
        </div>

        <div className="flex justify-end pt-4 pb-8">
          <button onClick={handleSave} disabled={saving}
            className="px-8 py-3 rounded-2xl text-white font-semibold text-sm transition-all disabled:opacity-40 shadow-lg shadow-blue-500/20"
            style={{ background: 'linear-gradient(135deg, #3B82F6, #8B5CF6)' }}>
            {saving ? 'Saving...' : saved ? 'Saved ✓' : 'Save Changes'}
          </button>
        </div>
      </div>

      <AppFooter />
    </AppShell>
  );
}
