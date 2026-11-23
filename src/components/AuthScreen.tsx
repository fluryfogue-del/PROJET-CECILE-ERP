import React, { useState } from 'react';
import {
  Building2,
  User,
  ShieldCheck,
  Layers,
  Lock,
  ArrowRight,
  Grid,
  CheckCircle2,
  Sun,
  Moon,
  AlertCircle,
  Eye,
  EyeOff,
} from 'lucide-react';
import { useErp } from '../contexts/ErpContext';
import { AccountType } from '../types/erp';
import { isNonEmptyText, validatePersonalDetails, validateWorkspacePasswordPair } from '../lib/security';
import { inputCls, labelCls } from './ui/DataUI';

export const AuthScreen: React.FC = () => {
  const {
    loginWithCredentials,
    registerAccount,
    theme,
    toggleTheme,
    pendingAccountType,
    setPendingAccountType,
    pendingPersonalInfo,
    notify,
  } = useErp();

  const [authTab, setAuthTab] = useState<'register' | 'login'>('register');
  const [firstName, setFirstName] = useState(pendingPersonalInfo.firstName);
  const [lastName, setLastName] = useState(pendingPersonalInfo.lastName);
  const [phone, setPhone] = useState(pendingPersonalInfo.phone);
  const [address, setAddress] = useState(pendingPersonalInfo.address);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPwd, setShowPwd] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const handleSelectType = (type: AccountType) => {
    setPendingAccountType(type);
    setFormError(null);
  };

  const handleRegisterSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormError(null);

    const validationError = validatePersonalDetails({
      lastName,
      firstName,
      phone,
      address,
    });
    if (validationError) {
      setFormError(validationError);
      return;
    }

    if (!isNonEmptyText(email, 5) || !email.includes('@')) {
      setFormError('Une adresse e-mail valide est obligatoire.');
      return;
    }

    if (!password || password.trim().length < 6) {
      setFormError('Le mot de passe du compte doit contenir au moins 6 caractères.');
      return;
    }

    const pairErr = validateWorkspacePasswordPair(password, confirmPassword);
    if (pairErr) {
      setFormError(pairErr);
      return;
    }

    setBusy(true);
    try {
      const res = await registerAccount({
        firstName: firstName.trim(),
        lastName: lastName.trim(),
        phone: phone.trim(),
        address: address.trim(),
        email: email.trim(),
        password,
        accountType: pendingAccountType,
      });
      if (!res.ok) {
        setFormError(res.error || 'Impossible de créer le compte.');
        return;
      }
      notify('Compte créé et session sécurisée ouverte.', 'success');
    } finally {
      setBusy(false);
    }
  };

  const handleLoginSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormError(null);

    if (!isNonEmptyText(email, 3) || !email.includes('@')) {
      setFormError('Veuillez saisir une adresse e-mail valide.');
      return;
    }
    if (!isNonEmptyText(password, 1)) {
      setFormError('Le mot de passe est obligatoire.');
      return;
    }

    setBusy(true);
    try {
      const res = await loginWithCredentials(email.trim(), password);
      if (!res.ok) {
        setFormError(res.error || 'Identifiants incorrects.');
        return;
      }
      notify('Connexion réussie.', 'success');
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#F5F6F8] dark:bg-[#0D0E12] text-[#111216] dark:text-slate-100 flex flex-col justify-between">
      {/* Clean Header */}
      <header className="w-full border-b border-[#E6E8EC] dark:border-[#262933] bg-white dark:bg-[#16181F] px-4 sm:px-8 h-16 flex items-center justify-between gap-4">
        <div className="flex items-center gap-3 whitespace-nowrap shrink-0">
          <div className="w-9 h-9 rounded-xl bg-[#FC3F1D] text-white flex items-center justify-center font-display font-extrabold text-sm tracking-tight">
            FX
          </div>
          <span className="font-display font-extrabold text-lg tracking-tight text-[#111216] dark:text-white">
            FUREX ERP
          </span>
        </div>

        <div className="flex items-center gap-2.5 shrink-0">
          <button
            type="button"
            onClick={toggleTheme}
            aria-label="Basculer le thème"
            className="inline-flex items-center gap-2 px-3 py-2 text-xs font-semibold border border-[#E6E8EC] dark:border-[#262933] rounded-xl text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-white/5 transition-colors whitespace-nowrap shrink-0 cursor-pointer"
          >
            {theme === 'dark' ? <Sun className="w-3.5 h-3.5" /> : <Moon className="w-3.5 h-3.5" />}
            <span className="hidden sm:inline">{theme === 'dark' ? 'Mode clair' : 'Mode sombre'}</span>
          </button>
          <button
            type="button"
            onClick={() => {
              setAuthTab('login');
              setFormError(null);
            }}
            className="px-4 py-2 text-xs font-semibold bg-[#111216] dark:bg-white text-white dark:text-[#111216] hover:opacity-90 rounded-xl transition-opacity whitespace-nowrap shrink-0 cursor-pointer"
          >
            Se connecter
          </button>
        </div>
      </header>

      {/* Main Content */}
      <main className="max-w-6xl w-full mx-auto px-4 sm:px-8 py-10 sm:py-12 grid lg:grid-cols-12 gap-10 items-center">
        {/* Left Column */}
        <div className="lg:col-span-6 space-y-6">
          <div className="space-y-3">
            <p className="text-xs font-bold uppercase tracking-wider text-[#FC3F1D]">
              Plateforme ERP Modulaire · Entreprise & Particulier
            </p>
            <h1 className="font-display text-3xl sm:text-5xl font-extrabold tracking-tight text-[#111216] dark:text-white leading-[1.1] text-balance">
              Pilotez vos activités dans un espace privé et persistant.
            </h1>
            <p className="text-base text-slate-600 dark:text-slate-300 leading-relaxed max-w-xl">
              Créez votre compte sécurisé, sélectionnez votre profil Entreprise ou Particulier, composez votre suite parmi plus de 66 modules et enregistrez toutes vos opérations en base de données.
            </p>
          </div>

          <div className="grid sm:grid-cols-2 gap-4 pt-2">
            <div className="bg-white dark:bg-[#16181F] border border-[#E6E8EC] dark:border-[#262933] rounded-2xl p-4 space-y-1.5">
              <Grid className="w-4 h-4 text-[#FC3F1D]" />
              <p className="text-xs font-bold text-[#111216] dark:text-white">66+ modules à la carte</p>
              <p className="text-xs text-slate-500 dark:text-slate-400 leading-relaxed">
                CRM, Ventes, Stocks, Achats, OHADA, Trésorerie, RH et modules personnalisés.
              </p>
            </div>
            <div className="bg-white dark:bg-[#16181F] border border-[#E6E8EC] dark:border-[#262933] rounded-2xl p-4 space-y-1.5">
              <Lock className="w-4 h-4 text-[#FC3F1D]" />
              <p className="text-xs font-bold text-[#111216] dark:text-white">Accès par mot de passe</p>
              <p className="text-xs text-slate-500 dark:text-slate-400 leading-relaxed">
                Authentification serveur et verrouillage chiffré de chaque espace de travail.
              </p>
            </div>
            <div className="bg-white dark:bg-[#16181F] border border-[#E6E8EC] dark:border-[#262933] rounded-2xl p-4 space-y-1.5">
              <Layers className="w-4 h-4 text-[#FC3F1D]" />
              <p className="text-xs font-bold text-[#111216] dark:text-white">Modèle Factures complet</p>
              <p className="text-xs text-slate-500 dark:text-slate-400 leading-relaxed">
                Numérotation séquentielle, TVA/remises, encaissements et export PDF, CSV, Excel.
              </p>
            </div>
            <div className="bg-white dark:bg-[#16181F] border border-[#E6E8EC] dark:border-[#262933] rounded-2xl p-4 space-y-1.5">
              <ShieldCheck className="w-4 h-4 text-[#FC3F1D]" />
              <p className="text-xs font-bold text-[#111216] dark:text-white">Persistance SQL & Cloudflare</p>
              <p className="text-xs text-slate-500 dark:text-slate-400 leading-relaxed">
                Architecture serveur prête pour Cloudflare Workers et base relationnelle D1.
              </p>
            </div>
          </div>
        </div>

        {/* Right Column: Registration & Login Card */}
        <div className="lg:col-span-6 bg-white dark:bg-[#16181F] border border-[#E6E8EC] dark:border-[#262933] rounded-2xl p-6 sm:p-7 space-y-5">
          {/* Tabs */}
          <div className="grid grid-cols-2 gap-1.5 p-1 bg-[#F5F6F8] dark:bg-[#0D0E12] rounded-xl border border-[#E6E8EC] dark:border-[#262933]">
            <button
              type="button"
              onClick={() => {
                setAuthTab('register');
                setFormError(null);
              }}
              className={`py-2 px-3 text-xs font-bold rounded-lg transition-colors cursor-pointer ${
                authTab === 'register'
                  ? 'bg-white dark:bg-[#16181F] text-[#FC3F1D] shadow-xs'
                  : 'text-slate-600 dark:text-slate-400 hover:text-[#111216] dark:hover:text-white'
              }`}
            >
              Créer un compte
            </button>
            <button
              type="button"
              onClick={() => {
                setAuthTab('login');
                setFormError(null);
              }}
              className={`py-2 px-3 text-xs font-bold rounded-lg transition-colors cursor-pointer ${
                authTab === 'login'
                  ? 'bg-white dark:bg-[#16181F] text-[#FC3F1D] shadow-xs'
                  : 'text-slate-600 dark:text-slate-400 hover:text-[#111216] dark:hover:text-white'
              }`}
            >
              Connexion membre
            </button>
          </div>

          {formError && (
            <div className="flex items-start gap-2.5 p-3 rounded-xl bg-red-50 dark:bg-red-950/50 border border-red-200 dark:border-red-800 text-xs text-red-700 dark:text-red-300 font-medium">
              <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
              <span>{formError}</span>
            </div>
          )}

          {authTab === 'register' ? (
            <form onSubmit={handleRegisterSubmit} noValidate className="space-y-3.5">
              {/* Profile Type Selector */}
              <div className="grid grid-cols-2 gap-3">
                <button
                  type="button"
                  onClick={() => handleSelectType('entreprise')}
                  className={`text-left p-3 rounded-xl border transition-all cursor-pointer ${
                    pendingAccountType === 'entreprise'
                      ? 'border-[#FC3F1D] bg-[#FC3F1D]/[0.04] ring-1 ring-[#FC3F1D]'
                      : 'border-[#E6E8EC] dark:border-[#262933] hover:border-slate-300'
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <Building2
                      className={`w-4 h-4 ${
                        pendingAccountType === 'entreprise' ? 'text-[#FC3F1D]' : 'text-slate-500'
                      }`}
                    />
                    {pendingAccountType === 'entreprise' && (
                      <CheckCircle2 className="w-4 h-4 text-[#FC3F1D]" />
                    )}
                  </div>
                  <p className="font-display font-bold text-xs text-[#111216] dark:text-white mt-1.5">
                    Entreprise
                  </p>
                  <p className="text-[11px] text-slate-500 dark:text-slate-400">
                    Société, PME, Commerce
                  </p>
                </button>

                <button
                  type="button"
                  onClick={() => handleSelectType('particulier')}
                  className={`text-left p-3 rounded-xl border transition-all cursor-pointer ${
                    pendingAccountType === 'particulier'
                      ? 'border-[#FC3F1D] bg-[#FC3F1D]/[0.04] ring-1 ring-[#FC3F1D]'
                      : 'border-[#E6E8EC] dark:border-[#262933] hover:border-slate-300'
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <User
                      className={`w-4 h-4 ${
                        pendingAccountType === 'particulier' ? 'text-[#FC3F1D]' : 'text-slate-500'
                      }`}
                    />
                    {pendingAccountType === 'particulier' && (
                      <CheckCircle2 className="w-4 h-4 text-[#FC3F1D]" />
                    )}
                  </div>
                  <p className="font-display font-bold text-xs text-[#111216] dark:text-white mt-1.5">
                    Particulier
                  </p>
                  <p className="text-[11px] text-slate-500 dark:text-slate-400">
                    Indépendant, Activité perso
                  </p>
                </button>
              </div>

              <div className="grid sm:grid-cols-2 gap-3">
                <div>
                  <label className={labelCls}>Nom *</label>
                  <input
                    type="text"
                    required
                    value={lastName}
                    onChange={(e) => setLastName(e.target.value)}
                    placeholder="Ex: FOGUE"
                    className={inputCls}
                  />
                </div>
                <div>
                  <label className={labelCls}>Prénoms *</label>
                  <input
                    type="text"
                    required
                    value={firstName}
                    onChange={(e) => setFirstName(e.target.value)}
                    placeholder="Ex: Flury"
                    className={inputCls}
                  />
                </div>
              </div>

              <div className="grid sm:grid-cols-2 gap-3">
                <div>
                  <label className={labelCls}>Numéro de téléphone *</label>
                  <input
                    type="tel"
                    required
                    value={phone}
                    onChange={(e) => setPhone(e.target.value)}
                    placeholder="+237 699 00 00 00"
                    className={inputCls}
                  />
                </div>
                <div>
                  <label className={labelCls}>Adresse e-mail *</label>
                  <input
                    type="email"
                    required
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="nom@entreprise.com"
                    className={inputCls}
                  />
                </div>
              </div>

              <div>
                <label className={labelCls}>Adresse complète *</label>
                <input
                  type="text"
                  required
                  value={address}
                  onChange={(e) => setAddress(e.target.value)}
                  placeholder="Quartier, Rue, Ville"
                  className={inputCls}
                />
              </div>

              <div className="grid sm:grid-cols-2 gap-3">
                <div>
                  <label className={labelCls}>Mot de passe (min. 6 car.) *</label>
                  <div className="relative">
                    <input
                      type={showPwd ? 'text' : 'password'}
                      required
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      placeholder="••••••"
                      className={`${inputCls} pr-9`}
                    />
                    <button
                      type="button"
                      onClick={() => setShowPwd((p) => !p)}
                      className="absolute right-2.5 top-2.5 text-slate-400 hover:text-slate-700 dark:hover:text-white"
                      aria-label="Afficher le mot de passe"
                    >
                      {showPwd ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                    </button>
                  </div>
                </div>
                <div>
                  <label className={labelCls}>Confirmer *</label>
                  <input
                    type={showPwd ? 'text' : 'password'}
                    required
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    placeholder="••••••"
                    className={inputCls}
                  />
                </div>
              </div>

              <button
                type="submit"
                disabled={busy}
                className="w-full inline-flex items-center justify-center gap-2.5 px-5 py-3.5 bg-[#FC3F1D] hover:bg-[#E03212] disabled:opacity-60 text-white font-bold text-sm rounded-xl transition-colors cursor-pointer"
              >
                <span>
                  {busy
                    ? 'Création du compte...'
                    : `Créer mon compte (${pendingAccountType === 'entreprise' ? 'Entreprise' : 'Particulier'})`}
                </span>
                <ArrowRight className="w-4 h-4" />
              </button>
              <p className="text-[11px] text-slate-500 dark:text-slate-400 text-center">
                Tous les champs marqués (*) sont obligatoires. Les saisies vides sont refusées.
              </p>
            </form>
          ) : (
            <form onSubmit={handleLoginSubmit} noValidate className="space-y-4 py-1">
              <p className="text-xs text-slate-600 dark:text-slate-300 leading-relaxed">
                Connectez-vous à votre compte FUREX ERP. Le mot de passe propre à votre espace de travail vous sera ensuite demandé avant l’affichage des données et métriques.
              </p>

              <div>
                <label className={labelCls}>Adresse e-mail *</label>
                <input
                  type="email"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="nom@entreprise.com"
                  className={inputCls}
                />
              </div>

              <div>
                <label className={labelCls}>Mot de passe *</label>
                <div className="relative">
                  <input
                    type={showPwd ? 'text' : 'password'}
                    required
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="Votre mot de passe"
                    className={`${inputCls} pr-9`}
                  />
                  <button
                    type="button"
                    onClick={() => setShowPwd((p) => !p)}
                    className="absolute right-2.5 top-2.5 text-slate-400 hover:text-slate-700 dark:hover:text-white"
                    aria-label="Afficher le mot de passe"
                  >
                    {showPwd ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
              </div>

              <button
                type="submit"
                disabled={busy}
                className="w-full inline-flex items-center justify-center gap-2.5 px-5 py-3.5 bg-[#FC3F1D] hover:bg-[#E03212] disabled:opacity-60 text-white font-bold text-sm rounded-xl transition-colors cursor-pointer"
              >
                <span>{busy ? 'Authentification...' : 'Se connecter'}</span>
                <ArrowRight className="w-4 h-4" />
              </button>
            </form>
          )}
        </div>
      </main>

      {/* Clean Footer */}
      <footer className="border-t border-[#E6E8EC] dark:border-[#262933] bg-white dark:bg-[#16181F] px-4 sm:px-8 py-4 text-xs text-slate-500 dark:text-slate-400 flex flex-wrap items-center justify-between gap-4">
        <span className="font-semibold text-[#111216] dark:text-slate-200">
          FUREX ERP · Progiciel de Gestion Intégré
        </span>
        <span>Entreprise & Particulier · Base persistante & Cloudflare Workers</span>
      </footer>
    </div>
  );
};
