import { Component, type ReactNode } from 'react';

/**
 * Isolates rendering errors of the third-party board (e.g. measuring a hidden
 * board during an animation) so they never take down the page. It re-mounts
 * the board when the position changes.
 */
export class BoardErrorBoundary extends Component<{ resetKey: string; children: ReactNode }, { failedKey: string | null }> {
  state = { failedKey: null as string | null };

  static getDerivedStateFromError() {
    return { failedKey: '__pending__' };
  }

  componentDidCatch(error: unknown) {
    console.warn('[ChessLab] board render error recovered:', error);
    this.setState({ failedKey: this.props.resetKey });
  }

  componentDidUpdate(prev: { resetKey: string }) {
    if (this.state.failedKey && prev.resetKey !== this.props.resetKey) this.setState({ failedKey: null });
  }

  render() {
    if (this.state.failedKey) {
      return (
        <button
          type="button"
          className="flex aspect-square w-full cursor-pointer items-center justify-center rounded-lg bg-muted text-sm text-muted-foreground"
          onClick={() => this.setState({ failedKey: null })}
        >
          El tauler s'ha de tornar a dibuixar. Toca per recarregar-lo.
        </button>
      );
    }
    return this.props.children;
  }
}
