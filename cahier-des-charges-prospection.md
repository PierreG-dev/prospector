# Cahier des charges — App interne de prospection (solo)

> Outil personnel pour qualifier et suivre des prospects issus de scraping Apify, en vue de vendre des sites internet à des entreprises locales. Usage mono-utilisateur, local, intensif.

---

## 0. Décisions d'architecture (résumé des arbitrages)

Avant le détail, les partis pris importants — certains contredisent le découpage initial :

1. **Ce n'est pas 3 modules, c'est UN pipeline avec des vues.** « Tri (swipe) », « CRM » et « rappels » manipulent la même entité `prospect` à des stades différents de son cycle de vie. On ne duplique jamais la donnée : un prospect passe d'un état à un autre. Cela évite la désynchronisation et simplifie énormément le code.

2. **Le swipe n'est pas le bon mot sur desktop.** Pour trier vite en solo intensif, le **clavier sur une carte focalisée** est plus rapide et moins fatigant qu'un geste de swipe (métaphore mobile). On garde le modèle mental « Tinder » mais on l'implémente au clavier. Le swipe tactile reste possible mais secondaire.

3. **La pile « à revoir plus tard » est un piège.** Sans mécanisme de re-remontée, elle devient un cimetière. On lui impose soit une **date de re-surfaçage obligatoire**, soit on la remplace par un snooze daté qui réinjecte la carte dans la file le jour J.

4. **Le signal n°1 pour TON offre, c'est le site web.** Tu vends des sites. Un prospect _sans site_ = chaud ; _avec un vieux site moche_ = tiède ; _avec un beau site récent_ = froid. « Présence et qualité du site » doit être un champ de première classe (filtre, tri, score), pas une note perdue.

5. **La dédup doit couvrir TOUTE la base, y compris les rejetés.** Un prospect archivé/rejeté doit être reconnu dans les runs futurs pour ne jamais réapparaître. L'index de dédup ne filtre donc jamais sur le statut.

6. **Brique manquante essentielle : la gestion des runs d'import (campagnes).** Tu l'as pressentie. Sans ça, impossible de savoir quelle source produit de bons prospects, ni de relancer un import proprement.

---

## 1. Découpage fonctionnel (challengé)

| Module                     | Rôle                                                      | Commentaire vs ta proposition                                         |
| -------------------------- | --------------------------------------------------------- | --------------------------------------------------------------------- |
| **Import & Runs**          | Récupère un export Apify, le normalise, trace la campagne | **Ajouté.** Brique manquante mais structurante                        |
| **Moteur de dédup**        | Reconnaît un prospect déjà vu, sur toute la base          | **Isolé.** C'est un concern technique à part, pas un sous-truc du tri |
| **Pré-filtrage / scoring** | Écarte ou déprioritise avant le tri manuel                | **Ajouté.** Divise par 2–5 le volume à swiper                         |
| **File de tri (ex-swipe)** | Décision rapide qualifié / rejeté / snooze                | Conservé, mais clavier-first + undo                                   |
| **CRM / pipeline**         | Suivi des qualifiés à travers les statuts                 | Conservé                                                              |
| **Rappels & relances**     | Actions datées + dashboard                                | Conservé                                                              |
| **Statistiques (V2)**      | Taux de conversion par run / par statut                   | **Ajouté en V2**                                                      |

**Verdict :** ta séparation tri / CRM / dashboard est juste _en surface_ mais incomplète et mal cadrée. Le vrai découpage est un pipeline `Import → Dédup → Pré-filtre → Tri → CRM → Rappels`, où tri/CRM/rappels sont des **vues** sur une base unique.

---

## 2. Modèle de données

**Base : MongoDB.** Timestamps en ISO 8601 UTC. Une collection `prospects` centrale qui traverse tout le cycle de vie (champ `lifecycle`).

> **Principe « vase à remplir ».** Le retour Apify est **partiel** : un champ peut exister ou non d'un prospect à l'autre. Donc **tout champ d'enrichissement est optionnel** (site, téléphone, e-mail, nom du propriétaire, horaires, note…). Le modèle, la carte de tri et la dédup gèrent l'absence sans planter. On exploite ici le fait que MongoDB est schemaless : on **stocke toujours le document Apify brut** (`raw`) en plus des champs normalisés, pour ne rien perdre et pouvoir re-mapper plus tard sans ré-importer.

### 2.1 Collections

**`import_runs`** — une exécution Apify importée

