import React from 'react';
import { PageHeader } from '../ui/DataUI';

export const DocsView: React.FC = () => {
  return (
    <div className="space-y-6 max-w-4xl">
      <PageHeader
        title="Centre de Documentation & Référentiel Opérationnel"
        subtitle="JESSI · Architecture modulaire à 66+ applications, comptabilité SYSCOHADA et gouvernance des données"
      />

      <section className="bg-white dark:bg-[#16181F] border border-slate-200 dark:border-slate-800 rounded-2xl p-6 space-y-3">
        <h2 className="font-display text-base font-bold text-[#111216] dark:text-white">
          1. Architecture Modulaire Entreprise & Particulier
        </h2>
        <ul className="text-xs text-slate-600 dark:text-slate-300 space-y-1.5 list-disc pl-5 leading-relaxed">
          <li><strong>Espaces de travail sur mesure</strong> : Lors de la création de votre espace, vous sélectionnez votre profil (<strong>Entreprise</strong> ou <strong>Particulier</strong>) et activez librement vos modules parmi plus de 66 applications métiers.</li>
          <li><strong>Évolutivité permanente</strong> : Ajoutez de nouveaux modules à la volée depuis le <em>Catalogue Modules</em> ou créez vos propres modules personnalisés.</li>
          <li><strong>Persistance Cloud sécurisée</strong> : Chaque espace est isolé dans la base relationnelle Cloudflare D1 / SQL avec contrôle d’accès RBAC par rôle, département et journal d’audit immuable.</li>
        </ul>
      </section>

      <section className="bg-white dark:bg-[#16181F] border border-slate-200 dark:border-slate-800 rounded-2xl p-6 space-y-3">
        <h2 className="font-display text-base font-bold text-[#111216] dark:text-white">
          2. Interconnexion Transactionnelle des Modules
        </h2>
        <div className="text-xs text-slate-600 dark:text-slate-300 space-y-2 leading-relaxed">
          <p><strong>1. CRM → Ventes</strong> : Un prospect qualifié se convertit en fiche client en un clic. Le devis commercial se transforme directement en commande client.</p>
          <p><strong>2. Ventes → Stocks</strong> : La validation d’une commande vérifie la disponibilité en entrepôt, décrémente les quantités atomiquement et déclenche une alerte sous le seuil critique.</p>
          <p><strong>3. Ventes → Comptabilité OHADA</strong> : La facturation génère automatiquement une écriture équilibrée au journal des ventes (<code className="font-mono">411 Débit / 701 + 443 Crédit</code>) et met à jour l’encours client.</p>
          <p><strong>4. Factures → Trésorerie → Comptabilité</strong> : Tout encaissement met à jour le statut de la facture, crédite le compte bancaire ou la caisse, et passe l’écriture (<code className="font-mono">521/571 Débit / 411 Crédit</code>).</p>
          <p><strong>5. Achats → Stocks → Comptabilité</strong> : La réception d’un bon de commande augmente le stock, crée la facture fournisseur et comptabilise l’achat (<code className="font-mono">601 + 445 Débit / 401 Crédit</code>).</p>
          <p><strong>6. RH → Trésorerie → Comptabilité</strong> : Le versement d’un bulletin de paie débite la trésorerie et impute les charges de personnel (<code className="font-mono">661 Débit / 521 Crédit</code>).</p>
        </div>
      </section>

      <section className="bg-white dark:bg-[#16181F] border border-slate-200 dark:border-slate-800 rounded-2xl p-6 space-y-3">
        <h2 className="font-display text-base font-bold text-[#111216] dark:text-white">
          3. Guide de Démarrage Rapide
        </h2>
        <ol className="text-xs text-slate-600 dark:text-slate-300 space-y-1.5 list-decimal pl-5 leading-relaxed">
          <li><strong>Lanceur d’Applications</strong> : Accédez à vos modules activés depuis la grille principale ou utilisez <code className="font-mono">Ctrl + K</code> pour rechercher instantanément un client, un article, une facture ou un module.</li>
          <li><strong>Ajouts rapides</strong> : Créez à tout moment de nouveaux articles en stock, de nouveaux clients, des écritures comptables ou de nouveaux modules depuis le Catalogue.</li>
          <li><strong>Sauvegarde & Production</strong> : Dans <em>Administration → Sauvegarde & Démo</em>, exportez l’intégralité de vos données en JSON ou supprimez les données de démonstration en un clic.</li>
        </ol>
      </section>
    </div>
  );
};
