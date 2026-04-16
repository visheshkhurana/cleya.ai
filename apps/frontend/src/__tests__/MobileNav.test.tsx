import React from 'react';
import { render, screen, fireEvent, act } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';

const pushMock = vi.fn();
let mockPathname = '/dashboard';
const logoutMock = vi.fn(() => Promise.resolve());

vi.mock('next/navigation', () => ({
  useRouter: () => ({ push: pushMock }),
  usePathname: () => mockPathname,
}));

vi.mock('@/lib/i18n', () => ({
  useTranslation: () => ({ t: (key: string) => key, locale: 'en', setLocale: () => {} }),
  useI18n: () => ({ locale: 'en', setLocale: () => {} }),
}));

vi.mock('@/lib/api', () => ({
  api: { logout: () => logoutMock() },
}));

import MobileNav from '@/components/MobileNav';

describe('MobileNav', () => {
  beforeEach(() => {
    pushMock.mockReset();
    logoutMock.mockClear();
    mockPathname = '/dashboard';
    document.body.style.overflow = '';
  });

  it('starts closed and only renders the toggle button', () => {
    render(<MobileNav />);
    const toggle = screen.getByRole('button', { name: 'Open menu' });
    expect(toggle).toHaveAttribute('aria-expanded', 'false');
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  });

  it('opens the drawer when the toggle is clicked', () => {
    render(<MobileNav />);
    fireEvent.click(screen.getByRole('button', { name: 'Open menu' }));
    expect(screen.getByRole('dialog', { name: 'Navigation menu' })).toBeInTheDocument();
    const toggles = screen.getAllByRole('button', { name: 'Close menu' });
    expect(toggles[0]).toHaveAttribute('aria-expanded', 'true');
    expect(document.body.style.overflow).toBe('hidden');
  });

  it('closes the drawer when the close button is clicked and restores body scroll', () => {
    render(<MobileNav />);
    fireEvent.click(screen.getByRole('button', { name: 'Open menu' }));
    fireEvent.click(screen.getAllByRole('button', { name: 'Close menu' })[0]);
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    expect(document.body.style.overflow).toBe('');
  });

  it('closes the drawer on Escape key', () => {
    render(<MobileNav />);
    fireEvent.click(screen.getByRole('button', { name: 'Open menu' }));
    expect(screen.getByRole('dialog')).toBeInTheDocument();
    act(() => {
      document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' }));
    });
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  });

  it('closes the drawer when a click occurs outside of it', () => {
    render(<MobileNav />);
    fireEvent.click(screen.getByRole('button', { name: 'Open menu' }));
    expect(screen.getByRole('dialog')).toBeInTheDocument();
    act(() => {
      document.dispatchEvent(new MouseEvent('mousedown', { bubbles: true }));
    });
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  });

  it('renders all nav items when open', () => {
    render(<MobileNav />);
    fireEvent.click(screen.getByRole('button', { name: 'Open menu' }));
    for (const key of [
      'nav.dashboard',
      'nav.matches',
      'nav.messages',
      'nav.introductions',
      'nav.secretary',
      'nav.onboardingChat',
      'nav.profile',
      'nav.settings',
    ]) {
      expect(screen.getByText(key)).toBeInTheDocument();
    }
  });

  it('marks the active nav item with aria-current="page"', () => {
    mockPathname = '/profile';
    render(<MobileNav />);
    fireEvent.click(screen.getByRole('button', { name: 'Open menu' }));
    const profileBtn = screen.getByText('nav.profile').closest('button')!;
    const matchesBtn = screen.getByText('nav.matches').closest('button')!;
    expect(profileBtn).toHaveAttribute('aria-current', 'page');
    expect(matchesBtn).not.toHaveAttribute('aria-current');
  });

  it('navigates when a nav item is clicked', () => {
    render(<MobileNav />);
    fireEvent.click(screen.getByRole('button', { name: 'Open menu' }));
    fireEvent.click(screen.getByText('nav.matches'));
    expect(pushMock).toHaveBeenCalledWith('/matches');
  });

  it('calls logout and redirects to / when sign out is clicked', async () => {
    render(<MobileNav />);
    fireEvent.click(screen.getByRole('button', { name: 'Open menu' }));
    fireEvent.click(screen.getByText('nav.signOut'));
    expect(logoutMock).toHaveBeenCalled();
    await act(async () => {
      await Promise.resolve();
    });
    expect(pushMock).toHaveBeenCalledWith('/');
  });
});
