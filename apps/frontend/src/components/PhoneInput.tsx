'use client';

import { useState, useRef, useEffect, useMemo } from 'react';
import {
  getCountries,
  getCountryCallingCode,
  isValidPhoneNumber,
  parsePhoneNumber,
} from 'react-phone-number-input';
import enLocale from 'react-phone-number-input/locale/en.json';
import { FALLBACK_COUNTRY, getDetectedCountryClient, normaliseCountry } from '@/lib/detectCountry';

interface Country {
  code: string;
  name: string;
  dial: string;
  flag: string;
}

function flagEmoji(countryCode: string): string {
  return countryCode
    .toUpperCase()
    .replace(/./g, (c) => String.fromCodePoint(127397 + c.charCodeAt(0)));
}

const labels = enLocale as Record<string, string>;

const countries: Country[] = getCountries()
  .map((cc) => ({
    code: cc,
    name: labels[cc] || cc,
    dial: `+${getCountryCallingCode(cc)}`,
    flag: flagEmoji(cc),
  }))
  .sort((a, b) => a.name.localeCompare(b.name));

const countriesByDialDescending = [...countries].sort(
  (a, b) => b.dial.length - a.dial.length,
);

function findCountryForValue(value: string): Country | undefined {
  if (!value || !value.startsWith('+')) return undefined;
  try {
    const parsed = parsePhoneNumber(value);
    if (parsed?.country) {
      const found = countries.find((c) => c.code === parsed.country);
      if (found) return found;
    }
  } catch {
    // fall through to dial-prefix match
  }
  const cleaned = value.replace(/[\s-]/g, '');
  return countriesByDialDescending.find((c) => cleaned.startsWith(c.dial));
}

export function validatePhone(value: string): string | null {
  if (!value) return null;
  if (!value.startsWith('+')) return 'Phone number must start with a country code';

  const cleaned = value.replace(/[\s-]/g, '');
  const matched = countriesByDialDescending.find((c) => cleaned.startsWith(c.dial));
  if (!matched) return 'Invalid country code';

  const local = cleaned.slice(matched.dial.length);
  if (!local) return 'Please enter your phone number';

  if (!isValidPhoneNumber(cleaned)) {
    return `Please enter a valid ${matched.name} phone number`;
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

function pickInitialCountry(defaultCountry: string | undefined): Country {
  const explicit = normaliseCountry(defaultCountry);
  if (explicit) {
    const found = countries.find((c) => c.code === explicit);
    if (found) return found;
  }
  if (defaultCountry === undefined) {
    const detected = getDetectedCountryClient();
    if (detected) {
      const found = countries.find((c) => c.code === detected);
      if (found) return found;
    }
  }
  return (
    countries.find((c) => c.code === FALLBACK_COUNTRY) || countries[0]
  );
}

export default function PhoneInput({
  value,
  onChange,
  placeholder = '98765 43210',
  disabled = false,
  className = '',
  defaultCountry,
  showValidation = false,
}: PhoneInputProps) {
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState('');
  const [touched, setTouched] = useState(false);
  const [highlightIndex, setHighlightIndex] = useState(-1);
  const [selectedCountry, setSelectedCountry] = useState<Country>(() =>
    pickInitialCountry(defaultCountry),
  );

  // If we render before client-side detection is available (SSR), re-detect on mount
  // and switch only when the user hasn't started typing and no explicit prop was set.
  useEffect(() => {
    if (defaultCountry !== undefined) return;
    if (value) return;
    const detected = getDetectedCountryClient();
    if (!detected || detected === selectedCountry.code) return;
    const found = countries.find((c) => c.code === detected);
    if (found) setSelectedCountry(found);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  const dropdownRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const listRef = useRef<HTMLDivElement>(null);
  const searchRef = useRef<HTMLInputElement>(null);

  const validationError = (showValidation || touched) && value ? validatePhone(value) : null;
  const validationId = validationError ? 'phone-validation-error' : undefined;

  useEffect(() => {
    if (!value || !value.startsWith('+')) return;
    // If the current selection already matches the value's dial prefix, keep it.
    // This avoids flipping between countries that share a calling code (e.g. NANP +1
    // covers US, CA, and many Caribbean nations) while the user is typing.
    if (value.startsWith(selectedCountry.dial)) return;
    const match = findCountryForValue(value);
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
      const match = countriesByDialDescending.find((c) => value.startsWith(c.dial));
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

  const filtered = useMemo(() => {
    if (!search) return countries;
    const q = search.toLowerCase();
    return countries.filter(
      (c) =>
        c.name.toLowerCase().includes(q) ||
        c.dial.includes(search) ||
        c.code.toLowerCase().includes(q),
    );
  }, [search]);

  const handleDropdownKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Escape') {
      e.preventDefault();
      setOpen(false);
      setSearch('');
      setHighlightIndex(-1);
      inputRef.current?.focus();
    } else if (e.key === 'ArrowDown') {
      e.preventDefault();
      setHighlightIndex((prev) => (prev < filtered.length - 1 ? prev + 1 : 0));
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setHighlightIndex((prev) => (prev > 0 ? prev - 1 : filtered.length - 1));
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
          className={`flex-1 min-w-0 px-3 py-2.5 rounded-r-xl border ${borderColor} bg-white/5 text-white placeholder-white/30 text-sm focus:outline-none focus:ring-2 focus:ring-brand-violet focus:border-transparent disabled:opacity-40 transition-all`}
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
                className="w-full px-3 py-2 rounded-lg border border-white/10 bg-white/5 text-white placeholder-white/30 text-xs focus:outline-none focus:ring-1 focus:ring-brand-violet"
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
                    selectedCountry.code === country.code ? 'bg-brand-violet/10 text-brand-teal' : 'text-white/70'
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