```js
{
  (_id, // ObjectId
    label, // "Plombiers Toulouse 06/2026"
    source_type, // 'google_maps' (défaut) | 'directory' | 'website' | 'other'
    apify_actor, // nom de l'actor → pilote le mapping
    apify_run_id, // optionnel
    imported_at,
    raw_count, // objets dans le fichier JSON
    new_count,
    dup_count,
    filtered_count,
    source_file);
}
```

**`prospects`** — document central, du brut au client. **Tous les champs d'identité/enrichissement sont optionnels.**

```js
{
  _id,
  // --- Identité (tout optionnel) ---
  name,                      // ← title
  owner_name,                // ⚠️ ABSENT de cet actor → masqué (gardé pour un actor plus riche)
  category,                  // ← categoryName (catégorie principale)
  categories,                // ← categories[] (toutes)
  address,                   // ← street
  city,                      // ← city
  postal_code,               // ⚠️ ABSENT de cet actor → null
  country_code,              // ← countryCode
  state,                     // ← state (souvent null en FR)
  phone,                     // ← phone (brut)
  email,                     // ABSENT de cet actor → null (vase à remplir plus tard)
  website_url,               // ← website (optionnel)
  gmaps_url,                 // ← url (lien fiche Maps — sert aussi de clé, voir 2.3)
  gmaps_rating,              // ← totalScore
  gmaps_reviews,             // ← reviewsCount
  og: { title, description, image, fetched_at }, // OpenGraph du site (best-effort, en cache)
  // --- Clés de dédup normalisées (voir 2.3), absentes si non calculables ---
  keys: {
    place_id,                // extrait de gmaps_url si présent (query_place_id / CID)
    gmaps_url_norm,          // url Maps normalisée — clé de repli forte si pas de place_id
    domain,                  // domaine registrable depuis website, sans www, lowercase
    phone_e164,              // phone normalisé E.164
    namegeo                  // hash(slug(name) + city) — clé faible (pas de code postal ici)
  },
  // --- Signaux métier ---
  has_website,               // bool dérivé de website_url (signal n°1)
  score,                     // pré-score auto, optionnel
  // --- Cycle de vie ---
  lifecycle,                 // 'inbox' | 'triaging' | 'rejected' | 'snoozed' | 'qualified'
  pipeline_status,           // null tant que pas qualifié, puis 'a_contacter'...
  snooze_until,              // si lifecycle='snoozed'
  // --- Moteur de relance (escalade — voir §5) ---
  relance_count,             // 0→3
  relance_next_at,
  last_status_at,            // date du dernier changement de statut
  relance_paused,            // bool
  // --- Embarqué (lecture toujours dans le contexte du prospect) ---
  notes:          [ { body, created_at } ],
  status_history: [ { from, to, note, created_at } ],
  runs:           [ { run_id, seen_at } ],   // chaque run où il est réapparu
  // --- Méta ---
  times_seen,                // = runs.length
  last_seen_at,
  raw,                       // document Apify d'origine, conservé tel quel
  created_at, updated_at
}
```

> `notes`, `status_history` et `runs` sont **embarqués** : on les lit toujours avec le prospect, jamais en requête globale. `times_seen = runs.length` → « ressorti 3 fois sur 3 campagnes » = signal de stabilité.

