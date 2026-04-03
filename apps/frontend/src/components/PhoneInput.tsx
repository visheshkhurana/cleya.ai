'use client';

import { useState, useRef, useEffect } from 'react';

interface Country {
  code: string;
  name: string;
  dial: string;
  flag: string;
  digits: number | [number, number];
}

const countries: Country[] = [
  { code: 'IN', name: 'India', dial: '+91', flag: '🇮🇳', digits: 10 },
  { code: 'US', name: 'United States', dial: '+1', flag: '🇺🇸', digits: 10 },
  { code: 'GB', name: 'United Kingdom', dial: '+44', flag: '🇬🇧', digits: 10 },
  { code: 'AE', name: 'UAE', dial: '+971', flag: '🇦🇪', digits: [7, 9] },
  { code: 'SG', name: 'Singapore', dial: '+65', flag: '🇸🇬', digits: 8 },
  { code: 'AU', name: 'Australia', dial: '+61', flag: '🇦🇺', digits: 9 },
  { code: 'CA', name: 'Canada', dial: '+1', flag: '🇨🇦', digits: 10 },
  { code: 'DE', name: 'Germany', dial: '+49', flag: '🇩🇪', digits: [7, 12] },
  { code: 'FR', name: 'France', dial: '+33', flag: '🇫🇷', digits: 9 },
  { code: 'JP', name: 'Japan', dial: '+81', flag: '🇯🇵', digits: [9, 10] },
  { code: 'KR', name: 'South Korea', dial: '+82', flag: '🇰🇷', digits: [9, 10] },
  { code: 'CN', name: 'China', dial: '+86', flag: '🇨🇳', digits: 11 },
  { code: 'BR', name: 'Brazil', dial: '+55', flag: '🇧🇷', digits: [10, 11] },
  { code: 'IL', name: 'Israel', dial: '+972', flag: '🇮🇱', digits: [7, 9] },
  { code: 'NL', name: 'Netherlands', dial: '+31', flag: '🇳🇱', digits: 9 },
  { code: 'SE', name: 'Sweden', dial: '+46', flag: '🇸🇪', digits: [7, 9] },
  { code: 'CH', name: 'Switzerland', dial: '+41', flag: '🇨🇭', digits: 9 },
  { code: 'ID', name: 'Indonesia', dial: '+62', flag: '🇮🇩', digits: [9, 12] },
  { code: 'MY', name: 'Malaysia', dial: '+60', flag: '🇲🇾', digits: [9, 10] },
  { code: 'PH', name: 'Philippines', dial: '+63', flag: '🇵🇭', digits: 10 },
  { code: 'TH', name: 'Thailand', dial: '+66', flag: '🇹🇭', digits: 9 },
  { code: 'VN', name: 'Vietnam', dial: '+84', flag: '🇻🇳', digits: [9, 10] },
  { code: 'ZA', name: 'South Africa', dial: '+27', flag: '🇿🇦', digits: 9 },
  { code: 'NG', name: 'Nigeria', dial: '+234', flag: '🇳🇬', digits: [7, 8] },
  { code: 'KE', name: 'Kenya', dial: '+254', flag: '🇰🇪', digits: 9 },
  { code: 'MX', name: 'Mexico', dial: '+52', flag: '🇲🇽', digits: 10 },
  { code: 'AR', name: 'Argentina', dial: '+54', flag: '🇦🇷', digits: 10 },
  { code: 'CO', name: 'Colombia', dial: '+57', flag: '🇨🇴', digits: 10 },
  { code: 'CL', name: 'Chile', dial: '+56', flag: '🇨🇱', digits: 9 },
  { code: 'NZ', name: 'New Zealand', dial: '+64', flag: '🇳🇿', digits: [8, 10] },
  { code: 'IE', name: 'Ireland', dial: '+353', flag: '🇮🇪', digits: [7, 9] },
  { code: 'PK', name: 'Pakistan', dial: '+92', flag: '🇵🇰', digits: 10 },
  { code: 'BD', name: 'Bangladesh', dial: '+880', flag: '🇧🇩', digits: 10 },
  { code: 'LK', name: 'Sri Lanka', dial: '+94', flag: '🇱🇰', digits: 9 },
  { code: 'NP', name: 'Nepal', dial: '+977', flag: '🇳🇵', digits: 10 },
];

