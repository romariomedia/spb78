import React from 'react';
import { AlertTriangle, RefreshCw } from 'lucide-react';

interface State { hasError: boolean; errorCode: string; errorDetail: string; componentTrace: string; }

/**
 * Last-resort mobile error screen. A faulty third-party widget (map, VK ID,
 * media decoder) must not leave the user with a blank Capacitor WebView.
 */
export class AppErrorBoundary extends React.Component<React.PropsWithChildren, State> {
  state: State = { hasError: false, errorCode: '', errorDetail: '', componentTrace: '' };

  static getDerivedStateFromError(error: Error): State {
    const message = String(error?.message || '');
    const chunkError = /ChunkLoadError|Failed to fetch dynamically imported module|Importing a module script failed|Loading chunk/i.test(message);
    const code = chunkError ? 'SB78-CHUNK' : error instanceof TypeError ? 'SB78-TYPE' : 'SB78-RENDER';
    return { hasError: true, errorCode: code, errorDetail: message.slice(0, 220), componentTrace: '' };
  }

  componentDidCatch(error: Error, info: React.ErrorInfo): void {
    // Keep diagnostics in development without exposing internal details in UI.
    console.error('[SportBuddy] render error', error, info);
    const trace = (info.componentStack || '').trim().split('\n').slice(0, 7).join('\n');
    if (trace && trace !== this.state.componentTrace) this.setState({ componentTrace: trace });
  }

  render(): React.ReactNode {
    if (!this.state.hasError) return this.props.children;

    return (
      <div className="min-h-screen bg-slate-950 px-6 pt-safe pb-safe flex items-center justify-center text-center">
        <div className="w-full max-w-sm rounded-3xl border border-amber-500/40 bg-slate-900 p-6 shadow-2xl">
          <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-2xl bg-amber-500/15 text-amber-400">
            <AlertTriangle className="h-7 w-7" />
          </div>
          <h1 className="text-lg font-black text-white">Не удалось открыть экран</h1>
          <p className="mt-2 text-xs leading-relaxed text-slate-400">
            Произошла ошибка загрузки экрана. Если она повторяется, сообщите поддержке код ниже.
          </p>
          <p className="mt-3 text-xs font-mono text-amber-300">Код: {this.state.errorCode}</p>
          {this.state.errorDetail && (
            <p className="mt-2 break-words text-left text-xs text-slate-300" data-testid="runtime-error-detail">
              {this.state.errorDetail}
            </p>
          )}
          {this.state.componentTrace && (
            <pre className="mt-3 max-h-40 overflow-auto whitespace-pre-wrap break-words rounded-xl bg-slate-950 p-3 text-left text-[10px] text-slate-300">{this.state.componentTrace}</pre>
          )}
          <button
            onClick={() => window.location.reload()}
            className="mt-5 flex w-full items-center justify-center gap-2 rounded-2xl bg-emerald-500 py-3 text-sm font-black text-slate-950 active:scale-95"
          >
            <RefreshCw className="h-4 w-4" /> Повторить загрузку
          </button>
        </div>
      </div>
    );
  }
}