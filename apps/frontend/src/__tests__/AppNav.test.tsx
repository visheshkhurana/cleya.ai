import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';

const pushMock = vi.fn();
let mockPathname = '/dashboard';

vi.mock('next/navigation', () => ({
  useRouter: () => ({ push: pushMock }),
  usePathname: () => mockPathname,
}));

vi.mock('@/lib/i18n', () => ({
  useTranslation: () => ({ t: (key: string) => key, locale: 'en', setLocale: () => {} }),
  useI18n: () => ({ locale: 'en', setLocale: () => {} }),
}));

vi.mock('@/components/MobileNav', () => ({
  default: () => React.createElement('div', { 'data-testid': 'mobile-nav' }),
}));

vi.mock('@/components/LanguageSwitcher', () => ({
  default: () => React.createElement('div', { 'data-testid': 'lang-switcher' }),
}));

import AppNav from '@/components/AppNav';

describe('AppNav', () => {
  beforeEach(() => {
    pushMock.mockReset();
    mockPathname = '/dashboard';
  });

  it('renders the brand label and all primary nav items', () => {
    render(<AppNav />);
    expect(screen.getByText('Cleya.ai')).toBeInTheDocument();
    for (const key of [
      'nav.dashboard',
      'nav.matches',
      'nav.introductions',
      'nav.chat',
      'nav.profile',
      'nav.settings',
    ]) {
      expect(screen.getByText(key)).toBeInTheDocument();
    }
  });

  it('renders the LanguageSwitcher and MobileNav', () => {
    render(<AppNav />);
    expect(screen.getByTestId('lang-switcher')).toBeInTheDocument();
    expect(screen.getByTestId('mobile-nav')).toBeInTheDocument();
  });

  it('renders rightContent when provided', () => {
    render(<AppNav rightContent={<span data-testid="right">x</span>} />);
    expect(screen.getByTestId('right')).toBeInTheDocument();
  });

  it('navigates to /dashboard when the brand button is clicked', () => {
    render(<AppNav />);
    fireEvent.click(screen.getByText('Cleya.ai'));
    expect(pushMock).toHaveBeenCalledWith('/dashboard');
  });

  it('navigates to the corresponding route when a nav item is clicked', () => {
    render(<AppNav />);
    fireEvent.click(screen.getByText('nav.matches'));
    expect(pushMock).toHaveBeenCalledWith('/matches');
  });

  it('highlights the active nav item based on exact pathname match', () => {
    mockPathname = '/profile';
    render(<AppNav />);
    const profileBtn = screen.getByText('nav.profile') as HTMLButtonElement;
    const matchesBtn = screen.getByText('nav.matches') as HTMLButtonElement;
    expect(profileBtn.className).toContain('text-white');
    expect(profileBtn.className).toContain('font-medium');
    expect(matchesBtn.className).toContain('text-white/40');
  });

  it('highlights the active nav item for nested routes', () => {
    mockPathname = '/matches/123';
    render(<AppNav />);
    const matchesBtn = screen.getByText('nav.matches') as HTMLButtonElement;
    expect(matchesBtn.className).toContain('font-medium');
  });

  it('does not highlight items whose href is only a prefix substring (without trailing slash)', () => {
    mockPathname = '/chatter';
    render(<AppNav />);
    const chatBtn = screen.getByText('nav.chat') as HTMLButtonElement;
    expect(chatBtn.className).not.toContain('font-medium');
  });
});
