import React from 'react';
import { render, screen, fireEvent, within } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import PhoneInput, { validatePhone } from '@/components/PhoneInput';
import { COUNTRY_COOKIE } from '@/lib/detectCountry';

function setNavigatorLanguage(lang: string | undefined, languages: string[] = []) {
  Object.defineProperty(window.navigator, 'language', {
    value: lang,
    configurable: true,
  });
  Object.defineProperty(window.navigator, 'languages', {
    value: languages,
    configurable: true,
  });
}

function clearCountryCookie() {
  document.cookie = `${COUNTRY_COOKIE}=; path=/; expires=Thu, 01 Jan 1970 00:00:00 GMT`;
}

describe('validatePhone', () => {
  it('returns null for empty value', () => {
    expect(validatePhone('')).toBeNull();
  });

  it('returns error if no leading +', () => {
    expect(validatePhone('919876543210')).toBe(
      'Phone number must start with a country code',
    );
  });

  it('returns error for unknown country code', () => {
    expect(validatePhone('+9991234567')).toBe('Invalid country code');
  });

  it('returns error if no local digits after country code', () => {
    expect(validatePhone('+91')).toBe('Please enter your phone number');
  });

  it('returns error for wrong fixed-length local number', () => {
    const err = validatePhone('+9112345');
    expect(err).toMatch(/valid India phone number/);
  });

  it('returns null for valid fixed-length India number', () => {
    expect(validatePhone('+919876543210')).toBeNull();
  });

  it('returns error for out-of-range variable-length number', () => {
    const err = validatePhone('+97112');
    expect(err).toMatch(/valid United Arab Emirates phone number/);
  });

  it('accepts variable-length number within range', () => {
    expect(validatePhone('+971501234567')).toBeNull();
  });

  it('accepts numbers with spaces and dashes', () => {
    expect(validatePhone('+1 415-555-2671')).toBeNull();
  });

  it('matches longest country code first (e.g. +44 vs +4)', () => {
    expect(validatePhone('+447911123456')).toBeNull();
  });
});

