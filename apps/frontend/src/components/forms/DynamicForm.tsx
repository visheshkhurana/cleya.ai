'use client';

import { useState, useRef, useEffect } from 'react';
import PhoneInput, { validatePhone } from '@/components/PhoneInput';

interface FormField {
  name: string;
  type: string;
  label: string;
  placeholder?: string;
  required?: boolean;
  options?: { label: string; value: string }[];
  validation?: { min?: number; max?: number; pattern?: string; message?: string };
  conditional?: { field: string; value: any };
}

interface DynamicFormProps {
  fields: FormField[];
  onSubmit: (data: Record<string, any>) => void;
  disabled?: boolean;
}

export function DynamicForm({ fields, onSubmit, disabled }: DynamicFormProps) {
  const [values, setValues] = useState<Record<string, any>>({});
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [submitted, setSubmitted] = useState(false);
  const [openSelect, setOpenSelect] = useState<string | null>(null);
  const [customOtherInputs, setCustomOtherInputs] = useState<Record<string, boolean>>({});
  const [customOtherValues, setCustomOtherValues] = useState<Record<string, string>>({});
  const selectRefs = useRef<Record<string, HTMLDivElement | null>>({});

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (openSelect) {
        const ref = selectRefs.current[openSelect];
        if (ref && !ref.contains(e.target as Node)) {
          setOpenSelect(null);
        }
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [openSelect]);

  const handleChange = (name: string, value: any) => {
    setValues((prev) => ({ ...prev, [name]: value }));
    if (errors[name]) {
      setErrors((prev) => { const next = { ...prev }; delete next[name]; return next; });
    }
  };

  const validate = (): boolean => {
    const newErrors: Record<string, string> = {};
    for (const field of fields) {
      if (field.conditional && values[field.conditional.field] !== field.conditional.value) continue;
      const val = values[field.name];
      if (field.required && (!val || (typeof val === 'string' && val.trim() === '') || (Array.isArray(val) && val.length === 0))) {
        newErrors[field.name] = `${field.label} is required`; continue;
      }
      if (!val) continue;
      if (field.type === 'email' && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(val)) newErrors[field.name] = 'Invalid email';
      if (field.name === 'linkedinUrl' && typeof val === 'string') {
        const v = val.trim();
        if (v) {
          try {
            const u = new URL(/^https?:\/\//i.test(v) ? v : `https://${v}`);
            const host = u.hostname.replace(/^www\./, '');
            if (!/^([a-z]{2,3}\.)?linkedin\.com$/i.test(host) || !/^\/in\/[^/?#]+/.test(u.pathname)) {
              newErrors[field.name] = 'Enter a valid LinkedIn profile URL (e.g. https://linkedin.com/in/your-handle)';
            }
          } catch {
            newErrors[field.name] = 'Enter a valid LinkedIn profile URL';
          }
        }
      } else if (field.type === 'url' && field.name !== 'linkedinUrl') { try { new URL(val); } catch { newErrors[field.name] = 'Invalid URL'; } }
      if (field.type === 'phone' && val) {
        const phoneErr = validatePhone(val);
        if (phoneErr) newErrors[field.name] = phoneErr;
      }
      if (field.validation?.max && typeof val === 'string' && val.length > field.validation.max)
        newErrors[field.name] = `Max ${field.validation.max} characters`;
    }
    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (disabled || submitted) return;
    if (!validate()) return;
    setSubmitted(true);
    const submitValues = { ...values };
    if (submitValues.linkedinUrl && typeof submitValues.linkedinUrl === 'string') {
      const v = submitValues.linkedinUrl.trim();
      if (v) {
        try {
          const u = new URL(/^https?:\/\//i.test(v) ? v : `https://${v}`);
          const host = u.hostname.replace(/^www\./, '');
          const m = u.pathname.match(/^\/in\/([^/?#]+)/);
          if (/^([a-z]{2,3}\.)?linkedin\.com$/i.test(host) && m) {
            submitValues.linkedinUrl = `https://linkedin.com/in/${m[1]}`;
          }
        } catch { /* leave as-is; validate() should have caught it */ }
      }
    }
    onSubmit(submitValues);
  };

  const isFieldVisible = (field: FormField) => {
    if (!field.conditional) return true;
    return values[field.conditional.field] === field.conditional.value;
  };

  const toggleMultiselect = (name: string, value: string) => {
    if (value === 'other') {
      setCustomOtherInputs((prev) => ({ ...prev, [name]: !prev[name] }));
      return;
    }
    const current = values[name] || [];
    const updated = current.includes(value) ? current.filter((v: string) => v !== value) : [...current, value];
    handleChange(name, updated);
  };

  const addCustomOtherValue = (fieldName: string) => {
    const trimmed = (customOtherValues[fieldName] || '').trim().toLowerCase().replace(/\s+/g, '_');
    if (!trimmed) return;
    const current = values[fieldName] || [];
    if (!current.includes(trimmed)) {
      handleChange(fieldName, [...current, trimmed]);
    }
    setCustomOtherValues((prev) => ({ ...prev, [fieldName]: '' }));
    setCustomOtherInputs((prev) => ({ ...prev, [fieldName]: false }));
  };

  const isLinkedInField = (field: FormField) => field.name === 'linkedinUrl';

  const inputClass = `w-full px-3 py-2.5 rounded-xl border border-white/10 bg-white/5 text-white
    placeholder-white/30 text-sm focus:outline-none focus:ring-2 focus:ring-brand-violet
    focus:border-transparent disabled:opacity-40 transition-all`;

  return (
    <form onSubmit={handleSubmit} className="max-w-[85%] mb-3 space-y-4 fade-up">
      <div className="glass-card p-5 space-y-4">
        {fields.filter(isFieldVisible).map((field) => (
          <div key={field.name}>
            <label className="block text-xs font-semibold text-white/50 mb-1.5 uppercase tracking-wide">
              {field.label}
              {field.required && <span className="text-brand-teal ml-0.5">*</span>}
            </label>

            {field.type === 'select' && field.options && (
              <div
                ref={(el) => { selectRefs.current[field.name] = el; }}
                className="relative"
              >
                <button
                  type="button"
                  onClick={() => setOpenSelect(openSelect === field.name ? null : field.name)}
                  disabled={submitted}
                  className={`${inputClass} text-left flex items-center justify-between`}
                >
                  <span className={values[field.name] ? 'text-white' : 'text-white/30'}>
                    {values[field.name]
                      ? field.options.find((o) => o.value === values[field.name])?.label || values[field.name]
                      : 'Select...'}
                  </span>
                  <svg className="w-4 h-4 text-white/40 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                  </svg>
                </button>
                {openSelect === field.name && (
                  <div className="absolute z-50 mt-1 w-full rounded-xl border border-white/10 overflow-hidden shadow-xl"
                    style={{ background: 'rgba(10,10,26,0.95)', backdropFilter: 'blur(12px)' }}>
                    <div className="max-h-60 overflow-y-auto py-1">
                      {values[field.name] && (
                        <button
                          type="button"
                          onClick={() => {
                            handleChange(field.name, '');
                            setOpenSelect(null);
                          }}
                          className="w-full text-left px-3 py-2 text-sm text-white/30 hover:bg-white/5 hover:text-white/50 transition-colors"
                        >
                          Select...
                        </button>
                      )}
                      {field.options.map((opt) => (
                        <button
                          key={opt.value}
                          type="button"
                          onClick={() => {
                            handleChange(field.name, opt.value);
                            setOpenSelect(null);
                          }}
                          className={`w-full text-left px-3 py-2 text-sm transition-colors ${
                            values[field.name] === opt.value
                              ? 'text-white bg-white/10'
                              : 'text-white/70 hover:bg-white/5 hover:text-white'
                          }`}
                        >
                          {opt.label}
                        </button>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            )}

            {field.type === 'multiselect' && field.options && (
              <>
                <div className="flex flex-wrap gap-2">
                  {field.options.map((opt) => {
                    const sel = opt.value === 'other'
                      ? !!customOtherInputs[field.name]
                      : (values[field.name] || []).includes(opt.value);
                    return (
                      <button
                        key={opt.value}
                        type="button"
                        onClick={() => toggleMultiselect(field.name, opt.value)}
                        disabled={submitted}
                        className={`px-3 py-1.5 rounded-full text-xs font-medium border transition-all
                          ${sel ? 'bg-brand-violet text-white border-brand-violet' : 'border-white/20 text-white/60 hover:border-brand-violet/50'}
                          disabled:opacity-40`}
                      >
                        {opt.label}
                      </button>
                    );
                  })}
                </div>
                {customOtherInputs[field.name] && (
                  <div className="flex items-center gap-2 mt-2">
                    <input
                      type="text"
                      value={customOtherValues[field.name] || ''}
                      onChange={(e) => setCustomOtherValues((prev) => ({ ...prev, [field.name]: e.target.value }))}
                      placeholder={`Enter custom ${field.label.toLowerCase()}`}
                      disabled={submitted}
                      className={inputClass + ' flex-1'}
                      onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); addCustomOtherValue(field.name); } }}
                    />
                    <button
                      type="button"
                      onClick={() => addCustomOtherValue(field.name)}
                      disabled={submitted}
                      className="px-4 py-2.5 rounded-xl text-xs font-semibold text-white transition bg-brand-violet hover:bg-brand-violet disabled:opacity-40"
                    >
                      Add
                    </button>
                  </div>
                )}
                {(values[field.name] || []).filter((v: string) => !(field.options || []).some((o) => o.value === v)).length > 0 && (
                  <div className="flex flex-wrap gap-2 mt-2">
                    {(values[field.name] || []).filter((v: string) => !(field.options || []).some((o) => o.value === v)).map((val: string) => (
                      <span key={val} className="px-3 py-1.5 rounded-full text-xs font-medium border border-brand-violet text-white bg-brand-violet/20 flex items-center gap-1.5">
                        {val.replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase())}
                        <button
                          type="button"
                          onClick={() => handleChange(field.name, (values[field.name] || []).filter((v: string) => v !== val))}
                          className="text-white/40 hover:text-white/70 text-xs"
                        >×</button>
                      </span>
                    ))}
                  </div>
                )}
              </>
            )}

            {field.type === 'textarea' && (
              <textarea
                value={values[field.name] || ''}
                onChange={(e) => handleChange(field.name, e.target.value)}
                placeholder={field.placeholder}
                disabled={submitted}
                rows={3}
                className={inputClass + ' resize-none'}
              />
            )}

            {field.type === 'phone' && (
              <PhoneInput
                value={values[field.name] || ''}
                onChange={(val) => handleChange(field.name, val)}
                placeholder={field.placeholder || '98765 43210'}
                disabled={submitted}
              />
            )}

            {isLinkedInField(field) && (
              <input
                type="url"
                inputMode="url"
                autoCapitalize="off"
                autoCorrect="off"
                spellCheck={false}
                value={values[field.name] || ''}
                onChange={(e) => handleChange(field.name, e.target.value)}
                onBlur={(e) => {
                  const v = e.target.value.trim();
                  if (!v) return;
                  try {
                    const url = new URL(/^https?:\/\//i.test(v) ? v : `https://${v}`);
                    if (/linkedin\.com$/i.test(url.hostname.replace(/^www\./, ''))) {
                      const m = url.pathname.match(/^\/in\/([^/?#]+)/);
                      if (m) handleChange(field.name, `https://linkedin.com/in/${m[1]}`);
                    }
                  } catch {}
                }}
                placeholder="https://linkedin.com/in/your-profile"
                disabled={submitted}
                className="input-dark"
              />
            )}

            {!['select', 'multiselect', 'textarea', 'phone'].includes(field.type) && !isLinkedInField(field) && (
              <input
                type={field.type === 'number' ? 'number' : 'text'}
                value={values[field.name] || ''}
                onChange={(e) => handleChange(field.name, e.target.value)}
                placeholder={field.placeholder}
                disabled={submitted}
                className={inputClass}
              />
            )}

            {errors[field.name] && (
              <p className="text-xs text-red-400 mt-1">{errors[field.name]}</p>
            )}
          </div>
        ))}
      </div>

      <button type="submit" disabled={submitted} className="btn-primary">
        {submitted ? 'Submitted ✓' : 'Continue →'}
      </button>
    </form>
  );
}
