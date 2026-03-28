'use client';
import { useEffect, useState } from 'react';
import { api } from '@/lib/api';
import { useRouter } from 'next/navigation';
import MobileNav from '@/components/MobileNav';
import PhoneInput, { validatePhone } from '@/components/PhoneInput';
import { analytics } from '@/lib/posthog';
import { useToast } from '@/components/Toast';

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
  'enterprise', 'consumer', 'climate',
];

export default function ProfilePage() {
  const [profile, setProfile] = useState<ProfileData>({});
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState('');
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
    const current = profile.industries || [];
    if (current.includes(ind)) {
      updateField('industries', current.filter((i) => i !== ind));
    } else {
      updateField('industries', [...current, ind]);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center" style={{ background: '#0F172A' }}>
        <div className="flex items-center gap-3">
          <div className="w-5 h-5 border-2 border-teal-400 border-t-transparent rounded-full animate-spin" />
          <p className="text-slate-400 text-sm">Loading profile...</p>
        </div>
      </div>
    );
  }

  const persona = profile.persona || 'OTHER';
  const isFounder = persona === 'FOUNDER';
  const isInvestor = persona === 'INVESTOR' || persona === 'VENTURE_PARTNER';
  const isTalent = persona === 'TALENT' || persona === 'JOB_SEEKER' || persona === 'FREELANCER';

  return (
    <div className="min-h-screen" style={{ background: '#0F172A' }}>
      <header className="sticky top-0 z-10 border-b border-white/5" style={{ background: 'rgba(13,11,26,0.9)', backdropFilter: 'blur(20px)' }}>
        <div className="max-w-3xl mx-auto px-4 py-3 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <button onClick={() => router.push('/dashboard')} className="text-white/30 hover:text-white/60 transition text-sm hidden sm:block">← Back</button>
            <h1 className="font-semibold text-white text-sm">Edit Profile</h1>
          </div>
          <div className="flex items-center gap-2">
            {saved && <span className="text-xs text-green-400 hidden sm:inline">Saved ✓</span>}
            <button onClick={handleSave} disabled={saving}
              className="px-4 py-1.5 text-xs font-medium rounded-lg text-white transition disabled:opacity-40"
              style={{ background: 'linear-gradient(135deg, #0D9488, #0F766E)' }}>
              {saving ? 'Saving...' : 'Save'}
            </button>
            <div className="sm:hidden"><MobileNav /></div>
          </div>
        </div>
      </header>

      <div className="max-w-3xl mx-auto px-4 py-8 space-y-6">
        <div className="rounded-2xl border border-white/5 p-6 flex items-center gap-4" style={{ background: 'rgba(30,41,59,0.6)' }}>
          {profile.avatarUrl ? (
            <img src={profile.avatarUrl} alt={profile.currentRole || 'Profile'} referrerPolicy="no-referrer"
              className="w-16 h-16 rounded-2xl object-cover flex-shrink-0 border border-white/10" />
          ) : (
            <div className="w-16 h-16 rounded-2xl flex items-center justify-center text-3xl"
              style={{ background: 'linear-gradient(135deg, #0D948820, #0F766E20)', border: '1px solid rgba(13,148,136,0.15)' }}>
              {personaIcon[persona] || '💬'}
            </div>
          )}
          <div>
            <div className="flex items-center gap-2">
              <h2 className="text-xl font-bold text-white">{profile.currentRole || 'Your Profile'}</h2>
              <span className="px-2.5 py-0.5 rounded-full text-[11px] font-medium border"
                style={{ background: 'rgba(13,148,136,0.1)', borderColor: 'rgba(13,148,136,0.2)', color: '#5EEAD4' }}>
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

        {error && (
          <div className="rounded-xl p-3 text-sm text-red-400 bg-red-500/10 border border-red-500/20">{error}</div>
        )}

        <div className="rounded-2xl border border-white/5 p-6 space-y-5" style={{ background: 'rgba(30,41,59,0.6)' }}>
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
              <input type="url" value={profile.linkedinUrl || ''} onChange={(e) => updateField('linkedinUrl', e.target.value)}
                placeholder="https://linkedin.com/in/..." className="input-dark" />
            </div>
            <div>
              <label className="block text-xs font-semibold text-white/40 mb-1.5 uppercase tracking-wide">Website</label>
              <input type="url" value={profile.websiteUrl || ''} onChange={(e) => updateField('websiteUrl', e.target.value)}
                placeholder="https://..." className="input-dark" />
            </div>
          </div>
        </div>

        <div className="rounded-2xl border border-white/5 p-6 space-y-4" style={{ background: 'rgba(30,41,59,0.6)' }}>
          <h3 className="text-sm font-semibold text-white/60 uppercase tracking-wider">Industries</h3>
          <div className="flex flex-wrap gap-2">
            {industryOptions.map((ind) => {
              const selected = (profile.industries || []).includes(ind);
              return (
                <button key={ind} onClick={() => toggleIndustry(ind)}
                  className={`px-3 py-1.5 rounded-full text-xs font-medium border transition ${
                    selected
                      ? 'border-teal-500/40 text-teal-300'
                      : 'border-white/10 text-white/40 hover:border-white/20 hover:text-white/60'
                  }`}
                  style={selected ? { background: 'rgba(13,148,136,0.15)' } : { background: 'rgba(255,255,255,0.03)' }}>
                  {ind.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase()).replace(/\bAi Ml\b/, 'AI/ML').replace(/\bSaas\b/, 'SaaS').replace(/\bE Commerce\b/, 'E-Commerce')}
                </button>
              );
            })}
          </div>
        </div>

        {isFounder && (
          <div className="rounded-2xl border border-white/5 p-6 space-y-4" style={{ background: 'rgba(30,41,59,0.6)' }}>
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
          </div>
        )}

        {isInvestor && (
          <div className="rounded-2xl border border-white/5 p-6 space-y-4" style={{ background: 'rgba(30,41,59,0.6)' }}>
            <h3 className="text-sm font-semibold text-white/60 uppercase tracking-wider">Investor Details</h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-semibold text-white/40 mb-1.5 uppercase tracking-wide">Fund Name</label>
                <input type="text" value={profile.fundName || ''} onChange={(e) => updateField('fundName', e.target.value)}
                  placeholder="Fund name" className="input-dark" />
              </div>
              <div>
                <label className="block text-xs font-semibold text-white/40 mb-1.5 uppercase tracking-wide">Portfolio Size</label>
                <input type="number" value={profile.portfolioSize || ''} onChange={(e) => updateField('portfolioSize', parseInt(e.target.value) || undefined)}
                  placeholder="Number of investments" className="input-dark" />
              </div>
            </div>
          </div>
        )}

        {isTalent && (
          <div className="rounded-2xl border border-white/5 p-6 space-y-4" style={{ background: 'rgba(30,41,59,0.6)' }}>
            <h3 className="text-sm font-semibold text-white/60 uppercase tracking-wider">Talent Details</h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-semibold text-white/40 mb-1.5 uppercase tracking-wide">Years of Experience</label>
                <input type="number" value={profile.yearsExperience || ''} onChange={(e) => updateField('yearsExperience', parseInt(e.target.value) || undefined)}
                  placeholder="Years" className="input-dark" />
              </div>
              <div>
                <label className="block text-xs font-semibold text-white/40 mb-1.5 uppercase tracking-wide">Preferred Role</label>
                <input type="text" value={profile.preferredRole || ''} onChange={(e) => updateField('preferredRole', e.target.value)}
                  placeholder="e.g. Senior Engineer" className="input-dark" />
              </div>
            </div>
          </div>
        )}

        <div className="flex justify-end pt-4 pb-8">
          <button onClick={handleSave} disabled={saving}
            className="px-8 py-3 rounded-2xl text-white font-semibold text-sm transition-all disabled:opacity-40 shadow-lg shadow-teal-500/20"
            style={{ background: 'linear-gradient(135deg, #0D9488, #0F766E)' }}>
            {saving ? 'Saving...' : saved ? 'Saved ✓' : 'Save Changes'}
          </button>
        </div>
      </div>
    </div>
  );
}
