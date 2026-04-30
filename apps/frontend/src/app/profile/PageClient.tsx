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
import UserAvatar from '@/components/UserAvatar';
import { personaIcon, personaLabel } from '@/lib/persona';
import ProfileStrengthBar from '@/components/ProfileStrengthBar';

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
  githubUrl?: string;
  twitterUrl?: string;
  portfolioUrl?: string;
  availabilityStatus?: 'OPEN_TO_ROLES' | 'OPEN_TO_DEALS' | 'NOT_LOOKING' | string;
}

const PERSONA_OPTIONS: { value: string; label: string }[] = [
  { value: 'FOUNDER', label: 'Founder' },
  { value: 'INVESTOR', label: 'Investor' },
  { value: 'TALENT', label: 'Talent / Operator' },
  { value: 'JOB_SEEKER', label: 'Job Seeker' },
  { value: 'FREELANCER', label: 'Freelancer' },
  { value: 'ADVISOR', label: 'Advisor' },
  { value: 'DEAL_PARTNER', label: 'Deal Partner' },
  { value: 'VENTURE_PARTNER', label: 'Venture Partner' },
  { value: 'RECRUITER', label: 'Recruiter' },
  { value: 'OPERATOR', label: 'Operator' },
  { value: 'OTHER', label: 'Other' },
];

const AVAILABILITY_OPTIONS: { value: string; label: string; hint: string }[] = [
  { value: 'OPEN_TO_ROLES', label: 'Open to roles', hint: 'Recruiters & founders can reach out' },
  { value: 'OPEN_TO_DEALS', label: 'Open to deals', hint: 'Founders & investors can reach out' },
  { value: 'NOT_LOOKING', label: 'Not looking', hint: 'Visible but no inbound asks' },
];