describe('PhoneInput', () => {
  beforeEach(() => {
    clearCountryCookie();
    setNavigatorLanguage('en');
  });

  afterEach(() => {
    clearCountryCookie();
  });

  it('falls back to IN when detection is unavailable and no value provided', () => {
    render(<PhoneInput value="" onChange={() => {}} />);
    expect(screen.getByLabelText(/Select country/)).toHaveTextContent('+91');
  });

  it('honours defaultCountry prop', () => {
    render(<PhoneInput value="" onChange={() => {}} defaultCountry="US" />);
    expect(screen.getByLabelText(/Select country/)).toHaveTextContent('+1');
  });

  it('detects country from the nf_country cookie', () => {
    document.cookie = `${COUNTRY_COOKIE}=DE; path=/`;
    render(<PhoneInput value="" onChange={() => {}} />);
    expect(screen.getByLabelText(/Select country/)).toHaveTextContent('+49');
  });

  it('detects country from navigator.language when no cookie is present', () => {
    setNavigatorLanguage('en-GB', ['en-GB']);
    render(<PhoneInput value="" onChange={() => {}} />);
    expect(screen.getByLabelText(/Select country/)).toHaveTextContent('+44');
  });

  it('explicit defaultCountry overrides detection', () => {
    document.cookie = `${COUNTRY_COOKIE}=DE; path=/`;
    setNavigatorLanguage('en-GB', ['en-GB']);
    render(<PhoneInput value="" onChange={() => {}} defaultCountry="US" />);
    expect(screen.getByLabelText(/Select country/)).toHaveTextContent('+1');
  });

  it('calls onChange with full E.164-style number when typing local digits', () => {
    const onChange = vi.fn();
    render(<PhoneInput value="" onChange={onChange} />);
    fireEvent.change(screen.getByLabelText('Phone number'), {
      target: { value: '9876543210' },
    });
    expect(onChange).toHaveBeenCalledWith('+919876543210');
  });

  it('strips non-digit characters from typed input', () => {
    const onChange = vi.fn();
    render(<PhoneInput value="" onChange={onChange} />);
    fireEvent.change(screen.getByLabelText('Phone number'), {
      target: { value: '987-654 3210abc' },
    });
    expect(onChange).toHaveBeenCalledWith('+919876543210');
  });

  it('emits empty string when input is cleared', () => {
    const onChange = vi.fn();
    render(<PhoneInput value="+919876543210" onChange={onChange} />);
    fireEvent.change(screen.getByLabelText('Phone number'), {
      target: { value: '' },
    });
    expect(onChange).toHaveBeenCalledWith('');
  });

  it('shows local digits without the dial prefix in the input', () => {
    render(<PhoneInput value="+919876543210" onChange={() => {}} />);
    const input = screen.getByLabelText('Phone number') as HTMLInputElement;
    expect(input.value).toBe('9876543210');
  });

  it('auto-detects country from value prop', () => {
    render(<PhoneInput value="+447911123456" onChange={() => {}} />);
    expect(screen.getByLabelText(/Select country/)).toHaveTextContent('+44');
  });

  it('opens country dropdown on toggle click', () => {
    render(<PhoneInput value="" onChange={() => {}} />);
    fireEvent.click(screen.getByLabelText(/Select country/));
    expect(screen.getByRole('listbox', { name: 'Countries' })).toBeInTheDocument();
  });

  it('selecting a different country updates dial code and onChange', () => {
    const onChange = vi.fn();
    render(<PhoneInput value="+919876543210" onChange={onChange} />);
    fireEvent.click(screen.getByLabelText(/Select country/));
    fireEvent.click(screen.getByRole('option', { name: /United States/ }));
    expect(onChange).toHaveBeenCalledWith('+19876543210');
    expect(screen.getByLabelText(/Select country/)).toHaveTextContent('+1');
  });

  it('filters countries via search box', () => {
    render(<PhoneInput value="" onChange={() => {}} />);
    fireEvent.click(screen.getByLabelText(/Select country/));
    fireEvent.change(screen.getByLabelText('Search countries'), {
      target: { value: 'germ' },
    });
    const listbox = screen.getByRole('listbox', { name: 'Countries' });
    expect(within(listbox).getByText('Germany')).toBeInTheDocument();
    expect(within(listbox).queryByText('India')).not.toBeInTheDocument();
  });

  it('shows "No countries found" when search has no matches', () => {
    render(<PhoneInput value="" onChange={() => {}} />);
    fireEvent.click(screen.getByLabelText(/Select country/));
    fireEvent.change(screen.getByLabelText('Search countries'), {
      target: { value: 'zzzzzz' },
    });
    expect(screen.getByText('No countries found')).toBeInTheDocument();
  });

  it('keyboard navigation: ArrowDown + Enter selects a country', () => {
    const onChange = vi.fn();
    render(<PhoneInput value="+919876543210" onChange={onChange} />);
    fireEvent.click(screen.getByLabelText(/Select country/));
    const search = screen.getByLabelText('Search countries');
    fireEvent.keyDown(search, { key: 'ArrowDown' });
    fireEvent.keyDown(search, { key: 'Enter' });
    // First country in the list is India (+91); selecting it should not change dial,
    // but should close the dropdown.
    expect(
      screen.queryByRole('listbox', { name: 'Countries' }),
    ).not.toBeInTheDocument();
  });

  it('Escape key closes the dropdown', () => {
    render(<PhoneInput value="" onChange={() => {}} />);
    fireEvent.click(screen.getByLabelText(/Select country/));
    fireEvent.keyDown(screen.getByLabelText('Search countries'), {
      key: 'Escape',
    });
    expect(
      screen.queryByRole('listbox', { name: 'Countries' }),
    ).not.toBeInTheDocument();
  });

  it('shows validation error after blur when value is invalid', () => {
    render(<PhoneInput value="+9112" onChange={() => {}} />);
    fireEvent.blur(screen.getByLabelText('Phone number'));
    expect(screen.getByRole('alert')).toHaveTextContent(/valid India phone number/);
    expect(screen.getByLabelText('Phone number')).toHaveAttribute(
      'aria-invalid',
      'true',
    );
  });

  it('shows validation eagerly when showValidation is true', () => {
    render(
      <PhoneInput value="+9112" onChange={() => {}} showValidation />,
    );
    expect(screen.getByRole('alert')).toBeInTheDocument();
  });

  it('does not show validation error for a valid number', () => {
    render(
      <PhoneInput value="+919876543210" onChange={() => {}} showValidation />,
    );
    expect(screen.queryByRole('alert')).not.toBeInTheDocument();
  });

  it('disables both the toggle and the input when disabled', () => {
    render(<PhoneInput value="" onChange={() => {}} disabled />);
    expect(screen.getByLabelText(/Select country/)).toBeDisabled();
    expect(screen.getByLabelText('Phone number')).toBeDisabled();
  });

  it('does not open the dropdown when disabled', () => {
    render(<PhoneInput value="" onChange={() => {}} disabled />);
    fireEvent.click(screen.getByLabelText(/Select country/));
    expect(
      screen.queryByRole('listbox', { name: 'Countries' }),
    ).not.toBeInTheDocument();
  });
});
