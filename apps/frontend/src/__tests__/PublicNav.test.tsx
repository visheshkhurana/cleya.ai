import React from 'react';
import { render, screen } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';

let mockPathname = '/';

vi.mock('next/navigation', () => ({
  usePathname: () => mockPathname,
}));

vi.mock('next/link', () => ({
  default: ({ href, children, ...rest }: { href: string; children: React.ReactNode } & Record<string, unknown>) =>
    React.createElement('a', { href, ...rest }, children),
}));

import PublicNav from '@/components/PublicNav';

describe('PublicNav', () => {
  it('renders the brand and all public nav links', () => {
    mockPathname = '/';
    render(<PublicNav />);
    expect(screen.getByText('Cleya.ai')).toBeInTheDocument();
    for (const label of ['About', 'Features', 'Pricing', 'Blog', 'Contact']) {
      expect(screen.getByText(label)).toBeInTheDocument();
    }
  });

  it('renders Log In and Get Started CTA links', () => {
    mockPathname = '/';
    render(<PublicNav />);
    const login = screen.getByText('Log In') as HTMLAnchorElement;
    const signup = screen.getByText('Get Started') as HTMLAnchorElement;
    expect(login).toHaveAttribute('href', '/?action=login');
    expect(signup).toHaveAttribute('href', '/?action=signup');
  });

  it('highlights the active link with text-white when pathname matches', () => {
    mockPathname = '/pricing';
    render(<PublicNav />);
    const pricing = screen.getByText('Pricing') as HTMLAnchorElement;
    const about = screen.getByText('About') as HTMLAnchorElement;
    expect(pricing.className).toContain('text-white');
    expect(pricing.className).not.toContain('text-white/50');
    expect(about.className).toContain('text-white/50');
  });

  it('does not highlight any link when pathname does not match a nav route', () => {
    mockPathname = '/some-other-page';
    render(<PublicNav />);
    for (const label of ['About', 'Features', 'Pricing', 'Blog', 'Contact']) {
      const link = screen.getByText(label) as HTMLAnchorElement;
      expect(link.className).toContain('text-white/50');
    }
  });

  it('exposes the navigation landmark with an accessible label', () => {
    mockPathname = '/';
    render(<PublicNav />);
    expect(screen.getByRole('navigation', { name: 'Main navigation' })).toBeInTheDocument();
  });
});
