import { describe, expect, it } from 'vitest';
import { render, screen, act } from '@testing-library/react';
import { FpsOverlay } from './FpsOverlay';
import { Emitter } from '../viewer/ViewerAdapter';
import type { ViewerAdapter, ViewerEvents } from '../viewer/ViewerAdapter';

describe('FpsOverlay component', () => {
  it('renders initial instructions and updates with fps stats', async () => {
    const emitter = new Emitter<ViewerEvents>();
    const mockViewer = {
      on: (event: any, listener: any) => emitter.on(event, listener),
    } as unknown as ViewerAdapter;

    render(<FpsOverlay viewer={mockViewer} />);
    expect(screen.getByTestId('fps-debug-overlay')).toBeInTheDocument();
    expect(screen.getByText('Kéo chuột để đo FPS...')).toBeInTheDocument();

    // Emit live fps stats
    act(() => {
      emitter.emit('fpsStats', {
        avgFps: 42.5,
        maxFrameMs: 24.3,
        over100Count: 0,
        active: true,
      });
    });

    expect(screen.getByText('42.5')).toBeInTheDocument();
    expect(screen.getByText('24.3 ms')).toBeInTheDocument();
    expect(screen.getByText('0')).toBeInTheDocument();
    expect(screen.getByText('Đang kéo...')).toBeInTheDocument();

    // Emit finished stats
    act(() => {
      emitter.emit('fpsStats', {
        avgFps: 45.0,
        maxFrameMs: 32.1,
        over100Count: 1,
        active: false,
      });
    });

    expect(screen.getByText('45.0')).toBeInTheDocument();
    expect(screen.getByText('32.1 ms')).toBeInTheDocument();
    expect(screen.getByText('1')).toBeInTheDocument();
    expect(screen.queryByText('Đang kéo...')).not.toBeInTheDocument();
  });
});
