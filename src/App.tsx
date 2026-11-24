/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React from 'react';
import { ShieldAlert } from 'lucide-react';
import { ErrorBoundary } from './components/ErrorBoundary';
import { ErpProvider, useErp } from './contexts/ErpContext';
import { AuthScreen } from './components/AuthScreen';
import { WorkspaceOnboarding } from './components/WorkspaceOnboarding';
import { WorkspaceLockGate } from './components/WorkspaceLockGate';
import { Layout } from './components/Layout';
import { AppLauncherView } from './components/modules/AppLauncherView';
import { AppStoreView } from './components/modules/AppStoreView';
import { DynamicModuleView } from './components/modules/DynamicModuleView';
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
  const {
    user,
    authReady,
    companiesLoaded,
    companies,
    activeCompany,
    isWorkspaceUnlocked,
    createWorkspaceOpen,
    setCreateWorkspaceOpen,
    activeModule,
    hasModuleAccess,
    setActiveModule,
  } = useErp();

  if (!authReady) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[#F5F6F8] dark:bg-[#0D0E12] p-6">
        <div className="text-center space-y-3">
          <img
            src="/assets/aistudio/image_2c55d81b.png"
            alt="JESSI"
            className="w-12 h-12 mx-auto rounded-xl object-cover border border-[#E6E8EC] dark:border-[#262933] shadow-xs"
          />
          <p className="text-sm font-semibold text-slate-700 dark:text-slate-300">
            Reconnexion automatique JESSI...
          </p>
        </div>
      </div>
    );
  }

  if (!user) {
    return <AuthScreen />;
  }

  if (!companiesLoaded) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[#F5F6F8] dark:bg-[#0D0E12] p-6">
        <div className="max-w-md w-full bg-white dark:bg-[#16181F] border border-[#E6E8EC] dark:border-[#262933] rounded-2xl p-6 text-center space-y-3">
          <img
            src="/assets/aistudio/image_2c55d81b.png"
            alt="JESSI"
            className="w-12 h-12 mx-auto rounded-xl object-cover border border-[#E6E8EC] dark:border-[#262933] shadow-xs"
          />
          <h2 className="font-display text-base font-bold text-[#111216] dark:text-white">
            Ouverture de votre accès JESSI
          </h2>
          <p className="text-xs text-slate-500 dark:text-slate-400 leading-relaxed">
            Chargement de votre espace de travail...
          </p>
        </div>
      </div>
    );
  }

  if (companies.length === 0 || !activeCompany || createWorkspaceOpen) {
    return (
      <WorkspaceOnboarding
        onCancel={companies.length > 0 ? () => setCreateWorkspaceOpen(false) : undefined}
        onCreated={() => setCreateWorkspaceOpen(false)}
      />
    );
  }

  // Enforce workspace password verification before exposing any metrics, modules, or subcollections
  if (!isWorkspaceUnlocked) {
    return <WorkspaceLockGate />;
  }

  const renderModule = () => {
    if (!hasModuleAccess(activeModule)) {
      return (
        <div className="bg-white dark:bg-[#16181F] border border-[#E6E8EC] dark:border-[#262933] rounded-2xl p-8 text-center space-y-3 max-w-lg mx-auto mt-8">
          <ShieldAlert className="w-8 h-8 text-amber-600 mx-auto" />
          <h2 className="font-display text-base font-bold text-[#111216] dark:text-white">
            Accès restreint à ce module
          </h2>
          <p className="text-xs text-slate-500 dark:text-slate-400">
            Votre rôle actuel ne dispose pas des autorisations requises pour consulter ce module.
          </p>
          <button
            type="button"
            onClick={() => setActiveModule('launcher')}
            className="px-4 py-2 text-xs font-semibold bg-[#FC3F1D] hover:bg-[#E03212] text-white rounded-xl"
          >
            Retour aux Applications
          </button>
        </div>
      );
    }

    switch (activeModule) {
      case 'launcher':
        return <AppLauncherView />;
      case 'appstore':
        return <AppStoreView />;
      case 'dynamic_module':
        return <DynamicModuleView />;
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
        return <AppLauncherView />;
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
