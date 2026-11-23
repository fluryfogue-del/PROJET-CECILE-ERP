import React, { useMemo, useState } from 'react';
import { Plus, ArrowRightLeft, AlertTriangle, Edit3, Trash2, Upload, Download, FileSpreadsheet } from 'lucide-react';
import { useErp } from '../../contexts/ErpContext';
import { formatDateFr, formatMoney, formatNumber, todayIso } from '../../lib/format';
import { exportRowsCsv, exportWorkbookExcel } from '../../lib/exports';
import { createErpDoc, deleteErpDoc, executeStockMovement, updateErpDoc } from '../../services/erpEngine';
import { Product } from '../../types/erp';
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

export const InventoryView: React.FC = () => {
  const {
    user,
    activeCompany,
    products,
    categories,
    warehouses,
    stockMovements,
    notify,
  } = useErp();

  const [tab, setTab] = useState<'products' | 'movements' | 'warehouses' | 'categories'>('products');
  const [prodModal, setProdModal] = useState(false);
  const [editingProd, setEditingProd] = useState<Product | null>(null);
  const [prodForm, setProdForm] = useState({
    sku: '',
    name: '',
    categoryId: '',
    unit: 'Unité',
    purchasePrice: 0,
    salePrice: 0,
    taxRate: 0,
    stockQty: 0,
    minStock: 0,
  });

  // Movement Modal
  const [movModal, setMovModal] = useState(false);
  const [movForm, setMovForm] = useState({
    productId: '',
    warehouseId: '',
    toWarehouseId: '',
    type: 'entree' as 'entree' | 'sortie' | 'transfert' | 'inventaire',
    quantity: 1,
    note: '',
  });

  // Warehouse Modal
  const [whModal, setWhModal] = useState(false);
  const [whForm, setWhForm] = useState({ code: '', name: '', location: '', managerName: '' });

  // Category Modal
  const [catModal, setCatModal] = useState(false);
  const [catForm, setCatForm] = useState({ code: '', name: '', description: '' });
  const [importOpen, setImportOpen] = useState(false);

  const currency = activeCompany?.currency || 'XAF';

  const valuation = useMemo(() => {
    const totalUnits = products.reduce((s, p) => s + (p.stockQty || 0), 0);
    const costValue = products.reduce((s, p) => s + (p.stockQty || 0) * (p.purchasePrice || 0), 0);
    const retailValue = products.reduce((s, p) => s + (p.stockQty || 0) * (p.salePrice || 0), 0);
    const alertsCount = products.filter((p) => p.stockQty <= p.minStock).length;
    return { totalUnits, costValue, retailValue, alertsCount };
  }, [products]);

  if (!activeCompany || !user) return null;
  const ownerId = activeCompany.ownerId;
  const memberUids = activeCompany.memberUids;

  const openProdForm = (p?: Product) => {
    if (p) {
      setEditingProd(p);
      setProdForm({
        sku: p.sku,
        name: p.name,
        categoryId: p.categoryId || '',
        unit: p.unit || 'Unité',
        purchasePrice: p.purchasePrice,
        salePrice: p.salePrice,
        taxRate: p.taxRate ?? 19.25,
        stockQty: p.stockQty,
        minStock: p.minStock,
      });
    } else {
      setEditingProd(null);
      setProdForm({
        sku: `PRD-${String(products.length + 1).padStart(3, '0')}`,
        name: '',
        categoryId: categories[0]?.id || '',
        unit: 'Unité',
        purchasePrice: 0,
        salePrice: 0,
        taxRate: 0,
        stockQty: 0,
        minStock: 0,
      });
    }
    setProdModal(true);
  };

  const saveProduct = async (e: React.FormEvent) => {
    e.preventDefault();
    const cleanSku = prodForm.sku.trim();
    const cleanName = prodForm.name.trim();
    const cleanUnit = prodForm.unit.trim() || 'Unité';
    if (!cleanSku || cleanName.length < 2) {
      notify('La référence SKU et la désignation du produit sont obligatoires.', 'error');
      return;
    }
    const cat = categories.find((c) => c.id === prodForm.categoryId);
    const defaultWh = warehouses[0]?.id;
    try {
      if (editingProd) {
        await updateErpDoc(activeCompany.id, 'products', editingProd.id, {
          sku: cleanSku,
          name: cleanName,
          categoryId: prodForm.categoryId,
          categoryName: cat?.name || 'Général',
          unit: cleanUnit,
          purchasePrice: Number(prodForm.purchasePrice) || 0,
          salePrice: Number(prodForm.salePrice) || 0,
          taxRate: Number(prodForm.taxRate) || 0,
          minStock: Number(prodForm.minStock) || 0,
        });
        notify('Article mis à jour.', 'success');
      } else {
        await createErpDoc(
          activeCompany.id,
          'products',
          {
            ...prodForm,
            sku: cleanSku,
            name: cleanName,
            unit: cleanUnit,
            categoryName: cat?.name || 'Général',
            purchasePrice: Number(prodForm.purchasePrice) || 0,
            salePrice: Number(prodForm.salePrice) || 0,
            taxRate: Number(prodForm.taxRate) || 0,
            stockQty: Number(prodForm.stockQty) || 0,
            minStock: Number(prodForm.minStock) || 0,
            warehouseStocks: defaultWh ? { [defaultWh]: Number(prodForm.stockQty) || 0 } : {},
            trackStock: true,
            isDemo: false,
          },
          ownerId,
          memberUids
        );
        notify('Article créé en catalogue.', 'success');
      }
      setProdModal(false);
    } catch (err) {
      notify(err instanceof Error ? err.message : 'Erreur produit', 'error');
    }
  };

  const openMovementModal = () => {
    setMovForm({
      productId: products[0]?.id || '',
      warehouseId: warehouses[0]?.id || '',
      toWarehouseId: warehouses[1]?.id || warehouses[0]?.id || '',
      type: 'entree',
      quantity: 1,
      note: '',
    });
    setMovModal(true);
  };

  const saveMovement = async (e: React.FormEvent) => {
    e.preventDefault();
    const product = products.find((p) => p.id === movForm.productId);
    const wh = warehouses.find((w) => w.id === movForm.warehouseId);
    const toWh = warehouses.find((w) => w.id === movForm.toWarehouseId);
    if (!product || !wh) return;

    try {
      await executeStockMovement({
        companyId: activeCompany.id,
        product,
        warehouseId: wh.id,
        warehouseName: wh.name,
        toWarehouseId: movForm.type === 'transfert' ? toWh?.id : undefined,
        toWarehouseName: movForm.type === 'transfert' ? toWh?.name : undefined,
        type: movForm.type,
        quantity: Number(movForm.quantity),
        note: movForm.note,
        uid: user.uid,
        email: user.email || '',
        ownerId,
        memberUids,
      });
      notify('Mouvement de stock enregistré.', 'success');
      setMovModal(false);
    } catch (err) {
      notify(err instanceof Error ? err.message : 'Erreur mouvement stock', 'error');
    }
  };

  const exportInventoryCsv = () => {
    if (tab === 'movements') {
      exportRowsCsv(
        stockMovements.map((m) => ({
          Date: m.date,
          Type: m.type,
          Article: m.productName,
          Entrepot: m.warehouseName,
          Destination: m.toWarehouseName || '',
          Quantite: m.quantity,
          Valorisation: m.totalValue,
          Reference: m.referenceNumber || m.note || '',
        })),
        `Mouvements_Stock_${todayIso()}`
      );
    } else if (tab === 'warehouses') {
      exportRowsCsv(
        warehouses.map((w) => ({
          Code: w.code,
          Nom: w.name,
          Localisation: w.location || '',
          Responsable: w.managerName || '',
          Principal: w.isDefault ? 'Oui' : 'Non',
        })),
        `Entrepots_${todayIso()}`
      );
    } else if (tab === 'categories') {
      exportRowsCsv(
        categories.map((c) => ({
          Code: c.code,
          Nom: c.name,
          Description: c.description || '',
        })),
        `Categories_${todayIso()}`
      );
    } else {
      exportRowsCsv(
        products.map((p) => ({
          SKU: p.sku,
          Designation: p.name,
          Categorie: p.categoryName || 'Général',
          Unite: p.unit || 'Unité',
          PrixAchat: p.purchasePrice,
          PrixVente: p.salePrice,
          TVA: p.taxRate ?? 19.25,
          Stock: p.stockQty,
          SeuilMin: p.minStock,
        })),
        `Catalogue_Articles_${todayIso()}`
      );
    }
    notify('Export CSV téléchargé.', 'success');
  };

  const exportInventoryExcel = () => {
    exportWorkbookExcel(
      [
        {
          name: 'Articles & Stocks',
          rows: products.map((p) => ({
            SKU: p.sku,
            Designation: p.name,
            Categorie: p.categoryName || 'Général',
            Unite: p.unit || 'Unité',
            PrixAchat: p.purchasePrice,
            PrixVente: p.salePrice,
            TVA: p.taxRate ?? 19.25,
            Stock: p.stockQty,
            SeuilMin: p.minStock,
          })),
        },
        {
          name: 'Mouvements Stock',
          rows: stockMovements.map((m) => ({
            Date: m.date,
            Type: m.type,
            Article: m.productName,
            Entrepot: m.warehouseName,
            Destination: m.toWarehouseName || '',
            Quantite: m.quantity,
            Valorisation: m.totalValue,
            Reference: m.referenceNumber || m.note || '',
          })),
        },
        {
          name: 'Entrepots',
          rows: warehouses.map((w) => ({
            Code: w.code,
            Nom: w.name,
            Localisation: w.location || '',
            Responsable: w.managerName || '',
          })),
        },
      ],
      `Stocks_FUREX_${todayIso()}`
    );
    notify('Classeur Excel téléchargé.', 'success');
  };

  return (
    <div className="space-y-6">
      <PageHeader
        title="Stocks & Entrepôts"
        subtitle="Catalogue articles, valorisation, seuils minimum, transferts inter-entrepôts et traçabilité complète"
        actions={
          <>
            <button type="button" onClick={() => setImportOpen(true)} className={btnSecondaryCls}>
              <Upload className="w-3.5 h-3.5" /> Importer CSV/Excel
            </button>
            <button type="button" onClick={exportInventoryCsv} className={btnSecondaryCls}>
              <Download className="w-3.5 h-3.5" /> CSV
            </button>
            <button type="button" onClick={exportInventoryExcel} className={btnSecondaryCls}>
              <FileSpreadsheet className="w-3.5 h-3.5" /> Excel
            </button>
            <button type="button" onClick={openMovementModal} className={btnSecondaryCls}>
              <ArrowRightLeft className="w-3.5 h-3.5" /> Mouvement / Transfert
            </button>
            <button type="button" onClick={() => openProdForm()} className={btnPrimaryCls}>
              <Plus className="w-3.5 h-3.5" /> Nouvel article
            </button>
          </>
        }
      />

      {/* Valuation Strip */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-white dark:bg-[#16181F] border border-slate-200 dark:border-slate-800 rounded-lg p-4">
          <p className="text-xs text-slate-500">Quantité totale en stock</p>
          <p className="mt-1 font-mono text-lg font-bold tabular-nums">{formatNumber(valuation.totalUnits)} unités</p>
        </div>
        <div className="bg-white dark:bg-[#16181F] border border-slate-200 dark:border-slate-800 rounded-lg p-4">
          <p className="text-xs text-slate-500">Valorisation (Coût d’achat)</p>
          <p className="mt-1 font-mono text-lg font-bold tabular-nums">{formatMoney(valuation.costValue, currency)}</p>
        </div>
        <div className="bg-white dark:bg-[#16181F] border border-slate-200 dark:border-slate-800 rounded-lg p-4">
          <p className="text-xs text-slate-500">Valeur potentielle (Vente HT)</p>
          <p className="mt-1 font-mono text-lg font-bold tabular-nums text-[#FC3F1D]">
            {formatMoney(valuation.retailValue, currency)}
          </p>
        </div>
        <div className="bg-white dark:bg-[#16181F] border border-slate-200 dark:border-slate-800 rounded-lg p-4">
          <p className="text-xs text-slate-500">Alertes stock minimum</p>
          <p className={`mt-1 font-mono text-lg font-bold tabular-nums ${valuation.alertsCount > 0 ? 'text-amber-600' : 'text-emerald-600'}`}>
            {valuation.alertsCount} article(s)
          </p>
        </div>
      </div>

      <SegmentedTabs
        activeId={tab}
        onChange={(id) => setTab(id as typeof tab)}
        tabs={[
          { id: 'products', label: 'Articles & Niveaux', count: products.length },
          { id: 'movements', label: 'Journal des mouvements', count: stockMovements.length },
          { id: 'warehouses', label: 'Entrepôts', count: warehouses.length },
          { id: 'categories', label: 'Catégories', count: categories.length },
        ]}
      />

      {tab === 'products' && (
        <div className="bg-white dark:bg-[#16181F] border border-slate-200 dark:border-slate-800 rounded-lg overflow-x-auto">
          {products.length === 0 ? (
            <EmptyState
              title="Aucun produit"
              description="Ajoutez vos articles pour activer la gestion des stocks, ventes et achats."
              actionLabel="Créer un article"
              onAction={() => openProdForm()}
            />
          ) : (
            <table className="w-full text-left border-collapse text-xs">
              <thead>
                <tr className="border-b border-slate-200 dark:border-slate-800 text-slate-500">
                  <th className="py-3 px-4 font-medium">SKU</th>
                  <th className="py-3 px-4 font-medium">Article / Catégorie</th>
                  <th className="py-3 px-4 font-medium text-right">Coût achat</th>
                  <th className="py-3 px-4 font-medium text-right">Prix vente</th>
                  <th className="py-3 px-4 font-medium text-right">Stock actuel</th>
                  <th className="py-3 px-4 font-medium">État</th>
                  <th className="py-3 px-4 font-medium text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800/80">
                {products.map((p) => {
                  const low = p.stockQty <= p.minStock;
                  return (
                    <tr key={p.id} className="hover:bg-slate-50/70 dark:hover:bg-slate-800/40">
                      <td className="py-3 px-4 font-mono">{p.sku}</td>
                      <td className="py-3 px-4">
                        <p className="font-semibold text-slate-900 dark:text-white">{p.name}</p>
                        <p className="text-slate-400">{p.categoryName || 'Général'}</p>
                      </td>
                      <td className="py-3 px-4 text-right font-mono tabular-nums">{formatMoney(p.purchasePrice, currency)}</td>
                      <td className="py-3 px-4 text-right font-mono tabular-nums font-medium">{formatMoney(p.salePrice, currency)}</td>
                      <td className="py-3 px-4 text-right font-mono tabular-nums font-bold">
                        {p.stockQty} <span className="font-normal text-slate-400">/ min {p.minStock}</span>
                      </td>
                      <td className="py-3 px-4">
                        {low ? (
                          <StatusLabel label="Stock critique" tone="warning" />
                        ) : (
                          <StatusLabel label="Nominal" tone="success" />
                        )}
                      </td>
                      <td className="py-3 px-4 text-right">
                        <div className="inline-flex items-center gap-1">
                          <button type="button" onClick={() => openProdForm(p)} className="p-1.5 text-slate-500 hover:text-slate-900 dark:hover:text-white">
                            <Edit3 className="w-3.5 h-3.5" />
                          </button>
                          <button type="button" onClick={() => deleteErpDoc(activeCompany.id, 'products', p.id)} className="p-1.5 text-slate-500 hover:text-red-600">
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          )}
        </div>
      )}

      {tab === 'movements' && (
        <div className="bg-white dark:bg-[#16181F] border border-slate-200 dark:border-slate-800 rounded-lg overflow-x-auto">
          {stockMovements.length === 0 ? (
            <EmptyState title="Aucun mouvement" description="Les entrées, sorties et transferts apparaîtront ici." />
          ) : (
            <table className="w-full text-left border-collapse text-xs">
              <thead>
                <tr className="border-b border-slate-200 dark:border-slate-800 text-slate-500">
                  <th className="py-3 px-4 font-medium">Date</th>
                  <th className="py-3 px-4 font-medium">Type</th>
                  <th className="py-3 px-4 font-medium">Article</th>
                  <th className="py-3 px-4 font-medium">Entrepôt</th>
                  <th className="py-3 px-4 font-medium text-right">Quantité</th>
                  <th className="py-3 px-4 font-medium text-right">Valorisation</th>
                  <th className="py-3 px-4 font-medium">Référence / Note</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800/80">
                {stockMovements.map((m) => (
                  <tr key={m.id}>
                    <td className="py-3 px-4 text-slate-500">{formatDateFr(m.date)}</td>
                    <td className="py-3 px-4">
                      <StatusLabel
                        label={m.type.toUpperCase()}
                        tone={m.type === 'entree' ? 'success' : m.type === 'sortie' ? 'danger' : 'info'}
                      />
                    </td>
                    <td className="py-3 px-4 font-medium">{m.productName}</td>
                    <td className="py-3 px-4 text-slate-600 dark:text-slate-300">
                      {m.warehouseName}
                      {m.toWarehouseName ? ` → ${m.toWarehouseName}` : ''}
                    </td>
                    <td className="py-3 px-4 text-right font-mono tabular-nums font-semibold">{m.quantity}</td>
                    <td className="py-3 px-4 text-right font-mono tabular-nums">{formatMoney(m.totalValue, currency)}</td>
                    <td className="py-3 px-4 text-slate-500">{m.referenceNumber || m.note || '-'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      )}

      {tab === 'warehouses' && (
        <div className="space-y-3">
          <div className="flex justify-end">
            <button type="button" onClick={() => setWhModal(true)} className={btnPrimaryCls}>
              <Plus className="w-3.5 h-3.5" /> Nouvel entrepôt
            </button>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {warehouses.map((w) => (
              <div key={w.id} className="bg-white dark:bg-[#16181F] border border-slate-200 dark:border-slate-800 rounded-lg p-4">
                <div className="flex items-center justify-between">
                  <span className="font-mono text-xs text-[#FC3F1D] font-semibold">{w.code}</span>
                  {w.isDefault && <StatusLabel label="Principal" tone="info" />}
                </div>
                <p className="font-display font-semibold text-sm mt-1">{w.name}</p>
                <p className="text-xs text-slate-500 mt-1">{w.location || 'Adresse non renseignée'} · Resp : {w.managerName || '-'}</p>
              </div>
            ))}
          </div>
        </div>
      )}

      {tab === 'categories' && (
        <div className="space-y-3">
          <div className="flex justify-end">
            <button type="button" onClick={() => setCatModal(true)} className={btnPrimaryCls}>
              <Plus className="w-3.5 h-3.5" /> Nouvelle catégorie
            </button>
          </div>
          <div className="bg-white dark:bg-[#16181F] border border-slate-200 dark:border-slate-800 rounded-lg divide-y divide-slate-100 dark:divide-slate-800">
            {categories.map((c) => (
              <div key={c.id} className="p-4 flex items-center justify-between">
                <div>
                  <span className="font-mono text-xs text-[#FC3F1D] mr-2">{c.code}</span>
                  <span className="text-sm font-semibold">{c.name}</span>
                  {c.description && <p className="text-xs text-slate-500 mt-0.5">{c.description}</p>}
                </div>
                <button type="button" onClick={() => deleteErpDoc(activeCompany.id, 'categories', c.id)} className="p-1.5 text-slate-400 hover:text-red-600">
                  <Trash2 className="w-3.5 h-3.5" />
                </button>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Product Modal */}
      <Modal open={prodModal} title={editingProd ? 'Modifier l’article' : 'Nouvel article'} onClose={() => setProdModal(false)}>
        <form onSubmit={saveProduct} className="space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className={labelCls}>Référence SKU *</label>
              <input required className={inputCls} value={prodForm.sku} onChange={(e) => setProdForm({ ...prodForm, sku: e.target.value })} />
            </div>
            <div>
              <label className={labelCls}>Désignation *</label>
              <input required className={inputCls} value={prodForm.name} onChange={(e) => setProdForm({ ...prodForm, name: e.target.value })} />
            </div>
            <div>
              <label className={labelCls}>Catégorie</label>
              <select className={inputCls} value={prodForm.categoryId} onChange={(e) => setProdForm({ ...prodForm, categoryId: e.target.value })}>
                <option value="">Général</option>
                {categories.map((c) => (
                  <option key={c.id} value={c.id}>{c.name}</option>
                ))}
              </select>
            </div>
            <div>
              <label className={labelCls}>Unité</label>
              <input className={inputCls} value={prodForm.unit} onChange={(e) => setProdForm({ ...prodForm, unit: e.target.value })} />
            </div>
            <div>
              <label className={labelCls}>Prix d’achat ({currency})</label>
              <input type="number" min="0" required className={inputCls} value={prodForm.purchasePrice} onChange={(e) => setProdForm({ ...prodForm, purchasePrice: Number(e.target.value) })} />
            </div>
            <div>
              <label className={labelCls}>Prix de vente ({currency})</label>
              <input type="number" min="0" required className={inputCls} value={prodForm.salePrice} onChange={(e) => setProdForm({ ...prodForm, salePrice: Number(e.target.value) })} />
            </div>
            <div>
              <label className={labelCls}>TVA (%)</label>
              <input type="number" min="0" max="100" step="0.01" className={inputCls} value={prodForm.taxRate} onChange={(e) => setProdForm({ ...prodForm, taxRate: Number(e.target.value) })} />
            </div>
            {!editingProd && (
              <div>
                <label className={labelCls}>Stock initial</label>
                <input type="number" min="0" className={inputCls} value={prodForm.stockQty} onChange={(e) => setProdForm({ ...prodForm, stockQty: Number(e.target.value) })} />
              </div>
            )}
            <div>
              <label className={labelCls}>Seuil d’alerte minimum</label>
              <input type="number" min="0" className={inputCls} value={prodForm.minStock} onChange={(e) => setProdForm({ ...prodForm, minStock: Number(e.target.value) })} />
            </div>
          </div>
          <div className="flex justify-end gap-2">
            <button type="button" onClick={() => setProdModal(false)} className={btnSecondaryCls}>Annuler</button>
            <button type="submit" className={btnPrimaryCls}>Enregistrer</button>
          </div>
        </form>
      </Modal>

      {/* Stock Movement Modal */}
      <Modal open={movModal} title="Mouvement / Transfert / Inventaire" onClose={() => setMovModal(false)}>
        <form onSubmit={saveMovement} className="space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className={labelCls}>Type d’opération</label>
              <select className={inputCls} value={movForm.type} onChange={(e) => setMovForm({ ...movForm, type: e.target.value as typeof movForm.type })}>
                <option value="entree">Entrée de stock</option>
                <option value="sortie">Sortie de stock</option>
                <option value="transfert">Transfert entre entrepôts</option>
                <option value="inventaire">Ajustement d’inventaire</option>
              </select>
            </div>
            <div>
              <label className={labelCls}>Article *</label>
              <select required className={inputCls} value={movForm.productId} onChange={(e) => setMovForm({ ...movForm, productId: e.target.value })}>
                {products.map((p) => (
                  <option key={p.id} value={p.id}>{p.sku} · {p.name} ({p.stockQty})</option>
                ))}
              </select>
            </div>
            <div>
              <label className={labelCls}>Entrepôt {movForm.type === 'transfert' ? 'source' : ''}</label>
              <select required className={inputCls} value={movForm.warehouseId} onChange={(e) => setMovForm({ ...movForm, warehouseId: e.target.value })}>
                {warehouses.map((w) => (
                  <option key={w.id} value={w.id}>{w.name}</option>
                ))}
              </select>
            </div>
            {movForm.type === 'transfert' && (
              <div>
                <label className={labelCls}>Entrepôt destination</label>
                <select required className={inputCls} value={movForm.toWarehouseId} onChange={(e) => setMovForm({ ...movForm, toWarehouseId: e.target.value })}>
                  {warehouses.map((w) => (
                    <option key={w.id} value={w.id}>{w.name}</option>
                  ))}
                </select>
              </div>
            )}
            <div>
              <label className={labelCls}>{movForm.type === 'inventaire' ? 'Nouvelle quantité comptée' : 'Quantité'}</label>
              <input type="number" min="0" required className={inputCls} value={movForm.quantity} onChange={(e) => setMovForm({ ...movForm, quantity: Number(e.target.value) })} />
            </div>
            <div>
              <label className={labelCls}>Motif / Note</label>
              <input className={inputCls} value={movForm.note} onChange={(e) => setMovForm({ ...movForm, note: e.target.value })} />
            </div>
          </div>
          {products.some((p) => p.stockQty <= p.minStock) && (
            <div className="flex items-center gap-2 text-xs text-amber-700 dark:text-amber-400">
              <AlertTriangle className="w-4 h-4 shrink-0" />
              <span>Astuce : toute sortie ramenant un article sous son seuil génère une notification automatique.</span>
            </div>
          )}
          <div className="flex justify-end gap-2">
            <button type="button" onClick={() => setMovModal(false)} className={btnSecondaryCls}>Annuler</button>
            <button type="submit" className={btnPrimaryCls}>Valider le mouvement</button>
          </div>
        </form>
      </Modal>

      {/* Warehouse Modal */}
      <Modal open={whModal} title="Nouvel entrepôt" onClose={() => setWhModal(false)} maxWidth="max-w-md">
        <form
          onSubmit={async (e) => {
            e.preventDefault();
            await createErpDoc(activeCompany.id, 'warehouses', { ...whForm, isDefault: false, isDemo: false }, ownerId, memberUids);
            notify('Entrepôt ajouté.', 'success');
            setWhModal(false);
          }}
          className="space-y-4"
        >
          <div>
            <label className={labelCls}>Code *</label>
            <input required className={inputCls} value={whForm.code} onChange={(e) => setWhForm({ ...whForm, code: e.target.value })} placeholder="ENT-03" />
          </div>
          <div>
            <label className={labelCls}>Nom *</label>
            <input required className={inputCls} value={whForm.name} onChange={(e) => setWhForm({ ...whForm, name: e.target.value })} />
          </div>
          <div>
            <label className={labelCls}>Localisation</label>
            <input className={inputCls} value={whForm.location} onChange={(e) => setWhForm({ ...whForm, location: e.target.value })} />
          </div>
          <div>
            <label className={labelCls}>Responsable</label>
            <input className={inputCls} value={whForm.managerName} onChange={(e) => setWhForm({ ...whForm, managerName: e.target.value })} />
          </div>
          <div className="flex justify-end gap-2">
            <button type="button" onClick={() => setWhModal(false)} className={btnSecondaryCls}>Annuler</button>
            <button type="submit" className={btnPrimaryCls}>Créer</button>
          </div>
        </form>
      </Modal>

      {/* Category Modal */}
      <Modal open={catModal} title="Nouvelle catégorie" onClose={() => setCatModal(false)} maxWidth="max-w-md">
        <form
          onSubmit={async (e) => {
            e.preventDefault();
            await createErpDoc(activeCompany.id, 'categories', { ...catForm, isDemo: false }, ownerId, memberUids);
            notify('Catégorie créée.', 'success');
            setCatModal(false);
          }}
          className="space-y-4"
        >
          <div>
            <label className={labelCls}>Code *</label>
            <input required className={inputCls} value={catForm.code} onChange={(e) => setCatForm({ ...catForm, code: e.target.value })} />
          </div>
          <div>
            <label className={labelCls}>Nom *</label>
            <input required className={inputCls} value={catForm.name} onChange={(e) => setCatForm({ ...catForm, name: e.target.value })} />
          </div>
          <div>
            <label className={labelCls}>Description</label>
            <input className={inputCls} value={catForm.description} onChange={(e) => setCatForm({ ...catForm, description: e.target.value })} />
          </div>
          <div className="flex justify-end gap-2">
            <button type="button" onClick={() => setCatModal(false)} className={btnSecondaryCls}>Annuler</button>
            <button type="submit" className={btnPrimaryCls}>Créer</button>
          </div>
        </form>
      </Modal>

      <ImportSpreadsheetModal
        open={importOpen}
        onClose={() => setImportOpen(false)}
        defaultTarget="products"
      />
    </div>
  );
};