**`reminders`** — collection **séparée** (l'ordonnanceur et le dashboard la requêtent globalement par date)

```js
{
  (_id,
    prospect_id, // ref prospects._id
    due_at,
    label, // "Relancer après devis"
    kind, // 'simple' | 'relance' (escalade auto) | 'sequence_step' (V2)
    relance_index, // 1, 2 ou 3 si kind='relance' ; sinon null
    priority, // priorité Pushover (-1..2), monte avec relance_index
    done,
    done_at,
    notified_at, // envoi du push (null = pas encore poussé) → anti-doublon
    push_receipt, // receipt Pushover si priorité 2 (accusé de réception)
    created_at);
}
```

### 2.2 Relations

- `import_runs` ←→ `prospects` : via le tableau embarqué `prospect.runs[]` (un prospect peut venir de plusieurs runs).
- `prospects` 1—N `reminders` : via `reminder.prospect_id` (collection séparée, indexée sur `due_at`/`done` pour l'ordonnanceur).
- `notes` et `status_history` : embarqués dans le document prospect.

### 2.3 Clé de déduplication — le cœur du système

Aucune clé unique n'est fiable à 100 %. Stratégie : **calculer plusieurs clés normalisées par prospect, puis matcher par cascade de confiance**. **Adapté à ton actor réel** (champs : `title, totalScore, reviewsCount, street, city, state, countryCode, website?, phone, categories, url, categoryName`) — donc **ni `placeId`, ni SIRET, ni code postal** en entrée.

**Normalisation à l'import (depuis ce JSON) :**

- `keys.place_id` : **extrait du champ `url`** s'il contient `query_place_id=...` ou un CID dans `...!1s0x…:0x…` / `?cid=`. Présent dans une bonne partie des URLs Maps → clé forte quand récupérable.
- `keys.gmaps_url_norm` : à défaut de place_id, **l'`url` Maps normalisée** (on retire les paramètres volatils `@lat,lng,zoom`, on garde la partie identifiant). Clé de repli forte, car stable pour une même fiche.
- `keys.domain` : domaine _enregistrable_ depuis `website` (ex. `boulangerie-durand.fr` depuis `https://www.boulangerie-durand.fr/contact`), lowercase, sans `www`. Liste noire des plateformes partagées (facebook.com, instagram.com, linktr.ee, pagesjaunes.fr…) → ignorées.
- `keys.phone_e164` : `phone` en E.164 (`+33…`). Attention aux numéros partagés (franchises) → forte mais pas absolue.
- `keys.namegeo` : `hash(slug(title) + city)` — **clé faible** (pas de code postal dans cet actor).

**Cascade de matching (un nouveau prospect = doublon si…) :**

| Niveau             | Clés (cet actor)                                       | Action                                                                                             |
| ------------------ | ------------------------------------------------------ | -------------------------------------------------------------------------------------------------- |
| **T1 — certitude** | `place_id` identique (extrait de l'url)                | Doublon sûr → **on ne restocke rien** (voir règles ci-dessous)                                     |
| **T2 — forte**     | `gmaps_url_norm` OU `domain` OU `phone_e164` identique | Doublon → on ne restocke rien                                                                      |
| **T3 — faible**    | `namegeo` seul (nom+ville)                             | **Pas de fusion auto.** Badge ⚠️ « doublon possible », laissé en file de tri pour arbitrage humain |

**Règles de dédup à l'import (ta demande : ne pas restocker une société déjà vue/traitée) :**

- La dédup interroge **toute** la collection `prospects`, **statuts compris** (inbox, rejeté, snoozé, qualifié).
- **Doublon T1/T2 → on n'écrit AUCUNE donnée du prospect.** On ne crée pas de second document et on **n'écrase ni ne ré-enrichit** la fiche existante. Le run est compté comme doublon (`dup_count++`). _(Au choix : on peut juste pousser une trace légère `{run_id, seen_at}` dans `runs[]` pour le signal « vu Nx » — métadonnée, pas « les infos » ; désactivable.)_
- **Déjà traité = jamais ré-affiché.** Si le doublon a `lifecycle ∈ {rejected, qualified, snoozed}`, il **ne réapparaît pas** dans la file de tri, point. Un rejeté reste rejeté ; un qualifié n'est pas re-trié.
- **Index MongoDB sparse** sur `keys.place_id`, `keys.gmaps_url_norm`, `keys.domain`, `keys.phone_e164`, `keys.namegeo`. Index sur `lifecycle`, `pipeline_status`, et sur `reminders.due_at`+`reminders.done` pour l'ordonnanceur.

---

## 3. Flux d'import Apify

```
Fichier Apify (JSON — export du dataset gmaps)
        │
        ▼
[1] Parsing JSON + mapping des champs → schéma canonique (table ci-dessous)
        │    Le document brut est conservé dans `raw` quoi qu'il arrive.
        ▼
[2] Normalisation → calcul des clés keys.place_id / gmaps_url_norm / domain / phone_e164 / namegeo
        │    (chaque clé absente si la donnée source manque)
        ▼
[3] Dédup contre TOUTE la base, statuts compris (cascade T1→T3)
        │   ├─ doublon T1/T2 → STOP : on ne restocke rien, dup_count++ (jamais ré-affiché si déjà traité)
        │   ├─ doublon T3 (nom+ville seul) → créé mais badgé ⚠️ "doublon possible"
        │   └─ nouveau → continue
        ▼
[4] Pré-filtrage automatique (règles)
        │   ├─ règle « hard reject » remplie → lifecycle='rejected' direct (récupérable)
        │   └─ sinon → calcul du score + lifecycle='inbox'
        ▼
[5] (asynchrone, best-effort) fetch OpenGraph du site → cache dans prospect.og
        ▼
[6] File de tri (cartes prêtes au swipe), triées par score décroissant
```

> **Format V1 : JSON uniquement** (l'export dataset Apify). Le CSV passe en V2 si besoin.

### Mapping Apify → canonique (ton actor réel)

| Champ Apify       | Champ canonique                                                 | Traitement                                                    |
| ----------------- | --------------------------------------------------------------- | ------------------------------------------------------------- |
| `title`           | `name`                                                          | trim                                                          |
| `categoryName`    | `category`                                                      | —                                                             |
| `categories[]`    | `categories`                                                    | tableau conservé                                              |
| `street`          | `address`                                                       | —                                                             |
| `city`            | `city`                                                          | sert à `keys.namegeo`                                         |
| `state`           | `state`                                                         | souvent null (FR)                                             |
| `countryCode`     | `country_code`                                                  | —                                                             |
| `phone`           | `phone` + `keys.phone_e164`                                     | E.164 via libphonenumber-js                                   |
| `website?`        | `website_url` + `has_website` + `keys.domain`                   | absent → `has_website=false`                                  |
| `url`             | `gmaps_url` + `keys.place_id` (extrait) + `keys.gmaps_url_norm` | parse de l'URL Maps                                           |
| `totalScore`      | `gmaps_rating`                                                  | —                                                             |
| `reviewsCount`    | `gmaps_reviews`                                                 | —                                                             |
| _(tout le reste)_ | `raw`                                                           | objet d'origine conservé                                      |
| _(absent ici)_    | `owner_name`, `email`, `postal_code`                            | restent null — _vase à remplir_ si un actor plus riche arrive |

**Faut-il un pré-scoring avant le tri manuel ? Oui, mais nuancé :**

- **Hard rules (suppression directe)** : à manier avec prudence en V1. N'active par défaut que ce qui est _incontestablement_ hors-cible. Pour ton offre, le bon candidat à l'auto-reject c'est **« a déjà un site récent/moderne »** — mais détecter « récent/moderne » est coûteux (V2, analyse de la techno/âge du site). En V1, reste sur des toggles simples et réversibles.
- **Soft scoring (priorisation)** : toujours utile. Le score remonte les prospects chauds en haut de la file. Exemple de scoring V1 simple et lisible :

```
score = 0
+40  si has_website == false        (cœur de cible : pas de site)
+20  si website = plateforme partagée (FB/PagesJaunes)
+15  si phone présent               (joignable)
+15  si gmaps_reviews >= 10         (activité réelle)
+10  si categoryName ∈ secteurs ciblés
-50  si has_website == true ET domaine propre + bien noté (à affiner en V2)
```

**Règles définies par toi :** oui, c'est un vrai besoin, mais **étalé** :

- **V1** : 3–4 toggles codés en dur, activables par run (« écarter sans téléphone », « écarter ceux qui ont déjà un site », « secteurs autorisés : [liste] »).
- **V2** : éditeur de règles (champ + opérateur + valeur → action reject/score), réutilisables d'un run à l'autre.

> Principe : **dépriorise par défaut, ne supprime que sur règle explicite.** Tout auto-reject reste consultable et restaurable, jamais effacé.

---

## 4. UX du mode tri (« swipe » clavier-first)

**Objectif : décider en < 5 s par carte, enchaîner des centaines de cartes sans fatigue.**

### Informations sur la carte (un max d'infos utiles, tout champ pouvant être absent)

Hiérarchie d'attention (haut = lu en premier). **Si une donnée manque dans le retour Apify, on l'affiche en grisé « — » ou on masque la ligne** — jamais de case vide trompeuse.

1. **Nom de l'entreprise** + **secteur/catégorie** (`categoryName`, gros)
2. **Ville** (+ adresse `street` au survol/détail)
3. **Statut site web** — LE signal : badge `🌐 Pas de site` / `🌐 Site présent`. **Si présent → lien direct cliquable** (`[ Ouvrir le site ↗ ]`, nouvel onglet).
4. **Téléphone** — **cliquable en click-to-call** (`tel:`) quand présent ; sinon badge « pas de tél ».
5. **Activité** : `⭐ totalScore (reviewsCount avis)` — c'est tout ce que l'actor donne ; **pas de texte d'avis** (voir note).
6. **Fiche Google Maps** : `[ Voir Maps ↗ ]` (champ `url`) — un clic pour ouvrir la fiche complète (avis, photos, horaires) avant l'appel.
7. **Aperçu OpenGraph du site** (si dispo) : vignette `og:image` + `og:title`/`og:description` → tu vois à quoi ressemble le site sans l'ouvrir. Best-effort, en cache.
8. **Score** + badge `vu Nx` si réapparu sur plusieurs runs
9. _(masqués si absents : nom du propriétaire, e-mail)_
10. (Discret) compteur « X restantes » + provenance (run)

Le détail complet (adresse, clés de dédup, `raw`, bloc notes prépa-appel) est **replié** par défaut (touche `?`) pour ne pas encombrer la décision rapide.

> **Réalité des avis avec cet actor :** seuls la **note moyenne** (`totalScore`) et le **nombre d'avis** (`reviewsCount`) sont fournis. Le **texte des avis n'est pas dans le JSON** ; le récupérer imposerait de re-scraper Google (anti-bot) ou un actor payant → **écarté** (ta règle « surcoût/tiers = on oublie »). À la place, le bouton `[ Voir Maps ↗ ]` t'ouvre la fiche en un clic pour lire les avis toi-même.

### Préparer l'appel à froid (panneau détail `?`)

Tout ce qui sert au cold call, regroupé : nom + gérant (si un jour dispo), catégorie, adresse, **téléphone (Appeler)**, **site (Ouvrir + aperçu OG)**, **fiche Maps (Ouvrir)**, note/avis, et un **champ note libre** pour griffonner ton accroche/objection avant de décrocher. Accessible sans quitter la file.

### Structure d'écran

```
┌──────────────────────────────────────────────┐
│  ⌛ 247 restantes            run: Plombiers31  │
│                                               │
│        BOULANGERIE DURAND                     │
│        Boulangerie · Toulouse                 │
│                                               │
│   🌐 Site présent   📞 05 61 …   ⭐ 4.6 (128)   │
│   ┌───────────┐  og:title "Boulangerie Durand"│
│   │ og:image  │  "Pains & viennoiseries…"     │
│   └───────────┘                               │
│   score 75 · vu 2x                            │
│                                               │
│   [ Ouvrir le site ↗ ] [ Appeler 📞 ]         │
│   [ Voir Maps ↗ ]      [ ? prépa appel ]      │
│                                               │
│   ← Rejeter      ↓ Plus tard      Qualifier → │
└──────────────────────────────────────────────┘
```

> Les boutons externes (site, appel, Maps, mail) n'apparaissent **que si la donnée existe**. Cliquer un lien externe **ne fait pas avancer** la file (pas de décision involontaire).

### Raccourcis (clavier-first, gestes en bonus tactile)

| Touche         | Action                                                     | Geste        |
| -------------- | ---------------------------------------------------------- | ------------ |
| `→` / `D`      | Qualifier (→ pipeline `a_contacter`)                       | swipe droite |
| `←` / `K`      | Rejeter (archivé définitif)                                | swipe gauche |
| `↑` / `L`      | Snooze (demande une date de re-surfaçage)                  | swipe haut   |
| `O`            | Ouvrir le site (si présent)                                | tap site     |
| `M`            | Ouvrir la fiche Google Maps (`url`)                        | tap Maps     |
| `T`            | Appeler (`tel:`) si numéro présent                         | tap tél      |
| `U` / `Ctrl+Z` | **Annuler la dernière décision** (indispensable à vitesse) | —            |
| `?`            | Panneau prépa-appel / détails                              | tap fiche    |

**Règles UX anti-fatigue :**

- **Auto-avance** à la carte suivante dès l'action, zéro confirmation, zéro modale.
- **Undo obligatoire** : à 2 cartes/seconde les erreurs sont garanties.
- **Préchargement** de la carte suivante (et idéalement screenshot du site en V2) pour zéro latence.
- Snooze = date → réinjecte la carte dans la file le jour venu (pas de pile morte).
- Session « finie » → écran de résumé (X qualifiés / Y rejetés / Z snoozés).

---

## 5. Rappels & relances

### Logique alignée sur un usage commercial réel

1. **Rappel simple à date fixe** (90 % des cas) : « rappeler le 12/03 ». C'est la base, V1.
2. **Rappel suggéré au changement de statut** : passer un prospect à `contacté` propose automatiquement un rappel de relance (J+3 par défaut, modifiable). Réduit les oublis.
3. **Principe « toujours une prochaine action »** : tout prospect actif dans le pipeline doit avoir soit un rappel daté, soit être listé comme « sans prochaine action » sur le dashboard → rien ne tombe entre les mailles.

### Moteur de relance automatique (escalade jusqu'à 3) — V1

**Règle métier :** dès qu'un prospect entre en phase de contact (`pipeline_status = 'contacté'`, statut déclencheur configurable), l'app surveille la **stagnation du statut**. Tant que **tu ne mets aucune mise à jour d'état** dans l'app, elle relance automatiquement, **jusqu'à 3 fois**, puis s'arrête et te le signale.

- **Déclencheur** : passage à `contacté` → `relance_count = 0`, `last_status_at = maintenant`, `relance_next_at = maintenant + délai₁`.
- **Cadence par défaut** (modifiable en réglages) : relance 1 à **J+3**, relance 2 à **J+7**, relance 3 à **J+14** (délais comptés depuis la relance précédente, pas depuis le début).
- **À chaque échéance atteinte sans mise à jour de statut** : création d'un `reminder` `kind='relance'` (`relance_index` = 1/2/3), **push Pushover** envoyé, `relance_count++`, recalcul de `relance_next_at`.
- **Ce qui coupe l'escalade** (`relance_paused = 1`) : **tout changement de statut (entrée `status_history`) qui fait avancer le pipeline** (`rdv_pris`, `client`, `perdu`…). C'est la stagnation du _statut_ qui pilote, pas le fait de cocher un rappel.
- **Après la 3ᵉ relance non suivie d'effet** : escalade stoppée, le prospect bascule dans un bucket **« relances épuisées »** sur le dashboard. Pas de passage auto en `perdu` par défaut (réglage `auto_perdu` désactivé par défaut — tu gardes la main).

> Garde-fou anti-incohérence : quand tu coches une relance comme « faite », l'app te demande **« quel est le nouvel état ? »**. Si tu ne changes rien, l'escalade continue — c'est volontaire : un rappel coché ne vaut pas une réponse du prospect.

### Gestion des rappels manqués

- Un rappel non fait **ne disparaît jamais**. Il bascule dans le bucket **« en retard »** (rouge) et y reste jusqu'à action (fait ou reporté).
- Reporter = simple ré-écriture de `due_at` (snooze du rappel). Reporter une relance **ne consomme pas** d'échelon d'escalade.

### Dashboard rappels (vue d'entrée de l'app)

Buckets, dans cet ordre :

- 🔴 **En retard** (`due_at < aujourd'hui`, `done=0`)
- 🟠 **Aujourd'hui**
- 🔵 **Cette semaine**
- ⚫ **Relances épuisées** (3/3 atteint, statut figé) → décision manuelle requise
- (+) **Sans prochaine action** : prospects `qualified` actifs sans rappel ouvert.

### Notifications — Pushover (V1)

Push mobile/desktop via **Pushover** (compte perso, app installée sur ton tel). Aucune lib npm nécessaire : simple `POST` HTTPS.

- **Endpoint** : `POST https://api.pushover.net/1/messages.json` avec `token` (clé d'application), `user` (ta clé utilisateur), `message`, `title`, `url` (lien profond vers la fiche prospect), `priority`. _(Confirme les paramètres exacts sur la doc officielle pushover.net/api — l'API est stable mais autant la garder sous les yeux.)_
- **Secrets** : `PUSHOVER_TOKEN` et `PUSHOVER_USER` dans `.env.local`, **jamais en dur dans le code ni commités**. C'est toi qui les renseignes dans le fichier — l'app ne fait que les lire.
- **Priorité croissante selon l'escalade** :
  - relance 1 → priority `0` (normale)
  - relance 2 → priority `1` (haute, contourne les heures de silence)
  - relance 3 → priority `2` (urgence : nécessite `retry` + `expire` et un **accusé de réception**, dont tu stockes le `receipt`)
- **Anti-doublon** : un push n'est envoyé qu'une fois par rappel (`notified_at` renseigné → on ne repousse pas).
- **Récap quotidien optionnel** : un push résumé le matin (« 3 en retard, 2 aujourd'hui »).

**Contrainte d'exécution à connaître :** une app Next.js locale ne pousse **que si son process tourne**. Deux options pour l'ordonnanceur :

1. **Worker interne** (`node-cron`) lancé avec l'app : vérifie les échéances toutes les ~15 min + au démarrage. Simple, mais ne tourne que quand l'app est ouverte.
2. **Cron de l'OS** (cron/Tâches planifiées) qui appelle une route `/api/cron/run-reminders` à intervalle fixe : pousse **même navigateur fermé**, tant que la machine est allumée. **Reco** si tu veux des relances fiables. La route doit être protégée par un `CRON_SECRET`.

---

## 6. Priorisation V1 / V2

### V1 — minimal mais réellement utilisable

- [ ] Import Apify **JSON** (export dataset gmaps) avec mapping des champs pour l'actor que tu utilises + conservation du `raw`.
- [ ] Création/sélection d'un **run (campagne)** avec label, compteurs (raw / new / dup / filtered).
- [ ] **Moteur de dédup** multi-clés (place_id depuis url / url_norm / domaine / tél / nom+ville), couvrant toute la base, rejetés inclus. **Doublon = on ne restocke rien ; déjà traité = jamais ré-affiché.**
- [ ] **Pré-filtre** : 3–4 toggles en dur par run + score V1 lisible.
- [ ] **File de tri** clavier-first : qualifier / rejeter / snooze + **undo** + auto-avance.
- [ ] **Carte enrichie** : site (ouvrir) + tél (appeler) + fiche Maps (ouvrir) + **aperçu OpenGraph du site** (best-effort, en cache) + panneau prépa-appel avec note libre.
- [ ] **Mini-CRM** : liste des qualifiés, pipeline `a_contacter → contacté → rdv_pris → client → perdu`, historique `status_history`.
- [ ] **Notes** libres par prospect.
- [ ] **Rappels simples** datés + dashboard buckets (retard / aujourd'hui / semaine / relances épuisées).
- [ ] **Moteur de relance auto** : escalade jusqu'à 3 relances pilotée par la stagnation du statut `contacté` ; coupée par toute avancée de pipeline.
- [ ] **Notifications Pushover** + ordonnanceur (worker `node-cron` et/ou route `/api/cron` appelée par le cron OS).
- [ ] **Recherche / filtre** basique (par ville, secteur, statut).

### V2 — quand la V1 tourne en prod

- [ ] **Éditeur de règles** de filtrage (champ/opérateur/valeur → action), réutilisables.
- [ ] **Scoring avancé** : détection présence/âge/techno du site (le prospect a-t-il _déjà_ un bon site ?), screenshot du site dans la carte.
- [ ] **Statistiques** : entonnoir importé → qualifié → contacté → client, taux de conversion **par run** (quelle source rapporte ?).
- [ ] **Séquences de relance avancées** (cadences multiples + templates de message par étape ; la V1 ne fait que l'escalade 3 niveaux).
- [ ] **Arbitrage des doublons faibles** (T3) dans un écran dédié.
- [ ] **Export** CSV / vers un CRM externe.
- [ ] **Récap e-mail** quotidien (en plus du push Pushover).
- [ ] **Multi-utilisateur** : auth + attribution de prospects (si tu embauches un commercial). À ne préparer en V1 que par une colonne `owner_id` nullable, sans construire l'auth.
- [ ] Vue **carte géographique** des prospects.

---

## 7. Stack technique recommandée

**Contraintes :** local, léger, maintenable seul, pas de dépendances lourdes inutiles, dév assisté par Claude Code.

### Reco principale — full-stack TypeScript, un seul process

| Couche             | Choix                                                 | Pourquoi                                                                                                                          |
| ------------------ | ----------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------- |
| Framework          | **Next.js (App Router)**                              | Un seul framework, un seul process. Les Server Actions remplacent une API REST à maintenir → moins de pièces mobiles pour un solo |
| Langage            | **TypeScript**                                        | Sûreté sur le modèle (clés de dédup, statuts)                                                                                     |
| DB                 | **MongoDB**                                           | Schemaless : colle au retour Apify partiel et au document `raw` conservé. _Ton choix._                                            |
| ODM                | **Mongoose**                                          | Schémas + validation + index déclaratifs, confort de maintenance en solo                                                          |
| UI                 | **React + Tailwind CSS**                              | Tu connais l'écosystème ; rapide à itérer avec Claude Code                                                                        |
| Raccourcis clavier | **`react-hotkeys-hook`**                              | La file de tri en dépend                                                                                                          |
| Parsing import     | **`JSON.parse` natif**                                | V1 = JSON Apify uniquement, aucune lib                                                                                            |
| Tél. E.164         | **`libphonenumber-js`**                               | Normalisation fiable des numéros FR                                                                                               |
| Ordonnanceur       | **`node-cron`** (+ route `/api/cron` pour le cron OS) | Déclenche relances et push à intervalle régulier                                                                                  |
| Notifications      | **Pushover** via `fetch` natif (pas de lib)           | Push mobile/desktop fiable, config par `.env.local`                                                                               |

**Exécution :** app web lancée en local (`next start`), ouverte dans le navigateur. Mono-utilisateur, **pas d'auth en V1**. Secrets (`MONGODB_URI`, `PUSHOVER_TOKEN`, `PUSHOVER_USER`, `CRON_SECRET`) dans `.env.local`, hors versionning.

> **Réserve d'architecte (honnête, mais ton choix prime).** MongoDB t'impose un **serveur de base** (un `mongod` local ou un cluster **Atlas** gratuit) là où SQLite tenait dans un seul fichier — pour un outil solo local c'est le seul vrai surcoût (installation + `mongodump` pour les backups au lieu d'un copier-coller de fichier). En face, le gain est réel : le retour Apify hétérogène et partiel se range naturellement en documents, et garder le `raw` est trivial. **Conclusion : c'est un choix défendable, je le retiens.** Si tu veux rester 100 % local sans serveur, dis-le et je rebascule sur SQLite ; sinon, **Atlas free tier** est le plus simple (et neutre vis-à-vis de ta localisation).

> **Choix verrouillé : Next.js (App Router) + TypeScript + MongoDB/Mongoose.**

### Alternatives (non retenues — pour mémoire)

- **100 % local sans serveur** : SQLite (better-sqlite3 + Drizzle), backup = copier le `.db`. À reconsidérer si l'aspect « serveur Mongo » te pèse.
- **Vrai desktop / offline** : envelopper le front dans **Tauri**. À garder pour plus tard si tu veux une app installable.

### Organisation du repo (proposée à Claude Code)

```
/app            routes Next (dashboard, tri, crm, import)
  /api/cron     route appelée par node-cron / cron OS
/models         schémas Mongoose (Prospect, ImportRun, Reminder)
/lib
  /db           connexion MongoDB (singleton)
  /import       parsing JSON + mapping par actor Apify (+ conservation raw)
  /dedup        normalisation des clés + cascade de matching
  /scoring      règles de pré-filtre + calcul du score
  /reminders    moteur d'escalade des relances
  /notify       client Pushover
/components     carte de tri, liste pipeline, buckets rappels
.env.local      (gitignored) — MONGODB_URI, PUSHOVER_TOKEN, PUSHOVER_USER, CRON_SECRET
```

---

## Annexe — Liste de tâches de dev priorisée (à coller dans Claude Code)

**Lot 1 — Socle**

1. Init projet (Next + TS + Tailwind + Mongoose) + connexion MongoDB (singleton, `MONGODB_URI`).
2. Schémas Mongoose (`ImportRun`, `Prospect` avec sous-docs `notes`/`status_history`/`runs` + `raw`, `Reminder`) + **index sparse** sur `keys.*` et index sur `reminders.due_at`/`done`.
3. Module `lib/dedup` : normalisation des clés (place_id depuis url, url_norm, domaine, tél E.164, nom+ville) + cascade T1→T3 (avec tests).

**Lot 2 — Import** 4. Écran « Nouvel import » : upload **JSON**, choix/saisie du run (label, source_type). 5. `lib/import` : parsing JSON + **mapping figé** (table §3, actor `title/totalScore/…`) + calcul des clés + conservation du `raw`. 6. Pipeline d'import : dédup → **si doublon : STOP, aucun restockage, `dup_count++`, jamais ré-affiché si déjà traité** → sinon création (`lifecycle='inbox'`) + trace `runs[]`.
6b. `lib/og` : fetch OpenGraph du `website` (async, best-effort, timeout court, cache dans `prospect.og`) — sans bloquer l'import.

**Lot 3 — Pré-filtre & tri** 7. `lib/scoring` : toggles de pré-filtre + score V1. 8. File de tri clavier-first : carte (§4) avec site/tél/Maps/aperçu OG + panneau prépa-appel, raccourcis, auto-avance, **undo**, snooze daté.

**Lot 4 — CRM** 9. Liste des qualifiés + filtres (ville/secteur/statut). 10. Fiche prospect : pipeline, `status_history` embarqué, notes.

**Lot 5 — Rappels & relances** 11. CRUD rappels + rappel suggéré au passage `contacté`. 12. **Moteur d'escalade** (`lib/reminders`) : surveillance de la stagnation de `contacté`, génération des relances 1/2/3, coupure sur avancée de statut, bucket « relances épuisées ». 13. **Client Pushover** (`lib/notify`) : envoi avec priorité croissante, anti-doublon via `notified_at`, gestion du `receipt` priorité 2. 14. **Ordonnanceur** : worker `node-cron` + route `/api/cron/run-reminders` protégée par `CRON_SECRET` (pour le cron OS). 15. Dashboard buckets + « sans prochaine action » comme écran d'accueil.

**Lot 6 — Finitions V1** 16. Restauration des rejetés/auto-écartés. 17. Backup/export du fichier `.db` en un clic. 18. Écran réglages : cadence des relances (J+3/J+7/J+14), statut déclencheur, toggle `auto_perdu`.

> V2 : éditeur de règles, scoring site web + screenshot, stats par run, séquences de relance avancées + templates, export CRM, récap e-mail, multi-utilisateur.
