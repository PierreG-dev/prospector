# Prospector

Outil interne de prospection commerciale GODINO. Mono-utilisateur, local, intensif.
Pipeline : **import Apify (Google Maps) → dédup → tri clavier-first → CRM → relances auto → push Pushover**.

---

## Prérequis

- **Node.js ≥ 20**
- **MongoDB** — au choix :
  - un `mongod` local (`mongodb://localhost:27017/prospector`)
  - un cluster gratuit MongoDB Atlas (`mongodb+srv://…`)
- Un compte **Pushover** (https://pushover.net) avec une application créée → tu auras un *user key* et un *application token*. L'app mobile Pushover doit être installée sur le téléphone qui doit recevoir les notifs.

---

## Installation

```bash
npm install
cp .env.example .env.local
# édite .env.local et renseigne tes secrets
npm run dev
```

L'app tourne sur `http://localhost:3000` et redirige sur `/dashboard`.

### `.env.local`

| Variable | Rôle |
|---|---|
| `MONGODB_URI` | URI de connexion Mongo (local ou Atlas). |
| `PUSHOVER_TOKEN` | Clé de l'application Pushover créée pour ce projet. |
| `PUSHOVER_USER` | Ta user key Pushover personnelle. |
| `CRON_SECRET` | Secret partagé entre le cron de l'OS et la route `/api/cron/run-reminders`. Mets ce que tu veux, juste pas vide. |

> Les secrets ne sont jamais en dur dans le code et `.env.local` est gitignored.

---

## Commandes

```bash
npm run dev       # serveur de dev (HMR)
npm run build     # build prod + vérif TS
npm run start     # serveur prod local
npm run test      # vitest (dédup, mapping, escalade — Lot 2+)
npm run seed      # injecte un faux dataset Apify (Lot 2)
```

---

## Importer un run Apify *(Lot 2)*

1. Lance l'actor Google Maps sur Apify, exporte le **dataset au format JSON**.
2. Dans Prospector, va sur **Import**, donne un label à la campagne et upload le JSON.
3. L'import normalise les champs, calcule les clés de dédup, détecte le métier (regex) et écarte les doublons **sans rien restocker**.

> **Format V1 : JSON uniquement.** Format d'entrée typé dans `cahier-des-charges-prospection.md` §3.

---

## Configurer les notifications *(Lot 7)*

Pushover envoie les pushs ; l'ordonnanceur peut être :

- le **worker `node-cron` interne** (actif tant que `npm run dev`/`npm run start` tourne) ;
- ou un **cron de l'OS** qui appelle la route protégée `/api/cron/run-reminders` (fiable même en arrière-plan).

**Tâches planifiées Windows** (exemple, toutes les 10 min) :

```powershell
$action  = New-ScheduledTaskAction -Execute "curl.exe" `
  -Argument '-s -H "Authorization: Bearer TON_CRON_SECRET" http://localhost:3000/api/cron/run-reminders'
$trigger = New-ScheduledTaskTrigger -Once (Get-Date) -RepetitionInterval (New-TimeSpan -Minutes 10)
Register-ScheduledTask -TaskName "ProspectorCron" -Action $action -Trigger $trigger
```

Sur Linux/macOS, un `crontab -e` équivalent : `*/10 * * * * curl -s -H "Authorization: Bearer TON_CRON_SECRET" http://localhost:3000/api/cron/run-reminders`.

---

## Backup

```bash
mongodump --uri="$MONGODB_URI" --out=./backup-$(date +%Y%m%d)
```

Restauration : `mongorestore --uri="$MONGODB_URI" ./backup-YYYYMMDD`.

---

## Structure du projet

Voir [`CLAUDE.md`](./CLAUDE.md) — c'est la table des matières du code, optimisée pour relire vite. Les principes durs (dédup, escalade, ordre de la file…) y sont listés comme invariants.

---

## Roadmap V2

- Éditeur de règles de pré-filtrage (champ + opérateur + valeur → action).
- Scoring avancé : détection présence/âge/techno du site, screenshot dans la carte.
- Statistiques par run (entonnoir importé → qualifié → client).
- Séquences de relance avancées + templates de message.
- Arbitrage UI des doublons faibles (T3).
- Export CSV / vers CRM externe.
- Mode nuit complet (toggle utilisateur), vue carte géographique.
