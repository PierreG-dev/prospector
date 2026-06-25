# Prospector — agent map (caveman)

App interne mono-user. Prospection commerciale. Apify Google Maps → tri → CRM → relances → push Pushover. Local. Pas d'auth.

## MAP
```
app/
  layout.tsx              shell: TopBar + Sidebar + main
  page.tsx                redirect /dashboard
  globals.css             tokens base + scrollbar + focus ring
  dashboard/page.tsx      buckets rappels             [Lot 6]
  import/page.tsx         upload JSON Apify           [Lot 2]
  tri/page.tsx            file de tri clavier-first    [Lot 4]
  crm/page.tsx            liste qualifiés + pipeline   [Lot 5]
  crm/[id]/page.tsx       fiche prospect               [Lot 5]
  settings/page.tsx       cadences relances            [Lot 8]
  api/
    health/route.ts                          GET → {mongo:bool}
    import/route.ts                          POST multipart OU JSON → runImport
    prospects/route.ts                       GET liste + facets (lifecycle/trade/city/pipeline/q)
    prospects/[id]/route.ts                  GET fiche complète (sans raw)
    prospects/next/route.ts                  GET → {candidate, remaining} (roulette pondérée)
    prospects/[id]/decide/route.ts           POST {action,snooze_until?} → snapshot
    prospects/[id]/undo/route.ts             POST snapshot → restore
    prospects/[id]/notes/route.ts            POST {body}
    prospects/[id]/pipeline/route.ts         POST {to,note?} → status_history + relance engine init/pause
    prospects/[id]/restore/route.ts          POST → lifecycle:'inbox' (rejeté/snoozé → file de tri)
    settings/route.ts                        GET (settings + env status) · PATCH
    reminders/route.ts                       GET buckets OU GET ?prospect_id=… (rappels ouverts) · POST create
    reminders/[id]/route.ts                  PATCH (done/due_at/label) · DELETE
    reminders/tick/route.ts                  POST → tickReminders() manuel (debug)
    cron/run-reminders/route.ts              GET/POST Bearer CRON_SECRET → tickReminders + pushDueReminders
models/
  ImportRun.ts            run d'import (compteurs)
  Prospect.ts             doc central + sous-docs + raw
  Reminder.ts             rappels (collection séparée)
  Settings.ts             singleton {_id:"singleton", relance_delays, auto_perdu}
lib/
  db.ts                   Mongoose singleton (HMR-safe)
  cn.ts                   classnames helper
  types.ts                Lifecycle / PipelineStatus / ReminderKind
  text.ts                 normalize (NFD + diacritic strip) + slug
  import/                 parse.ts (Root2[]) + map.ts (canonique) + pipeline.ts (orchestre)
  dedup/                  keys.ts (place_id, url_norm, domain, E.164, namegeo, blacklist) + cascade.ts (T1/T2/T3)
  trade/                  detect.ts (regex buckets) + calltime.ts (fenêtres + weightAt)
  pipeline.ts             PIPELINE_ORDER + PIPELINE_LABEL/TONE + isPipelineAdvance + RELANCE_FIRST_DELAY_DAYS
  queue/pick.ts           pickNext + countQueue + rouletteIndex
  scoring/score.ts        score V1 (utilise trade)
  og/fetch.ts             fetchOg (timeout 3.5s, head only) + refreshOgForProspect (cache 30j)
  reminders/engine.ts     tickReminders + nextRelanceState (pur, testable) + priorityFor + RELANCE_DELAYS_DAYS=[3,7,14]
  reminders/buckets.ts    getBuckets → {en_retard, aujourd_hui, cette_semaine, relances_epuisees, sans_prochaine_action}
  notify/pushover.ts      sendPushover + buildBody (form-encoded, clamp retry/expire pour priority 2)
  notify/processor.ts     pushDueReminders : balaie Reminders notified_at=null AND due_at<=now, envoie, marque
  cron/worker.ts          node-cron toutes 15min (singleton globalThis, désactivable DISABLE_INTERNAL_CRON=1)
  settings.ts             getSettings/updateSettings (DB singleton, fallback DEFAULTS=[3,7,14], auto_perdu)
  pipeline.ts             PIPELINE_ORDER + LABEL/TONE + isPipelineAdvance (les cadences viennent de getSettings)
instrumentation.ts        hook serveur Next : démarre le worker au boot (runtime nodejs uniquement)
components/
  shell/{TopBar,Sidebar,PageHeader,EmptyState}.tsx
  ui/{Button,Pill,Card,Skeleton,Toast}.tsx
  import/ImportForm.tsx                upload + drag&drop + stats
  tri/TriClient.tsx                    state machine + hotkeys + undo stack + précharge next
  tri/TriCard.tsx                      carte centrale (badges site/tel/note, OG, score, vu Nx, créneau)
  tri/OgPreview.tsx                    vignette site avec fallback skeleton/erreur image
  tri/PrepAppelPanel.tsx               slide-over `?` : tel/site/Maps + note libre (POST /notes)
  tri/SnoozeDialog.tsx                 date picker + presets J+3/J+7/J+14/J+30
  crm/CrmList.tsx                      liste filtrable (ville/trade/statut/q) + facets server-side
  crm/CrmFiche.tsx                     fiche complète (identité, pipeline, notes, historique, méta)
  crm/PipelineSelector.tsx             segmented control des 5 statuts pipeline
  crm/PipelinePill.tsx                 badge statut (couleur tonale)
  crm/StatusHistory.tsx                timeline status_history
  crm/NotesPanel.tsx                   ajout + liste de notes
  crm/RemindersSection.tsx             rappels ouverts du prospect + créer/done/delete
  dashboard/DashboardClient.tsx        5 buckets (en retard/aujourd'hui/semaine/épuisées/sans suite) + actions inline
  settings/SettingsClient.tsx          cadences modifiables + auto_perdu toggle + statut .env (présence)
  shell/ThemeToggle.tsx                bascule light/dark (localStorage, anti-flash via script inline layout)
scripts/seed.ts           génère seed-apify.json (RNG seedé, --post pour POST direct)
tests/                    dedup · mapping · trade · og · queue (56 tests)
```