export function validatePhone(value: string): string | null {
  if (!value) return null;
  if (!value.startsWith('+')) return 'Phone number must start with a country code';

  const digitsOnly = value.replace(/[\s\-]/g, '');

  const sorted = [...countries].sort((a, b) => b.dial.length - a.dial.length);
  const matched = sorted.find(c => digitsOnly.startsWith(c.dial));
  if (!matched) return 'Invalid country code';

  const localDigits = digitsOnly.slice(matched.dial.length).replace(/\D/g, '');
  if (!localDigits) return 'Please enter your phone number';

  const { digits } = matched;
  if (typeof digits === 'number') {
    if (localDigits.length !== digits) {
      return `${matched.name} phone numbers must be ${digits} digits (after ${matched.dial})`;
    }
  } else {
    const [min, max] = digits;
    if (localDigits.length < min || localDigits.length > max) {
      return `${matched.name} phone numbers must be ${min}–${max} digits (after ${matched.dial})`;
    }
  }

  return null;
}

interface PhoneInputProps {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  disabled?: boolean;
  className?: string;
  defaultCountry?: string;
  showValidation?: boolean;
}

export default function PhoneInput({
  value,
  onChange,
  placeholder = '98765 43210',
  disabled = false,
  className = '',
  defaultCountry = 'IN',
  showValidation = false,
}: PhoneInputProps) {
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState('');
  const [touched, setTouched] = useState(false);
  const [highlightIndex, setHighlightIndex] = useState(-1);
  const [selectedCountry, setSelectedCountry] = useState<Country>(
    countries.find(c => c.code === defaultCountry) || countries[0]
  );
  const dropdownRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const listRef = useRef<HTMLDivElement>(null);
  const searchRef = useRef<HTMLInputElement>(null);

  const validationError = (showValidation || touched) && value ? validatePhone(value) : null;
  const validationId = validationError ? 'phone-validation-error' : undefined;

  useEffect(() => {
    if (!value || !value.startsWith('+')) return;
    const sorted = [...countries].sort((a, b) => b.dial.length - a.dial.length);
    const match = sorted.find(c => value.startsWith(c.dial));
    if (match && match.code !== selectedCountry.code) {
      setSelectedCountry(match);
    }
  }, [value]);

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setOpen(false);
        setSearch('');
        setHighlightIndex(-1);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  useEffect(() => {
    if (open) {
      setHighlightIndex(-1);
    }
  }, [open]);

  const getLocalNumber = () => {
    if (!value) return '';
    if (value.startsWith(selectedCountry.dial)) {
      return value.slice(selectedCountry.dial.length).trim();
    }
    if (value.startsWith('+')) {
      const match = countries.find(c => value.startsWith(c.dial));
      if (match) return value.slice(match.dial.length).trim();
      return value;
    }
    return value;
  };

  const handleNumberChange = (localNumber: string) => {
    const cleaned = localNumber.replace(/[^\d]/g, '');
    if (cleaned) {
      onChange(`${selectedCountry.dial}${cleaned}`);
    } else {
      onChange('');
    }
  };

  const handleCountrySelect = (country: Country) => {
    const localNum = getLocalNumber();
    setSelectedCountry(country);
    setOpen(false);
    setSearch('');
    setHighlightIndex(-1);
    if (localNum) {
      onChange(`${country.dial}${localNum}`);
    }
    inputRef.current?.focus();
  };

  const filtered = search
    ? countries.filter(c =>
        c.name.toLowerCase().includes(search.toLowerCase()) ||
        c.dial.includes(search) ||
        c.code.toLowerCase().includes(search.toLowerCase())
      )
    : countries;

  const handleDropdownKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Escape') {
      e.preventDefault();
      setOpen(false);
      setSearch('');
      setHighlightIndex(-1);
      inputRef.current?.focus();
    } else if (e.key === 'ArrowDown') {
      e.preventDefault();
      setHighlightIndex(prev => (prev < filtered.length - 1 ? prev + 1 : 0));
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setHighlightIndex(prev => (prev > 0 ? prev - 1 : filtered.length - 1));
    } else if (e.key === 'Enter' && highlightIndex >= 0 && highlightIndex < filtered.length) {
      e.preventDefault();
      handleCountrySelect(filtered[highlightIndex]);
    }
  };

  useEffect(() => {
    if (highlightIndex >= 0 && listRef.current) {
      const items = listRef.current.querySelectorAll('[data-country-item]');
      items[highlightIndex]?.scrollIntoView({ block: 'nearest' });
    }
  }, [highlightIndex]);

  const borderColor = validationError ? 'border-red-500/50' : 'border-white/10';

  return (
    <div className={className}>
      <div className={`relative flex`} ref={dropdownRef}>
        <button
          type="button"
          onClick={() => !disabled && setOpen(!open)}
          disabled={disabled}
          aria-label={`Select country, current: ${selectedCountry.name} ${selectedCountry.dial}`}
          aria-expanded={open}
          aria-haspopup="listbox"
          className={`flex items-center gap-1.5 px-3 py-2.5 rounded-l-xl border border-r-0 ${borderColor} bg-white/5 text-white text-sm hover:bg-white/10 transition disabled:opacity-40 flex-shrink-0`}
        >
          <span className="text-base" aria-hidden="true">{selectedCountry.flag}</span>
          <span className="text-white/60 text-xs">{selectedCountry.dial}</span>
          <svg className={`w-3 h-3 text-white/40 transition-transform ${open ? 'rotate-180' : ''}`} fill="none" viewBox="0 0 24 24" stroke="currentColor" aria-hidden="true">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
          </svg>
        </button>

        <input
          ref={inputRef}
          type="tel"
          value={getLocalNumber()}
          onChange={(e) => handleNumberChange(e.target.value)}
          onBlur={() => setTouched(true)}
          placeholder={placeholder}
          disabled={disabled}
          aria-label="Phone number"
          aria-invalid={validationError ? true : undefined}
          aria-describedby={validationId}
          className={`flex-1 min-w-0 px-3 py-2.5 rounded-r-xl border ${borderColor} bg-white/5 text-white placeholder-white/30 text-sm focus:outline-none focus:ring-2 focus:ring-cleya-500 focus:border-transparent disabled:opacity-40 transition-all`}
        />

        {open && (
          <div
            className="absolute top-full left-0 mt-1 w-64 max-h-60 overflow-hidden rounded-xl border border-white/10 bg-[#0a0a1a] shadow-2xl z-50"
            ref={listRef}
          >
            <div className="sticky top-0 p-2 bg-[#0a0a1a] border-b border-white/5">
              <input
                ref={searchRef}
                type="text"
                role="combobox"
                value={search}
                onChange={(e) => { setSearch(e.target.value); setHighlightIndex(-1); }}
                onKeyDown={handleDropdownKeyDown}
                placeholder="Search country..."
                className="w-full px-3 py-2 rounded-lg border border-white/10 bg-white/5 text-white placeholder-white/30 text-xs focus:outline-none focus:ring-1 focus:ring-cleya-500"
                autoFocus
                aria-label="Search countries"
                aria-expanded={true}
                aria-controls="country-listbox"
                aria-activedescendant={highlightIndex >= 0 && filtered[highlightIndex] ? `country-${filtered[highlightIndex].code}` : undefined}
                autoComplete="off"
              />
            </div>
            <div id="country-listbox" role="listbox" aria-label="Countries" className="max-h-48 overflow-auto">
              {filtered.map((country, index) => (
                <div
                  key={country.code}
                  id={`country-${country.code}`}
                  role="option"
                  aria-selected={selectedCountry.code === country.code}
                  data-country-item
                  onClick={() => handleCountrySelect(country)}
                  className={`w-full flex items-center gap-3 px-3 py-2 text-left hover:bg-white/5 transition text-sm cursor-pointer ${
                    selectedCountry.code === country.code ? 'bg-cleya-500/10 text-cleya-400' : 'text-white/70'
                  } ${index === highlightIndex ? 'bg-white/10' : ''}`}
                >
                  <span className="text-base" aria-hidden="true">{country.flag}</span>
                  <span className="flex-1 truncate">{country.name}</span>
                  <span className="text-white/40 text-xs">{country.dial}</span>
                </div>
              ))}
              {filtered.length === 0 && (
                <p className="text-center text-white/30 text-xs py-4">No countries found</p>
              )}
            </div>
          </div>
        )}
      </div>
      {validationError && (
        <p id="phone-validation-error" className="text-xs text-red-400 mt-1" role="alert">{validationError}</p>
      )}
    </div>
  );
}
