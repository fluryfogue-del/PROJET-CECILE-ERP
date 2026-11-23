import { Invoice, Opportunity, Product, Payment } from '../types/erp';
import { round2 } from '../lib/format';

export interface PredictiveInsight {
  id: string;
  category: 'stock' | 'tresorerie' | 'commercial' | 'creances';
  title: string;
  detail: string;
  priority: 'haute' | 'moyenne' | 'info';
  targetModule: 'inventory' | 'treasury' | 'crm' | 'sales';
}

/**
 * Couche analytique extensible (prête pour branchement d'un service IA prédictif externe).
 * Calcule des recommandations déterministes à partir des données réelles de l'entreprise.
 */
export function computePredictiveInsights(params: {
  products: Product[];
  invoices: Invoice[];
  opportunities: Opportunity[];
  payments: Payment[];
  totalTreasuryBalance: number;
}): PredictiveInsight[] {
  const insights: PredictiveInsight[] = [];

  // 1. Risques de rupture de stock
  const criticalProducts = params.products.filter((p) => p.stockQty <= p.minStock);
  if (criticalProducts.length > 0) {
    insights.push({
      id: 'ins-stock-alert',
      category: 'stock',
      title: `${criticalProducts.length} article(s) sous le seuil de sécurité`,
      detail: `Réapprovisionnement recommandé en priorité : ${criticalProducts
        .slice(0, 3)
        .map((p) => `${p.name} (${p.stockQty}/${p.minStock})`)
        .join(', ')}.`,
      priority: 'haute',
      targetModule: 'inventory',
    });
  }

  // 2. Recouvrement créances clients
  const unpaidInvoices = params.invoices.filter((i) => i.balanceDue > 0 && i.status !== 'annulee');
  const totalReceivable = unpaidInvoices.reduce((s, i) => s + i.balanceDue, 0);
  if (totalReceivable > 0) {
    const topInv = [...unpaidInvoices].sort((a, b) => b.balanceDue - a.balanceDue)[0];
    insights.push({
      id: 'ins-receivables',
      category: 'creances',
      title: `${unpaidInvoices.length} facture(s) à recouvrer`,
      detail: `Relance prioritaire suggérée pour ${topInv.customerName} (${topInv.number}) représentant ${Math.round(topInv.balanceDue).toLocaleString('fr-FR')} restants.`,
      priority: totalReceivable > params.totalTreasuryBalance * 0.4 ? 'haute' : 'moyenne',
      targetModule: 'sales',
    });
  }

  // 3. Prévision pondérée du pipeline commercial
  const activeOpps = params.opportunities.filter((o) => o.stage !== 'gagnee' && o.stage !== 'perdue');
  if (activeOpps.length > 0) {
    const weightedRevenue = round2(
      activeOpps.reduce((s, o) => s + o.amount * (o.probability / 100), 0)
    );
    insights.push({
      id: 'ins-pipeline',
      category: 'commercial',
      title: `Prévision commerciale pondérée : ${Math.round(weightedRevenue).toLocaleString('fr-FR')}`,
      detail: `Calculée sur ${activeOpps.length} opportunité(s) actives selon leur probabilité de signature.`,
      priority: 'info',
      targetModule: 'crm',
    });
  }

  // 4. Ratio encaissements / décaissements
  const inflows = params.payments
    .filter((p) => p.direction === 'encaissement')
    .reduce((s, p) => s + p.amount, 0);
  const outflows = params.payments
    .filter((p) => p.direction === 'decaissement')
    .reduce((s, p) => s + p.amount, 0);

  if (inflows > 0 || outflows > 0) {
    const netFlow = inflows - outflows;
    insights.push({
      id: 'ins-cashflow',
      category: 'tresorerie',
      title: netFlow >= 0 ? 'Flux de trésorerie net positif' : 'Tension sur les flux nets de trésorerie',
      detail: `Solde consolidé actuel : ${Math.round(params.totalTreasuryBalance).toLocaleString('fr-FR')} · Flux net enregistré : ${netFlow >= 0 ? '+' : ''}${Math.round(netFlow).toLocaleString('fr-FR')}.`,
      priority: netFlow < 0 ? 'haute' : 'info',
      targetModule: 'treasury',
    });
  }

  return insights;
}
