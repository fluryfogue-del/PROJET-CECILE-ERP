import React, { useMemo, useState } from 'react';
import { Plus, ArrowRightLeft, MessageSquarePlus, Trash2, Edit3, Search, Upload, Download, FileSpreadsheet } from 'lucide-react';
import { useErp } from '../../contexts/ErpContext';
import { formatDateFr, formatMoney, todayIso } from '../../lib/format';
import { exportRowsCsv, exportWorkbookExcel } from '../../lib/exports';
import {
  convertLeadToCustomer,
  createErpDoc,
  deleteErpDoc,
  logAudit,
  updateErpDoc,
} from '../../services/erpEngine';
import { Customer, Lead, Opportunity } from '../../types/erp';
import { ImportSpreadsheetModal } from '../ImportSpreadsheetModal';
import {
  EmptyState,
  Modal,
  PageHeader,
  SegmentedTabs,
  StatusLabel,
  btnPrimaryCls,
  btnSecondaryCls,
  inputCls,
  labelCls,
} from '../ui/DataUI';

export const CrmView: React.FC = () => {
  const {
    user,
    activeCompany,
    leads,
    customers,
    opportunities,
    interactions,
    notify,
  } = useErp();

  const [tab, setTab] = useState<'leads' | 'customers' | 'opportunities' | 'interactions'>('leads');
  const [search, setSearch] = useState('');

  // Lead Modal
  const [leadModal, setLeadModal] = useState(false);
  const [editingLead, setEditingLead] = useState<Lead | null>(null);
  const [leadForm, setLeadForm] = useState({
    name: '',
    companyName: '',
    email: '',
    phone: '',
    source: 'Site Web',
    status: 'nouveau' as Lead['status'],
    estimatedValue: 0,
    notes: '',
  });

  // Customer Modal
  const [custModal, setCustModal] = useState(false);
  const [editingCust, setEditingCust] = useState<Customer | null>(null);
  const [custForm, setCustForm] = useState({
    code: '',
    name: '',
    segment: 'B2B' as Customer['segment'],
    email: '',
    phone: '',
    address: '',
    taxId: '',
    creditLimit: 0,
    notes: '',
  });
  const [importOpen, setImportOpen] = useState(false);

  // Opportunity Modal
  const [oppModal, setOppModal] = useState(false);
  const [editingOpp, setEditingOpp] = useState<Opportunity | null>(null);
  const [oppForm, setOppForm] = useState({
    title: '',
    customerId: '',
    stage: 'prospection' as Opportunity['stage'],
    amount: 0,
    probability: 40,
    expectedCloseDate: todayIso(),
  });

  // Interaction Modal
  const [intModal, setIntModal] = useState(false);
  const [intForm, setIntForm] = useState({
    entityType: 'customer' as 'lead' | 'customer' | 'opportunity',
    entityId: '',
    entityName: '',
    channel: 'appel' as 'appel' | 'email' | 'reunion' | 'note',
    summary: '',
    date: todayIso(),
  });

  const currency = activeCompany?.currency || 'XAF';

  const stats = useMemo(() => {
    const pipelineValue = opportunities
      .filter((o) => o.stage !== 'perdue')
      .reduce((s, o) => s + o.amount, 0);
    const wonValue = opportunities
      .filter((o) => o.stage === 'gagnee')
      .reduce((s, o) => s + o.amount, 0);
    const conversionRate =
      leads.length > 0
        ? Math.round((leads.filter((l) => l.status === 'converti').length / leads.length) * 100)
        : 0;
    return { pipelineValue, wonValue, conversionRate };
  }, [opportunities, leads]);

  if (!activeCompany || !user) return null;

  const ownerId = activeCompany.ownerId;
  const memberUids = activeCompany.memberUids;

  const openLeadForm = (lead?: Lead) => {
    if (lead) {
      setEditingLead(lead);
      setLeadForm({
        name: lead.name,
        companyName: lead.companyName || '',
        email: lead.email || '',
        phone: lead.phone || '',
        source: lead.source || 'Site Web',
        status: lead.status,
        estimatedValue: lead.estimatedValue,
        notes: lead.notes || '',
      });
    } else {
      setEditingLead(null);
      setLeadForm({
        name: '',
        companyName: '',
        email: '',
        phone: '',
        source: 'Site Web',
        status: 'nouveau',
        estimatedValue: 0,
        notes: '',
      });
    }
    setLeadModal(true);
  };

  const saveLead = async (e: React.FormEvent) => {
    e.preventDefault();
    const cleanName = leadForm.name.trim();
    if (cleanName.length < 2) {
      notify('Le nom du prospect est obligatoire (minimum 2 caractères).', 'error');
      return;
    }
    const payload = {
      ...leadForm,
      name: cleanName,
      companyName: leadForm.companyName.trim(),
      email: leadForm.email.trim(),
      phone: leadForm.phone.trim(),
      source: leadForm.source.trim(),
      notes: leadForm.notes.trim(),
      estimatedValue: Number(leadForm.estimatedValue) || 0,
    };
    try {
      if (editingLead) {
        await updateErpDoc(activeCompany.id, 'leads', editingLead.id, payload);
        notify('Prospect mis à jour.', 'success');
      } else {
        await createErpDoc(
          activeCompany.id,
          'leads',
          {
            ...payload,
            isDemo: false,
          },
          ownerId,
          memberUids
        );
        notify('Prospect enregistré.', 'success');
      }
      setLeadModal(false);
    } catch (err) {
      notify(err instanceof Error ? err.message : 'Erreur lors de la sauvegarde', 'error');
    }
  };

  const handleConvertLead = async (lead: Lead) => {
    try {
      await convertLeadToCustomer({
        companyId: activeCompany.id,
        lead,
        uid: user.uid,
        email: user.email || '',
        ownerId,
        memberUids,
      });
      notify(`${lead.name} converti en client.`, 'success');
      setTab('customers');
    } catch (err) {
      notify(err instanceof Error ? err.message : 'Erreur de conversion', 'error');
    }
  };

  const openCustForm = (c?: Customer) => {
    if (c) {
      setEditingCust(c);
      setCustForm({
        code: c.code,
        name: c.name,
        segment: c.segment,
        email: c.email || '',
        phone: c.phone || '',
        address: c.address || '',
        taxId: c.taxId || '',
        creditLimit: c.creditLimit || 0,
        notes: c.notes || '',
      });
    } else {
      setEditingCust(null);
      setCustForm({
        code: `CLI-${String(customers.length + 1).padStart(3, '0')}`,
        name: '',
        segment: 'B2B',
        email: '',
        phone: '',
        address: '',
        taxId: '',
        creditLimit: 0,
        notes: '',
      });
    }
    setCustModal(true);
  };

  const saveCustomer = async (e: React.FormEvent) => {
    e.preventDefault();
    const cleanCode = custForm.code.trim();
    const cleanName = custForm.name.trim();
    if (!cleanCode || cleanName.length < 2) {
      notify('Le code client et le nom ou raison sociale sont obligatoires.', 'error');
      return;
    }
    const payload = {
      ...custForm,
      code: cleanCode,
      name: cleanName,
      email: custForm.email.trim(),
      phone: custForm.phone.trim(),
      address: custForm.address.trim(),
      taxId: custForm.taxId.trim(),
      notes: custForm.notes.trim(),
      creditLimit: Number(custForm.creditLimit) || 0,
    };
    try {
      if (editingCust) {
        await updateErpDoc(activeCompany.id, 'customers', editingCust.id, payload);
        notify('Fiche client mise à jour.', 'success');
      } else {
        await createErpDoc(
          activeCompany.id,
          'customers',
          {
            ...payload,
            balanceDue: 0,
            isDemo: false,
          },
          ownerId,
          memberUids
        );
        await logAudit({
          companyId: activeCompany.id,
          uid: user.uid,
          email: user.email || '',
          ownerId,
          memberUids,
          action: 'CREATE',
          module: 'crm',
          entityType: 'customer',
          summary: `Création client ${cleanName}`,
        });
        notify('Client créé.', 'success');
        setTab('customers');
      }
      setCustModal(false);
    } catch (err) {
      notify(err instanceof Error ? err.message : 'Erreur client', 'error');
    }
  };

  const openOppForm = (o?: Opportunity) => {
    if (o) {
      setEditingOpp(o);
      setOppForm({
        title: o.title,
        customerId: o.customerId || '',
        stage: o.stage,
        amount: o.amount,
        probability: o.probability,
        expectedCloseDate: o.expectedCloseDate || todayIso(),
      });
    } else {
      setEditingOpp(null);
      setOppForm({
        title: '',
        customerId: customers[0]?.id || '',
        stage: 'prospection',
        amount: 0,
        probability: 40,
        expectedCloseDate: todayIso(),
      });
    }
    setOppModal(true);
  };

  const saveOpp = async (e: React.FormEvent) => {
    e.preventDefault();
    const cust = customers.find((c) => c.id === oppForm.customerId);
    try {
      if (editingOpp) {
        await updateErpDoc(activeCompany.id, 'opportunities', editingOpp.id, {
          title: oppForm.title,
          customerId: oppForm.customerId,
          customerName: cust?.name || '',
          stage: oppForm.stage,
          amount: Number(oppForm.amount) || 0,
          probability: Number(oppForm.probability) || 0,
          expectedCloseDate: oppForm.expectedCloseDate,
        });
        notify('Opportunité mise à jour.', 'success');
      } else {
        await createErpDoc(
          activeCompany.id,
          'opportunities',
          {
            title: oppForm.title,
            customerId: oppForm.customerId,
            customerName: cust?.name || '',
            stage: oppForm.stage,
            amount: Number(oppForm.amount) || 0,
            probability: Number(oppForm.probability) || 0,
            expectedCloseDate: oppForm.expectedCloseDate,
            isDemo: false,
          },
          ownerId,
          memberUids
        );
        notify('Opportunité ajoutée.', 'success');
      }
      setOppModal(false);
    } catch (err) {
      notify(err instanceof Error ? err.message : 'Erreur opportunité', 'error');
    }
  };

  const openInteractionModal = (entityType: 'lead' | 'customer', entityId: string, entityName: string) => {
    setIntForm({
      entityType,
      entityId,
      entityName,
      channel: 'appel',
      summary: '',
      date: todayIso(),
    });
    setIntModal(true);
  };

  const saveInteraction = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await createErpDoc(
        activeCompany.id,
        'interactions',
        {
          ...intForm,
          authorEmail: user.email || '',
          isDemo: false,
        },
        ownerId,
        memberUids,
        false
      );
      notify('Interaction enregistrée dans l’historique.', 'success');
      setIntModal(false);
    } catch (err) {
      notify(err instanceof Error ? err.message : 'Erreur interaction', 'error');
    }
  };

  const q = search.trim().toLowerCase();
  const filteredLeads = leads.filter(
    (l) => l.name.toLowerCase().includes(q) || (l.companyName || '').toLowerCase().includes(q)
  );
  const filteredCustomers = customers.filter(
    (c) => c.name.toLowerCase().includes(q) || c.code.toLowerCase().includes(q)
  );
  const filteredOpps = opportunities.filter(
    (o) => o.title.toLowerCase().includes(q) || (o.customerName || '').toLowerCase().includes(q)
  );

  const exportCrmCsv = () => {
    if (tab === 'customers') {
      exportRowsCsv(
        customers.map((c) => ({
          Code: c.code,
          Nom: c.name,
          Segment: c.segment,
          Email: c.email || '',
          Telephone: c.phone || '',
          Adresse: c.address || '',
          NIF: c.taxId || '',
          PlafondCredit: c.creditLimit || 0,
          SoldeDu: c.balanceDue || 0,
          Notes: c.notes || '',
        })),
        `Clients_CRM_${todayIso()}`
      );
    } else if (tab === 'opportunities') {
      exportRowsCsv(
        opportunities.map((o) => ({
          Affaire: o.title,
          Client: o.customerName || '',
          Etape: o.stage,
          Montant: o.amount,
          Probabilite: o.probability,
          CloturePrevue: o.expectedCloseDate,
        })),
        `Opportunites_CRM_${todayIso()}`
      );
    } else if (tab === 'interactions') {
      exportRowsCsv(
        interactions.map((i) => ({
          Date: i.date,
          Canal: i.channel,
          Entite: i.entityName || i.entityId,
          Resume: i.summary,
          Auteur: i.authorEmail || '',
        })),
        `Interactions_CRM_${todayIso()}`
      );
    } else {
      exportRowsCsv(
        leads.map((l) => ({
          Nom: l.name,
          Entreprise: l.companyName || '',
          Email: l.email || '',
          Telephone: l.phone || '',
          Source: l.source || '',
          Statut: l.status,
          ValeurEstimee: l.estimatedValue,
          Notes: l.notes || '',
        })),
        `Prospects_CRM_${todayIso()}`
      );
    }
    notify('Export CSV téléchargé.', 'success');
  };

  const exportCrmExcel = () => {
    exportWorkbookExcel(
      [
        {
          name: 'Clients',
          rows: customers.map((c) => ({
            Code: c.code,
            Nom: c.name,
            Segment: c.segment,
            Email: c.email || '',
            Telephone: c.phone || '',
            Adresse: c.address || '',
            NIF: c.taxId || '',
            PlafondCredit: c.creditLimit || 0,
            SoldeDu: c.balanceDue || 0,
          })),
        },
        {
          name: 'Prospects',
          rows: leads.map((l) => ({
            Nom: l.name,
            Entreprise: l.companyName || '',
            Email: l.email || '',
            Telephone: l.phone || '',
            Source: l.source || '',
            Statut: l.status,
            ValeurEstimee: l.estimatedValue,
          })),
        },
        {
          name: 'Opportunites',
          rows: opportunities.map((o) => ({
            Affaire: o.title,
            Client: o.customerName || '',
            Etape: o.stage,
            Montant: o.amount,
            Probabilite: o.probability,
            CloturePrevue: o.expectedCloseDate,
          })),
        },
      ],
      `CRM_FUREX_${todayIso()}`
    );
    notify('Classeur Excel CRM téléchargé.', 'success');
  };

  return (
    <div className="space-y-6">
      <PageHeader
        title="CRM & Développement Commercial"
        subtitle="Prospects, conversion en clients, pipeline d’opportunités et historique des interactions"
        actions={
          <>
            <button type="button" onClick={() => setImportOpen(true)} className={btnSecondaryCls}>
              <Upload className="w-3.5 h-3.5" /> Importer CSV/Excel
            </button>
            <button type="button" onClick={exportCrmCsv} className={btnSecondaryCls}>
              <Download className="w-3.5 h-3.5" /> CSV
            </button>
            <button type="button" onClick={exportCrmExcel} className={btnSecondaryCls}>
              <FileSpreadsheet className="w-3.5 h-3.5" /> Excel
            </button>
            <button type="button" onClick={() => openLeadForm()} className={btnSecondaryCls}>
              <Plus className="w-3.5 h-3.5" /> Nouveau prospect
            </button>
            <button type="button" onClick={() => openCustForm()} className={btnPrimaryCls}>
              <Plus className="w-3.5 h-3.5" /> Nouveau client
            </button>
          </>
        }
      />

      {/* Commercial Stats Strip */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="bg-white dark:bg-[#16181F] border border-slate-200 dark:border-slate-800 rounded-lg p-4">
          <p className="text-xs text-slate-500 dark:text-slate-400">Pipeline commercial actif</p>
          <p className="mt-1 font-mono text-lg font-bold tabular-nums text-slate-900 dark:text-white">
            {formatMoney(stats.pipelineValue, currency)}
          </p>
        </div>
        <div className="bg-white dark:bg-[#16181F] border border-slate-200 dark:border-slate-800 rounded-lg p-4">
          <p className="text-xs text-slate-500 dark:text-slate-400">Opportunités gagnées</p>
          <p className="mt-1 font-mono text-lg font-bold tabular-nums text-emerald-600 dark:text-emerald-400">
            {formatMoney(stats.wonValue, currency)}
          </p>
        </div>
        <div className="bg-white dark:bg-[#16181F] border border-slate-200 dark:border-slate-800 rounded-lg p-4">
          <p className="text-xs text-slate-500 dark:text-slate-400">Taux de conversion prospects</p>
          <p className="mt-1 font-mono text-lg font-bold tabular-nums text-[#FC3F1D]">
            {stats.conversionRate} %
          </p>
        </div>
      </div>

      {/* Toolbar */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-3">
        <SegmentedTabs
          activeId={tab}
          onChange={(id) => setTab(id as typeof tab)}
          tabs={[
            { id: 'leads', label: 'Prospects', count: leads.length },
            { id: 'customers', label: 'Clients', count: customers.length },
            { id: 'opportunities', label: 'Opportunités', count: opportunities.length },
            { id: 'interactions', label: 'Interactions', count: interactions.length },
          ]}
        />
        <div className="relative w-full md:w-72">
          <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-2.5" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Filtrer par nom, société, code..."
            className={`${inputCls} pl-8`}
          />
        </div>
      </div>

      {/* Tab Content */}
      {tab === 'leads' && (
        <div className="bg-white dark:bg-[#16181F] border border-slate-200 dark:border-slate-800 rounded-lg overflow-x-auto">
          {filteredLeads.length === 0 ? (
            <EmptyState
              title="Aucun prospect trouvé"
              description="Enregistrez vos prospects commerciaux pour suivre leur qualification et les convertir en clients."
              actionLabel="Ajouter un prospect"
              onAction={() => openLeadForm()}
            />
          ) : (
            <table className="w-full text-left border-collapse text-xs">
              <thead>
                <tr className="border-b border-slate-200 dark:border-slate-800 text-slate-500 dark:text-slate-400">
                  <th className="py-3 px-4 font-medium">Contact / Société</th>
                  <th className="py-3 px-4 font-medium">Coordonnées</th>
                  <th className="py-3 px-4 font-medium">Source</th>
                  <th className="py-3 px-4 font-medium text-right">Valeur estimée</th>
                  <th className="py-3 px-4 font-medium">Statut</th>
                  <th className="py-3 px-4 font-medium text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800/80">
                {filteredLeads.map((lead) => (
                  <tr key={lead.id} className="hover:bg-slate-50/70 dark:hover:bg-slate-800/40">
                    <td className="py-3 px-4">
                      <p className="font-semibold text-slate-900 dark:text-white">{lead.name}</p>
                      <p className="text-slate-500 dark:text-slate-400">{lead.companyName || 'Particulier'}</p>
                    </td>
                    <td className="py-3 px-4 text-slate-600 dark:text-slate-300">
                      <p>{lead.email || '-'}</p>
                      <p className="font-mono text-[11px] text-slate-400">{lead.phone || ''}</p>
                    </td>
                    <td className="py-3 px-4 text-slate-600 dark:text-slate-300">{lead.source || '-'}</td>
                    <td className="py-3 px-4 text-right font-mono tabular-nums font-medium">
                      {formatMoney(lead.estimatedValue, currency)}
                    </td>
                    <td className="py-3 px-4">
                      <StatusLabel
                        label={lead.status}
                        tone={
                          lead.status === 'converti'
                            ? 'success'
                            : lead.status === 'qualifie'
                            ? 'info'
                            : lead.status === 'perdu'
                            ? 'danger'
                            : 'neutral'
                        }
                      />
                    </td>
                    <td className="py-3 px-4 text-right">
                      <div className="inline-flex items-center gap-1.5">
                        {lead.status !== 'converti' && (
                          <button
                            type="button"
                            onClick={() => handleConvertLead(lead)}
                            className="px-2 py-1 text-[11px] font-medium text-[#FC3F1D] border border-blue-200 dark:border-blue-800 rounded hover:bg-blue-50 dark:hover:bg-blue-950/50"
                            title="Convertir en client"
                          >
                            <ArrowRightLeft className="w-3 h-3 inline mr-1" />
                            Convertir
                          </button>
                        )}
                        <button
                          type="button"
                          onClick={() => openInteractionModal('lead', lead.id, lead.name)}
                          className="p-1.5 text-slate-500 hover:text-[#FC3F1D]"
                          title="Ajouter une interaction"
                        >
                          <MessageSquarePlus className="w-3.5 h-3.5" />
                        </button>
                        <button
                          type="button"
                          onClick={() => openLeadForm(lead)}
                          className="p-1.5 text-slate-500 hover:text-slate-900 dark:hover:text-white"
                          title="Modifier"
                        >
                          <Edit3 className="w-3.5 h-3.5" />
                        </button>
                        <button
                          type="button"
                          onClick={() => deleteErpDoc(activeCompany.id, 'leads', lead.id)}
                          className="p-1.5 text-slate-500 hover:text-red-600"
                          title="Supprimer"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      )}

      {tab === 'customers' && (
        <div className="bg-white dark:bg-[#16181F] border border-slate-200 dark:border-slate-800 rounded-lg overflow-x-auto">
          {filteredCustomers.length === 0 ? (
            <EmptyState
              title="Aucun client enregistré"
              description="Créez une fiche client ou convertissez un prospect qualifié."
              actionLabel="Nouveau client"
              onAction={() => openCustForm()}
            />
          ) : (
            <table className="w-full text-left border-collapse text-xs">
              <thead>
                <tr className="border-b border-slate-200 dark:border-slate-800 text-slate-500 dark:text-slate-400">
                  <th className="py-3 px-4 font-medium">Code</th>
                  <th className="py-3 px-4 font-medium">Raison sociale</th>
                  <th className="py-3 px-4 font-medium">Segment</th>
                  <th className="py-3 px-4 font-medium">Contact</th>
                  <th className="py-3 px-4 font-medium text-right">Encours / Solde dû</th>
                  <th className="py-3 px-4 font-medium text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800/80">
                {filteredCustomers.map((c) => (
                  <tr key={c.id} className="hover:bg-slate-50/70 dark:hover:bg-slate-800/40">
                    <td className="py-3 px-4 font-mono text-slate-600 dark:text-slate-300">{c.code}</td>
                    <td className="py-3 px-4">
                      <p className="font-semibold text-slate-900 dark:text-white">{c.name}</p>
                      <p className="text-slate-400">{c.address || '-'}</p>
                    </td>
                    <td className="py-3 px-4">
                      <StatusLabel label={c.segment} tone="info" />
                    </td>
                    <td className="py-3 px-4 text-slate-600 dark:text-slate-300">
                      <p>{c.email || '-'}</p>
                      <p className="font-mono text-[11px] text-slate-400">{c.phone || ''}</p>
                    </td>
                    <td className="py-3 px-4 text-right font-mono tabular-nums font-semibold">
                      <span className={c.balanceDue > 0 ? 'text-amber-600 dark:text-amber-400' : 'text-emerald-600'}>
                        {formatMoney(c.balanceDue, currency)}
                      </span>
                    </td>
                    <td className="py-3 px-4 text-right">
                      <div className="inline-flex items-center gap-1.5">
                        <button
                          type="button"
                          onClick={() => openInteractionModal('customer', c.id, c.name)}
                          className="p-1.5 text-slate-500 hover:text-[#FC3F1D]"
                          title="Consigner un échange"
                        >
                          <MessageSquarePlus className="w-3.5 h-3.5" />
                        </button>
                        <button
                          type="button"
                          onClick={() => openCustForm(c)}
                          className="p-1.5 text-slate-500 hover:text-slate-900 dark:hover:text-white"
                          title="Modifier"
                        >
                          <Edit3 className="w-3.5 h-3.5" />
                        </button>
                        <button
                          type="button"
                          onClick={() => deleteErpDoc(activeCompany.id, 'customers', c.id)}
                          className="p-1.5 text-slate-500 hover:text-red-600"
                          title="Supprimer"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      )}

      {tab === 'opportunities' && (
        <div className="space-y-3">
          <div className="flex justify-end">
            <button type="button" onClick={() => openOppForm()} className={btnPrimaryCls}>
              <Plus className="w-3.5 h-3.5" /> Nouvelle opportunité
            </button>
          </div>
          <div className="bg-white dark:bg-[#16181F] border border-slate-200 dark:border-slate-800 rounded-lg overflow-x-auto">
            {filteredOpps.length === 0 ? (
              <EmptyState
                title="Aucune opportunité commerciale"
                description="Suivez vos affaires en cours par étape de négociation et probabilité de signature."
                actionLabel="Créer une opportunité"
                onAction={() => openOppForm()}
              />
            ) : (
              <table className="w-full text-left border-collapse text-xs">
                <thead>
                  <tr className="border-b border-slate-200 dark:border-slate-800 text-slate-500 dark:text-slate-400">
                    <th className="py-3 px-4 font-medium">Affaire</th>
                    <th className="py-3 px-4 font-medium">Client</th>
                    <th className="py-3 px-4 font-medium">Étape</th>
                    <th className="py-3 px-4 font-medium text-right">Montant</th>
                    <th className="py-3 px-4 font-medium text-right">Probabilité</th>
                    <th className="py-3 px-4 font-medium">Clôture prévue</th>
                    <th className="py-3 px-4 font-medium text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-slate-800/80">
                  {filteredOpps.map((opp) => (
                    <tr key={opp.id} className="hover:bg-slate-50/70 dark:hover:bg-slate-800/40">
                      <td className="py-3 px-4 font-semibold text-slate-900 dark:text-white">{opp.title}</td>
                      <td className="py-3 px-4 text-slate-600 dark:text-slate-300">{opp.customerName || '-'}</td>
                      <td className="py-3 px-4">
                        <StatusLabel
                          label={opp.stage}
                          tone={opp.stage === 'gagnee' ? 'success' : opp.stage === 'perdue' ? 'danger' : 'info'}
                        />
                      </td>
                      <td className="py-3 px-4 text-right font-mono tabular-nums font-medium">
                        {formatMoney(opp.amount, currency)}
                      </td>
                      <td className="py-3 px-4 text-right font-mono tabular-nums">{opp.probability} %</td>
                      <td className="py-3 px-4 text-slate-500">{formatDateFr(opp.expectedCloseDate)}</td>
                      <td className="py-3 px-4 text-right">
                        <div className="inline-flex items-center gap-1">
                          <button type="button" onClick={() => openOppForm(opp)} className="p-1.5 text-slate-500 hover:text-slate-900 dark:hover:text-white">
                            <Edit3 className="w-3.5 h-3.5" />
                          </button>
                          <button type="button" onClick={() => deleteErpDoc(activeCompany.id, 'opportunities', opp.id)} className="p-1.5 text-slate-500 hover:text-red-600">
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        </div>
      )}

      {tab === 'interactions' && (
        <div className="bg-white dark:bg-[#16181F] border border-slate-200 dark:border-slate-800 rounded-lg divide-y divide-slate-100 dark:divide-slate-800">
          {interactions.length === 0 ? (
            <EmptyState
              title="Aucune interaction consignée"
              description="Utilisez l’icône de commentaire sur un prospect ou un client pour enregistrer un appel, e-mail ou rendez-vous."
            />
          ) : (
            interactions.map((item) => (
              <div key={item.id} className="p-4 flex items-start justify-between gap-4">
                <div>
                  <div className="flex items-center gap-2 text-xs">
                    <StatusLabel label={item.channel.toUpperCase()} tone="info" />
                    <span className="font-semibold text-slate-900 dark:text-white">{item.entityName || item.entityId}</span>
                    <span className="text-slate-400">·</span>
                    <span className="text-slate-500">{formatDateFr(item.date)}</span>
                  </div>
                  <p className="text-xs text-slate-600 dark:text-slate-300 mt-1.5">{item.summary}</p>
                </div>
                <span className="text-[11px] text-slate-400 shrink-0">{item.authorEmail}</span>
              </div>
            ))
          )}
        </div>
      )}

      {/* Lead Modal */}
      <Modal open={leadModal} title={editingLead ? 'Modifier le prospect' : 'Nouveau prospect'} onClose={() => setLeadModal(false)}>
        <form onSubmit={saveLead} className="space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className={labelCls}>Nom du contact *</label>
              <input required className={inputCls} value={leadForm.name} onChange={(e) => setLeadForm({ ...leadForm, name: e.target.value })} />
            </div>
            <div>
              <label className={labelCls}>Entreprise</label>
              <input className={inputCls} value={leadForm.companyName} onChange={(e) => setLeadForm({ ...leadForm, companyName: e.target.value })} />
            </div>
            <div>
              <label className={labelCls}>Email</label>
              <input type="email" className={inputCls} value={leadForm.email} onChange={(e) => setLeadForm({ ...leadForm, email: e.target.value })} />
            </div>
            <div>
              <label className={labelCls}>Téléphone</label>
              <input className={inputCls} value={leadForm.phone} onChange={(e) => setLeadForm({ ...leadForm, phone: e.target.value })} />
            </div>
            <div>
              <label className={labelCls}>Statut</label>
              <select className={inputCls} value={leadForm.status} onChange={(e) => setLeadForm({ ...leadForm, status: e.target.value as Lead['status'] })}>
                <option value="nouveau">Nouveau</option>
                <option value="contacte">Contacté</option>
                <option value="qualifie">Qualifié</option>
                <option value="converti">Converti</option>
                <option value="perdu">Perdu</option>
              </select>
            </div>
            <div>
              <label className={labelCls}>Valeur estimée ({currency})</label>
              <input type="number" min="0" className={inputCls} value={leadForm.estimatedValue} onChange={(e) => setLeadForm({ ...leadForm, estimatedValue: Number(e.target.value) })} />
            </div>
          </div>
          <div>
            <label className={labelCls}>Notes</label>
            <textarea rows={3} className={inputCls} value={leadForm.notes} onChange={(e) => setLeadForm({ ...leadForm, notes: e.target.value })} />
          </div>
          <div className="flex justify-end gap-2 pt-2">
            <button type="button" onClick={() => setLeadModal(false)} className={btnSecondaryCls}>Annuler</button>
            <button type="submit" className={btnPrimaryCls}>Enregistrer</button>
          </div>
        </form>
      </Modal>

      {/* Customer Modal */}
      <Modal open={custModal} title={editingCust ? 'Modifier la fiche client' : 'Nouveau client'} onClose={() => setCustModal(false)}>
        <form onSubmit={saveCustomer} className="space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className={labelCls}>Code client *</label>
              <input required className={inputCls} value={custForm.code} onChange={(e) => setCustForm({ ...custForm, code: e.target.value })} />
            </div>
            <div>
              <label className={labelCls}>Nom / Raison sociale *</label>
              <input required className={inputCls} value={custForm.name} onChange={(e) => setCustForm({ ...custForm, name: e.target.value })} />
            </div>
            <div>
              <label className={labelCls}>Segment</label>
              <select className={inputCls} value={custForm.segment} onChange={(e) => setCustForm({ ...custForm, segment: e.target.value as Customer['segment'] })}>
                <option value="B2B">B2B (Entreprise)</option>
                <option value="B2C">B2C (Particulier)</option>
                <option value="Administration">Administration</option>
              </select>
            </div>
            <div>
              <label className={labelCls}>NIF / Identifiant fiscal</label>
              <input className={inputCls} value={custForm.taxId} onChange={(e) => setCustForm({ ...custForm, taxId: e.target.value })} />
            </div>
            <div>
              <label className={labelCls}>Email</label>
              <input type="email" className={inputCls} value={custForm.email} onChange={(e) => setCustForm({ ...custForm, email: e.target.value })} />
            </div>
            <div>
              <label className={labelCls}>Téléphone</label>
              <input className={inputCls} value={custForm.phone} onChange={(e) => setCustForm({ ...custForm, phone: e.target.value })} />
            </div>
            <div>
              <label className={labelCls}>Adresse</label>
              <input className={inputCls} value={custForm.address} onChange={(e) => setCustForm({ ...custForm, address: e.target.value })} />
            </div>
            <div>
              <label className={labelCls}>Plafond de crédit ({currency})</label>
              <input type="number" min="0" className={inputCls} value={custForm.creditLimit} onChange={(e) => setCustForm({ ...custForm, creditLimit: Number(e.target.value) })} />
            </div>
          </div>
          <div className="flex justify-end gap-2 pt-2">
            <button type="button" onClick={() => setCustModal(false)} className={btnSecondaryCls}>Annuler</button>
            <button type="submit" className={btnPrimaryCls}>Enregistrer</button>
          </div>
        </form>
      </Modal>

      {/* Opportunity Modal */}
      <Modal open={oppModal} title={editingOpp ? 'Modifier l’opportunité' : 'Nouvelle opportunité'} onClose={() => setOppModal(false)}>
        <form onSubmit={saveOpp} className="space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="sm:col-span-2">
              <label className={labelCls}>Titre de l’opportunité *</label>
              <input required className={inputCls} value={oppForm.title} onChange={(e) => setOppForm({ ...oppForm, title: e.target.value })} />
            </div>
            <div>
              <label className={labelCls}>Client associé</label>
              <select className={inputCls} value={oppForm.customerId} onChange={(e) => setOppForm({ ...oppForm, customerId: e.target.value })}>
                <option value="">Sélectionner un client</option>
                {customers.map((c) => (
                  <option key={c.id} value={c.id}>{c.name}</option>
                ))}
              </select>
            </div>
            <div>
              <label className={labelCls}>Étape</label>
              <select className={inputCls} value={oppForm.stage} onChange={(e) => setOppForm({ ...oppForm, stage: e.target.value as Opportunity['stage'] })}>
                <option value="prospection">Prospection</option>
                <option value="qualification">Qualification</option>
                <option value="proposition">Proposition</option>
                <option value="negociation">Négociation</option>
                <option value="gagnee">Gagnée</option>
                <option value="perdue">Perdue</option>
              </select>
            </div>
            <div>
              <label className={labelCls}>Montant estimé ({currency})</label>
              <input type="number" min="0" className={inputCls} value={oppForm.amount} onChange={(e) => setOppForm({ ...oppForm, amount: Number(e.target.value) })} />
            </div>
            <div>
              <label className={labelCls}>Probabilité (%)</label>
              <input type="number" min="0" max="100" className={inputCls} value={oppForm.probability} onChange={(e) => setOppForm({ ...oppForm, probability: Number(e.target.value) })} />
            </div>
            <div>
              <label className={labelCls}>Date de clôture prévue</label>
              <input type="date" className={inputCls} value={oppForm.expectedCloseDate} onChange={(e) => setOppForm({ ...oppForm, expectedCloseDate: e.target.value })} />
            </div>
          </div>
          <div className="flex justify-end gap-2 pt-2">
            <button type="button" onClick={() => setOppModal(false)} className={btnSecondaryCls}>Annuler</button>
            <button type="submit" className={btnPrimaryCls}>Enregistrer</button>
          </div>
        </form>
      </Modal>

      {/* Interaction Modal */}
      <Modal open={intModal} title={`Consigner un échange · ${intForm.entityName}`} onClose={() => setIntModal(false)} maxWidth="max-w-lg">
        <form onSubmit={saveInteraction} className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className={labelCls}>Canal</label>
              <select className={inputCls} value={intForm.channel} onChange={(e) => setIntForm({ ...intForm, channel: e.target.value as typeof intForm.channel })}>
                <option value="appel">Appel téléphonique</option>
                <option value="email">E-mail</option>
                <option value="reunion">Réunion / Visite</option>
                <option value="note">Note interne</option>
              </select>
            </div>
            <div>
              <label className={labelCls}>Date</label>
              <input type="date" className={inputCls} value={intForm.date} onChange={(e) => setIntForm({ ...intForm, date: e.target.value })} />
            </div>
          </div>
          <div>
            <label className={labelCls}>Compte-rendu *</label>
            <textarea required rows={3} className={inputCls} value={intForm.summary} onChange={(e) => setIntForm({ ...intForm, summary: e.target.value })} />
          </div>
          <div className="flex justify-end gap-2">
            <button type="button" onClick={() => setIntModal(false)} className={btnSecondaryCls}>Annuler</button>
            <button type="submit" className={btnPrimaryCls}>Enregistrer</button>
          </div>
        </form>
      </Modal>

      <ImportSpreadsheetModal
        open={importOpen}
        onClose={() => setImportOpen(false)}
        defaultTarget={tab === 'leads' ? 'leads' : 'customers'}
        allowTargetSwitch
      />
    </div>
  );
};
