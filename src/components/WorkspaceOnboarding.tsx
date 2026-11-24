import React, { useMemo, useState } from 'react';
import {
  Building2,
  User,
  Search,
  Check,
  ArrowRight,
  Layers,
  X,
  CheckSquare,
  Square,
  Lock,
  Eye,
  EyeOff,
  AlertCircle,
  Sparkles,
  ChevronDown,
  ChevronUp,
} from 'lucide-react';
import { useErp } from '../contexts/ErpContext';
import { MODULE_CATALOG, MODULE_FAMILIES, MODULE_PRESETS, ModuleFamily } from '../catalog/moduleCatalog';
import { createCompanyWorkspace } from '../services/erpEngine';
import {
  isNonEmptyText,
  validateWorkspacePasswordPair,
} from '../lib/security';
import { AccountingStandard, AccountType, CurrencyCode } from '../types/erp';
import { inputCls, labelCls } from './ui/DataUI';

interface WorkspaceOnboardingProps {
  onCancel?: () => void;
  onCreated?: (companyId: string) => void;
}

export const WorkspaceOnboarding: React.FC<WorkspaceOnboardingProps> = ({ onCancel, onCreated }) => {
  const {
    user,
    profile,
    pendingAccountType,
    pendingPersonalInfo,
    updateUserAccountType,
    setActiveCompanyId,
    markWorkspaceUnlocked,
    openDemoWorkspace,
    setActiveModule,
    notify,
  } = useErp();

  const initialType: AccountType = profile?.accountType || pendingAccountType || 'entreprise';
  const [accountType, setAccountType] = useState<AccountType>(initialType);

  const [lastName, setLastName] = useState(
    profile?.lastName || pendingPersonalInfo.lastName || ''
  );
  const [firstName, setFirstName] = useState(
    profile?.firstName || pendingPersonalInfo.firstName || user?.displayName?.split(' ')[0] || ''
  );
  const [phone, setPhone] = useState(profile?.phone || pendingPersonalInfo.phone || '');
  const [address, setAddress] = useState(profile?.address || pendingPersonalInfo.address || '');
  const [email, setEmail] = useState(user?.email || '');
  const [editOwnerCoords, setEditOwnerCoords] = useState(false);

  const [name, setName] = useState('');
  const [legalForm, setLegalForm] = useState(initialType === 'entreprise' ? 'SARL' : 'Particulier');
  const [sector, setSector] = useState('');
  const [city, setCity] = useState('');
  const [taxId, setTaxId] = useState('');
  const [rccm, setRccm] = useState('');
  const [currency, setCurrency] = useState<CurrencyCode>('XAF');
  const [accountingStandard, setAccountingStandard] = useState<AccountingStandard>('OHADA');

  const [useSeparatePin, setUseSeparatePin] = useState(false);
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);

  const defaultSelected = useMemo(() => {
    const preset = MODULE_PRESETS.find((p) => p.accountType === initialType);
    return preset ? preset.moduleIds : MODULE_CATALOG.map((m) => m.id);
  }, [initialType]);

  const [selectedModules, setSelectedModules] = useState<string[]>(defaultSelected);
  const [familyFilter, setFamilyFilter] = useState<'ALL' | ModuleFamily>('ALL');
  const [search, setSearch] = useState('');
  const [busy, setBusy] = useState(false);
  const [demoBusy, setDemoBusy] = useState(false);

  const handleAccountTypeChange = (nextType: AccountType) => {
    setAccountType(nextType);
    setLegalForm(nextType === 'entreprise' ? 'SARL' : 'Particulier');
    const preset = MODULE_PRESETS.find((p) => p.accountType === nextType);
    if (preset) {
      setSelectedModules(preset.moduleIds);
    }
  };

  const toggleModule = (id: string) => {
    setSelectedModules((prev) => {
      if (prev.includes(id)) {
        if (prev.length <= 1) return prev;
        return prev.filter((item) => item !== id);
      }
      return [...prev, id];
    });
  };

  const filteredCatalog = useMemo(() => {
    const q = search.trim().toLowerCase();
    return MODULE_CATALOG.filter((mod) => {
      const matchFamily = familyFilter === 'ALL' || mod.family === familyFilter;
      const matchSearch =
        !q ||
        mod.name.toLowerCase().includes(q) ||
        mod.shortDesc.toLowerCase().includes(q) ||
        mod.family.toLowerCase().includes(q);
      return matchFamily && matchSearch;
    });
  }, [familyFilter, search]);

  const handleOpenDemo = async () => {
    if (!user) return;
    setDemoBusy(true);
    setFormError(null);
    try {
      await openDemoWorkspace(false);
      notify('Espace Démo JESSI ouvert avec les 66+ modules pré-remplis.', 'success');
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Erreur lors de l’ouverture de l’espace démo.';
      setFormError(msg);
      notify(msg, 'error');
    } finally {
      setDemoBusy(false);
    }
  };

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) return;
    setFormError(null);

    if (!isNonEmptyText(name, 2)) {
      const errMsg =
        accountType === 'entreprise'
          ? 'La raison sociale de l’entreprise est obligatoire (min. 2 caractères).'
          : 'Le nom de votre espace personnel est obligatoire (min. 2 caractères).';
      setFormError(errMsg);
      notify(errMsg, 'warning');
      return;
    }

    if (useSeparatePin) {
      const passErr = validateWorkspacePasswordPair(password, confirmPassword);
      if (passErr) {
        setFormError(passErr);
        notify(passErr, 'warning');
        return;
      }
    }

    if (selectedModules.length === 0) {
      const errMsg = 'Sélectionnez au moins un module pour créer votre espace.';
      setFormError(errMsg);
      notify(errMsg, 'warning');
      return;
    }

    setBusy(true);
    try {
      await updateUserAccountType(accountType);
      const companyId = await createCompanyWorkspace({
        uid: user.uid,
        email: (email || user.email).trim(),
        displayName: `${firstName.trim()} ${lastName.trim()}`.trim() || user.displayName,
        ownerFirstName: firstName.trim(),
        ownerLastName: lastName.trim(),
        phone: phone.trim(),
        address: address.trim(),
        city: city.trim(),
        sector: sector.trim(),
        legalForm: legalForm.trim(),
        taxId: taxId.trim(),
        rccm: rccm.trim(),
        name: name.trim(),
        accountType,
        currency,
        accountingStandard,
        password: useSeparatePin ? password : '',
        enabledModules: selectedModules,
        withDemoData: false,
      });
      markWorkspaceUnlocked(companyId);
      setActiveCompanyId(companyId);
      setActiveModule('launcher');
      notify(
        `Espace vierge « ${name.trim()} » créé avec ${selectedModules.length} modules actifs.`,
        'success'
      );
      if (onCreated) onCreated(companyId);
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Erreur lors de la création de l’espace.';
      setFormError(msg);
      notify(msg, 'error');
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#F5F6F8] dark:bg-[#0D0E12] text-[#111216] dark:text-slate-100 py-8 px-4 sm:px-8">
      <div className="max-w-6xl mx-auto space-y-6">
        {/* Top Studio Bar */}
        <div className="flex flex-wrap items-center justify-between gap-4 bg-white dark:bg-[#16181F] border border-[#E6E8EC] dark:border-[#262933] rounded-2xl px-6 py-4">
          <div className="flex items-center gap-3">
            <img
              src="/assets/aistudio/image_2c55d81b.png"
              alt="JESSI"
              className="w-10 h-10 rounded-xl object-cover border border-[#E6E8EC] dark:border-[#262933]"
            />
            <div>
              <h1 className="font-display text-lg sm:text-xl font-extrabold text-[#111216] dark:text-white">
                Nouvel Espace de Travail · JESSI
              </h1>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                Nommez votre espace vierge et choisissez vos modules parmi les 66+ disponibles.
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2.5 flex-wrap">
            <button
              type="button"
              disabled={demoBusy}
              onClick={handleOpenDemo}
              className="inline-flex items-center gap-1.5 px-3.5 py-2 text-xs font-bold rounded-xl bg-[#111216] dark:bg-white text-white dark:text-[#111216] hover:opacity-90 disabled:opacity-60 transition-opacity cursor-pointer"
            >
              <Sparkles className="w-3.5 h-3.5 text-[#FC3F1D]" />
              <span>{demoBusy ? 'Chargement démo...' : 'Explorer l’Espace Démo (66 modules)'}</span>
            </button>
            {onCancel && (
              <button
                type="button"
                onClick={onCancel}
                className="inline-flex items-center gap-1.5 px-3.5 py-2 text-xs font-semibold rounded-xl border border-[#E6E8EC] dark:border-[#262933] text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-white/5 cursor-pointer"
              >
                <X className="w-4 h-4" /> Annuler
              </button>
            )}
          </div>
        </div>

        <form onSubmit={handleCreate} noValidate className="grid lg:grid-cols-12 gap-6 items-start">
          {/* Left Column: Streamlined Business Setup */}
          <div className="lg:col-span-5 space-y-4 bg-white dark:bg-[#16181F] border border-[#E6E8EC] dark:border-[#262933] rounded-2xl p-6">
            <div>
              <p className="text-[11px] font-bold uppercase tracking-wider text-[#FC3F1D]">
                Étape 1 · Configuration de votre espace
              </p>
              <h2 className="font-display text-base font-bold text-[#111216] dark:text-white mt-1">
                Entreprise ou Particulier
              </h2>
            </div>

            {formError && (
              <div className="flex items-start gap-2.5 p-3 rounded-xl bg-red-50 dark:bg-red-950/50 border border-red-200 dark:border-red-800 text-xs text-red-700 dark:text-red-300 font-medium">
                <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
                <span>{formError}</span>
              </div>
            )}

            {/* Entreprise vs Particulier */}
            <div className="grid grid-cols-2 gap-2.5">
              <button
                type="button"
                onClick={() => handleAccountTypeChange('entreprise')}
                className={`p-3 rounded-xl border text-left transition-all cursor-pointer ${
                  accountType === 'entreprise'
                    ? 'border-[#FC3F1D] bg-[#FC3F1D]/5 ring-1 ring-[#FC3F1D]'
                    : 'border-[#E6E8EC] dark:border-[#262933] hover:border-slate-300'
                }`}
              >
                <Building2
                  className={`w-4 h-4 mb-1.5 ${
                    accountType === 'entreprise' ? 'text-[#FC3F1D]' : 'text-slate-500'
                  }`}
                />
                <p className="text-xs font-bold text-[#111216] dark:text-white">Entreprise</p>
                <p className="text-[11px] text-slate-500 dark:text-slate-400">Société, PME, Commerce</p>
              </button>

              <button
                type="button"
                onClick={() => handleAccountTypeChange('particulier')}
                className={`p-3 rounded-xl border text-left transition-all cursor-pointer ${
                  accountType === 'particulier'
                    ? 'border-[#FC3F1D] bg-[#FC3F1D]/5 ring-1 ring-[#FC3F1D]'
                    : 'border-[#E6E8EC] dark:border-[#262933] hover:border-slate-300'
                }`}
              >
                <User
                  className={`w-4 h-4 mb-1.5 ${
                    accountType === 'particulier' ? 'text-[#FC3F1D]' : 'text-slate-500'
                  }`}
                />
                <p className="text-xs font-bold text-[#111216] dark:text-white">Particulier</p>
                <p className="text-[11px] text-slate-500 dark:text-slate-400">Indépendant, Activité perso</p>
              </button>
            </div>

            {/* Verified owner summary without re-typing */}
            <div className="rounded-xl bg-[#F5F6F8] dark:bg-[#0D0E12] border border-[#E6E8EC] dark:border-[#262933] p-3 space-y-2">
              <div className="flex items-center justify-between gap-2">
                <div className="min-w-0">
                  <p className="text-[11px] font-bold text-[#111216] dark:text-white truncate">
                    Titulaire : {`${firstName} ${lastName}`.trim() || user?.displayName}
                  </p>
                  <p className="text-[11px] text-slate-500 dark:text-slate-400 truncate">
                    {email || user?.email}
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => setEditOwnerCoords((p) => !p)}
                  className="inline-flex items-center gap-1 text-[11px] font-semibold text-[#FC3F1D] hover:underline shrink-0 cursor-pointer"
                >
                  {editOwnerCoords ? (
                    <>
                      Masquer <ChevronUp className="w-3 h-3" />
                    </>
                  ) : (
                    <>
                      Modifier <ChevronDown className="w-3 h-3" />
                    </>
                  )}
                </button>
              </div>

              {editOwnerCoords && (
                <div className="pt-2 border-t border-[#E6E8EC] dark:border-[#262933] space-y-2.5">
                  <div className="grid grid-cols-2 gap-2.5">
                    <div>
                      <label className={labelCls}>Nom</label>
                      <input
                        type="text"
                        value={lastName}
                        onChange={(e) => setLastName(e.target.value)}
                        className={inputCls}
                      />
                    </div>
                    <div>
                      <label className={labelCls}>Prénoms</label>
                      <input
                        type="text"
                        value={firstName}
                        onChange={(e) => setFirstName(e.target.value)}
                        className={inputCls}
                      />
                    </div>
                  </div>
                  <div className="grid grid-cols-2 gap-2.5">
                    <div>
                      <label className={labelCls}>Téléphone</label>
                      <input
                        type="tel"
                        value={phone}
                        onChange={(e) => setPhone(e.target.value)}
                        className={inputCls}
                      />
                    </div>
                    <div>
                      <label className={labelCls}>E-mail pro</label>
                      <input
                        type="email"
                        value={email}
                        onChange={(e) => setEmail(e.target.value)}
                        className={inputCls}
                      />
                    </div>
                  </div>
                  <div>
                    <label className={labelCls}>Adresse</label>
                    <input
                      type="text"
                      value={address}
                      onChange={(e) => setAddress(e.target.value)}
                      className={inputCls}
                    />
                  </div>
                </div>
              )}
            </div>

            {/* Workspace / Activity Details */}
            <div className="space-y-3">
              <div>
                <label className={labelCls}>
                  {accountType === 'entreprise'
                    ? 'Raison sociale / Nom de l’entreprise *'
                    : 'Nom de votre espace / activité *'}
                </label>
                <input
                  type="text"
                  required
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder={
                    accountType === 'entreprise'
                      ? 'Ex: JESSI Distribution SARL'
                      : 'Ex: Cabinet Conseil Flury'
                  }
                  className={inputCls}
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className={labelCls}>
                    {accountType === 'entreprise' ? 'Secteur (optionnel)' : 'Activité (optionnel)'}
                  </label>
                  <input
                    type="text"
                    value={sector}
                    onChange={(e) => setSector(e.target.value)}
                    placeholder={
                      accountType === 'entreprise'
                        ? 'Commerce, BTP...'
                        : 'Consultant, Commerce...'
                    }
                    className={inputCls}
                  />
                </div>
                <div>
                  <label className={labelCls}>Ville / Pays (optionnel)</label>
                  <input
                    type="text"
                    value={city}
                    onChange={(e) => setCity(e.target.value)}
                    placeholder="Ex: Douala, Cameroun"
                    className={inputCls}
                  />
                </div>
              </div>

              {accountType === 'entreprise' && (
                <div className="grid grid-cols-3 gap-2.5">
                  <div>
                    <label className={labelCls}>Forme</label>
                    <select
                      value={legalForm}
                      onChange={(e) => setLegalForm(e.target.value)}
                      className={inputCls}
                    >
                      <option value="SARL">SARL</option>
                      <option value="SAS">SAS</option>
                      <option value="SA">SA</option>
                      <option value="Entreprise Individuelle">Individuelle</option>
                      <option value="Association / ONG">Association</option>
                    </select>
                  </div>
                  <div>
                    <label className={labelCls}>NIF / NUI</label>
                    <input
                      type="text"
                      value={taxId}
                      onChange={(e) => setTaxId(e.target.value)}
                      placeholder="Optionnel"
                      className={inputCls}
                    />
                  </div>
                  <div>
                    <label className={labelCls}>RCCM</label>
                    <input
                      type="text"
                      value={rccm}
                      onChange={(e) => setRccm(e.target.value)}
                      placeholder="Optionnel"
                      className={inputCls}
                    />
                  </div>
                </div>
              )}

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className={labelCls}>Devise principale</label>
                  <select
                    value={currency}
                    onChange={(e) => setCurrency(e.target.value as CurrencyCode)}
                    className={inputCls}
                  >
                    <option value="XAF">XAF (FCFA BEAC)</option>
                    <option value="XOF">XOF (FCFA BCEAO)</option>
                    <option value="EUR">EUR (€)</option>
                    <option value="USD">USD ($)</option>
                  </select>
                </div>
                <div>
                  <label className={labelCls}>Plan comptable</label>
                  <select
                    value={accountingStandard}
                    onChange={(e) => setAccountingStandard(e.target.value as AccountingStandard)}
                    className={inputCls}
                  >
                    <option value="OHADA">Plan OHADA</option>
                    <option value="GENERAL">Plan Général</option>
                  </select>
                </div>
              </div>
            </div>

            {/* Optional separate PIN toggle */}
            <div className="pt-2 border-t border-[#E6E8EC] dark:border-[#262933] space-y-2.5">
              <label className="flex items-center gap-2 text-xs font-semibold text-slate-700 dark:text-slate-300 cursor-pointer select-none">
                <input
                  type="checkbox"
                  checked={useSeparatePin}
                  onChange={(e) => setUseSeparatePin(e.target.checked)}
                  className="rounded border-slate-300 text-[#FC3F1D] focus:ring-[#FC3F1D]"
                />
                <Lock className="w-3.5 h-3.5 text-[#FC3F1D]" />
                <span>Ajouter un code de verrouillage séparé (optionnel)</span>
              </label>

              {useSeparatePin && (
                <div className="grid grid-cols-2 gap-3 pt-1">
                  <div>
                    <label className={labelCls}>Code d’espace *</label>
                    <div className="relative">
                      <input
                        type={showPassword ? 'text' : 'password'}
                        value={password}
                        onChange={(e) => setPassword(e.target.value)}
                        placeholder="Min. 4 caractères"
                        className={`${inputCls} pr-9`}
                      />
                      <button
                        type="button"
                        onClick={() => setShowPassword((p) => !p)}
                        className="absolute right-2.5 top-2.5 text-slate-400 hover:text-slate-700 dark:hover:text-white"
                        aria-label="Afficher le code"
                      >
                        {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                      </button>
                    </div>
                  </div>
                  <div>
                    <label className={labelCls}>Confirmation *</label>
                    <input
                      type={showPassword ? 'text' : 'password'}
                      value={confirmPassword}
                      onChange={(e) => setConfirmPassword(e.target.value)}
                      placeholder="Répétez"
                      className={inputCls}
                    />
                  </div>
                </div>
              )}
            </div>

            {/* Virgin workspace guarantee */}
            <div className="p-3.5 rounded-xl bg-[#F5F6F8] dark:bg-[#0D0E12] border border-[#E6E8EC] dark:border-[#262933]">
              <p className="text-xs font-bold text-[#111216] dark:text-white">
                Démarrage vierge à 0 (données 100 % réelles)
              </p>
              <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5 leading-relaxed">
                Votre espace personnel ou entreprise démarre entièrement vierge : aucun client, produit ou facture factice. Pour tester les 66+ modules déjà remplis, cliquez sur « Explorer l’Espace Démo ».
              </p>
            </div>

            <button
              type="submit"
              disabled={busy}
              className="w-full flex items-center justify-center gap-2 px-5 py-3.5 bg-[#FC3F1D] hover:bg-[#E03212] disabled:opacity-60 text-white text-sm font-bold rounded-xl transition-colors cursor-pointer"
            >
              <span>
                {busy
                  ? 'Création de l’espace vierge...'
                  : `Créer mon espace vierge (${selectedModules.length} modules)`}
              </span>
              <ArrowRight className="w-4 h-4" />
            </button>
          </div>

          {/* Right Column: 66+ Modular Catalog Selector */}
          <div className="lg:col-span-7 bg-white dark:bg-[#16181F] border border-[#E6E8EC] dark:border-[#262933] rounded-2xl p-6 space-y-5">
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
              <div>
                <p className="text-[11px] font-bold uppercase tracking-wider text-[#FC3F1D]">
                  Étape 2 · Catalogue Modulaire ({MODULE_CATALOG.length} Applications)
                </p>
                <h2 className="font-display text-base font-bold text-[#111216] dark:text-white mt-0.5">
                  Choisissez vos modules parmi tous ceux disponibles
                </h2>
              </div>

              <div className="flex items-center gap-2 shrink-0">
                <button
                  type="button"
                  onClick={() => setSelectedModules(MODULE_CATALOG.map((m) => m.id))}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded-lg border border-[#E6E8EC] dark:border-[#262933] hover:border-[#FC3F1D] transition-colors cursor-pointer"
                >
                  <CheckSquare className="w-3.5 h-3.5 text-[#FC3F1D]" />
                  Tout activer ({MODULE_CATALOG.length})
                </button>
                <button
                  type="button"
                  onClick={() =>
                    setSelectedModules([
                      'mod_dashboard',
                      'mod_customers',
                      'mod_quotes',
                      'mod_invoices',
                      'mod_products',
                      'mod_treasury',
                      'mod_admin_rbac',
                    ])
                  }
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded-lg border border-[#E6E8EC] dark:border-[#262933] hover:border-slate-400 transition-colors cursor-pointer"
                >
                  <Square className="w-3.5 h-3.5" />
                  Essentiel (7)
                </button>
              </div>
            </div>

            {/* Quick Presets */}
            <div className="grid sm:grid-cols-3 gap-2.5">
              {MODULE_PRESETS.map((preset) => (
                <button
                  key={preset.id}
                  type="button"
                  onClick={() => setSelectedModules(preset.moduleIds)}
                  className="text-left p-3 rounded-xl border border-[#E6E8EC] dark:border-[#262933] hover:border-[#FC3F1D] transition-colors cursor-pointer"
                >
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-xs font-bold text-[#111216] dark:text-white truncate">
                      {preset.label}
                    </span>
                    <span className="font-mono text-[11px] font-semibold text-[#FC3F1D] shrink-0">
                      {preset.moduleIds.length}
                    </span>
                  </div>
                  <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-1 line-clamp-2">
                    {preset.description}
                  </p>
                </button>
              ))}
            </div>

            {/* Search & Family Filter */}
            <div className="space-y-3">
              <div className="relative">
                <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-3" />
                <input
                  type="text"
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  placeholder="Rechercher parmi les 66 modules (Caisse POS, Stocks, Clients, Paie, Flotte, OHADA...)"
                  className="w-full pl-10 pr-4 py-2.5 text-sm bg-[#F5F6F8] dark:bg-[#0D0E12] border border-[#E6E8EC] dark:border-[#262933] rounded-xl focus:outline-none focus:ring-2 focus:ring-[#FC3F1D]"
                />
              </div>

              <div className="flex flex-wrap items-center gap-1.5">
                <button
                  type="button"
                  onClick={() => setFamilyFilter('ALL')}
                  className={`px-3 py-1.5 text-xs font-semibold rounded-lg transition-colors whitespace-nowrap cursor-pointer ${
                    familyFilter === 'ALL'
                      ? 'bg-[#111216] dark:bg-white text-white dark:text-[#111216]'
                      : 'bg-[#F5F6F8] dark:bg-[#0D0E12] text-slate-600 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-white/10'
                  }`}
                >
                  Tous ({MODULE_CATALOG.length})
                </button>
                {MODULE_FAMILIES.map((fam) => {
                  const count = MODULE_CATALOG.filter((m) => m.family === fam).length;
                  const active = familyFilter === fam;
                  return (
                    <button
                      key={fam}
                      type="button"
                      onClick={() => setFamilyFilter(fam)}
                      className={`px-3 py-1.5 text-xs font-semibold rounded-lg transition-colors whitespace-nowrap cursor-pointer ${
                        active
                          ? 'bg-[#111216] dark:bg-white text-white dark:text-[#111216]'
                          : 'bg-[#F5F6F8] dark:bg-[#0D0E12] text-slate-600 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-white/10'
                      }`}
                    >
                      {fam} ({count})
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Module Selection Grid */}
            <div className="grid sm:grid-cols-2 xl:grid-cols-3 gap-3 max-h-[560px] overflow-y-auto pr-1">
              {filteredCatalog.map((mod) => {
                const isSelected = selectedModules.includes(mod.id);
                return (
                  <button
                    key={mod.id}
                    type="button"
                    onClick={() => toggleModule(mod.id)}
                    className={`text-left p-3.5 rounded-2xl border transition-all flex flex-col justify-between gap-2.5 cursor-pointer ${
                      isSelected
                        ? 'border-[#FC3F1D] bg-[#FC3F1D]/[0.04] dark:bg-[#FC3F1D]/[0.08]'
                        : 'border-[#E6E8EC] dark:border-[#262933] bg-[#F5F6F8]/50 dark:bg-[#0D0E12]/60 opacity-80 hover:opacity-100'
                    }`}
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div className="flex items-center gap-2.5 min-w-0">
                        <div
                          className="w-8 h-8 rounded-xl text-white flex items-center justify-center font-display font-bold text-xs shrink-0"
                          style={{ backgroundColor: mod.color }}
                        >
                          {mod.name.slice(0, 2).toUpperCase()}
                        </div>
                        <div className="min-w-0">
                          <p className="text-xs font-bold text-[#111216] dark:text-white truncate">
                            {mod.name}
                          </p>
                          <p className="text-[10px] text-slate-500 dark:text-slate-400 truncate">
                            {mod.family}
                          </p>
                        </div>
                      </div>
                      <span
                        className={`w-5 h-5 rounded-md flex items-center justify-center shrink-0 border ${
                          isSelected
                            ? 'bg-[#FC3F1D] border-[#FC3F1D] text-white'
                            : 'border-slate-300 dark:border-slate-600 bg-white dark:bg-[#16181F]'
                        }`}
                      >
                        {isSelected && <Check className="w-3.5 h-3.5" />}
                      </span>
                    </div>
                    <p className="text-[11px] text-slate-600 dark:text-slate-400 leading-snug line-clamp-2">
                      {mod.shortDesc}
                    </p>
                  </button>
                );
              })}
            </div>

            <div className="pt-2 border-t border-[#E6E8EC] dark:border-[#262933] flex flex-wrap items-center justify-between gap-3 text-xs text-slate-500 dark:text-slate-400">
              <span className="inline-flex items-center gap-1.5">
                <Layers className="w-3.5 h-3.5 text-[#FC3F1D]" />
                Vous pourrez ajouter d’autres modules ou créer vos propres modules après ouverture.
              </span>
              <span className="font-mono font-bold text-[#111216] dark:text-white tabular-nums">
                {selectedModules.length} / {MODULE_CATALOG.length} actifs
              </span>
            </div>
          </div>
        </form>
      </div>
    </div>
  );
};
