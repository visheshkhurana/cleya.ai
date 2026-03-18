'use client';

import { useState } from 'react';
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
      if (field.required && (!val || (typeof val === 'string' && val.trim() === ''))) {
        newErrors[field.name] = `${field.label} is required`; continue;
      }
      if (!val) continue;
      if (field.type === 'email' && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(val)) newErrors[field.name] = 'Invalid email';
      if (field.type === 'url') { try { new URL(val); } catch { newErrors[field.name] = 'Invalid URL'; } }
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
    onSubmit(values);
  };

  const isFieldVisible = (field: FormField) => {
    if (!field.conditional) return true;
    return values[field.conditional.field] === field.conditional.value;
  };

  const toggleMultiselect = (name: string, value: string) => {
    const current = values[name] || [];
    const updated = current.includes(value) ? current.filter((v: string) => v !== value) : [...current, value];
    handleChange(name, updated);
  };

  const inputClass = `w-full px-3 py-2.5 rounded-xl border border-white/10 bg-white/5 text-white
    placeholder-white/30 text-sm focus:outline-none focus:ring-2 focus:ring-boardy-500
    focus:border-transparent disabled:opacity-40 transition-all`;

  return (
    <form onSubmit={handleSubmit} className="max-w-[85%] mb-3 space-y-4 fade-up">
      <div className="glass-card p-5 space-y-4">
        {fields.filter(isFieldVisible).map((field) => (
          <div key={field.name}>
            <label className="block text-xs font-semibold text-white/50 mb-1.5 uppercase tracking-wide">
              {field.label}
              {field.required && <span className="text-boardy-400 ml-0.5">*</span>}
            </label>

            {field.type === 'select' && field.options && (
              <select
                value={values[field.name] || ''}
                onChange={(e) => handleChange(field.name, e.target.value)}
                disabled={submitted}
                className={inputClass + ' appearance-none'}
              >
                <option value="">Select...</option>
                {field.options.map((opt) => (
                  <option key={opt.value} value={opt.value}>{opt.label}</option>
                ))}
              </select>
            )}

            {field.type === 'multiselect' && field.options && (
              <div className="flex flex-wrap gap-2">
                {field.options.map((opt) => {
                  const sel = (values[field.name] || []).includes(opt.value);
                  return (
                    <button
                      key={opt.value}
                      type="button"
                      onClick={() => toggleMultiselect(field.name, opt.value)}
                      disabled={submitted}
                      className={`px-3 py-1.5 rounded-full text-xs font-medium border transition-all
                        ${sel ? 'bg-boardy-500 text-white border-boardy-500' : 'border-white/20 text-white/60 hover:border-boardy-500/50'}
                        disabled:opacity-40`}
                    >
                      {opt.label}
                    </button>
                  );
                })}
              </div>
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

            {!['select', 'multiselect', 'textarea', 'phone'].includes(field.type) && (
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