## INVARIANTS (8 + 1 — non négociables)
1. Doublon T1/T2 à l'import → AUCUN restock. `dup_count++`. Pas d'écrasement.
2. `lifecycle ∈ {rejected,qualified,snoozed}` → jamais ré-affiché dans la file de tri, même réimporté.
3. Dédup balaie TOUTE la collection (statuts compris).
4. Champs enrichissement = optionnels. UI ne plante jamais sur null. `prospect.raw` toujours conservé.
5. Clés dédup (cet actor) : place_id (extrait de `url`) → gmaps_url_norm → domain → phone_e164 → namegeo (faible).
6. Escalade = stagnation de `pipeline_status='contacte'`. Max 3. Avancée pipeline coupe. Pas d'auto `perdu`.
7. File tri = clavier-first + undo. Lien externe (site/Maps/tel) n'avance JAMAIS la file.
8. Avis : note + count via Apify uniquement. Pas de scraping fiche Maps. OG du site = best-effort.
9. Ordre file = aléatoire pondéré par heure d'appel optimale du métier (regex). Pas score-desc.

## DATA (Mongo — détails dans /models)
- `import_runs` : label, source_type, imported_at, raw/new/dup/filtered counts.
- `prospects` : identité (tout null sauf name), `keys.{place_id,gmaps_url_norm,domain,phone_e164,namegeo}` (sparse indexed), `trade` (bucket regex, indexé), `lifecycle/pipeline_status`, `snooze_until`, escalade (relance_count/next/paused, last_status_at), embarqué `notes/status_history/runs`, `og`, `raw` (Mixed), `score`, `times_seen`, `last_seen_at`.
- `reminders` : prospect_id, due_at, label, kind ('simple'|'relance'|'sequence_step'), relance_index, priority, done/done_at, notified_at (anti-doublon push), push_receipt.
- Index : `{lifecycle,trade}`, `{pipeline_status}`, `{snooze_until}`, `{done,due_at}`, `{prospect_id}`, + sparse sur chaque `keys.*`.

## FLOWS
- **Import** : upload JSON → `parse` (Root2[]) → `map` (canonique + raw conservé) → `dedup.cascade` contre TOUTE base → si T1/T2 : STOP+dup_count++ ; T3 : créé+badgé ; new : créé `lifecycle=inbox` → `scoring` (score V1) → `trade.detect` (regex) → fire-and-forget `og.fetch`.
- **Tri** : `queue.pickNext(now, excludeIds)` = `find({$or:[{lifecycle:'inbox'},{lifecycle:'snoozed',snooze_until<=now}]}).limit(50)` → `combinedWeight = max(score,1) × max(weightAt(trade,now), 0.05)` → `rouletteIndex` → carte focus. Hotkeys (→/D qualify, ←/K reject, ↑/L snooze ouvre dialog, O/M/T externes, U/Ctrl+Z undo, ? prépa). Auto-avance avec exit anim direction sémantique. Précharge `next` en arrière-plan. Pile undo client (5 max) + restore serveur via `/undo` (snapshot lifecycle/pipeline/snooze_until + $pop status_history).
- **Relance** : worker `node-cron` (15min) + `/api/cron/run-reminders` (cron OS). Étape 1 `tickReminders(now)` : `prospects.find({pipeline_status:'contacte', !paused, count<3, next_at<=now})` → crée `Reminder` kind='relance' relance_index=N+1 priority=N-1, bump count, recompute `relance_next_at` via `nextRelanceState`. Étape 2 `pushDueReminders(now)` : `reminders.find({done:false, notified_at:null, due_at<=now})` → `sendPushover` → on succès `notified_at=now` + `push_receipt`. `relance_paused=true` posé par `/pipeline` sur toute avancée. Après 3 : `relance_next_at=null`, bucket "épuisées".

