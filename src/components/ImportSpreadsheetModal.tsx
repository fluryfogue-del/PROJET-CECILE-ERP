import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  Upload,
  FileSpreadsheet,
  Download,
  CheckCircle2,
  AlertTriangle,
  FileText,
} from 'lucide-react';
import { useErp } from '../contexts/ErpContext';
import { exportHeadersTemplate } from '../lib/exports';
import { todayIso } from '../lib/format';
import {
  commitImportedRows,
  IMPORT_TARGET_META,
  ImportTarget,
  ParsedSpreadsheetResult,
  parseSpreadsheetFile,
} from '../lib/spreadsheet';
import {
  Modal,
  btnPrimaryCls,
  btnSecondaryCls,
  inputCls,
  labelCls,
} from './ui/DataUI';

interface ImportSpreadsheetModalProps {
  open: boolean;
  onClose: () => void;
  defaultTarget?: ImportTarget;
  allowTargetSwitch?: boolean;
  moduleId?: string;
  moduleLabel?: string;
}

const ALL_CORE_TARGETS: ImportTarget[] = [
  'products',
  'customers',
  'leads',
  'suppliers',
  'employees',
  'accounts',
];

export const ImportSpreadsheetModal: React.FC<ImportSpreadsheetModalProps> = ({
  open,
  onClose,
  defaultTarget = 'products',
  allowTargetSwitch = false,
  moduleId,
  moduleLabel,
}) => {
  const { user, activeCompany, warehouses, notify } = useErp();
  const [target, setTarget] = useState<ImportTarget>(defaultTarget);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [parsed, setParsed] = useState<ParsedSpreadsheetResult | null>(null);
  const [parsing, setParsing] = useState(false);
  const [importing, setImporting] = useState(false);
  const inputRef = useRef<HTMLInputElement | null>(null);

  useEffect(() => {
    if (open) {
      setTarget(defaultTarget);
      setSelectedFile(null);
      setParsed(null);
    }
  }, [open, defaultTarget]);

  const meta = useMemo(() => IMPORT_TARGET_META[target], [target]);
  const defaultWarehouseId = warehouses[0]?.id;

  const handleFilePick = async (file: File | null) => {
    if (!file) return;
    setSelectedFile(file);
    setParsing(true);
    try {
      const result = await parseSpreadsheetFile(file, target, {
        moduleId,
        defaultWarehouseId,
      });
      setParsed(result);
      if (result.rows.length === 0) {
        notify('Le fichier sélectionné ne contient aucune ligne exploitable.', 'warning');
      }
    } catch (err) {
      notify(err instanceof Error ? err.message : 'Impossible de lire ce fichier CSV ou Excel.', 'error');
      setParsed(null);
    } finally {
      setParsing(false);
    }
  };

  const handleTargetChange = async (next: ImportTarget) => {
    setTarget(next);
    if (selectedFile) {
      setParsing(true);
      try {
        const result = await parseSpreadsheetFile(selectedFile, next, {
          moduleId,
          defaultWarehouseId,
        });
        setParsed(result);
      } catch {
        setParsed(null);
      } finally {
        setParsing(false);
      }
    }
  };

  const handleCommit = async () => {
    if (!activeCompany || !user || !parsed || parsed.validCount === 0) return;
    setImporting(true);
    try {
      const count = await commitImportedRows({
        companyId: activeCompany.id,
        target,
        rows: parsed.rows,
        uid: user.uid,
        email: user.email || '',
        ownerId: activeCompany.ownerId,
        memberUids: activeCompany.memberUids,
      });
      notify(`${count} enregistrement(s) importé(s) dans ${moduleLabel || meta.label}.`, 'success');
      onClose();
    } catch (err) {
      notify(err instanceof Error ? err.message : 'Erreur lors de l’importation en base de données.', 'error');
    } finally {
      setImporting(false);
    }
  };

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={`Importer un fichier CSV ou Excel : ${moduleLabel || meta.label}`}
      maxWidth="max-w-3xl"
    >
      <div className="space-y-4">
        {allowTargetSwitch && (
          <div>
            <label className={labelCls}>Données à importer dans l’espace</label>
            <select
              className={inputCls}
              value={target}
              onChange={(e) => handleTargetChange(e.target.value as ImportTarget)}
            >
              {ALL_CORE_TARGETS.map((id) => (
                <option key={id} value={id}>
                  {IMPORT_TARGET_META[id].label}
                </option>
              ))}
            </select>
          </div>
        )}

        <div className="rounded-xl border border-[#E6E8EC] dark:border-[#262933] bg-[#F5F6F8] dark:bg-[#0D0E12] p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div className="space-y-1">
            <p className="text-xs font-bold text-[#111216] dark:text-white">{meta.description}</p>
            <p className="text-[11px] text-slate-500 dark:text-slate-400">
              Colonnes attendues : {meta.templateHeaders.join(', ')} ({meta.requiredHint})
            </p>
          </div>
          <div className="flex items-center gap-2 shrink-0">
            <button
              type="button"
              onClick={() =>
                exportHeadersTemplate(
                  meta.templateHeaders,
                  'csv',
                  `Modele_${target}_${todayIso()}`
                )
              }
              className={btnSecondaryCls}
            >
              <Download className="w-3.5 h-3.5" /> Modèle CSV
            </button>
            <button
              type="button"
              onClick={() =>
                exportHeadersTemplate(
                  meta.templateHeaders,
                  'xlsx',
                  `Modele_${target}_${todayIso()}`,
                  meta.label
                )
              }
              className={btnSecondaryCls}
            >
              <FileSpreadsheet className="w-3.5 h-3.5" /> Modèle Excel
            </button>
          </div>
        </div>

        {/* File Picker */}
        <div
          onClick={() => inputRef.current?.click()}
          onDragOver={(e) => e.preventDefault()}
          onDrop={(e) => {
            e.preventDefault();
            const file = e.dataTransfer.files?.[0] || null;
            handleFilePick(file);
          }}
          className="border-2 border-dashed border-slate-300 dark:border-slate-700 hover:border-[#FC3F1D] rounded-xl p-6 text-center cursor-pointer transition-colors bg-white dark:bg-[#16181F]"
        >
          <input
            ref={inputRef}
            type="file"
            accept=".csv,.xlsx,.xls,text/csv,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet,application/vnd.ms-excel"
            className="hidden"
            onChange={(e) => handleFilePick(e.target.files?.[0] || null)}
          />
          <Upload className="w-7 h-7 text-[#FC3F1D] mx-auto mb-2" />
          <p className="text-sm font-semibold text-[#111216] dark:text-white">
            {selectedFile ? selectedFile.name : 'Cliquez ou déposez un fichier CSV ou Excel (.xlsx, .xls, .csv)'}
          </p>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
            {parsing
              ? 'Analyse du fichier en cours...'
              : 'Séparateurs virgule ou point-virgule acceptés automatiquement'}
          </p>
        </div>

        {/* Parsed Preview */}
        {parsed && (
          <div className="space-y-3">
            <div className="flex flex-wrap items-center justify-between gap-2 text-xs">
              <div className="flex items-center gap-4">
                <span className="inline-flex items-center gap-1.5 font-semibold text-emerald-600 dark:text-emerald-400">
                  <CheckCircle2 className="w-4 h-4" /> {parsed.validCount} ligne(s) valide(s)
                </span>
                {parsed.errorCount > 0 && (
                  <span className="inline-flex items-center gap-1.5 font-semibold text-amber-600 dark:text-amber-400">
                    <AlertTriangle className="w-4 h-4" /> {parsed.errorCount} ligne(s) ignorée(s)
                  </span>
                )}
              </div>
              <span className="text-[11px] text-slate-500">
                <FileText className="w-3.5 h-3.5 inline mr-1" />
                {parsed.detectedHeaders.length} colonne(s) détectée(s)
              </span>
            </div>

            {parsed.rows.length > 0 && (
              <div className="max-h-60 overflow-y-auto border border-[#E6E8EC] dark:border-[#262933] rounded-xl">
                <table className="w-full text-left border-collapse text-xs">
                  <thead>
                    <tr className="bg-[#F5F6F8] dark:bg-[#0D0E12] border-b border-[#E6E8EC] dark:border-[#262933] text-slate-500">
                      <th className="py-2 px-3 font-semibold">Ligne</th>
                      <th className="py-2 px-3 font-semibold">Élément</th>
                      <th className="py-2 px-3 font-semibold">Détails</th>
                      <th className="py-2 px-3 font-semibold">Validation</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-[#E6E8EC] dark:divide-[#262933]">
                    {parsed.rows.slice(0, 80).map((row) => (
                      <tr key={row.rowIndex}>
                        <td className="py-2 px-3 font-mono text-slate-500">#{row.rowIndex}</td>
                        <td className="py-2 px-3 font-semibold text-[#111216] dark:text-white">
                          {row.previewTitle}
                        </td>
                        <td className="py-2 px-3 text-slate-500 dark:text-slate-400">
                          {row.previewSubtitle}
                        </td>
                        <td className="py-2 px-3">
                          {row.valid ? (
                            <span className="text-emerald-600 dark:text-emerald-400 font-semibold">Prêt</span>
                          ) : (
                            <span className="text-red-600 dark:text-red-400 font-semibold">
                              {row.error || 'Invalide'}
                            </span>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        )}

        <div className="flex justify-end gap-2 pt-2">
          <button type="button" onClick={onClose} className={btnSecondaryCls}>
            Fermer
          </button>
          <button
            type="button"
            disabled={importing || parsing || !parsed || parsed.validCount === 0}
            onClick={handleCommit}
            className={btnPrimaryCls}
          >
            <Upload className="w-3.5 h-3.5" />
            {importing
              ? 'Importation en cours...'
              : `Importer ${parsed?.validCount || 0} ligne(s)`}
          </button>
        </div>
      </div>
    </Modal>
  );
};
