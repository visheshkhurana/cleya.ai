'use client';
import { useEffect, useState } from 'react';
import { api } from '@/lib/api';
import { useTranslation } from '@/lib/i18n';

export interface TemplateItem {
  id: string;
  name: string;
  body: string;
  category?: string;
  description?: string;
  ownerId?: string | null;
  isDefault?: boolean;
}

interface Props {
  matchId?: string;
  initialBody?: string;
  onChange: (body: string) => void;
}

export default function IntroTemplatePicker({ matchId, initialBody, onChange }: Props) {
  const { t } = useTranslation();
  const [defaults, setDefaults] = useState<TemplateItem[]>([]);
  const [custom, setCustom] = useState<TemplateItem[]>([]);
  const [body, setBody] = useState(initialBody || '');
  const [active, setActive] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [savingNew, setSavingNew] = useState(false);
  const [newName, setNewName] = useState('');
  const [renamingId, setRenamingId] = useState<string | null>(null);
  const [renameValue, setRenameValue] = useState('');

  const load = async () => {
    try {
      const data: any = await api.getIntroTemplates();
      setDefaults((data?.defaults || []).map((d: any) => ({ ...d, isDefault: true })));
      setCustom((data?.custom || []).map((d: any) => ({ ...d, isDefault: false })));
    } catch (e: any) {
      setError(e?.message || t('common.error'));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, []);

  const updateBody = (next: string) => {
    setBody(next);
    onChange(next);
  };

  const apply = async (tpl: TemplateItem) => {
    setActive(tpl.id);
    try {
      const res: any = await api.renderIntroTemplate({ templateId: tpl.id, matchId });
      const filled = res?.body || tpl.body;
      updateBody(filled);
    } catch {
      updateBody(tpl.body);
    }
  };

  const handleSaveCurrent = async () => {
    setError('');
    if (!newName.trim()) { setError(t('intro.tplNameRequired')); return; }
    if (body.trim().length < 10) { setError(t('intro.editMinLength')); return; }
    setBusy(true);
    try {
      await api.createIntroTemplate({ name: newName.trim(), category: 'CUSTOM', body });
      setNewName('');
      setSavingNew(false);
      await load();
    } catch (e: any) {
      setError(e?.message || t('common.error'));
    } finally {
      setBusy(false);
    }
  };

  const handleRename = async (id: string) => {
    setError('');
    if (!renameValue.trim()) { setError(t('intro.tplNameRequired')); return; }
    setBusy(true);
    try {
      await api.updateIntroTemplate(id, { name: renameValue.trim() });
      setRenamingId(null);
      setRenameValue('');
      await load();
    } catch (e: any) {
      setError(e?.message || t('common.error'));
    } finally {
      setBusy(false);
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm(t('intro.tplConfirmDelete'))) return;
    setBusy(true);
    setError('');
    try {
      await api.deleteIntroTemplate(id);
      if (active === id) setActive(null);
      await load();
    } catch (e: any) {
      setError(e?.message || t('common.error'));
    } finally {
      setBusy(false);
    }
  };

  const all: TemplateItem[] = [...custom, ...defaults];

  return (
    <div className="space-y-3">
      <div>
        <p className="text-[10px] uppercase tracking-wider text-white/40 mb-2">
          {t('intro.templates')} {!loading && `(${all.length})`}
        </p>
        {loading ? (
          <p className="text-xs text-white/40">{t('common.loading')}</p>
        ) : (
          <div className="flex flex-wrap gap-2">
            {all.map((tpl) => (
              <div
                key={tpl.id}
                className="flex items-center gap-1 rounded-full border px-1 py-0.5 text-[11px] transition"
                style={{
                  background: active === tpl.id ? 'rgba(108,99,255,0.15)' : 'rgba(255,255,255,0.04)',
                  borderColor: active === tpl.id ? 'rgba(108,99,255,0.3)' : 'rgba(255,255,255,0.08)',
                }}
              >
                {renamingId === tpl.id ? (
                  <>
                    <input
                      value={renameValue}
                      onChange={(e) => setRenameValue(e.target.value)}
                      className="bg-transparent text-[11px] text-white border border-white/10 rounded px-2 py-0.5 outline-none w-32"
                      placeholder={t('intro.tplNamePlaceholder')}
                      maxLength={80}
                      autoFocus
                    />
                    <button
                      type="button"
                      onClick={() => handleRename(tpl.id)}
                      disabled={busy}
                      className="text-[10px] px-2 py-0.5 rounded text-white"
                      style={{ background: 'linear-gradient(135deg, #6C63FF, #4ECDC4)' }}
                    >
                      {t('common.save')}
                    </button>
                    <button
                      type="button"
                      onClick={() => { setRenamingId(null); setRenameValue(''); }}
                      className="text-[10px] px-2 py-0.5 rounded text-white/40 hover:text-white/60"
                    >
                      {t('common.cancel')}
                    </button>
                  </>
                ) : (
                  <>
                    <button
                      type="button"
                      onClick={() => apply(tpl)}
                      title={tpl.description || tpl.name}
                      className="px-2 py-1 rounded-full font-medium"
                      style={{ color: active === tpl.id ? '#9B95FF' : 'rgba(255,255,255,0.7)' }}
                    >
                      {tpl.name}
                    </button>
                    {!tpl.isDefault ? (
                      <span
                        className="px-1.5 py-0.5 rounded text-[9px] font-bold uppercase tracking-wider"
                        style={{ background: 'rgba(78,205,196,0.15)', color: '#4ECDC4' }}
                      >
                        {t('intro.tplYours')}
                      </span>
                    ) : null}
                    {!tpl.isDefault && (
                      <>
                        <button
                          type="button"
                          onClick={() => { setRenamingId(tpl.id); setRenameValue(tpl.name); }}
                          className="text-[10px] px-1.5 text-white/50 hover:text-white/80"
                          title={t('intro.tplRename')}
                        >
                          ✎
                        </button>
                        <button
                          type="button"
                          onClick={() => handleDelete(tpl.id)}
                          disabled={busy}
                          className="text-[10px] px-1.5 text-red-400/60 hover:text-red-400 disabled:opacity-50"
                          title={t('common.delete')}
                        >
                          ✕
                        </button>
                      </>
                    )}
                  </>
                )}
              </div>
            ))}
            {all.length === 0 && (
              <p className="text-xs text-white/40">{t('intro.tplEmpty')}</p>
            )}
          </div>
        )}
      </div>

      <div>
        <p className="text-[10px] uppercase tracking-wider text-white/40 mb-2">{t('intro.preview')}</p>
        <textarea
          value={body}
          onChange={(e) => updateBody(e.target.value)}
          rows={10}
          className="w-full bg-transparent text-white/80 text-sm leading-relaxed resize-none outline-none border rounded-lg p-3 font-mono"
          style={{ borderColor: 'rgba(108,99,255,0.3)' }}
          placeholder={t('intro.tplPlaceholder')}
        />
        <p className="text-[10px] text-white/30 mt-1">{t('intro.tplVarsHint')}</p>
      </div>

      <div className="border-t border-white/5 pt-3">
        {savingNew ? (
          <div className="space-y-2">
            <input
              value={newName}
              onChange={(e) => setNewName(e.target.value)}
              className="w-full bg-transparent text-xs text-white border border-white/10 rounded px-2 py-2 outline-none"
              placeholder={t('intro.tplNamePlaceholder')}
              maxLength={80}
              autoFocus
            />
            <div className="flex gap-2">
              <button
                type="button"
                onClick={handleSaveCurrent}
                disabled={busy}
                className="flex-1 text-xs py-2 rounded-lg text-white font-medium disabled:opacity-50"
                style={{ background: 'linear-gradient(135deg, #6C63FF, #4ECDC4)' }}
              >
                {busy ? t('intro.saving') : t('intro.tplSave')}
              </button>
              <button
                type="button"
                onClick={() => { setSavingNew(false); setNewName(''); setError(''); }}
                className="px-3 text-xs py-2 rounded-lg text-white/50 hover:text-white/70"
              >
                {t('common.cancel')}
              </button>
            </div>
          </div>
        ) : (
          <button
            type="button"
            onClick={() => { setSavingNew(true); setError(''); }}
            disabled={body.trim().length < 10}
            title={body.trim().length < 10 ? t('intro.editMinLength') : ''}
            className="w-full text-xs py-2 rounded-lg text-white/70 hover:text-white border border-dashed border-white/15 hover:border-white/30 transition disabled:opacity-40 disabled:cursor-not-allowed"
          >
            + {t('intro.tplSaveCurrent')}
          </button>
        )}
      </div>

      {error && <p className="text-xs text-red-400/80">{error}</p>}
    </div>
  );
}
