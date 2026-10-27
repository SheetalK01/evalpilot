import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { FlightStrip, MiniStrip } from '@/components/instruments/flight-strip';
import { LatencyBar } from '@/components/instruments/latency-bar';
import { Panel, Readout } from '@/components/instruments/panel';
import { RiskGauge } from '@/components/instruments/risk-gauge';
import { RollingNumber } from '@/components/instruments/rolling-number';
import { EmptyState, ErrorState } from '@/components/instruments/states';
import { riskTone, SeverityTag, StatusTag } from '@/components/instruments/status';
import { ThreatRadar } from '@/components/instruments/threat-radar';
import { ApiError } from '@/lib/api';

describe('instruments', () => {
  it('RollingNumber exposes the plain value to screen readers', () => {
    render(<RollingNumber value="91.7%" />);
    expect(screen.getByRole('img', { name: '91.7%' })).toBeInTheDocument();
  });

  it('FlightStrip summarises results and marks the live cursor', () => {
    const { container } = render(<FlightStrip statuses={['PASSED', 'FAILED', null, null]} live />);
    expect(screen.getByRole('img', { name: '1 passed, 1 failed, 2 pending' })).toBeInTheDocument();
    expect(container.querySelectorAll('.bg-pass')).toHaveLength(1);
    expect(container.querySelector('.animate-cursor')).not.toBeNull();
  });

  it('MiniStrip reads the compact strip string', () => {
    render(<MiniStrip strip="PFE" total={4} />);
    expect(screen.getByRole('img', { name: '1 passed, 2 failed, 1 pending' })).toBeInTheDocument();
  });

  it('shows status in text, not colour only', () => {
    render(
      <>
        <StatusTag status="PASSED" />
        <StatusTag status="FAILED" />
        <StatusTag status="RUNNING" />
        <SeverityTag severity="CRITICAL" />
      </>,
    );
    for (const text of ['PASS', 'FAIL', 'LIVE', 'CRITICAL'])
      expect(screen.getByText(text)).toBeInTheDocument();
  });

  it.each([
    [null, 'muted'],
    [5, 'pass'],
    [22, 'warn'],
    [60, 'fail'],
  ] as const)('risk %s is %s', (score, tone) => {
    expect(riskTone(score)).toBe(tone);
  });

  it('LatencyBar colours by absolute latency', () => {
    const { container, rerender } = render(<LatencyBar ms={200} max={1000} />);
    expect(container.querySelector('.bg-muted')).not.toBeNull();
    rerender(<LatencyBar ms={1500} max={2000} />);
    expect(container.querySelector('.bg-warn')).not.toBeNull();
    rerender(<LatencyBar ms={4000} max={4000} />);
    expect(container.querySelector('.bg-fail')).not.toBeNull();
    rerender(<LatencyBar ms={null} max={4000} />);
    expect(screen.getByText('—')).toBeInTheDocument();
  });

  it('ThreatRadar and RiskGauge describe themselves', () => {
    render(
      <>
        <ThreatRadar points={[{ category: 'PII_LEAK', score: 40, vulnerable: 1 }]} />
        <RiskGauge score={22} level="MEDIUM" />
        <RiskGauge score={null} />
      </>,
    );
    expect(screen.getByRole('img', { name: /PII leak 40/ })).toBeInTheDocument();
    expect(screen.getByText('MEDIUM RISK')).toBeInTheDocument();
    expect(screen.getByText('NO DATA')).toBeInTheDocument();
  });

  it('Panel and Readout render label and value', () => {
    render(
      <Panel title="USAGE">
        <Readout label="REQUESTS" value="91" sub="24h" testId="r" />
      </Panel>,
    );
    expect(screen.getByRole('heading', { name: 'USAGE' })).toBeInTheDocument();
    expect(screen.getByTestId('r')).toHaveTextContent('REQUESTS9124h');
  });

  it('EmptyState shows one instruction and one action', () => {
    render(
      <EmptyState title="No suites" text="Add one." action={<button type="button">New suite</button>} />,
    );
    expect(screen.getByRole('heading', { name: 'No suites' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'New suite' })).toBeInTheDocument();
  });

  it('ErrorState shows the request id with a copy button and a retry', async () => {
    const onRetry = vi.fn();
    const writeText = vi.fn(() => Promise.resolve());
    Object.assign(navigator, { clipboard: { writeText } });
    render(<ErrorState error={new ApiError(500, 'Queue down', 'req-42')} onRetry={onRetry} />);
    expect(screen.getByRole('alert')).toHaveTextContent('Queue down');
    expect(screen.getByText('req-42')).toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', { name: 'Copy' }));
    expect(writeText).toHaveBeenCalledWith('req-42');
    await userEvent.click(screen.getByRole('button', { name: /Retry/ }));
    expect(onRetry).toHaveBeenCalledOnce();
  });
});

describe('RollingNumber frames', () => {
  it('every intermediate frame shows whole numbers in the target format', async () => {
    const { interpolate } = await import('@/components/instruments/rolling-number');
    for (let step = 0; step <= 20; step++) {
      const t = step / 20;
      expect(interpolate('0%', '91.7%', t)).toMatch(/^\d{1,3}\.\d%$/);
      expect(interpolate('$0.014', '$0.086', t)).toMatch(/^\$0\.0\d{2}$/);
      expect(interpolate('3/24', '24/24', t)).toMatch(/^\d{1,2}\/24$/);
      expect(interpolate('', '1,864', t)).toMatch(/^\d{1,3}(,\d{3})*$/);
    }
    expect(interpolate('0%', '91.7%', 1)).toBe('91.7%');
    expect(interpolate('40%', '100%', 0.5)).toBe('70%');
  });
});
