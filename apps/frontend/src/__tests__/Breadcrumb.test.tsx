import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import Breadcrumb from '@/components/Breadcrumb';

const push = vi.fn();
const back = vi.fn();

vi.mock('next/navigation', () => ({
  useRouter: () => ({ push, back }),
}));

vi.mock('@/lib/i18n', () => ({
  useTranslation: () => ({ t: (key: string) => (key === 'common.back' ? 'Back' : key) }),
}));

describe('Breadcrumb', () => {
  beforeEach(() => {
    push.mockClear();
    back.mockClear();
  });

  it('renders all item labels', () => {
    render(<Breadcrumb items={[{ label: 'Home', href: '/' }, { label: 'Current' }]} />);
    expect(screen.getByText('Home')).toBeInTheDocument();
    expect(screen.getByText('Current')).toBeInTheDocument();
  });

  it('renders the localized back button', () => {
    render(<Breadcrumb items={[{ label: 'Current' }]} />);
    expect(screen.getByText('Back')).toBeInTheDocument();
  });

  it('calls router.back when the back button is clicked', () => {
    render(<Breadcrumb items={[{ label: 'Current' }]} />);
    fireEvent.click(screen.getByText('Back'));
    expect(back).toHaveBeenCalledTimes(1);
  });

  it('navigates when a linked item is clicked', () => {
    render(
      <Breadcrumb
        items={[
          { label: 'Home', href: '/' },
          { label: 'Settings', href: '/settings' },
          { label: 'Current' },
        ]}
      />,
    );
    fireEvent.click(screen.getByText('Settings'));
    expect(push).toHaveBeenCalledWith('/settings');
  });

  it('renders non-linked items as spans (non-clickable)', () => {
    render(<Breadcrumb items={[{ label: 'Current' }]} />);
    const current = screen.getByText('Current');
    expect(current.tagName.toLowerCase()).toBe('span');
  });

  it('renders linked items as buttons', () => {
    render(<Breadcrumb items={[{ label: 'Home', href: '/' }]} />);
    const home = screen.getByText('Home');
    expect(home.tagName.toLowerCase()).toBe('button');
  });

  it('inserts a separator between items', () => {
    const { container } = render(
      <Breadcrumb items={[{ label: 'A', href: '/a' }, { label: 'B' }]} />,
    );
    expect(container.textContent).toContain('/');
  });

  it('sets aria-label for accessibility', () => {
    render(<Breadcrumb items={[{ label: 'Current' }]} />);
    expect(screen.getByLabelText('Breadcrumb')).toBeInTheDocument();
  });
});