const LOOKING_FOR_OPTIONS: { value: string; label: string }[] = [
  { value: 'RAISING', label: 'Raising' },
  { value: 'HIRING', label: 'Hiring' },
  { value: 'COFOUNDER', label: 'Co-founder' },
  { value: 'ADVICE', label: 'Advice' },
  { value: 'CUSTOMERS', label: 'Customers' },
  { value: 'INVESTING', label: 'Investing' },
];


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
  const [bioGenerating, setBioGenerating] = useState(false);
  const [skillQuery, setSkillQuery] = useState('');
  const [skillSuggestions, setSkillSuggestions] = useState<string[]>([]);
  const toast = useToast();
  const router = useRouter();

  const handleGenerateBio = async () => {
    setBioGenerating(true);
    try {
      const result = await api.generateBio();
      if (result?.bio) {
        setProfile((prev) => ({ ...prev, bio: result.bio.slice(0, 1000) }));
        toast.success(`Draft bio added. You have ${result.remaining} AI generations left today.`);
      } else {
        toast.error('Could not generate a bio. Please try again.');
      }
    } catch (err: any) {
      toast.error(err.message || 'Bio generation failed');
    } finally {
      setBioGenerating(false);
    }
  };

  const updateSkillSuggestions = async (query: string) => {
    setSkillQuery(query);
    if (!query.trim()) {
      setSkillSuggestions([]);
      return;
    }
    const { searchSkills } = await import('@/data/skillsTaxonomy');
    setSkillSuggestions(searchSkills(query, profile.skills || [], 8));
  };

  const addSkill = (skill: string) => {
    const trimmed = skill.trim().slice(0, 100);
    if (!trimmed) return;
    const current = profile.skills || [];
    if (current.length >= 30) {
      toast.error('Up to 30 skills only.');
      return;
    }
    if (current.some((s) => s.toLowerCase() === trimmed.toLowerCase())) {
      setSkillQuery('');
      setSkillSuggestions([]);
      return;
    }
    setProfile((prev) => ({ ...prev, skills: [...current, trimmed] }));
    setSkillQuery('');
    setSkillSuggestions([]);
  };

  const removeSkill = (skill: string) => {
    setProfile((prev) => ({
      ...prev,
      skills: (prev.skills || []).filter((s) => s !== skill),
    }));
  };

  const setTopPriority = (priority: string) => {
    const current = profile.lookingFor || [];
    if (!priority) {
      setProfile((prev) => ({ ...prev, lookingFor: current.filter((p) => !LOOKING_FOR_OPTIONS.some((o) => o.value === p) || current.indexOf(p) > 0) }));
      return;
    }
    const rest = current.filter((p) => p !== priority);
    setProfile((prev) => ({ ...prev, lookingFor: [priority, ...rest] }));
  };

  const toggleSecondaryAsk = (ask: string) => {
    const current = profile.lookingFor || [];
    if (current[0] === ask) return;
    if (current.includes(ask)) {
      setProfile((prev) => ({ ...prev, lookingFor: current.filter((p) => p !== ask) }));
    } else {
      setProfile((prev) => ({ ...prev, lookingFor: [...current, ask] }));
    }
  };

  const setAvailability = (status: string) => {
    setProfile((prev) => {
      const next: ProfileData = { ...prev, availabilityStatus: status };
      if (status === 'NOT_LOOKING') next.openToMeeting = false;
      return next;
    });
  };

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
    // Skeleton mirrors the real form layout (identity card, strength bar,
    // Basic Info, Industries, Professional Details, Availability) so the
    // transition from skeleton to loaded state is visually seamless.
    return <ProfileSkeleton />;
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
            style={{ background: 'linear-gradient(135deg, #6C63FF, #4ECDC4)' }}>
            {saving ? 'Saving...' : 'Save'}
          </button>
        </div>
      } />

      <div className="max-w-3xl mx-auto px-6 lg:px-8 py-8 space-y-6">
        <div className="rounded-2xl border border-white/5 p-6 flex items-center gap-4" style={{ background: '#1A2035' }}>
          <UserAvatar
            name={profile.currentRole}
            avatarUrl={profile.avatarUrl}
            size="3xl"
            shape="rounded"
            fallbackIcon={personaIcon[persona] || '💬'}
            className={profile.avatarUrl ? 'border border-white/10' : ''}
            style={!profile.avatarUrl ? { background: 'linear-gradient(135deg, #6C63FF20, #4ECDC420)', border: '1px solid rgba(108,99,255,0.15)' } : undefined}
          />
          <div>
            <div className="flex items-center gap-2">
              <h2 className="text-xl font-bold text-white">{profile.currentRole || 'Your Profile'}</h2>
              <span className="px-2.5 py-0.5 rounded-full text-[11px] font-medium border"
                style={{ background: 'rgba(108,99,255,0.1)', borderColor: 'rgba(108,99,255,0.2)', color: '#9B95FF' }}>
                {personaLabel[persona] || persona}
              </span>
              {profile.linkedinVerified && (
                <span className="px-2 py-0.5 rounded-full text-[10px] font-medium border"
                  style={{ background: 'rgba(108,99,255,0.1)', borderColor: 'rgba(108,99,255,0.2)', color: '#9B95FF' }}>
                  ✓ LinkedIn
                </span>
              )}
            </div>
            <p className="text-sm text-white/40 mt-0.5">{profile.headline || 'Add a headline'}</p>
          </div>
        </div>

        <ProfileStrengthBar />

        {/* B8: Availability segmented control — surfaced near the top, not buried */}
        <div className="rounded-2xl border border-white/5 p-5" style={{ background: '#1A2035' }}>
          <div className="flex items-center justify-between mb-3">
            <h3 className="text-xs font-semibold text-white/60 uppercase tracking-wider">Availability</h3>
            <span className="text-[10px] text-white/40">Controls who can reach out</span>
          </div>
          <div className="grid grid-cols-3 gap-2">
            {AVAILABILITY_OPTIONS.map((opt) => {
              const active = profile.availabilityStatus === opt.value;
              return (
                <button
                  key={opt.value}
                  type="button"
                  onClick={() => setAvailability(opt.value)}
                  className={`px-3 py-2.5 rounded-xl text-xs font-semibold border transition text-left ${
                    active
                      ? 'border-brand-violet/50 text-white'
                      : 'border-white/10 text-white/60 hover:border-white/20 hover:text-white/80'
                  }`}
                  style={active ? { background: 'rgba(108,99,255,0.15)' } : { background: 'rgba(255,255,255,0.03)' }}
                >
                  <div>{opt.label}</div>
                  <div className="text-[10px] font-normal text-white/40 mt-0.5">{opt.hint}</div>
                </button>
              );
            })}
          </div>
        </div>

        {error && (
          <div className="rounded-xl p-3 text-sm text-red-400 bg-red-500/10 border border-red-500/20">{error}</div>
        )}

        <div className="rounded-2xl border border-white/5 p-6 space-y-5" style={{ background: '#1A2035' }}>
          <h3 className="text-sm font-semibold text-white/60 uppercase tracking-wider">Basic Information</h3>

          {/* A7: Persona is editable from the form, not just shown as a badge */}
          <div>
            <label className="block text-xs font-semibold text-white/40 mb-1.5 uppercase tracking-wide">Persona</label>
            <select
              value={profile.persona || ''}
              onChange={(e) => updateField('persona', e.target.value || undefined)}
              className="input-dark"
            >
              <option value="">Select your role on Cleya</option>
              {PERSONA_OPTIONS.map((p) => (
                <option key={p.value} value={p.value}>{p.label}</option>
              ))}
            </select>
            <p className="text-[10px] text-white/40 mt-1">
              Drives who you get matched with. Change anytime if your focus shifts.
            </p>
          </div>

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
            <div className="flex items-center justify-between mb-1.5">
              <label className="block text-xs font-semibold text-white/40 uppercase tracking-wide">Bio</label>
              <button
                type="button"
                onClick={handleGenerateBio}
                disabled={bioGenerating}
                className="px-2.5 py-1 rounded-md text-[10px] font-semibold border border-brand-violet/40 text-brand-violet-hover hover:bg-brand-violet/10 transition disabled:opacity-50"
              >
                {bioGenerating ? 'Drafting…' : '✨ Generate with AI'}
              </button>
            </div>
            <textarea value={profile.bio || ''} onChange={(e) => updateField('bio', e.target.value.slice(0, 1000))}
              placeholder="e.g. Co-founder of an AI fintech for SMBs in India. Previously led product at Razorpay. Looking for a technical co-founder and seed investors who back early infra bets."
              rows={4}
              className="input-dark resize-none" maxLength={1000} />
            <div className="flex items-center justify-between mt-1">
              <p className="text-[10px] text-white/40">2-3 sentences. Specific beats generic. Names + numbers help.</p>
              <p className="text-[10px]" style={{ color: (profile.bio?.length || 0) > 900 ? '#ef4444' : '#94A3B8' }}>
                {profile.bio?.length || 0}/1000
              </p>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-semibold text-white/40 mb-1.5 uppercase tracking-wide">LinkedIn URL</label>
              <input
                type="url"
                inputMode="url"
                autoCapitalize="off"
                autoCorrect="off"
                spellCheck={false}
                value={profile.linkedinUrl || ''}
                onChange={(e) => updateField('linkedinUrl', e.target.value)}
                onBlur={(e) => {
                  const v = e.target.value.trim();
                  if (!v) return;
                  try {
                    const url = new URL(/^https?:\/\//i.test(v) ? v : `https://${v}`);
                    if (/linkedin\.com$/i.test(url.hostname.replace(/^www\./, ''))) {
                      const m = url.pathname.match(/^\/in\/([^/?#]+)/);
                      if (m) updateField('linkedinUrl', `https://linkedin.com/in/${m[1]}`);
                    }
                  } catch {}
                }}
                placeholder="https://linkedin.com/in/your-profile"
                className="input-dark"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-white/40 mb-1.5 uppercase tracking-wide">Website</label>
              <input type="url" value={profile.websiteUrl || ''} onChange={(e) => updateField('websiteUrl', e.target.value)}
                placeholder="https://..." className="input-dark" />
            </div>
            {/* B4-7: Optional links — show in form, render conditionally on read-only views */}
            <div>
              <label className="block text-xs font-semibold text-white/40 mb-1.5 uppercase tracking-wide">GitHub</label>
              <input type="url" inputMode="url" autoCapitalize="off" autoCorrect="off" spellCheck={false}
                value={profile.githubUrl || ''} onChange={(e) => updateField('githubUrl', e.target.value)}
                placeholder="https://github.com/your-handle" className="input-dark" />
            </div>
            <div>
              <label className="block text-xs font-semibold text-white/40 mb-1.5 uppercase tracking-wide">Twitter / X</label>
              <input type="url" inputMode="url" autoCapitalize="off" autoCorrect="off" spellCheck={false}
                value={profile.twitterUrl || ''} onChange={(e) => updateField('twitterUrl', e.target.value)}
                placeholder="https://x.com/your-handle" className="input-dark" />
            </div>
            <div className="md:col-span-2">
              <label className="block text-xs font-semibold text-white/40 mb-1.5 uppercase tracking-wide">Portfolio / Personal Site</label>
              <input type="url" inputMode="url" autoCapitalize="off" autoCorrect="off" spellCheck={false}
                value={profile.portfolioUrl || ''} onChange={(e) => updateField('portfolioUrl', e.target.value)}
                placeholder="https://yourname.com" className="input-dark" />
            </div>
          </div>
        </div>

        <div className="rounded-2xl border border-white/5 p-6 space-y-4" style={{ background: '#1A2035' }}>
          <h3 className="text-sm font-semibold text-white/60 uppercase tracking-wider">Industries</h3>
          <div className="flex flex-wrap gap-2">
            {industryOptions.map((ind) => {
              const selected = ind === 'other' ? showCustomIndustry : (profile.industries || []).includes(ind);
              return (
                <button key={ind} onClick={() => toggleIndustry(ind)}
                  className={`px-3 py-1.5 rounded-full text-xs font-medium border transition ${
                    selected
                      ? 'border-brand-violet/40 text-brand-violet-hover'
                      : 'border-white/10 text-white/40 hover:border-white/20 hover:text-white/60'
                  }`}
                  style={selected ? { background: 'rgba(108,99,255,0.15)' } : { background: 'rgba(255,255,255,0.03)' }}>
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
                style={{ background: '#6C63FF' }}>
                Add
              </button>
            </div>
          )}
          {(profile.industries || []).filter(i => !industryOptions.includes(i)).length > 0 && (
            <div className="flex flex-wrap gap-2 mt-2">
              {(profile.industries || []).filter(i => !industryOptions.includes(i)).map(ind => (
                <span key={ind} className="px-3 py-1.5 rounded-full text-xs font-medium border border-brand-violet/40 text-brand-violet-hover flex items-center gap-1.5"
                  style={{ background: 'rgba(108,99,255,0.15)' }}>
                  {ind.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase())}
                  <button onClick={() => updateField('industries', (profile.industries || []).filter(i => i !== ind))}
                    className="text-white/40 hover:text-white/70 text-xs">×</button>
                </span>
              ))}
            </div>
          )}
        </div>

        {/* B1: Skills with curated taxonomy autocomplete + 30 cap */}
        <div className="rounded-2xl border border-white/5 p-6 space-y-3" style={{ background: '#1A2035' }}>
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-semibold text-white/60 uppercase tracking-wider">Skills</h3>
            <span className="text-[10px] text-white/40">{(profile.skills || []).length}/30</span>
          </div>
          <div className="relative">
            <input
              type="text"
              value={skillQuery}
              onChange={(e) => updateSkillSuggestions(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  e.preventDefault();
                  if (skillSuggestions[0]) addSkill(skillSuggestions[0]);
                  else if (skillQuery.trim()) addSkill(skillQuery);
                } else if (e.key === 'Escape') {
                  setSkillQuery('');
                  setSkillSuggestions([]);
                }
              }}
              placeholder="Type to search (e.g. 'pro' for Product Management)"
              className="input-dark"
              maxLength={100}
            />
            {skillSuggestions.length > 0 && (
              <div className="absolute z-10 left-0 right-0 mt-1 rounded-xl border border-white/10 max-h-56 overflow-y-auto"
                style={{ background: '#13182B' }}>
                {skillSuggestions.map((s) => (
                  <button
                    key={s}
                    type="button"
                    onClick={() => addSkill(s)}
                    className="block w-full text-left px-3 py-2 text-xs text-white/80 hover:bg-white/5"
                  >
                    {s}
                  </button>
                ))}
                {skillQuery.trim() && !skillSuggestions.some((s) => s.toLowerCase() === skillQuery.trim().toLowerCase()) && (
                  <button
                    type="button"
                    onClick={() => addSkill(skillQuery)}
                    className="block w-full text-left px-3 py-2 text-xs text-brand-violet-hover border-t border-white/5 hover:bg-white/5"
                  >
                    + Add "{skillQuery.trim()}" (custom)
                  </button>
                )}
              </div>
            )}
          </div>
          {(profile.skills || []).length > 0 && (
            <div className="flex flex-wrap gap-2 pt-1">
              {(profile.skills || []).map((s) => (
                <span key={s} className="px-3 py-1.5 rounded-full text-xs font-medium border border-brand-violet/40 text-brand-violet-hover flex items-center gap-1.5"
                  style={{ background: 'rgba(108,99,255,0.15)' }}>
                  {s}
                  <button type="button" onClick={() => removeSkill(s)}
                    className="text-white/40 hover:text-white/70 text-xs">×</button>
                </span>
              ))}
            </div>
          )}
        </div>

        {/* B2: Current Ask — top priority dropdown + secondary multi-select chips */}
        <div className="rounded-2xl border border-white/5 p-6 space-y-4" style={{ background: '#1A2035' }}>
          <h3 className="text-sm font-semibold text-white/60 uppercase tracking-wider">Current Ask</h3>
          <div>
            <label className="block text-xs font-semibold text-white/40 mb-1.5 uppercase tracking-wide">Top priority right now</label>
            <select
              value={(profile.lookingFor && profile.lookingFor[0]) || ''}
              onChange={(e) => setTopPriority(e.target.value)}
              className="input-dark"
            >
              <option value="">Pick one</option>
              {LOOKING_FOR_OPTIONS.map((o) => (
                <option key={o.value} value={o.value}>{o.label}</option>
              ))}
            </select>
            <p className="text-[10px] text-white/40 mt-1">Shown first on your match cards. Update whenever your focus shifts.</p>
          </div>
          <div>
            <label className="block text-xs font-semibold text-white/40 mb-2 uppercase tracking-wide">Also open to</label>
            <div className="flex flex-wrap gap-2">
              {LOOKING_FOR_OPTIONS.map((o) => {
                const isPrimary = (profile.lookingFor || [])[0] === o.value;
                const isSelected = (profile.lookingFor || []).includes(o.value);
                return (
                  <button
                    key={o.value}
                    type="button"
                    disabled={isPrimary}
                    onClick={() => toggleSecondaryAsk(o.value)}
                    className={`px-3 py-1.5 rounded-full text-xs font-medium border transition ${
                      isSelected
                        ? 'border-brand-violet/40 text-brand-violet-hover'
                        : 'border-white/10 text-white/40 hover:border-white/20 hover:text-white/60'
                    } ${isPrimary ? 'opacity-60 cursor-not-allowed' : ''}`}
                    style={isSelected ? { background: 'rgba(108,99,255,0.15)' } : { background: 'rgba(255,255,255,0.03)' }}
                  >
                    {o.label}{isPrimary ? ' (top)' : ''}
                  </button>
                );
              })}
            </div>
          </div>
        </div>

        {isFounder && (
          <div className="rounded-2xl border border-white/5 p-6 space-y-4" style={{ background: '#1A2035' }}>
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
          <div className="rounded-2xl border border-white/5 p-6 space-y-4" style={{ background: '#1A2035' }}>
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
          <div className="rounded-2xl border border-white/5 p-6 space-y-4" style={{ background: '#1A2035' }}>
            <h3 className="text-sm font-semibold text-white/60 uppercase tracking-wider">Operator Details</h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-semibold text-white/40 mb-1.5 uppercase tracking-wide">Years of Experience</label>
                <input type="number" value={profile.yearsExperience || ''} onChange={(e) => updateField('yearsExperience', parseInt(e.target.value) || undefined)}
                  placeholder="Years" className="input-dark" />
              </div>
              <div>
                <label className="block text-xs font-semibold text-white/40 mb-1.5 uppercase tracking-wide">Equity Expectation (%)</label>
                <input type="text" value={profile.equityExpectation || ''} onChange={(e) => updateField('equityExpectation', e.target.value)}
                  placeholder="e.g. 0.5 - 2" className="input-dark" />
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
          <div className="rounded-2xl border border-white/5 p-6 space-y-4" style={{ background: '#1A2035' }}>
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

        <div className="rounded-2xl border border-white/5 p-6 space-y-4" style={{ background: '#1A2035' }}>
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
              className={`relative w-11 h-6 rounded-full transition-colors ${profile.openToMeeting !== false ? 'bg-brand-violet' : 'bg-white/10'}`}>
              <span className={`absolute top-0.5 left-0.5 w-5 h-5 rounded-full bg-white transition-transform ${profile.openToMeeting !== false ? 'translate-x-5' : ''}`} />
            </button>
            <span className="text-sm text-white/60">Open to meeting new people</span>
          </div>
        </div>

        <div className="flex justify-end pt-4 pb-8">
          <button onClick={handleSave} disabled={saving}
            className="px-8 py-3 rounded-2xl text-white font-semibold text-sm transition-all disabled:opacity-40 shadow-lg shadow-brand-violet/20"
            style={{ background: 'linear-gradient(135deg, #6C63FF, #4ECDC4)' }}>
            {saving ? 'Saving...' : saved ? 'Saved ✓' : 'Save Changes'}
          </button>
        </div>
      </div>

      <AppFooter />
    </AppShell>
  );
}

/* ------------------------------------------------------------------ */
/* Loading skeleton                                                    */
/* ------------------------------------------------------------------ */
/**
 * ProfileSkeleton renders a low-fidelity placeholder that mirrors the
 * shape of the real profile form. Same outer chrome (AppShell + AppNav),
 * same card containers, same grid breakpoints, and roughly the same
 * vertical rhythm — so when the data resolves and the real form swaps in
 * there's no layout shift or flash of empty space.
 */
function ProfileSkeleton() {
  const Block = ({ className = '', style }: { className?: string; style?: React.CSSProperties }) => (
    <div className={`rounded-md bg-white/[0.06] ${className}`} style={style} />
  );
  const FieldBlock = () => (
    <div>
      <Block className="h-3 w-24 mb-2" />
      <Block className="h-10 w-full" />
    </div>
  );
  const SectionCard = ({ children }: { children: React.ReactNode }) => (
    <div className="rounded-2xl border border-white/5 p-6 space-y-5" style={{ background: '#1A2035' }}>
      {children}
    </div>
  );

  return (
    <AppShell>
      <AppNav rightContent={
        <div className="flex items-center gap-2">
          <Block className="h-7 w-16 rounded-lg" />
        </div>
      } />

      <div className="max-w-3xl mx-auto px-6 lg:px-8 py-8 space-y-6 animate-pulse">
        {/* Identity card */}
        <div className="rounded-2xl border border-white/5 p-6 flex items-center gap-4" style={{ background: '#1A2035' }}>
          <Block className="h-20 w-20 rounded-2xl" />
          <div className="flex-1 space-y-2">
            <div className="flex items-center gap-2">
              <Block className="h-5 w-40" />
              <Block className="h-4 w-16 rounded-full" />
            </div>
            <Block className="h-3 w-56" />
          </div>
        </div>

        {/* Profile strength bar */}
        <div className="rounded-2xl border border-white/5 p-5 space-y-3" style={{ background: '#1A2035' }}>
          <div className="flex items-center justify-between">
            <Block className="h-3 w-32" />
            <Block className="h-3 w-10" />
          </div>
          <Block className="h-2 w-full rounded-full" />
        </div>

        {/* Personal Info / Basic Information */}
        <SectionCard>
          <Block className="h-3 w-40" />
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <FieldBlock />
            <FieldBlock />
            <FieldBlock />
            <FieldBlock />
          </div>
          <FieldBlock />
          {/* Bio (taller textarea) */}
          <div>
            <Block className="h-3 w-16 mb-2" />
            <Block className="h-20 w-full" />
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <FieldBlock />
            <FieldBlock />
          </div>
        </SectionCard>

        {/* Industries (chip row) */}
        <div className="rounded-2xl border border-white/5 p-6 space-y-4" style={{ background: '#1A2035' }}>
          <Block className="h-3 w-24" />
          <div className="flex flex-wrap gap-2">
            {[64, 80, 56, 72, 60, 84, 68, 76, 52, 90].map((w, i) => (
              <Block key={i} className="h-7 rounded-full" style={{ width: `${w}px` }} />
            ))}
          </div>
        </div>

        {/* Professional Details (persona-specific section) */}
        <SectionCard>
          <Block className="h-3 w-40" />
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <FieldBlock />
            <FieldBlock />
            <FieldBlock />
            <FieldBlock />
          </div>
        </SectionCard>

        {/* Availability & Intro Preferences */}
        <SectionCard>
          <Block className="h-3 w-56" />
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <FieldBlock />
            <FieldBlock />
          </div>
          <FieldBlock />
        </SectionCard>

        {/* Save button placeholder */}
        <div className="flex justify-end">
          <Block className="h-10 w-32 rounded-xl" />
        </div>
      </div>

      <AppFooter />
    </AppShell>
  );
}
