import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import UserAvatar from '@/components/UserAvatar';

vi.mock('next/image', () => ({
  default: (props: Record<string, unknown>) => {
    const { unoptimized, referrerPolicy, ...rest } = props;
    return React.createElement('img', {
      ...rest,
      'data-unoptimized': String(unoptimized),
      referrerPolicy: referrerPolicy as string,
    });
  },
}));

vi.mock('@/lib/avatarOptimization', () => ({
  isOptimizedAvatarDomain: (url: string) => url.includes('googleusercontent.com'),
}));

describe('UserAvatar', () => {
  describe('image rendering', () => {
    it('renders an image when avatarUrl is provided', () => {
      render(<UserAvatar name="Alice" avatarUrl="https://example.com/photo.jpg" />);
      const img = screen.getByRole('img');
      expect(img).toBeInTheDocument();
      expect(img).toHaveAttribute('src', 'https://example.com/photo.jpg');
      expect(img).toHaveAttribute('alt', 'Alice');
    });

    it('sets alt to "User avatar" when name is not provided', () => {
      render(<UserAvatar avatarUrl="https://example.com/photo.jpg" />);
      const img = screen.getByRole('img');
      expect(img).toHaveAttribute('alt', 'User avatar');
    });

    it('marks optimized domains as optimized', () => {
      render(<UserAvatar name="Alice" avatarUrl="https://lh3.googleusercontent.com/photo.jpg" />);
      const img = screen.getByRole('img');
      expect(img).toHaveAttribute('data-unoptimized', 'false');
    });

    it('marks non-optimized domains as unoptimized', () => {
      render(<UserAvatar name="Alice" avatarUrl="https://example.com/photo.jpg" />);
      const img = screen.getByRole('img');
      expect(img).toHaveAttribute('data-unoptimized', 'true');
    });

    it('sets referrerPolicy to no-referrer', () => {
      render(<UserAvatar name="Alice" avatarUrl="https://example.com/photo.jpg" />);
      const img = screen.getByRole('img');
      expect(img).toHaveAttribute('referrerPolicy', 'no-referrer');
    });
  });

  describe('error fallback to initials', () => {
    it('falls back to initials when image fails to load', () => {
      render(<UserAvatar name="Alice Smith" avatarUrl="https://example.com/broken.jpg" />);
      const img = screen.getByRole('img');
      fireEvent.error(img);
      expect(screen.queryByRole('img')).not.toBeInTheDocument();
      expect(screen.getByText('AS')).toBeInTheDocument();
    });

    it('renders initials when no avatarUrl is provided', () => {
      render(<UserAvatar name="Bob Jones" />);
      expect(screen.queryByRole('img')).not.toBeInTheDocument();
      expect(screen.getByText('BJ')).toBeInTheDocument();
    });
  });

  describe('error fallback to icon', () => {
    it('falls back to fallbackIcon when image fails and fallbackIcon is provided', () => {
      const icon = React.createElement('span', { 'data-testid': 'fallback-icon' }, '★');
      render(
        <UserAvatar
          name="Alice"
          avatarUrl="https://example.com/broken.jpg"
          fallbackIcon={icon}
        />,
      );
      fireEvent.error(screen.getByRole('img'));
      expect(screen.queryByRole('img')).not.toBeInTheDocument();
      expect(screen.getByTestId('fallback-icon')).toBeInTheDocument();
    });

    it('renders fallbackIcon when no avatarUrl is provided', () => {
      const icon = React.createElement('span', { 'data-testid': 'fallback-icon' }, '★');
      render(<UserAvatar name="Alice" fallbackIcon={icon} />);
      expect(screen.queryByRole('img')).not.toBeInTheDocument();
      expect(screen.getByTestId('fallback-icon')).toBeInTheDocument();
    });

    it('applies correct icon size class to fallback icon container', () => {
      const icon = React.createElement('span', null, '★');
      const { container } = render(<UserAvatar fallbackIcon={icon} size="lg" />);
      const div = container.firstChild as HTMLElement;
      expect(div.className).toContain('text-lg');
    });

    it('prefers fallbackIcon over initials when both available', () => {
      const icon = React.createElement('span', { 'data-testid': 'fallback-icon' }, '★');
      render(<UserAvatar name="Alice" fallbackIcon={icon} />);
      expect(screen.getByTestId('fallback-icon')).toBeInTheDocument();
      expect(screen.queryByText('AL')).not.toBeInTheDocument();
    });
  });

  describe('initials generation', () => {
    it('uses first and last initials for multi-word names', () => {
      render(<UserAvatar name="John Michael Doe" />);
      expect(screen.getByText('JD')).toBeInTheDocument();
    });

    it('uses first two characters for single-word names', () => {
      render(<UserAvatar name="Alice" />);
      expect(screen.getByText('AL')).toBeInTheDocument();
    });

    it('shows "?" when name is not provided', () => {
      render(<UserAvatar />);
      expect(screen.getByText('?')).toBeInTheDocument();
    });

    it('shows "?" when name is null', () => {
      render(<UserAvatar name={null} />);
      expect(screen.getByText('?')).toBeInTheDocument();
    });

    it('renders empty fallback for whitespace-only name', () => {
      const { container } = render(<UserAvatar name="   " />);
      const div = container.firstChild as HTMLElement;
      expect(div.textContent).toBe('');
    });
  });

  describe('size presets', () => {
    const sizeClasses: Record<string, { container: string; icon: string; px: number }> = {
      xs: { container: 'w-5 h-5', icon: 'text-xs', px: 20 },
      sm: { container: 'w-7 h-7', icon: 'text-sm', px: 28 },
      md: { container: 'w-8 h-8', icon: 'text-base', px: 32 },
      lg: { container: 'w-10 h-10', icon: 'text-lg', px: 40 },
      xl: { container: 'w-12 h-12', icon: 'text-xl', px: 48 },
      '2xl': { container: 'w-14 h-14', icon: 'text-2xl', px: 56 },
      '3xl': { container: 'w-16 h-16', icon: 'text-3xl', px: 64 },
    };

    type SizeKey = 'xs' | 'sm' | 'md' | 'lg' | 'xl' | '2xl' | '3xl';

    for (const [size, { container, px }] of Object.entries(sizeClasses)) {
      it(`applies correct classes for size="${size}" (initials fallback)`, () => {
        const { container: el } = render(
          <UserAvatar name="Test" size={size as SizeKey} />,
        );
        const div = el.firstChild as HTMLElement;
        for (const cls of container.split(' ')) {
          expect(div.className).toContain(cls);
        }
      });

      it(`applies correct dimensions for size="${size}" (image)`, () => {
        render(
          <UserAvatar
            name="Test"
            avatarUrl="https://example.com/photo.jpg"
            size={size as SizeKey}
          />,
        );
        const img = screen.getByRole('img');
        expect(img).toHaveAttribute('width', String(px));
        expect(img).toHaveAttribute('height', String(px));
      });
    }

    for (const [size, { container, icon }] of Object.entries(sizeClasses)) {
      it(`applies correct classes for size="${size}" (icon fallback)`, () => {
        const iconEl = React.createElement('span', null, '★');
        const { container: el } = render(
          <UserAvatar fallbackIcon={iconEl} size={size as SizeKey} />,
        );
        const div = el.firstChild as HTMLElement;
        for (const cls of container.split(' ')) {
          expect(div.className).toContain(cls);
        }
        expect(div.className).toContain(icon);
      });
    }

    it('defaults to md size', () => {
      const { container } = render(<UserAvatar name="Test" />);
      const div = container.firstChild as HTMLElement;
      expect(div.className).toContain('w-8');
      expect(div.className).toContain('h-8');
    });
  });

  describe('shape variants', () => {
    it('defaults to circle (rounded-full)', () => {
      const { container } = render(<UserAvatar name="Test" />);
      const div = container.firstChild as HTMLElement;
      expect(div.className).toContain('rounded-full');
    });

    it('applies rounded-full for shape="circle" on image', () => {
      render(<UserAvatar name="Test" avatarUrl="https://example.com/photo.jpg" shape="circle" />);
      const img = screen.getByRole('img');
      expect(img.className).toContain('rounded-full');
    });

    it('applies rounded-2xl for shape="rounded" on initials fallback', () => {
      const { container } = render(<UserAvatar name="Test" shape="rounded" />);
      const div = container.firstChild as HTMLElement;
      expect(div.className).toContain('rounded-2xl');
      expect(div.className).not.toContain('rounded-full');
    });

    it('applies rounded-2xl for shape="rounded" on image', () => {
      render(<UserAvatar name="Test" avatarUrl="https://example.com/photo.jpg" shape="rounded" />);
      const img = screen.getByRole('img');
      expect(img.className).toContain('rounded-2xl');
      expect(img.className).not.toContain('rounded-full');
    });

    it('applies rounded-2xl for shape="rounded" on icon fallback', () => {
      const icon = React.createElement('span', null, '★');
      const { container } = render(<UserAvatar fallbackIcon={icon} shape="rounded" />);
      const div = container.firstChild as HTMLElement;
      expect(div.className).toContain('rounded-2xl');
      expect(div.className).not.toContain('rounded-full');
    });
  });

  describe('className passthrough', () => {
    it('passes className to the initials fallback div', () => {
      const { container } = render(<UserAvatar name="Test" className="custom-class" />);
      const div = container.firstChild as HTMLElement;
      expect(div.className).toContain('custom-class');
    });

    it('passes className to the image element', () => {
      render(
        <UserAvatar
          name="Test"
          avatarUrl="https://example.com/photo.jpg"
          className="custom-class"
        />,
      );
      const img = screen.getByRole('img');
      expect(img.className).toContain('custom-class');
    });

    it('passes className to the icon fallback div', () => {
      const icon = React.createElement('span', null, '★');
      const { container } = render(<UserAvatar fallbackIcon={icon} className="custom-class" />);
      const div = container.firstChild as HTMLElement;
      expect(div.className).toContain('custom-class');
    });
  });

  describe('style passthrough', () => {
    it('passes style to the initials fallback div', () => {
      const { container } = render(<UserAvatar name="Test" style={{ border: '1px solid red' }} />);
      const div = container.firstChild as HTMLElement;
      expect(div.style.border).toBe('1px solid red');
    });

    it('passes style to the image element', () => {
      render(
        <UserAvatar
          name="Test"
          avatarUrl="https://example.com/photo.jpg"
          style={{ border: '2px solid blue' }}
        />,
      );
      const img = screen.getByRole('img');
      expect(img.style.border).toBe('2px solid blue');
    });

    it('passes style to the icon fallback div', () => {
      const icon = React.createElement('span', null, '★');
      const { container } = render(
        <UserAvatar fallbackIcon={icon} style={{ border: '3px solid green' }} />,
      );
      const div = container.firstChild as HTMLElement;
      expect(div.style.border).toBe('3px solid green');
    });
  });

  describe('styling', () => {
    it('applies gradient background classes to initials fallback div', () => {
      const { container } = render(<UserAvatar name="Test" />);
      const div = container.firstChild as HTMLElement;
      expect(div.className).toContain('bg-gradient-to-br');
      expect(div.className).toContain('from-brand-violet');
      expect(div.className).toContain('to-brand-teal');
      expect(div.className).toContain('text-white');
    });

    it('does not apply gradient to icon fallback div', () => {
      const icon = React.createElement('span', null, '★');
      const { container } = render(<UserAvatar fallbackIcon={icon} />);
      const div = container.firstChild as HTMLElement;
      expect(div.className).not.toContain('bg-gradient-to-br');
    });
  });
});
