'use client';

import { useState } from 'react';

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
      setErrors((prev) => {
        const next = { ...prev };
        delete next[name];
        return next;
      });
    }
  };

  const validate = (): boolean => {
    const newErrors: Record<string, string> = {};

    for (const field of fields) {
      // Check conditional visibility
      if (field.conditional) {
        if (values[field.conditional.field] !== field.conditional.value) continue;
      }

      const val = values[field.name];

      if (field.required && (!val || (typeof val === 'string' && val.trim() === ''))) {
        newErrors[field.name] = `${field.label} is required`;
        continue;
      }

      if (!val) continue;

      if (field.type === 'email' && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(val)) {
        newErrors[field.name] = 'Invalid email';
      }

      if (field.type === 'url') {
        try { new URL(val); } catch { newErrors[field.name] = 'Invalid URL'; }
      }

      if (field.validation?.max && typeof val === 'string' && val.length > field.validation.max) {
        newErrors[field.name] = `Max ${field.validation.max} characters`;
      }
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
    const updated = current.includes(value)
      ? current.filter((v: string) => v !== value)
      : [...current, value];
    handleChange(name, updated);
  };

  return (
    <form onSubmit={handleSubmit} className="max-w-[85%] mb-3 space-y-4">
      <div className="bg-white rounded-2xl border border-gray-200 p-5 shadow-sm space-y-4">
        {fields.filter(isFieldVisible).map((field) => (
          <div key={field.name}>
            <label className="block text-xs font-semibold text-gray-600 mb-1.5">
              {field.label}
              {field.required && <span className="text-red-400 ml-0.5">*</span>}
            </label>

            {field.type === 'select' && field.options && (
              <select
                value={values[field.name] || ''}
                onChange={(e) => handleChange(field.name, e.target.value)}
                disabled={submitted}
                className="w-full px-3 py-2.5 rounded-lg border border-gray-200 text-sm
                           focus:outline-none focus:ring-2 focus:ring-boardy-500 focus:border-transparent
                           disabled:opacity-50 disabled:bg-gray-50"
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
                  const selected = (values[field.name] || []).includes(opt.value);
                  return (
                    <button
                      key={opt.value}
                      type="button"
                      onClick={() => toggleMultiselect(field.name, opt.value)}
                      disabled={submitted}
                      className={`px-3 py-1.5 rounded-full text-xs font-medium border transition-all
                        ${selected
                          ? 'bg-boardy-600 text-white border-boardy-600'
                          : 'bg-white text-gray-600 border-gray-200 hover:border-boardy-400'
                        } disabled:opacity-50`}
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
                className="w-full px-3 py-2.5 rounded-lg border border-gray-200 text-sm resize-none
                           focus:outline-none focus:ring-2 focus:ring-boardy-500 focus:border-transparent
                           disabled:opacity-50 disabled:bg-gray-50"
              />
            )}

            {!['select', 'multiselect', 'textarea'].includes(field.type) && (
              <input
                type={field.type === 'phone' ? 'tel' : field.type === 'number' ? 'number' : 'text'}
                value={values[field.name] || ''}
                onChange={(e) => handleChange(field.name, e.target.value)}
                placeholder={field.placeholder}
                disabled={submitted}
                className="w-full px-3 py-2.5 rounded-lg border border-gray-200 text-sm
                           focus:outline-none focus:ring-2 focus:ring-boardy-500 focus:border-transparent
                           disabled:opacity-50 disabled:bg-gray-50"
              />
            )}

            {errors[field.name] && (
              <p className="text-xs text-red-500 mt-1">{errors[field.name]}</p>
            )}
          </div>
        ))}
      </div>

      <button
        type="submit"
        disabled={submitted}
        className="w-full py-3 rounded-xl bg-boardy-600 text-white font-semibold text-sm
                   hover:bg-boardy-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
      >
        {submitted ? 'Submitted ✓' : 'Continue →'}
      </button>
    </form>
  );
}
