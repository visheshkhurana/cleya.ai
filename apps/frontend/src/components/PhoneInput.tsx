'use client';

import { useState, useRef, useEffect } from 'react';

interface Country {
  code: string;
  name: string;
  dial: string;
  flag: string;
}

const countries: Country[] = [
  { code: 'IN', name: 'India', dial: '+91', flag: '🇮🇳' },
  { code: 'US', name: 'United States', dial: '+1', flag: '🇺🇸' },
  { code: 'GB', name: 'United Kingdom', dial: '+44', flag: '🇬🇧' },
  { code: 'AE', name: 'UAE', dial: '+971', flag: '🇦🇪' },
  { code: 'SG', name: 'Singapore', dial: '+65', flag: '🇸🇬' },
  { code: 'AU', name: 'Australia', dial: '+61', flag: '🇦🇺' },
  { code: 'CA', name: 'Canada', dial: '+1', flag: '🇨🇦' },
  { code: 'DE', name: 'Germany', dial: '+49', flag: '🇩🇪' },
  { code: 'FR', name: 'France', dial: '+33', flag: '🇫🇷' },
  { code: 'JP', name: 'Japan', dial: '+81', flag: '🇯🇵' },
  { code: 'KR', name: 'South Korea', dial: '+82', flag: '🇰🇷' },
  { code: 'CN', name: 'China', dial: '+86', flag: '🇨🇳' },
  { code: 'BR', name: 'Brazil', dial: '+55', flag: '🇧🇷' },
  { code: 'IL', name: 'Israel', dial: '+972', flag: '🇮🇱' },
  { code: 'NL', name: 'Netherlands', dial: '+31', flag: '🇳🇱' },
  { code: 'SE', name: 'Sweden', dial: '+46', flag: '🇸🇪' },
  { code: 'CH', name: 'Switzerland', dial: '+41', flag: '🇨🇭' },
  { code: 'ID', name: 'Indonesia', dial: '+62', flag: '🇮🇩' },
  { code: 'MY', name: 'Malaysia', dial: '+60', flag: '🇲🇾' },
  { code: 'PH', name: 'Philippines', dial: '+63', flag: '🇵🇭' },
  { code: 'TH', name: 'Thailand', dial: '+66', flag: '🇹🇭' },
  { code: 'VN', name: 'Vietnam', dial: '+84', flag: '🇻🇳' },
  { code: 'ZA', name: 'South Africa', dial: '+27', flag: '🇿🇦' },
  { code: 'NG', name: 'Nigeria', dial: '+234', flag: '🇳🇬' },
  { code: 'KE', name: 'Kenya', dial: '+254', flag: '🇰🇪' },
  { code: 'MX', name: 'Mexico', dial: '+52', flag: '🇲🇽' },
  { code: 'AR', name: 'Argentina', dial: '+54', flag: '🇦🇷' },
  { code: 'CO', name: 'Colombia', dial: '+57', flag: '🇨🇴' },
  { code: 'CL', name: 'Chile', dial: '+56', flag: '🇨🇱' },
  { code: 'NZ', name: 'New Zealand', dial: '+64', flag: '🇳🇿' },
  { code: 'IE', name: 'Ireland', dial: '+353', flag: '🇮🇪' },
  { code: 'PK', name: 'Pakistan', dial: '+92', flag: '🇵🇰' },
  { code: 'BD', name: 'Bangladesh', dial: '+880', flag: '🇧🇩' },
  { code: 'LK', name: 'Sri Lanka', dial: '+94', flag: '🇱🇰' },
  { code: 'NP', name: 'Nepal', dial: '+977', flag: '🇳🇵' },
];

interface PhoneInputProps {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  disabled?: boolean;
  className?: string;
  defaultCountry?: string;
}

export default function PhoneInput({
  value,
  onChange,
  placeholder = '98765 43210',
  disabled = false,
  className = '',
  defaultCountry = 'IN',
}: PhoneInputProps) {
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState('');
  const [selectedCountry, setSelectedCountry] = useState<Country>(
    countries.find(c => c.code === defaultCountry) || countries[0]
  );
  const dropdownRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

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
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

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
    const cleaned = localNumber.replace(/[^\d\s-]/g, '');
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

  return (
    <div className={`relative flex ${className}`} ref={dropdownRef}>
      <button
        type="button"
        onClick={() => !disabled && setOpen(!open)}
        disabled={disabled}
        className="flex items-center gap-1.5 px-3 py-2.5 rounded-l-xl border border-r-0 border-white/10 bg-white/5 text-white text-sm hover:bg-white/10 transition disabled:opacity-40 flex-shrink-0"
      >
        <span className="text-base">{selectedCountry.flag}</span>
        <span className="text-white/60 text-xs">{selectedCountry.dial}</span>
        <svg className={`w-3 h-3 text-white/40 transition-transform ${open ? 'rotate-180' : ''}`} fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
        </svg>
      </button>

      <input
        ref={inputRef}
        type="tel"
        value={getLocalNumber()}
        onChange={(e) => handleNumberChange(e.target.value)}
        placeholder={placeholder}
        disabled={disabled}
        className="flex-1 min-w-0 px-3 py-2.5 rounded-r-xl border border-white/10 bg-white/5 text-white placeholder-white/30 text-sm focus:outline-none focus:ring-2 focus:ring-boardy-500 focus:border-transparent disabled:opacity-40 transition-all"
      />

      {open && (
        <div className="absolute top-full left-0 mt-1 w-64 max-h-60 overflow-auto rounded-xl border border-white/10 bg-[#1A1730] shadow-2xl z-50">
          <div className="sticky top-0 p-2 bg-[#1A1730] border-b border-white/5">
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search country..."
              className="w-full px-3 py-2 rounded-lg border border-white/10 bg-white/5 text-white placeholder-white/30 text-xs focus:outline-none focus:ring-1 focus:ring-boardy-500"
              autoFocus
            />
          </div>
          {filtered.map((country) => (
            <button
              key={country.code}
              type="button"
              onClick={() => handleCountrySelect(country)}
              className={`w-full flex items-center gap-3 px-3 py-2 text-left hover:bg-white/5 transition text-sm ${
                selectedCountry.code === country.code ? 'bg-boardy-500/10 text-boardy-400' : 'text-white/70'
              }`}
            >
              <span className="text-base">{country.flag}</span>
              <span className="flex-1 truncate">{country.name}</span>
              <span className="text-white/40 text-xs">{country.dial}</span>
            </button>
          ))}
          {filtered.length === 0 && (
            <p className="text-center text-white/30 text-xs py-4">No countries found</p>
          )}
        </div>
      )}
    </div>
  );
}
