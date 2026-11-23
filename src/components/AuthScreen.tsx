import React from 'react';
import { Building2, ShieldCheck, Layers, BarChart3, ArrowRight } from 'lucide-react';
import { useErp } from '../contexts/ErpContext';

export const AuthScreen: React.FC = () => {
  const { signInWithGoogle, theme, toggleTheme } = useErp();

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-[#070D19] flex flex-col justify-between">
      <header className="w-full border-b border-slate-200 dark:border-slate-800 bg-white dark:bg-[#0B1426] px-6 py-4 flex items-center justify-between gap-8">
        <div className="flex items-center gap-3 whitespace-nowrap shrink-0">
          <div className="w-8 h-8 rounded-md bg-blue-700 text-white flex items-center justify-center font-display font-bold text-sm">
            NX
          </div>
          <span className="font-display font-bold text-lg tracking-tight text-slate-900 dark:text-white">
            NEXUS ERP
          </span>
        </div>
        <div className="flex items-center gap-3 shrink-0">
          <button
            type="button"
            onClick={toggleTheme}
            className="px-3 py-1.5 text-xs font-medium border border-slate-200 dark:border-slate-700 rounded-md text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors whitespace-nowrap shrink-0"
          >
            {theme === 'dark' ? 'Mode clair' : 'Mode sombre'}
          </button>
          <button
            type="button"
            onClick={signInWithGoogle}
            className="px-4 py-2 text-xs font-semibold bg-blue-700 hover:bg-blue-800 text-white rounded-md transition-colors whitespace-nowrap shrink-0"
          >
            Connexion sécurisée
          </button>
        </div>
      </header>

      <main className="max-w-5xl w-full mx-auto px-6 py-12 grid lg:grid-cols-12 gap-10 items-center">
        <div className="lg:col-span-7 space-y-6">
          <p className="text-xs font-medium text-blue-700 dark:text-blue-400">
            Projet CECILE · Progiciel de Gestion Intégré
          </p>
          <h1 className="font-display text-3xl sm:text-4xl font-bold tracking-tight text-slate-900 dark:text-white text-balance">
            Connecter, gérer et optimiser chaque processus de votre entreprise.
          </h1>
          <p className="text-base text-slate-600 dark:text-slate-300 leading-relaxed max-w-xl">
            Une plateforme ERP unifiée inspirée des standards Odoo et SAP Business One : CRM, Ventes, Achats, Stocks multi-entrepôts, Comptabilité OHADA, Trésorerie, Ressources Humaines et Reporting temps réel.
          </p>

          <div className="pt-2">
            <button
              type="button"
              onClick={signInWithGoogle}
              className="inline-flex items-center gap-3 px-6 py-3 bg-[#0B1426] hover:bg-blue-800 dark:bg-blue-700 dark:hover:bg-blue-600 text-white font-semibold text-sm rounded-md transition-colors"
            >
              <span>Accéder à l’espace de travail avec Google</span>
              <ArrowRight className="w-4 h-4" />
            </button>
          </div>
        </div>

        <div className="lg:col-span-5 bg-white dark:bg-[#0B1426] border border-slate-200 dark:border-slate-800 rounded-lg p-6 space-y-5">
          <h2 className="font-display text-base font-semibold text-slate-900 dark:text-white border-b border-slate-100 dark:border-slate-800 pb-3">
            Architecture opérationnelle incluse
          </h2>
          <div className="space-y-4 text-sm">
            <div className="flex items-start gap-3">
              <Layers className="w-4 h-4 text-blue-700 dark:text-blue-400 mt-0.5 shrink-0" />
              <div>
                <p className="font-medium text-slate-900 dark:text-slate-100">9 modules interconnectés</p>
                <p className="text-slate-500 dark:text-slate-400 text-xs mt-0.5">
                  Synchronisation atomique ventes, stocks, facturation, trésorerie et écritures comptables.
                </p>
              </div>
            </div>
            <div className="flex items-start gap-3">
              <Building2 className="w-4 h-4 text-blue-700 dark:text-blue-400 mt-0.5 shrink-0" />
              <div>
                <p className="font-medium text-slate-900 dark:text-slate-100">Multi-entreprises & Plan OHADA</p>
                <p className="text-slate-500 dark:text-slate-400 text-xs mt-0.5">
                  Isolation stricte par société, grand livre, balance, bilan et compte de résultat.
                </p>
              </div>
            </div>
            <div className="flex items-start gap-3">
              <ShieldCheck className="w-4 h-4 text-blue-700 dark:text-blue-400 mt-0.5 shrink-0" />
              <div>
                <p className="font-medium text-slate-900 dark:text-slate-100">Contrôle d’accès RBAC & Audit</p>
                <p className="text-slate-500 dark:text-slate-400 text-xs mt-0.5">
                  Rôles granulaires par département, journalisation immuable et sauvegarde JSON.
                </p>
              </div>
            </div>
            <div className="flex items-start gap-3">
              <BarChart3 className="w-4 h-4 text-blue-700 dark:text-blue-400 mt-0.5 shrink-0" />
              <div>
                <p className="font-medium text-slate-900 dark:text-slate-100">Exports PDF, Excel & Analytics</p>
                <p className="text-slate-500 dark:text-slate-400 text-xs mt-0.5">
                  Factures PDF imprimables, classeurs Excel multi-feuilles et indicateurs en direct.
                </p>
              </div>
            </div>
          </div>
        </div>
      </main>

      <footer className="border-t border-slate-200 dark:border-slate-800 px-6 py-4 text-xs text-slate-500 dark:text-slate-400 flex flex-wrap items-center justify-between gap-4">
        <span>NEXUS ERP · Projet CECILE</span>
        <span>Français · Architecture modulaire persistante</span>
      </footer>
    </div>
  );
};
