import React from 'react';
import { PageHeader } from '../ui/DataUI';

export const DocsView: React.FC = () => {
  return (
    <div className="space-y-6 max-w-4xl">
      <PageHeader
        title="Documentation Technique & Guide Utilisateur"
        subtitle="Projet CECILE — NEXUS ERP · Architecture, interconnexion des modules, plan OHADA et déploiement"
      />

      <section className="bg-white dark:bg-[#0B1426] border border-slate-200 dark:border-slate-800 rounded-lg p-6 space-y-3">
        <h2 className="font-display text-base font-bold text-slate-900 dark:text-white">
          1. Architecture Technique & Sécurité
        </h2>
        <ul className="text-xs text-slate-600 dark:text-slate-300 space-y-1.5 list-disc pl-5 leading-relaxed">
          <li><strong>Frontend modulaire</strong> : React 19, TypeScript strict, Tailwind CSS v4 (mode clair/sombre), Recharts, jsPDF (factures & rapports PDF) et SheetJS (export Excel).</li>
          <li><strong>Persistance & Temps réel</strong> : Cloud Firestore structuré par locataire (<code className="font-mono">/companies/&#123;companyId&#125;/...</code>) garantissant une isolation multi-société stricte.</li>
          <li><strong>Authentification & RBAC</strong> : Firebase Auth (Google Sign-In) couplé à une matrice de rôles par entreprise (Admin, Direction, Commercial, Comptable, Magasinier, RH) et à un journal d’audit immuable.</li>
          <li><strong>Couche IA extensible</strong> : Module <code className="font-mono">src/services/aiInsights.ts</code> prêt pour le branchement d’analyses prédictives avancées.</li>
        </ul>
      </section>

      <section className="bg-white dark:bg-[#0B1426] border border-slate-200 dark:border-slate-800 rounded-lg p-6 space-y-3">
        <h2 className="font-display text-base font-bold text-slate-900 dark:text-white">
          2. Interconnexion Transactionnelle des Modules
        </h2>
        <div className="text-xs text-slate-600 dark:text-slate-300 space-y-2 leading-relaxed">
          <p><strong>1. CRM → Ventes</strong> : Un prospect qualifié se convertit en fiche client en un clic. Le devis se transforme directement en commande client.</p>
          <p><strong>2. Ventes → Stocks</strong> : La validation d’une commande client vérifie la disponibilité en entrepôt, décrémente les quantités atomiquement et déclenche une alerte si le seuil minimum est atteint.</p>
          <p><strong>3. Ventes → Comptabilité OHADA</strong> : La facturation d’une commande génère automatiquement une écriture équilibrée au journal des ventes (<code className="font-mono">411 Débit / 701 + 443 Crédit</code>) et met à jour l’encours client.</p>
          <p><strong>4. Factures → Trésorerie → Comptabilité</strong> : Tout encaissement met à jour le statut de la facture (partielle/payée), crédite le compte bancaire ou la caisse, et passe l’écriture de trésorerie (<code className="font-mono">521/571 Débit / 411 Crédit</code>).</p>
          <p><strong>5. Achats → Stocks → Comptabilité</strong> : La réception d’une commande fournisseur augmente le stock, crée la facture fournisseur et passe l’écriture d’achat (<code className="font-mono">601 + 445 Débit / 401 Crédit</code>).</p>
          <p><strong>6. RH → Trésorerie → Comptabilité</strong> : Le versement d’un bulletin de paie débite la trésorerie et impute le compte de charges de personnel (<code className="font-mono">661 Débit / 521 Crédit</code>).</p>
        </div>
      </section>

      <section className="bg-white dark:bg-[#0B1426] border border-slate-200 dark:border-slate-800 rounded-lg p-6 space-y-3">
        <h2 className="font-display text-base font-bold text-slate-900 dark:text-white">
          3. Guide d’Utilisation Rapide
        </h2>
        <ol className="text-xs text-slate-600 dark:text-slate-300 space-y-1.5 list-decimal pl-5 leading-relaxed">
          <li><strong>Exploration</strong> : Naviguez via le menu latéral ou utilisez <code className="font-mono">Ctrl + K</code> pour la recherche globale instantanée.</li>
          <li><strong>Cycle de vente</strong> : Créez un devis dans <em>Ventes</em> → Convertissez en commande → Validez la sortie de stock → Facturez → Téléchargez le PDF → Encaissez.</li>
          <li><strong>Passage en production</strong> : Dans <em>Administration → Sauvegarde & Démo</em>, téléchargez une sauvegarde JSON ou supprimez les données de démonstration (<code className="font-mono">isDemo: true</code>) d’un clic.</li>
        </ol>
      </section>
    </div>
  );
};
