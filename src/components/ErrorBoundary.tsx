import React from 'react';
import { AlertTriangle, RefreshCw } from 'lucide-react';

interface State {
  hasError: boolean;
  message: string;
}

export class ErrorBoundary extends React.Component<{ children: React.ReactNode }, State> {
  constructor(props: { children: React.ReactNode }) {
    super(props);
    this.state = { hasError: false, message: '' };
  }

  static getDerivedStateFromError(error: Error): State {
    return {
      hasError: true,
      message: error.message || 'Une erreur inattendue est survenue.',
    };
  }

  render() {
    if (this.state.hasError) {
      let friendlyMsg = this.state.message;
      try {
        const parsed = JSON.parse(this.state.message);
        if (parsed.error && parsed.operationType) {
          friendlyMsg = `Accès ou opération refusée (${parsed.operationType} sur ${parsed.path || 'ressource'}) : ${parsed.error}`;
        }
      } catch {
        // plain text error
      }

      return (
        <div className="min-h-screen flex items-center justify-center bg-slate-50 dark:bg-[#070D19] p-6">
          <div className="max-w-lg w-full bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-lg p-6 space-y-4">
            <div className="flex items-center gap-3 text-[#FC3F1D]">
              <AlertTriangle className="w-6 h-6 shrink-0" />
              <h2 className="text-lg font-semibold">Interruption de session JESSI</h2>
            </div>
            <p className="text-sm text-slate-600 dark:text-slate-300 leading-relaxed break-words">
              {friendlyMsg}
            </p>
            <button
              onClick={() => window.location.reload()}
              className="inline-flex items-center gap-2 px-4 py-2 text-sm font-semibold bg-[#FC3F1D] hover:bg-[#E03212] text-white rounded-xl transition-colors"
            >
              <RefreshCw className="w-4 h-4" />
              Recharger l’espace de travail
            </button>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}
