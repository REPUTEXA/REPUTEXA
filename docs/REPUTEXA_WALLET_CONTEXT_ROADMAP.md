# REPUTEXA - Wallet, contexte client, cuisine (feuille de route technique)

Ce document verrouille ce qui est **déjà en base / code** et ce qui reste **projet dédié** (PassKit, géofencing, VIP).

## Déjà en place

### Wallet Apple / Google (socle)

- Migration `supabase/migrations/160_reputexa_ghost_wallet.sql` : jetons Agent Ghost, verrous d’appareil par membre fidélité, audit.
- Tables liées fidélité : `banano_loyalty_members`, passes métier côté produit (carte marque artisan, mention REPUTEXA discrète) : voir écrans Banano / wallet existants.

### Mémoire client (IA sans invention)

- Migration `supabase/migrations/175_reputexa_client_context.sql` : table `reputexa_client_context` (un couple marchand `user_id` + `phone_e164`), champs `last_visit_at`, `last_whatsapp_thread_at`, `last_order_summary`, `prefs` JSONB. RLS : le marchand ne voit que ses lignes.
- Types TS : `lib/reputexa/client-context.ts`.
- Alimentation : à brancher depuis webhooks caisse / WhatsApp (upsert service role ou route serveur signée), pas d’écriture fantaisiste côté LLM.

### Finalisation texte WhatsApp (sortie)

- `lib/whatsapp-alerts/humanizer-whatsapp.ts` : `finalizeWhatsappOutboundText` (typographie clavier, pas de contenu ajouté).
- `lib/whatsapp-alerts/send-whatsapp-message.ts` : applique cette finalisation sur **tout** envoi Twilio texte.

### Indicateur moteur dans le dashboard

- Colonne `profiles.reputexa_dashboard_engine_badge` (migration `174_profiles_reputexa_dashboard_engine_badge.sql`), réglage dans **Paramètres** (section ADN IA), affichage dans le header (`DashboardShell`) pour les plans Pulse / Zenith.

## Projets dédiés (hors périmètre livré ici)

### PassKit / Google Wallet API

- Certificats Apple, signing pass, clés Google Wallet ; pipeline de génération de `.pkpass` et mises à jour push.
- Relire la doc interne compliance et les mentions “Élaboré par REPUTEXA” sur le visuel carte.

### Géofencing et VIP

- Passes dynamiques + notifications de proximité : dépend des plateformes Wallet et des quotas ; à cadrer avec la base `banano_wallet_device_locks` et les règles métier VIP (déjà des automatisations côté Banano à étendre).

### Tablette cuisine

- File d’événements dédiée (ou réutilisation `banano_ghost_audit_events` / webhook interne) pour afficher les retours clients remontés depuis WhatsApp / caisse ; écran tactile = consommation API en lecture seule + accusé de lecture.

---

Pour toute implémentation nouvelle, respecter la charte **zéro invention** : seules les données présentes en base ou dans le message entrant peuvent être citées dans les prompts IA.
