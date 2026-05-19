import { Component } from "react";
import { useLocation } from "react-router-dom";
import type { ErrorInfo, ReactNode } from "react";

type ErrorBoundaryProps = {
  children: ReactNode;
  resetKey: string;
};

type ErrorBoundaryState = {
  error: Error | null;
};

class ErrorBoundary extends Component<ErrorBoundaryProps, ErrorBoundaryState> {
  state: ErrorBoundaryState = { error: null };

  static getDerivedStateFromError(error: Error): ErrorBoundaryState {
    return { error };
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error("Route render failed:", error, errorInfo);
  }

  componentDidUpdate(prevProps: ErrorBoundaryProps) {
    if (prevProps.resetKey !== this.props.resetKey && this.state.error) {
      this.setState({ error: null });
    }
  }

  private handleReset = () => {
    this.setState({ error: null });
  };

  render() {
    if (!this.state.error) return this.props.children;

    return (
      <div className="flex min-h-full items-center justify-center bg-gray-950 p-6 text-white">
        <div className="w-full max-w-lg rounded-lg border border-red-500/30 bg-gray-900/95 p-6 shadow-2xl">
          <p className="text-xs font-semibold uppercase tracking-[0.22em] text-red-300">
            Page error
          </p>
          <h1 className="mt-3 text-2xl font-bold">Something went wrong on this page.</h1>
          <p className="mt-3 text-sm leading-6 text-gray-300">
            The app shell is still running. You can retry this page or return to the main trainer.
          </p>
          <div className="mt-5 flex flex-wrap gap-3">
            <button
              className="rounded-md border border-cyan-400/50 bg-cyan-500/15 px-4 py-2 text-sm font-semibold text-cyan-100 transition hover:bg-cyan-500/25"
              type="button"
              onClick={this.handleReset}
            >
              Try again
            </button>
            <a
              className="rounded-md border border-gray-600 bg-gray-800 px-4 py-2 text-sm font-semibold text-gray-100 transition hover:bg-gray-700"
              href="#/melodica"
            >
              Go home
            </a>
          </div>
        </div>
      </div>
    );
  }
}

export const RouteErrorBoundary = ({ children }: { children: ReactNode }) => {
  const location = useLocation();
  return <ErrorBoundary resetKey={location.pathname}>{children}</ErrorBoundary>;
};