## COMMANDS
- `npm install` puis `npm run dev` (http://localhost:3000)
- `npm run build` (vérif TS + build prod)
- `npm run start` (prod local)
- `npm run test` (vitest)
- `npm run seed` → `seed-apify.json` (40 items). `npm run seed -- --post --count=80` POST direct sur /api/import.
- `curl -H "Authorization: Bearer $CRON_SECRET" http://localhost:3000/api/cron/run-reminders` [Lot 7]

## ENV (`.env.local`)
- `MONGODB_URI` — Atlas free tier ou `mongodb://localhost:27017/prospector`
- `PUSHOVER_TOKEN` — clé d'app Pushover (absent = push skip propre, l'app reste utilisable)
- `PUSHOVER_USER` — user key Pushover
- `CRON_SECRET` — header Bearer pour la route cron
- `NEXT_PUBLIC_BASE_URL` — URL utilisée dans les liens des pushs (défaut http://localhost:3000)
- `DISABLE_INTERNAL_CRON=1` — optionnel, désactive le worker `node-cron` (si tu pilotes via cron OS)

## GOTCHAS
- `place_id` pas toujours extractible de `url` Maps : selon la forme on a `query_place_id=`, CID dans `!1s0x…:0x…`, ou `?cid=`. Si rien → fallback `gmaps_url_norm`.
- `categoryName` Apify est bruité : NE PAS faire d'égalité stricte. Toujours passer par `lib/trade/detect.ts` (regex sur `name+categoryName+categories` normalisé sans accents).
- `phone` peut être partagé (franchises) : c'est une clé forte mais pas absolue. Cascade T2, pas T1.
- Domaines blacklist (plateformes partagées) : facebook.com, instagram.com, linktr.ee, pagesjaunes.fr, linkedin.com, x.com, twitter.com → ne servent PAS de clé `domain`.
- Worker `node-cron` ne tourne que si process up. Pour fiabilité prod : cron OS (Tâches planifiées Windows) → `/api/cron/run-reminders` protégée `CRON_SECRET`.
- Pushover priority 2 → REQUIERT `retry` (>=30) + `expire` (<=10800) ET stockage du `receipt` (accusé de réception).
- Champs Apify optionnels : `website`, `state`, parfois `phone`. UI affiche "—" ou masque la ligne. Boutons externes affichés seulement si donnée présente.
- Mongoose en serverless Next : utiliser `lib/db.ts` (cache global HMR-safe). Importer schémas via `mongoose.models.X ?? mongoose.model(...)`.
- Fenêtres d'appel : `Europe/Paris` par défaut. Hors fenêtre = poids faible (~0.2), pas zéro, pour éviter la famine.

## GOTCHAS (suite Lot 8)
- Settings = singleton (_id="singleton"). `getSettings()` retombe sur DEFAULTS [3,7,14] si lecture échoue (DB down, jamais initialisée) — pas de throw.
- Modifier les cadences dans /settings impacte tous les futurs ticks + la 1ère relance posée au prochain passage à `contacte`. Les `relance_next_at` déjà calculés sur d'anciennes cadences ne sont PAS recalculés rétroactivement.
- Restauration : `POST /api/prospects/[id]/restore` ne fonctionne PAS sur lifecycle=qualified (déjà actif), seulement sur `rejected` ou `snoozed`. Trace dans status_history.
- Mode nuit : script inline anti-flash dans `<head>` (lit `localStorage.prospector-theme` avant React). Sans ce script, alterner light↔dark provoque un flash blanc sur reload — c'est volontaire et non négociable.
- Mode nuit appliqué aux **surfaces principales** (body, Card, Sidebar, TopBar, EmptyState). Dialogues/panneaux secondaires (SnoozeDialog, PrepAppelPanel, certains inputs) restent partiellement en mode clair — à compléter au fil des besoins.

## WHERE-TO
- Modifier la **palette/fontes/shadows** → `tailwind.config.ts`
- Modifier la **cascade de dédup** → `lib/dedup/cascade.ts`
- Ajouter une **clé de dédup** ou la **regex place_id** → `lib/dedup/keys.ts`
- Modifier le **mapping** Apify→canonique → `lib/import/map.ts` (table §3 spec)
- Ajouter un **bucket métier** (regex) → `lib/trade/detect.ts`
- Modifier la **fenêtre d'appel** d'un métier → `lib/trade/calltime.ts`
- Modifier le **scoring** V1 → `lib/scoring/score.ts`
- Modifier la **carte de tri** → `components/tri/TriCard.tsx`
- Modifier le **tirage pondéré** → `lib/queue/pick.ts`
- Modifier les **cadences par défaut** (3/7/14) → `lib/settings.ts` (DEFAULT_SETTINGS). Les valeurs effectives viennent du document Settings (modifiable via `/settings`).
- Modifier le **moteur d'escalade** (logique de tick, calcul next_at) → `lib/reminders/engine.ts`
- Modifier le **client Pushover** (priorités, receipt) → `lib/notify/pushover.ts`
- Modifier la **route cron** protégée → `app/api/cron/run-reminders/route.ts`
- Ajouter un **élément de nav** → `components/shell/Sidebar.tsx`
