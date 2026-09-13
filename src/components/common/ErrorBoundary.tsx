import React, { Component, ErrorInfo, ReactNode } from 'react';
import { AlertTriangle, RefreshCw } from 'lucide-react';

interface Props {
  children: ReactNode;
}

interface State {
  hasError: boolean;
  error: Error | null;
}

export class ErrorBoundary extends Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = {
      hasError: false,
      error: null,
    };
  }

  public static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  public componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error('[CallBreak ErrorBoundary] Uncaught runtime error:', error, errorInfo);
  }

  private handleReload = () => {
    window.location.reload();
  };

  public render() {
    if (this.state.hasError) {
      return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-stone-950 text-stone-200 p-4">
          <div className="w-full max-w-md p-6 rounded-3xl bg-stone-900 border border-stone-800 shadow-2xl text-center space-y-4">
            <div className="w-12 h-12 mx-auto rounded-2xl bg-rose-950/80 border border-rose-700/60 flex items-center justify-center text-rose-400">
              <AlertTriangle className="w-6 h-6" />
            </div>
            <h2 className="text-lg font-bold text-white tracking-tight">Something went wrong</h2>
            <p className="text-xs text-stone-400 leading-relaxed">
              An unexpected display issue occurred. Your saved game and player statistics are safely preserved in local storage.
            </p>
            {this.state.error?.message && (
              <div className="p-3 rounded-xl bg-stone-950/80 border border-stone-800 text-[11px] font-mono text-stone-400 text-left overflow-x-auto">
                {this.state.error.message}
              </div>
            )}
            <button
              type="button"
              onClick={this.handleReload}
              className="w-full py-3 px-4 rounded-xl bg-gradient-to-r from-emerald-600 to-emerald-500 hover:from-emerald-500 hover:to-emerald-400 text-white font-bold text-xs flex items-center justify-center gap-2 shadow-lg shadow-emerald-950 transition-all cursor-pointer"
            >
              <RefreshCw className="w-4 h-4" />
              <span>Reload Application</span>
            </button>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}
