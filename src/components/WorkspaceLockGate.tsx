import React, { useState } from 'react';
import {
  Lock,
  Eye,
  EyeOff,
  ArrowRight,
  Plus,
  LogOut,
  AlertCircle,
  Building2,
  User,
} from 'lucide-react';
import { useErp } from '../contexts/ErpContext';
import { inputCls, labelCls } from './ui/DataUI';

export const WorkspaceLockGate: React.FC = () => {
  const {
    user,
    profile,
    companies,
    activeCompany,
    setActiveCompanyId,
    unlockWorkspace,
    setCreateWorkspaceOpen,
    logout,
    notify,
  } = useErp();

  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  if (!activeCompany) return null;

  const hasCustomPin =
    activeCompany.hasPassword !== undefined
      ? activeCompany.hasPassword
      : Boolean(activeCompany.passwordHash && activeCompany.passwordSalt);

  const handleUnlock = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (!password || password.trim().length === 0) {
      setError('Veuillez saisir votre mot de passe.');
      return;
    }

    setBusy(true);
    try {
      const result = await unlockWorkspace(activeCompany.id, password);
      if (!result.ok) {
        setError(result.error || 'Mot de passe incorrect.');
        return;
      }
      setPassword('');
      notify(`Espace « ${activeCompany.name} » déverrouillé.`, 'success');
    } finally {
      setBusy(false);
    }
  };

  const displayUser =
    profile?.firstName || profile?.lastName
      ? `${profile.firstName || ''} ${profile.lastName || ''}`.trim()
      : user?.displayName || user?.email;

  return (
    <div className="min-h-screen bg-[#F5F6F8] dark:bg-[#0D0E12] text-[#111216] dark:text-slate-100 flex flex-col justify-between">
      <header className="w-full border-b border-[#E6E8EC] dark:border-[#262933] bg-white dark:bg-[#16181F] px-4 sm:px-8 h-16 flex items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <img
            src="/assets/aistudio/image_2c55d81b.png"
            alt="JESSI"
            className="w-9 h-9 rounded-xl object-cover border border-[#E6E8EC] dark:border-[#262933]"
          />
          <span className="font-display font-extrabold text-lg tracking-tight text-[#111216] dark:text-white">
            JESSI
          </span>
        </div>

        <div className="flex items-center gap-2.5">
          <button
            type="button"
            onClick={() => setCreateWorkspaceOpen(true)}
            className="inline-flex items-center gap-1.5 px-3.5 py-2 text-xs font-semibold rounded-xl border border-[#E6E8EC] dark:border-[#262933] text-[#111216] dark:text-slate-200 hover:border-[#FC3F1D] transition-colors cursor-pointer"
          >
            <Plus className="w-3.5 h-3.5 text-[#FC3F1D]" />
            <span>Nouvel espace</span>
          </button>
          <button
            type="button"
            onClick={logout}
            className="inline-flex items-center gap-1.5 px-3.5 py-2 text-xs font-semibold rounded-xl text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-white/5 transition-colors cursor-pointer"
          >
            <LogOut className="w-3.5 h-3.5" />
            <span>Déconnexion</span>
          </button>
        </div>
      </header>

      <main className="flex-1 flex items-center justify-center p-4 sm:p-8">
        <div className="w-full max-w-md bg-white dark:bg-[#16181F] border border-[#E6E8EC] dark:border-[#262933] rounded-2xl p-6 sm:p-8 space-y-6">
          <div className="flex items-center gap-3.5">
            <div className="w-11 h-11 rounded-2xl bg-[#FC3F1D]/10 text-[#FC3F1D] flex items-center justify-center shrink-0">
              <Lock className="w-5 h-5" />
            </div>
            <div>
              <p className="text-[11px] font-bold uppercase tracking-wider text-[#FC3F1D]">
                Écran verrouillé
              </p>
              <h1 className="font-display text-lg font-extrabold text-[#111216] dark:text-white">
                Déverrouiller votre espace
              </h1>
            </div>
          </div>

          <p className="text-xs text-slate-600 dark:text-slate-300 leading-relaxed">
            Connecté en tant que <strong className="text-[#111216] dark:text-white">{displayUser}</strong>.{' '}
            {hasCustomPin
              ? 'Saisissez le code de verrouillage de cet espace pour reprendre votre travail.'
              : 'Saisissez le mot de passe de votre compte JESSI pour reprendre votre travail.'}
          </p>

          {companies.length > 1 && (
            <div>
              <label className={labelCls}>Espace de travail</label>
              <select
                value={activeCompany.id}
                onChange={(e) => {
                  setActiveCompanyId(e.target.value);
                  setPassword('');
                  setError(null);
                }}
                className={inputCls}
              >
                {companies.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name} ({c.accountType === 'particulier' ? 'Particulier' : 'Entreprise'})
                  </option>
                ))}
              </select>
            </div>
          )}

          {companies.length === 1 && (
            <div className="flex items-center gap-2.5 px-3.5 py-2.5 rounded-xl bg-[#F5F6F8] dark:bg-[#0D0E12] border border-[#E6E8EC] dark:border-[#262933] text-xs font-semibold text-[#111216] dark:text-white">
              {activeCompany.accountType === 'particulier' ? (
                <User className="w-4 h-4 text-[#FC3F1D] shrink-0" />
              ) : (
                <Building2 className="w-4 h-4 text-[#FC3F1D] shrink-0" />
              )}
              <span className="truncate">{activeCompany.name}</span>
            </div>
          )}

          {error && (
            <div className="flex items-start gap-2.5 p-3 rounded-xl bg-red-50 dark:bg-red-950/50 border border-red-200 dark:border-red-800 text-xs text-red-700 dark:text-red-300 font-medium">
              <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
              <span>{error}</span>
            </div>
          )}

          <form onSubmit={handleUnlock} noValidate className="space-y-4">
            <div>
              <label className={labelCls}>
                {hasCustomPin ? 'Code de l’espace *' : 'Mot de passe de votre compte *'}
              </label>
              <div className="relative">
                <input
                  type={showPassword ? 'text' : 'password'}
                  autoFocus
                  required
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="Saisissez votre mot de passe"
                  className={`${inputCls} pr-10`}
                />
                <button
                  type="button"
                  onClick={() => setShowPassword((p) => !p)}
                  className="absolute right-3 top-2.5 text-slate-400 hover:text-slate-700 dark:hover:text-white"
                  aria-label="Afficher le mot de passe"
                >
                  {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
            </div>

            <button
              type="submit"
              disabled={busy}
              className="w-full inline-flex items-center justify-center gap-2 px-5 py-3 bg-[#FC3F1D] hover:bg-[#E03212] disabled:opacity-60 text-white text-sm font-bold rounded-xl transition-colors cursor-pointer"
            >
              <span>{busy ? 'Vérification...' : 'Reprendre la session'}</span>
              <ArrowRight className="w-4 h-4" />
            </button>
          </form>
        </div>
      </main>

      <footer className="border-t border-[#E6E8EC] dark:border-[#262933] bg-white dark:bg-[#16181F] px-4 sm:px-8 py-4 text-xs text-slate-500 dark:text-slate-400 text-center">
        JESSI · Session chiffrée et protection de vos données
      </footer>
    </div>
  );
};
