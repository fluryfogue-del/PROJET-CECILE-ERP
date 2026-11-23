/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React from 'react';
import { ShieldAlert } from 'lucide-react';
import { ErrorBoundary } from './components/ErrorBoundary';
import { ErpProvider, useErp } from './contexts/ErpContext';
import { AuthScreen } from './components/AuthScreen';
import { Layout } from './components/Layout';
import { DashboardView } from './components/modules/DashboardView';
import { CrmView } from './components/modules/CrmView';
import { SalesView } from './components/modules/SalesView';
import { PurchasesView } from './components/modules/PurchasesView';
import { InventoryView } from './components/modules/InventoryView';
import { AccountingView } from './components/modules/AccountingView';
import { TreasuryView } from './components/modules/TreasuryView';
import { HrView } from './components/modules/HrView';
import { ReportingView } from './components/modules/ReportingView';
import { AdminView } from './components/modules/AdminView';
import { DocsView } from './components/modules/DocsView';

const ErpShell: React.FC = () => {
  const { user, authReady, bootstrapping, activeCompany, activeModule, hasModuleAccess, setActiveModule } = useErp();

  if (!authReady) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50 dark:bg-[#070D19] p-6">
        <div className="text-center space-y-3">
          <div className="w-10 h-10 mx-auto rounded-md bg-blue-700 text-white flex items-center justify-center font-display font-bold text-sm">
            NX
          </div>
          <p className="text-sm font-medium text-slate-700 dark:text-slate-300">
            Initialisation de la session NEXUS ERP...
          </p>
        </div>
      </div>
    );
  }

  if (!user) {
    return <AuthScreen />;
  }

  if (bootstrapping || !activeCompany) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50 dark:bg-[#070D19] p-6">
        <div className="max-w-md w-full bg-white dark:bg-[#0B1426] border border-slate-200 dark:border-slate-800 rounded-lg p-6 text-center space-y-3">
          <div className="w-10 h-10 mx-auto rounded-md bg-blue-700 text-white flex items-center justify-center font-display font-bold text-sm">
            NX
          </div>
          <h2 className="font-display text-base font-semibold text-slate-900 dark:text-white">
            Préparation de votre espace CECILE — NEXUS ERP
          </h2>
          <p className="text-xs text-slate-500 dark:text-slate-400 leading-relaxed">
            Initialisation du plan comptable OHADA, des entrepôts, de la trésorerie et des données opérationnelles en base de données...
          </p>
        </div>
      </div>
    );
  }

  const renderModule = () => {
    if (!hasModuleAccess(activeModule)) {
      return (
        <div className="bg-white dark:bg-[#0B1426] border border-slate-200 dark:border-slate-800 rounded-lg p-8 text-center space-y-3 max-w-lg mx-auto mt-8">
          <ShieldAlert className="w-8 h-8 text-amber-600 mx-auto" />
          <h2 className="font-display text-base font-semibold text-slate-900 dark:text-white">
            Accès restreint à ce module
          </h2>
          <p className="text-xs text-slate-500 dark:text-slate-400">
            Votre rôle actuel ne dispose pas des autorisations requises pour consulter ce module.
          </p>
          <button
            type="button"
            onClick={() => setActiveModule('dashboard')}
            className="px-4 py-2 text-xs font-semibold bg-blue-700 hover:bg-blue-800 text-white rounded-md"
          >
            Retour au tableau de bord
          </button>
        </div>
      );
    }

    switch (activeModule) {
      case 'dashboard':
        return <DashboardView />;
      case 'crm':
        return <CrmView />;
      case 'sales':
        return <SalesView />;
      case 'purchases':
        return <PurchasesView />;
      case 'inventory':
        return <InventoryView />;
      case 'accounting':
        return <AccountingView />;
      case 'treasury':
        return <TreasuryView />;
      case 'hr':
        return <HrView />;
      case 'reporting':
        return <ReportingView />;
      case 'admin':
        return <AdminView />;
      case 'docs':
        return <DocsView />;
      default:
        return <DashboardView />;
    }
  };

  return <Layout>{renderModule()}</Layout>;
};

export default function App() {
  return (
    <ErrorBoundary>
      <ErpProvider>
        <ErpShell />
      </ErpProvider>
    </ErrorBoundary>
  );
}
