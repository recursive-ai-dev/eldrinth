import { Component, type ErrorInfo, type ReactNode } from "react";

/**
 * Last line of defence for the React shell.
 *
 * A render-time throw anywhere in the tree unmounts everything and leaves a
 * blank page, because `body` is a near-black background and the game draws to
 * a canvas rather than to DOM. For a static release with no error reporting,
 * that is an unrecoverable dead end: the player's only remedy is a manual
 * reload they have no reason to know about. This catches it, says so, and
 * offers both a reload and a way back.
 *
 * This cannot catch a crash inside the canvas engine — that one is routed
 * through `GameCallbacks.onFatal` and surfaces in `GameCanvas`.
 */
interface Props {
  children: ReactNode;
  /** Shown instead of the default panel, for testability. */
  fallback?: (error: Error, reset: () => void) => ReactNode;
}

interface State {
  error: Error | null;
}

export default class ErrorBoundary extends Component<Props, State> {
  state: State = { error: null };

  static getDerivedStateFromError(error: Error): State {
    return { error };
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error("Unhandled UI error:", error, info.componentStack);
  }

  private reset = () => this.setState({ error: null });

  render() {
    const { error } = this.state;
    if (!error) return this.props.children;
    if (this.props.fallback) return this.props.fallback(error, this.reset);

    return (
      <div
        data-testid="error-boundary"
        className="fixed inset-0 z-[100] flex items-center justify-center bg-black/90 p-6"
      >
        <div className="max-w-md w-full rounded-xl border border-rose-500/30 bg-[#0f0c13] p-8 text-center">
          <h2 className="mb-2 font-serif text-xl font-bold tracking-widest text-rose-100 uppercase">
            Something Broke
          </h2>
          <p className="mb-2 font-serif text-sm text-amber-100/75 leading-relaxed">
            The interface stopped responding. Your most recent autosave is
            untouched.
          </p>
          <p className="mb-6 font-mono text-xs text-amber-100/45 break-words">{error.message}</p>
          <div className="flex flex-col sm:flex-row gap-3 justify-center">
            <button
              type="button"
              onClick={this.reset}
              className="cursor-pointer rounded border border-amber-400/40 bg-amber-500/20 px-5 py-2 font-serif text-xs uppercase tracking-widest text-amber-200 transition hover:border-amber-300 hover:bg-amber-500/30 active:scale-95"
            >
              Try Again
            </button>
            <button
              type="button"
              onClick={() => window.location.reload()}
              className="cursor-pointer rounded border border-white/20 bg-white/5 px-5 py-2 font-serif text-xs uppercase tracking-widest text-stone-300 transition hover:border-white/40 hover:bg-white/10 active:scale-95"
            >
              Reload
            </button>
          </div>
        </div>
      </div>
    );
  }
}
