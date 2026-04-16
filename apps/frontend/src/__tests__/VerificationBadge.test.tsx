import React from 'react';
import { render, screen } from '@testing-library/react';
import { describe, it, expect } from 'vitest';
import VerificationBadge from '@/components/VerificationBadge';

describe('VerificationBadge', () => {
  describe('tier thresholds', () => {
    it('renders null when score is below 25', () => {
      const { container } = render(<VerificationBadge score={20} />);
      expect(container.firstChild).toBeNull();
    });

    it('renders null when score is 0', () => {
      const { container } = render(<VerificationBadge score={0} />);
      expect(container.firstChild).toBeNull();
    });

    it('renders "Basic" for score 25-49', () => {
      render(<VerificationBadge score={30} />);
      expect(screen.getByText('Basic')).toBeInTheDocument();
    });

    it('renders "Verified" for score 50-74', () => {
      render(<VerificationBadge score={60} />);
      expect(screen.getByText('Verified')).toBeInTheDocument();
    });

    it('renders "Trusted" for score 75+', () => {
      render(<VerificationBadge score={90} />);
      expect(screen.getByText('Trusted')).toBeInTheDocument();
    });

    it('renders "Trusted" at exactly 75', () => {
      render(<VerificationBadge score={75} />);
      expect(screen.getByText('Trusted')).toBeInTheDocument();
    });

    it('renders "Verified" at exactly 50', () => {
      render(<VerificationBadge score={50} />);
      expect(screen.getByText('Verified')).toBeInTheDocument();
    });

    it('renders "Basic" at exactly 25', () => {
      render(<VerificationBadge score={25} />);
      expect(screen.getByText('Basic')).toBeInTheDocument();
    });
  });

  describe('score normalization', () => {
    it('treats fractional scores (<=1) as percentages', () => {
      render(<VerificationBadge score={0.8} />);
      expect(screen.getByText('Trusted')).toBeInTheDocument();
    });

    it('treats integer scores (>1) as already normalized', () => {
      render(<VerificationBadge score={80} />);
      expect(screen.getByText('Trusted')).toBeInTheDocument();
    });

    it('renders null for fractional score below 25%', () => {
      const { container } = render(<VerificationBadge score={0.1} />);
      expect(container.firstChild).toBeNull();
    });

    it('includes rounded percentage in the title tooltip', () => {
      render(<VerificationBadge score={87.3} />);
      const badge = screen.getByText('Trusted').closest('span');
      expect(badge).toHaveAttribute('title', 'Verification: Trusted (87%)');
    });
  });

  describe('showLabel prop', () => {
    it('hides label text when showLabel is false', () => {
      render(<VerificationBadge score={80} showLabel={false} />);
      expect(screen.queryByText('Trusted')).not.toBeInTheDocument();
    });

    it('shows label by default', () => {
      render(<VerificationBadge score={80} />);
      expect(screen.getByText('Trusted')).toBeInTheDocument();
    });

    it('still renders icon and container when showLabel is false', () => {
      const { container } = render(<VerificationBadge score={80} showLabel={false} />);
      expect(container.querySelector('svg')).toBeInTheDocument();
    });
  });

  describe('size prop', () => {
    it('applies small text size by default', () => {
      render(<VerificationBadge score={80} />);
      const badge = screen.getByText('Trusted').closest('span');
      expect(badge?.className).toContain('text-[9px]');
    });

    it('applies medium text size when size="md"', () => {
      render(<VerificationBadge score={80} size="md" />);
      const badge = screen.getByText('Trusted').closest('span');
      expect(badge?.className).toContain('text-[10px]');
    });

    it('applies small icon size by default', () => {
      const { container } = render(<VerificationBadge score={80} />);
      const svg = container.querySelector('svg');
      expect(svg?.getAttribute('class')).toContain('w-3');
      expect(svg?.getAttribute('class')).toContain('h-3');
    });

    it('applies medium icon size when size="md"', () => {
      const { container } = render(<VerificationBadge score={80} size="md" />);
      const svg = container.querySelector('svg');
      expect(svg?.getAttribute('class')).toContain('w-4');
      expect(svg?.getAttribute('class')).toContain('h-4');
    });
  });

  describe('defaults', () => {
    it('renders null when no score is provided (defaults to 0)', () => {
      const { container } = render(<VerificationBadge />);
      expect(container.firstChild).toBeNull();
    });
  });
});
