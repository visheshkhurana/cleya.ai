'use client';
import { useEffect, useState } from 'react';
import { api } from '@/lib/api';

interface Template {
  id: string;
  name: string;
  category: string;
  description?: string;
  body: string;
  isDefault: boolean;
}

export default function IntroTemplatePicker({
  matchId,
  initialBody,
  onChange,
}: {
  matchId?: string;
  initialBody?: string;
  onChange: (body: string) => void;
}) {
  const [templates, setTemplates] = useState<Template[]>([]);
  const [active, setActive] = useState<string | null>(null);
  const [body, setBody] = useState(initialBody || '');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api.getIntroTemplates()
      .then((res: any) => {
        const data = res?.data || res || {};
        setTemplates([...(data.defaults || []), ...(data.custom || [])]);
      })
      .catch(() => null)
      .finally(() => setLoading(false));
  }, []);

  const apply = async (tpl: Template) => {
    setActive(tpl.id);
    try {
      const res: any = await api.renderIntroTemplate({ templateId: tpl.id, matchId });
      const filled = res?.data?.body || res?.body || tpl.body;
      setBody(filled);
      onChange(filled);
    } catch {
      setBody(tpl.body);
      onChange(tpl.body);
    }
  };

  return (
    <div className="space-y-3">
      <div>
        <p className="text-[10px] uppercase tracking-wider text-white/40 mb-2">Pick a template</p>
        {loading ? (
          <p className="text-xs text-white/40">Loading templates…</p>
        ) : (
          <div className="flex flex-wrap gap-2">
            {templates.map((t) => (
              <button
                key={t.id}
                onClick={() => apply(t)}
                className="px-3 py-1.5 rounded-full text-[11px] font-medium border transition"
                style={{
                  background: active === t.id ? 'rgba(108,99,255,0.15)' : 'rgba(255,255,255,0.04)',
                  color: active === t.id ? '#9B95FF' : 'rgba(255,255,255,0.6)',
                  borderColor: active === t.id ? 'rgba(108,99,255,0.3)' : 'rgba(255,255,255,0.08)',
                }}
                title={t.description || t.name}
              >
                {t.name}
              </button>
            ))}
          </div>
        )}
      </div>

      <div>
        <p className="text-[10px] uppercase tracking-wider text-white/40 mb-2">Message</p>
        <textarea
          value={body}
          onChange={(e) => { setBody(e.target.value); onChange(e.target.value); }}
          rows={10}
          className="input-dark resize-none font-mono text-xs leading-relaxed"
          placeholder="Pick a template above, or draft your own intro message…"
        />
        <p className="text-[10px] text-white/30 mt-1">Variables in [brackets] will be filled with profile data when sent.</p>
      </div>
    </div>
  );
}
