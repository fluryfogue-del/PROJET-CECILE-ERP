# Spécification de Sécurité — NEXUS ERP (Projet CECILE)

## 1. Invariants de Données
1. **Isolation Multi-Société (Master Gate)** : Aucun utilisateur ne peut lire, lister, créer, modifier ou supprimer un document sous `/companies/{companyId}/...` s'il n'est pas authentifié avec un e-mail vérifié et membre actif de la société `{companyId}`.
2. **Intégrité d'Identité** : Un utilisateur ne peut ni usurper `ownerId` ni s'auto-promouvoir `admin` lors de la création ou de la mise à jour d'un document `members`.
3. **Intégrité Temporelle** : Tous les horodatages `createdAt` et `updatedAt` doivent correspondre à `request.time`.
4. **Immuabilité Comptable & Audit** : Les écritures comptables (`journalEntries`) doivent être équilibrées (`totalDebit == totalCredit`) et les journaux d'audit (`auditLogs`) sont en écriture seule (non modifiables).
5. **Validation des Identifiants** : Tous les IDs de chemin respectent `^[a-zA-Z0-9_\-]+$` et `<= 128` caractères.

## 2. Les 12 Payloads Hostiles (« Dirty Dozen »)
1. **Usurpation de profil utilisateur** : Écriture sur `/users/autreUid` -> `PERMISSION_DENIED`.
2. **Création de société avec `ownerId` falsifié** : `ownerId != request.auth.uid` -> `PERMISSION_DENIED`.
3. **Shadow Update (champ fantôme)** : Injection d'un champ non autorisé `isSuperAdmin: true` sur `customers` -> `PERMISSION_DENIED`.
4. **Escalade de privilège membre** : Un utilisateur non-admin tente de modifier `roleCode: "admin"` sur son propre document `members/{uid}` -> `PERMISSION_DENIED`.
5. **Lecture croisée inter-entreprise** : Un utilisateur de la société A tente un `get` ou `list` sur `/companies/B/invoices` -> `PERMISSION_DENIED`.
6. **Horodatage falsifié** : Soumission d'un `createdAt` client antidaté au lieu de `request.time` -> `PERMISSION_DENIED`.
7. **Empoisonnement d'ID** : Document ID contenant `../` ou `1500` caractères -> `PERMISSION_DENIED`.
8. **Tableau non borné (Denial of Wallet)** : Facture soumise avec `lines.size() > 50` -> `PERMISSION_DENIED`.
9. **Modification de journal d'audit** : Tentative d'`update` sur `/companies/{id}/auditLogs/{logId}` -> `PERMISSION_DENIED`.
10. **Modification de facture clôturée** : Tentative de modification par un non-admin d'une facture au statut terminal `payee` ou `annulee` -> `PERMISSION_DENIED`.
11. **Requête `list` sans filtre d'appartenance** : Tentative de requête `collection` sans condition compatible avec `request.auth.uid in resource.data.memberUids` -> `PERMISSION_DENIED`.
12. **Écriture comptable déséquilibrée** : Tentative de création d'une écriture `journalEntries` où `totalDebit != totalCredit` -> `PERMISSION_DENIED`.
