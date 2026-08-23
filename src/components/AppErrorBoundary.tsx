import React from 'react';
import { AlertTriangle, RefreshCw } from 'lucide-react';

interface State { hasError: boolean; }

/**
 * Last-resort mobile error screen. A faulty third-party widget (map, VK ID,
 * media decoder) must not leave the user with a blank Capacitor WebView.
 */
export class AppErrorBoundary extends React.Component<React.PropsWithChildren, State> {
  state: State = { hasError: false };

  static getDerivedStateFromError(): State {
    return { hasError: true };
  }

  componentDidCatch(error: Error, info: React.ErrorInfo): void {
    // Keep diagnostics in development without exposing internal details in UI.
    if (import.meta.env.DEV) console.error('[SportBuddy] render error', error, info);
  }

  render(): React.ReactNode {
    if (!this.state.hasError) return this.props.children;

    return (
      <div className="min-h-screen bg-slate-950 px-6 pt-safe pb-safe flex items-center justify-center text-center">
        <div className="w-full max-w-sm rounded-3xl border border-amber-500/40 bg-slate-900 p-6 shadow-2xl">
          <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-2xl bg-amber-500/15 text-amber-400">
            <AlertTriangle className="h-7 w-7" />
          </div>
          <h1 className="text-lg font-black text-white">Нужно обновить SportBuddy78</h1>
          <p className="mt-2 text-xs leading-relaxed text-slate-400">
            Мы сохранили ваши данные локально. Перезапустите приложение — это обычно решает проблему.
          </p>
          <button
            onClick={() => window.location.reload()}
            className="mt-5 flex w-full items-center justify-center gap-2 rounded-2xl bg-emerald-500 py-3 text-sm font-black text-slate-950 active:scale-95"
          >
            <RefreshCw className="h-4 w-4" /> Обновить приложение
          </button>
        </div>
      </div>
    );
  }
}