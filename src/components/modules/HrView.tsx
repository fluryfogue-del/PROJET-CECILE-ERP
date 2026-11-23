import React, { useMemo, useState } from 'react';
import { Plus, Check, X, CreditCard, Trash2, Edit3, Upload, Download, FileSpreadsheet } from 'lucide-react';
import { useErp } from '../../contexts/ErpContext';
import { currentPeriod, formatDateFr, formatMoney, todayIso } from '../../lib/format';
import { exportRowsCsv, exportWorkbookExcel } from '../../lib/exports';
import { createErpDoc, deleteErpDoc, payEmployeePayroll, updateErpDoc } from '../../services/erpEngine';
import { Employee, Payroll } from '../../types/erp';
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

export const HrView: React.FC = () => {
  const {
    user,
    activeCompany,
    employees,
    departments,
    leaves,
    payrolls,
    treasuryAccounts,
    accounts,
    notify,
  } = useErp();

  const [tab, setTab] = useState<'employees' | 'leaves' | 'payrolls'>('employees');

  // Employee Modal
  const [empModal, setEmpModal] = useState(false);
  const [editingEmp, setEditingEmp] = useState<Employee | null>(null);
  const [empForm, setEmpForm] = useState({
    matricule: '',
    firstName: '',
    lastName: '',
    email: '',
    phone: '',
    departmentName: 'Direction Générale',
    position: '',
    contractType: 'CDI' as Employee['contractType'],
    hireDate: todayIso(),
    baseSalary: 0,
    status: 'actif' as Employee['status'],
  });
  const [importOpen, setImportOpen] = useState(false);

  // Leave Modal
  const [leaveModal, setLeaveModal] = useState(false);
  const [leaveForm, setLeaveForm] = useState({
    employeeId: '',
    type: 'conge_paye' as 'conge_paye' | 'maladie' | 'absence' | 'exceptionnel',
    startDate: todayIso(),
    endDate: todayIso(),
    days: 1,
    reason: '',
  });

  // Payroll Modal
  const [payModal, setPayModal] = useState(false);
  const [payForm, setPayForm] = useState({
    period: currentPeriod(),
    employeeId: '',
    bonuses: 0,
    deductions: 0,
  });

  const currency = activeCompany?.currency || 'XAF';

  const hrStats = useMemo(() => {
    const active = employees.filter((e) => e.status === 'actif').length;
    const payrollMass = employees.filter((e) => e.status !== 'sorti').reduce((s, e) => s + (e.baseSalary || 0), 0);
    const pendingLeaves = leaves.filter((l) => l.status === 'en_attente').length;
    return { active, payrollMass, pendingLeaves };
  }, [employees, leaves]);

  if (!activeCompany || !user) return null;
  const ownerId = activeCompany.ownerId;
  const memberUids = activeCompany.memberUids;

  const openEmpForm = (emp?: Employee) => {
    if (emp) {
      setEditingEmp(emp);
      setEmpForm({
        matricule: emp.matricule,
        firstName: emp.firstName,
        lastName: emp.lastName,
        email: emp.email || '',
        phone: emp.phone || '',
        departmentName: emp.departmentName,
        position: emp.position,
        contractType: emp.contractType,
        hireDate: emp.hireDate || todayIso(),
        baseSalary: emp.baseSalary,
        status: emp.status,
      });
    } else {
      setEditingEmp(null);
      setEmpForm({
        matricule: `EMP-${String(employees.length + 1).padStart(3, '0')}`,
        firstName: '',
        lastName: '',
        email: '',
        phone: '',
        departmentName: departments[0]?.name || 'Direction Générale',
        position: '',
        contractType: 'CDI',
        hireDate: todayIso(),
        baseSalary: 0,
        status: 'actif',
      });
    }
    setEmpModal(true);
  };

  const saveEmployee = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      if (editingEmp) {
        await updateErpDoc(activeCompany.id, 'employees', editingEmp.id, {
          firstName: empForm.firstName,
          lastName: empForm.lastName,
          email: empForm.email,
          phone: empForm.phone,
          departmentName: empForm.departmentName,
          position: empForm.position,
          contractType: empForm.contractType,
          baseSalary: Number(empForm.baseSalary),
          status: empForm.status,
        });
        notify('Dossier employé mis à jour.', 'success');
      } else {
        await createErpDoc(
          activeCompany.id,
          'employees',
          {
            ...empForm,
            baseSalary: Number(empForm.baseSalary),
            history: [`${empForm.hireDate} : Embauche ${empForm.contractType} (${empForm.position})`],
            isDemo: false,
          },
          ownerId,
          memberUids
        );
        notify('Employé ajouté aux effectifs.', 'success');
      }
      setEmpModal(false);
    } catch (err) {
      notify(err instanceof Error ? err.message : 'Erreur employé', 'error');
    }
  };

  const saveLeave = async (e: React.FormEvent) => {
    e.preventDefault();
    const emp = employees.find((item) => item.id === leaveForm.employeeId);
    if (!emp) return;
    try {
      await createErpDoc(
        activeCompany.id,
        'leaves',
        {
          employeeId: emp.id,
          employeeName: `${emp.firstName} ${emp.lastName}`,
          type: leaveForm.type,
          startDate: leaveForm.startDate,
          endDate: leaveForm.endDate,
          days: Number(leaveForm.days) || 1,
          reason: leaveForm.reason,
          status: 'en_attente',
          isDemo: false,
        },
        ownerId,
        memberUids
      );
      notify('Demande de congé enregistrée.', 'success');
      setLeaveModal(false);
    } catch (err) {
      notify(err instanceof Error ? err.message : 'Erreur congé', 'error');
    }
  };

  const savePayroll = async (e: React.FormEvent) => {
    e.preventDefault();
    const emp = employees.find((item) => item.id === payForm.employeeId);
    if (!emp) return;
    const netSalary = Math.max(0, emp.baseSalary + Number(payForm.bonuses) - Number(payForm.deductions));
    try {
      await createErpDoc(
        activeCompany.id,
        'payrolls',
        {
          period: payForm.period,
          employeeId: emp.id,
          employeeName: `${emp.firstName} ${emp.lastName}`,
          departmentName: emp.departmentName,
          baseSalary: emp.baseSalary,
          bonuses: Number(payForm.bonuses) || 0,
          deductions: Number(payForm.deductions) || 0,
          netSalary,
          status: 'validee',
          isDemo: false,
        },
        ownerId,
        memberUids
      );
      notify('Bulletin de paie généré.', 'success');
      setPayModal(false);
    } catch (err) {
      notify(err instanceof Error ? err.message : 'Erreur paie', 'error');
    }
  };

  const handlePaySalary = async (payroll: Payroll) => {
    const treas = treasuryAccounts[0];
    if (!treas) {
      notify('Configurez un compte de trésorerie pour payer les salaires.', 'warning');
      return;
    }
    try {
      await payEmployeePayroll({
        companyId: activeCompany.id,
        payroll,
        treasuryAccount: treas,
        accounts,
        uid: user.uid,
        email: user.email || '',
        ownerId,
        memberUids,
      });
      notify(`Salaire versé à ${payroll.employeeName} et comptabilisé (661).`, 'success');
    } catch (err) {
      notify(err instanceof Error ? err.message : 'Erreur versement salaire', 'error');
    }
  };

  const exportHrCsv = () => {
    if (tab === 'leaves') {
      exportRowsCsv(
        leaves.map((l) => ({
          Employe: l.employeeName,
          Type: l.type,
          Debut: l.startDate,
          Fin: l.endDate,
          Jours: l.days,
          Statut: l.status,
        })),
        `Conges_RH_${todayIso()}`
      );
    } else if (tab === 'payrolls') {
      exportRowsCsv(
        payrolls.map((p) => ({
          Periode: p.period,
          Employe: p.employeeName,
          Departement: p.departmentName,
          SalaireBase: p.baseSalary,
          Primes: p.bonuses || 0,
          Retenues: p.deductions || 0,
          NetAPayer: p.netSalary,
          Statut: p.status,
        })),
        `Bulletins_Paie_${todayIso()}`
      );
    } else {
      exportRowsCsv(
        employees.map((e) => ({
          Matricule: e.matricule,
          Prenom: e.firstName,
          Nom: e.lastName,
          Email: e.email || '',
          Telephone: e.phone || '',
          Departement: e.departmentName,
          Poste: e.position,
          Contrat: e.contractType,
          DateEmbauche: e.hireDate,
          SalaireBase: e.baseSalary,
          Statut: e.status,
        })),
        `Effectifs_RH_${todayIso()}`
      );
    }
    notify('Export CSV téléchargé.', 'success');
  };

  const exportHrExcel = () => {
    exportWorkbookExcel(
      [
        {
          name: 'Employes',
          rows: employees.map((e) => ({
            Matricule: e.matricule,
            Prenom: e.firstName,
            Nom: e.lastName,
            Departement: e.departmentName,
            Poste: e.position,
            Contrat: e.contractType,
            SalaireBase: e.baseSalary,
            Statut: e.status,
          })),
        },
        {
          name: 'Conges',
          rows: leaves.map((l) => ({
            Employe: l.employeeName,
            Type: l.type,
            Debut: l.startDate,
            Fin: l.endDate,
            Jours: l.days,
            Statut: l.status,
          })),
        },
        {
          name: 'Paie',
          rows: payrolls.map((p) => ({
            Periode: p.period,
            Employe: p.employeeName,
            SalaireBase: p.baseSalary,
            Primes: p.bonuses || 0,
            Retenues: p.deductions || 0,
            NetAPayer: p.netSalary,
            Statut: p.status,
          })),
        },
      ],
      `RH_Paie_FUREX_${todayIso()}`
    );
    notify('Classeur Excel RH téléchargé.', 'success');
  };

  return (
    <div className="space-y-6">
      <PageHeader
        title="Ressources Humaines & Paie"
        subtitle="Dossiers du personnel, contrats, départements, congés, absences et versement des rémunérations"
        actions={
          <>
            <button type="button" onClick={() => setImportOpen(true)} className={btnSecondaryCls}>
              <Upload className="w-3.5 h-3.5" /> Importer CSV/Excel
            </button>
            <button type="button" onClick={exportHrCsv} className={btnSecondaryCls}>
              <Download className="w-3.5 h-3.5" /> CSV
            </button>
            <button type="button" onClick={exportHrExcel} className={btnSecondaryCls}>
              <FileSpreadsheet className="w-3.5 h-3.5" /> Excel
            </button>
            <button
              type="button"
              onClick={() => {
                setLeaveForm({
                  employeeId: employees[0]?.id || '',
                  type: 'conge_paye',
                  startDate: todayIso(),
                  endDate: todayIso(),
                  days: 1,
                  reason: '',
                });
                setLeaveModal(true);
              }}
              className={btnSecondaryCls}
            >
              <Plus className="w-3.5 h-3.5" /> Congé / Absence
            </button>
            <button
              type="button"
              onClick={() => {
                setPayForm({ period: currentPeriod(), employeeId: employees[0]?.id || '', bonuses: 0, deductions: 0 });
                setPayModal(true);
              }}
              className={btnSecondaryCls}
            >
              <Plus className="w-3.5 h-3.5" /> Bulletin de paie
            </button>
            <button type="button" onClick={() => openEmpForm()} className={btnPrimaryCls}>
              <Plus className="w-3.5 h-3.5" /> Nouvel employé
            </button>
          </>
        }
      />

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="bg-white dark:bg-[#16181F] border border-slate-200 dark:border-slate-800 rounded-lg p-4">
          <p className="text-xs text-slate-500">Effectif actif</p>
          <p className="mt-1 font-mono text-lg font-bold tabular-nums">{hrStats.active} collaborateurs</p>
        </div>
        <div className="bg-white dark:bg-[#16181F] border border-slate-200 dark:border-slate-800 rounded-lg p-4">
          <p className="text-xs text-slate-500">Masse salariale mensuelle de base</p>
          <p className="mt-1 font-mono text-lg font-bold tabular-nums text-[#FC3F1D]">
            {formatMoney(hrStats.payrollMass, currency)}
          </p>
        </div>
        <div className="bg-white dark:bg-[#16181F] border border-slate-200 dark:border-slate-800 rounded-lg p-4">
          <p className="text-xs text-slate-500">Demandes de congés en attente</p>
          <p className="mt-1 font-mono text-lg font-bold tabular-nums">{hrStats.pendingLeaves}</p>
        </div>
      </div>

      <SegmentedTabs
        activeId={tab}
        onChange={(id) => setTab(id as typeof tab)}
        tabs={[
          { id: 'employees', label: 'Dossiers Personnel', count: employees.length },
          { id: 'leaves', label: 'Congés & Absences', count: leaves.length },
          { id: 'payrolls', label: 'Rémunérations & Paie', count: payrolls.length },
        ]}
      />

      {tab === 'employees' && (
        <div className="bg-white dark:bg-[#16181F] border border-slate-200 dark:border-slate-800 rounded-lg overflow-x-auto">
          {employees.length === 0 ? (
            <EmptyState title="Aucun employé" description="Ajoutez votre premier collaborateur." actionLabel="Nouvel employé" onAction={() => openEmpForm()} />
          ) : (
            <table className="w-full text-left border-collapse text-xs">
              <thead>
                <tr className="border-b border-slate-200 dark:border-slate-800 text-slate-500">
                  <th className="py-3 px-4 font-medium">Matricule</th>
                  <th className="py-3 px-4 font-medium">Nom complet</th>
                  <th className="py-3 px-4 font-medium">Département & Poste</th>
                  <th className="py-3 px-4 font-medium">Contrat</th>
                  <th className="py-3 px-4 font-medium text-right">Salaire de base</th>
                  <th className="py-3 px-4 font-medium">Statut</th>
                  <th className="py-3 px-4 font-medium text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800/80">
                {employees.map((emp) => (
                  <tr key={emp.id}>
                    <td className="py-3 px-4 font-mono">{emp.matricule}</td>
                    <td className="py-3 px-4">
                      <p className="font-semibold text-slate-900 dark:text-white">{emp.firstName} {emp.lastName}</p>
                      <p className="text-slate-400">{emp.email || emp.phone || '-'}</p>
                    </td>
                    <td className="py-3 px-4">
                      <p className="font-medium">{emp.position}</p>
                      <p className="text-slate-400">{emp.departmentName}</p>
                    </td>
                    <td className="py-3 px-4"><StatusLabel label={emp.contractType} tone="info" /></td>
                    <td className="py-3 px-4 text-right font-mono tabular-nums font-semibold">
                      {formatMoney(emp.baseSalary, currency)}
                    </td>
                    <td className="py-3 px-4">
                      <StatusLabel label={emp.status} tone={emp.status === 'actif' ? 'success' : 'warning'} />
                    </td>
                    <td className="py-3 px-4 text-right">
                      <div className="inline-flex gap-1">
                        <button type="button" onClick={() => openEmpForm(emp)} className="p-1.5 text-slate-500 hover:text-slate-900 dark:hover:text-white">
                          <Edit3 className="w-3.5 h-3.5" />
                        </button>
                        <button type="button" onClick={() => deleteErpDoc(activeCompany.id, 'employees', emp.id)} className="p-1.5 text-slate-500 hover:text-red-600">
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

      {tab === 'leaves' && (
        <div className="bg-white dark:bg-[#16181F] border border-slate-200 dark:border-slate-800 rounded-lg overflow-x-auto">
          {leaves.length === 0 ? (
            <EmptyState title="Aucune demande de congé" description="Enregistrez les demandes de congés ou absences." />
          ) : (
            <table className="w-full text-left border-collapse text-xs">
              <thead>
                <tr className="border-b border-slate-200 dark:border-slate-800 text-slate-500">
                  <th className="py-3 px-4 font-medium">Collaborateur</th>
                  <th className="py-3 px-4 font-medium">Type</th>
                  <th className="py-3 px-4 font-medium">Période</th>
                  <th className="py-3 px-4 font-medium text-right">Jours</th>
                  <th className="py-3 px-4 font-medium">Statut</th>
                  <th className="py-3 px-4 font-medium text-right">Décision</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800/80">
                {leaves.map((l) => (
                  <tr key={l.id}>
                    <td className="py-3 px-4 font-semibold">{l.employeeName}</td>
                    <td className="py-3 px-4">{l.type}</td>
                    <td className="py-3 px-4 text-slate-500">{formatDateFr(l.startDate)} → {formatDateFr(l.endDate)}</td>
                    <td className="py-3 px-4 text-right font-mono">{l.days} j</td>
                    <td className="py-3 px-4">
                      <StatusLabel label={l.status} tone={l.status === 'approuve' ? 'success' : l.status === 'refuse' ? 'danger' : 'warning'} />
                    </td>
                    <td className="py-3 px-4 text-right">
                      {l.status === 'en_attente' && (
                        <div className="inline-flex gap-1">
                          <button type="button" onClick={() => updateErpDoc(activeCompany.id, 'leaves', l.id, { status: 'approuve' })} className="p-1.5 text-emerald-600 hover:bg-emerald-50 rounded" title="Approuver">
                            <Check className="w-3.5 h-3.5" />
                          </button>
                          <button type="button" onClick={() => updateErpDoc(activeCompany.id, 'leaves', l.id, { status: 'refuse' })} className="p-1.5 text-red-600 hover:bg-red-50 rounded" title="Refuser">
                            <X className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      )}

      {tab === 'payrolls' && (
        <div className="bg-white dark:bg-[#16181F] border border-slate-200 dark:border-slate-800 rounded-lg overflow-x-auto">
          {payrolls.length === 0 ? (
            <EmptyState title="Aucun bulletin de paie" description="Générez les fiches de paie mensuelles de vos salariés." />
          ) : (
            <table className="w-full text-left border-collapse text-xs">
              <thead>
                <tr className="border-b border-slate-200 dark:border-slate-800 text-slate-500">
                  <th className="py-3 px-4 font-medium">Période</th>
                  <th className="py-3 px-4 font-medium">Collaborateur</th>
                  <th className="py-3 px-4 font-medium text-right">Base</th>
                  <th className="py-3 px-4 font-medium text-right">Primes</th>
                  <th className="py-3 px-4 font-medium text-right">Retenues</th>
                  <th className="py-3 px-4 font-medium text-right">Net à payer</th>
                  <th className="py-3 px-4 font-medium">Statut</th>
                  <th className="py-3 px-4 font-medium text-right">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800/80">
                {payrolls.map((p) => (
                  <tr key={p.id}>
                    <td className="py-3 px-4 font-mono">{p.period}</td>
                    <td className="py-3 px-4 font-semibold">{p.employeeName}</td>
                    <td className="py-3 px-4 text-right font-mono tabular-nums">{formatMoney(p.baseSalary, currency)}</td>
                    <td className="py-3 px-4 text-right font-mono tabular-nums text-emerald-600">+ {formatMoney(p.bonuses || 0, currency)}</td>
                    <td className="py-3 px-4 text-right font-mono tabular-nums text-red-600">- {formatMoney(p.deductions || 0, currency)}</td>
                    <td className="py-3 px-4 text-right font-mono tabular-nums font-bold">{formatMoney(p.netSalary, currency)}</td>
                    <td className="py-3 px-4">
                      <StatusLabel label={p.status} tone={p.status === 'payee' ? 'success' : 'info'} />
                    </td>
                    <td className="py-3 px-4 text-right">
                      {p.status !== 'payee' && (
                        <button type="button" onClick={() => handlePaySalary(p)} className="px-2.5 py-1 text-[11px] font-semibold bg-emerald-600 hover:bg-emerald-700 text-white rounded">
                          <CreditCard className="w-3 h-3 inline mr-1" />
                          Verser salaire
                        </button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      )}

      {/* Employee Modal */}
      <Modal open={empModal} title={editingEmp ? 'Modifier dossier employé' : 'Nouvel employé'} onClose={() => setEmpModal(false)}>
        <form onSubmit={saveEmployee} className="space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className={labelCls}>Matricule *</label>
              <input required className={inputCls} value={empForm.matricule} onChange={(e) => setEmpForm({ ...empForm, matricule: e.target.value })} />
            </div>
            <div>
              <label className={labelCls}>Prénom *</label>
              <input required className={inputCls} value={empForm.firstName} onChange={(e) => setEmpForm({ ...empForm, firstName: e.target.value })} />
            </div>
            <div>
              <label className={labelCls}>Nom *</label>
              <input required className={inputCls} value={empForm.lastName} onChange={(e) => setEmpForm({ ...empForm, lastName: e.target.value })} />
            </div>
            <div>
              <label className={labelCls}>Département *</label>
              <select className={inputCls} value={empForm.departmentName} onChange={(e) => setEmpForm({ ...empForm, departmentName: e.target.value })}>
                {departments.map((d) => (
                  <option key={d.id} value={d.name}>{d.name}</option>
                ))}
                <option value="Direction Générale">Direction Générale</option>
              </select>
            </div>
            <div>
              <label className={labelCls}>Poste occupé *</label>
              <input required className={inputCls} value={empForm.position} onChange={(e) => setEmpForm({ ...empForm, position: e.target.value })} />
            </div>
            <div>
              <label className={labelCls}>Type de contrat</label>
              <select className={inputCls} value={empForm.contractType} onChange={(e) => setEmpForm({ ...empForm, contractType: e.target.value as Employee['contractType'] })}>
                <option value="CDI">CDI</option>
                <option value="CDD">CDD</option>
                <option value="Stage">Stage</option>
                <option value="Consultant">Consultant</option>
              </select>
            </div>
            <div>
              <label className={labelCls}>Salaire mensuel de base ({currency}) *</label>
              <input type="number" min="0" required className={inputCls} value={empForm.baseSalary} onChange={(e) => setEmpForm({ ...empForm, baseSalary: Number(e.target.value) })} />
            </div>
            <div>
              <label className={labelCls}>Statut</label>
              <select className={inputCls} value={empForm.status} onChange={(e) => setEmpForm({ ...empForm, status: e.target.value as Employee['status'] })}>
                <option value="actif">Actif</option>
                <option value="en_conge">En congé</option>
                <option value="suspendu">Suspendu</option>
                <option value="sorti">Sorti</option>
              </select>
            </div>
          </div>
          <div className="flex justify-end gap-2">
            <button type="button" onClick={() => setEmpModal(false)} className={btnSecondaryCls}>Annuler</button>
            <button type="submit" className={btnPrimaryCls}>Enregistrer</button>
          </div>
        </form>
      </Modal>

      {/* Leave Modal */}
      <Modal open={leaveModal} title="Enregistrer un congé ou une absence" onClose={() => setLeaveModal(false)} maxWidth="max-w-md">
        <form onSubmit={saveLeave} className="space-y-4">
          <div>
            <label className={labelCls}>Employé *</label>
            <select required className={inputCls} value={leaveForm.employeeId} onChange={(e) => setLeaveForm({ ...leaveForm, employeeId: e.target.value })}>
              {employees.map((e) => (
                <option key={e.id} value={e.id}>{e.firstName} {e.lastName}</option>
              ))}
            </select>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className={labelCls}>Type</label>
              <select className={inputCls} value={leaveForm.type} onChange={(e) => setLeaveForm({ ...leaveForm, type: e.target.value as typeof leaveForm.type })}>
                <option value="conge_paye">Congé payé</option>
                <option value="maladie">Arrêt maladie</option>
                <option value="absence">Absence autorisée</option>
                <option value="exceptionnel">Congé exceptionnel</option>
              </select>
            </div>
            <div>
              <label className={labelCls}>Nombre de jours</label>
              <input type="number" min="1" required className={inputCls} value={leaveForm.days} onChange={(e) => setLeaveForm({ ...leaveForm, days: Number(e.target.value) })} />
            </div>
            <div>
              <label className={labelCls}>Début</label>
              <input type="date" required className={inputCls} value={leaveForm.startDate} onChange={(e) => setLeaveForm({ ...leaveForm, startDate: e.target.value })} />
            </div>
            <div>
              <label className={labelCls}>Fin</label>
              <input type="date" required className={inputCls} value={leaveForm.endDate} onChange={(e) => setLeaveForm({ ...leaveForm, endDate: e.target.value })} />
            </div>
          </div>
          <div>
            <label className={labelCls}>Motif</label>
            <input className={inputCls} value={leaveForm.reason} onChange={(e) => setLeaveForm({ ...leaveForm, reason: e.target.value })} />
          </div>
          <div className="flex justify-end gap-2">
            <button type="button" onClick={() => setLeaveModal(false)} className={btnSecondaryCls}>Annuler</button>
            <button type="submit" className={btnPrimaryCls}>Soumettre</button>
          </div>
        </form>
      </Modal>

      {/* Payroll Modal */}
      <Modal open={payModal} title="Générer un bulletin de paie" onClose={() => setPayModal(false)} maxWidth="max-w-md">
        <form onSubmit={savePayroll} className="space-y-4">
          <div>
            <label className={labelCls}>Employé *</label>
            <select required className={inputCls} value={payForm.employeeId} onChange={(e) => setPayForm({ ...payForm, employeeId: e.target.value })}>
              {employees.map((e) => (
                <option key={e.id} value={e.id}>{e.firstName} {e.lastName} ({formatMoney(e.baseSalary, currency)})</option>
              ))}
            </select>
          </div>
          <div>
            <label className={labelCls}>Période (AAAA-MM)</label>
            <input required className={inputCls} value={payForm.period} onChange={(e) => setPayForm({ ...payForm, period: e.target.value })} />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className={labelCls}>Primes / Indemnités</label>
              <input type="number" min="0" className={inputCls} value={payForm.bonuses} onChange={(e) => setPayForm({ ...payForm, bonuses: Number(e.target.value) })} />
            </div>
            <div>
              <label className={labelCls}>Retenues / Cotisations</label>
              <input type="number" min="0" className={inputCls} value={payForm.deductions} onChange={(e) => setPayForm({ ...payForm, deductions: Number(e.target.value) })} />
            </div>
          </div>
          <div className="flex justify-end gap-2">
            <button type="button" onClick={() => setPayModal(false)} className={btnSecondaryCls}>Annuler</button>
            <button type="submit" className={btnPrimaryCls}>Générer le bulletin</button>
          </div>
        </form>
      </Modal>

      <ImportSpreadsheetModal
        open={importOpen}
        onClose={() => setImportOpen(false)}
        defaultTarget="employees"
      />
    </div>
  );
};
