# README - Fonction appel destinataire dans l'app livreur

Ce document explique simplement comment la partie **appel destinataire** a ete ajoutee dans le projet MZ Logistic.

L'objectif etait le suivant :

- Quand le livreur scanne un colis ou clique sur un colis affecte, il arrive sur la page details/action du colis.
- Depuis cette page, il peut appuyer sur un bouton pour appeler le destinataire.
- L'application ouvre l'application Telephone du mobile avec le numero du destinataire.
- Juste apres l'ouverture de l'appel, le backend enregistre un evenement dans l'historique du colis.
- L'admin et l'expediteur peuvent ensuite voir dans l'historique combien de fois le livreur a lance un appel.

Important : actuellement, le systeme enregistre **le nombre d'appels + la date/heure de chaque appel**. Il ne mesure pas la duree reelle de la conversation.

---

## 1. Resume du fonctionnement

Le fonctionnement complet est :

1. Le livreur ouvre l'app Flutter.
2. Il scanne un QR code ou clique sur un colis affecte.
3. L'app ouvre la page details du colis : `/colis-action`.
4. La page charge les informations du colis, dont `telephone_destinataire`.
5. Le livreur appuie sur **Ouvrir l'appel**.
6. Flutter ouvre l'application Telephone avec `tel:numero`.
7. Si l'application Telephone s'ouvre correctement, Flutter appelle le backend.
8. Le backend verifie que le colis appartient bien au livreur.
9. Le backend compte les anciens appels du colis.
10. Le backend ajoute une nouvelle ligne dans `colis_history_events`.
11. L'admin et l'expediteur voient l'evenement dans l'historique du colis.

---

## 2. Ce qui est enregistre dans la base

Il n'y a pas une table separee speciale pour les appels.

Les appels sont enregistres dans la table deja utilisee pour l'historique operationnel :

```sql
colis_history_events
```

Chaque appel cree une ligne avec :

- `colis_id` : le colis concerne.
- `kind` : toujours `courier_call` pour un appel livreur.
- `title` : par exemple `Appel destinataire #1`.
- `note` : phrase expliquant que le livreur a ouvert un appel.
- `event_at` : date/heure de l'appel.
- `is_notification` : `false` par defaut.

Exemple de ligne :

```text
kind: courier_call
title: Appel destinataire #2
note: Mohamed a ouvert un appel vers le numero du destinataire depuis l application livreur. Total appels enregistres: 2.
event_at: 2026-05-29 14:22:10
```

---

## 3. Table SQL a avoir dans PostgreSQL

Si la table `colis_history_events` n'existe pas dans la base, il faut la creer.

Script SQL :

```sql
CREATE TABLE IF NOT EXISTS colis_history_events (
  id SERIAL PRIMARY KEY,
  colis_id INTEGER NOT NULL REFERENCES colis(id) ON DELETE CASCADE,
  kind VARCHAR(30) NOT NULL,
  title VARCHAR(180) NOT NULL,
  note TEXT,
  event_at TIMESTAMP NOT NULL DEFAULT NOW(),
  is_notification BOOLEAN NOT NULL DEFAULT FALSE,
  read_at TIMESTAMP,
  expires_at TIMESTAMP
);

CREATE INDEX IF NOT EXISTS ix_colis_history_events_colis_id
  ON colis_history_events(colis_id);

CREATE INDEX IF NOT EXISTS ix_colis_history_events_event_at
  ON colis_history_events(event_at);
```

Cette table sert pour tous les evenements du colis, pas seulement les appels :

- creation du colis,
- validation admin,
- refus admin,
- depot au depot,
- sortie en livraison,
- livraison reportee,
- retour,
- livraison finale,
- appel destinataire.

---

## 4. Fichiers backend concernes

### 4.1 Modele de la table historique

Fichier :

```text
PFE2026-backend/app/models/colis_event.py
```

Role :

- Declare la table SQLAlchemy `colis_history_events`.
- Definit les colonnes de l'historique.
- Relie chaque evenement a un colis avec `colis_id`.

Structure importante :

```python
class ColisEvent(Base):
    __tablename__ = "colis_history_events"

    id = Column(Integer, primary_key=True, index=True)
    colis_id = Column(Integer, ForeignKey("colis.id", ondelete="CASCADE"), nullable=False, index=True)
    kind = Column(String(30), nullable=False)
    title = Column(String(180), nullable=False)
    note = Column(Text, nullable=True)
    event_at = Column(DateTime, nullable=False, default=datetime.utcnow, index=True)
```

---

### 4.2 Relation entre colis et historique

Fichier :

```text
PFE2026-backend/app/models/colis.py
```

Role :

- Ajoute la relation `history` sur chaque colis.
- Permet de recuperer les evenements d'un colis.

Partie importante :

```python
history = relationship(
    "ColisEvent",
    back_populates="colis",
    cascade="all, delete-orphan",
    order_by="ColisEvent.event_at",
)
```

Grace a cette relation, quand un colis est supprime, son historique est aussi supprime.

---

### 4.3 Helper qui ajoute les evenements

Fichier :

```text
PFE2026-backend/app/core/colis_events.py
```

Role :

- Centralise la creation des evenements d'historique.
- Contient la fonction speciale pour l'appel livreur.

Fonction importante :

```python
def add_courier_call_event(
    db,
    colis,
    *,
    courier_name: str | None = None,
    call_count: int,
    event_at: datetime | None = None,
):
    clean_name = (courier_name or "").strip()
    actor = clean_name if clean_name else "Le livreur"
    return add_colis_event(
        db,
        colis,
        kind="courier_call",
        title=f"Appel destinataire #{call_count}",
        note=(
            f"{actor} a ouvert un appel vers le numero du destinataire "
            f"depuis l application livreur. Total appels enregistres: {call_count}."
        ),
        event_at=event_at,
    )
```

Cette fonction ne lance pas l'appel. Elle enregistre seulement l'evenement dans l'historique.

---

### 4.4 Endpoint backend appele par Flutter

Fichier :

```text
PFE2026-backend/app/api/routes/courier_colis.py
```

Endpoint ajoute :

```text
POST /courier/colis/{colis_id}/call
```

Role :

- Recoit la confirmation que le livreur a ouvert l'appel.
- Verifie que le colis existe.
- Verifie que le colis est bien affecte a ce livreur.
- Verifie que le colis a un numero destinataire.
- Compte combien d'appels `courier_call` existent deja pour ce colis.
- Ajoute un nouvel evenement `courier_call`.
- Retourne `call_count`, `event_id` et `event_date`.

Partie importante :

```python
call_count = (
    db.query(ColisEvent)
    .filter(ColisEvent.colis_id == colis.id, ColisEvent.kind == "courier_call")
    .count()
    + 1
)
```

Puis :

```python
event = add_courier_call_event(
    db,
    colis,
    courier_name=courier.name,
    call_count=call_count,
    event_at=happened_at,
)
db.commit()
```

Exemple de reponse :

```json
{
  "detail": "Appel destinataire enregistre dans l historique (2).",
  "call_count": 2,
  "event_id": 154,
  "event_date": "2026-05-29T14:22:10"
}
```

---

### 4.5 Schema de reponse colis

Fichier :

```text
PFE2026-backend/app/schemas/colis.py
```

Role :

- Ajoute `history` dans la reponse des colis.
- Permet au frontend admin et expediteur de recevoir les evenements.

Partie importante :

```python
history: list[ColisHistoryEventResponse] = Field(default_factory=list)
```

---

### 4.6 API admin qui charge l'historique

Fichier :

```text
PFE2026-backend/app/api/routes/admin_colis.py
```

Role :

- Quand l'admin recupere les colis, le backend charge aussi `Colis.history`.
- Cela permet d'afficher les appels dans le modal historique admin.

Partie importante :

```python
db.query(Colis)
  .options(selectinload(Colis.history))
```

---

### 4.7 API expediteur qui charge l'historique

Fichier :

```text
PFE2026-backend/app/api/routes/colis.py
```

Role :

- Quand l'expediteur recupere ses colis, le backend charge aussi `Colis.history`.
- Cela permet d'afficher les appels dans l'historique expediteur.

Partie importante :

```python
db.query(Colis)
  .options(selectinload(Colis.history))
```

---

## 5. Fichiers Flutter concernes

### 5.1 Dependances Flutter

Fichier :

```text
mz_livreur_app/pubspec.yaml
```

Dependance importante :

```yaml
url_launcher: ^6.3.2
```

Role :

- Permet d'ouvrir l'application Telephone du mobile avec un lien `tel:`.

---

### 5.2 Client API Flutter

Fichier :

```text
mz_livreur_app/lib/core/api.dart
```

Role :

- Contient les fonctions generiques `getJson`, `postJson`, `patchJson`.
- La partie appel utilise `Api.postJson(...)` pour appeler le backend.

Exemple utilise par la page colis :

```dart
final log = await Api.postJson(
  '/courier/colis/$colisId/call',
  body: {},
  withAuth: true,
);
```

---

### 5.3 Gestion des routes QR et details colis

Fichier :

```text
mz_livreur_app/lib/core/parcel_deep_link.dart
```

Role :

- Comprend les liens QR.
- Extrait le code colis depuis un QR ou une URL.
- Decide si le lien doit ouvrir le scan ou les details colis.

Route details :

```dart
const parcelDetailRoute = '/colis-action';
```

Fonction utile :

```dart
String parcelDetailsRouteForCode(String code)
```

Elle transforme un code en route :

```text
/colis-action?code=CODE_COLIS
```

---

### 5.4 Configuration des routes Flutter

Fichier :

```text
mz_livreur_app/lib/main.dart
```

Role :

- Enregistre la route `/colis-action`.
- Si une route contient un code colis, elle ouvre `ParcelStatusScreen`.

Partie importante :

```dart
if (normalized.startsWith('/colis-action')) {
  final argumentCode = _codeFromArguments(settings.arguments);
  final routeCode = _codeFromRoute(normalized);
  final code = argumentCode.isNotEmpty ? argumentCode : routeCode;

  return MaterialPageRoute(
    builder: (_) => ParcelStatusScreen(
      initialCode: code,
      initialData: _colisFromArguments(settings.arguments),
    ),
  );
}
```

---

### 5.5 Scan QR vers details colis

Fichier :

```text
mz_livreur_app/lib/screens/parcel_scan.dart
```

Role :

- Lit le QR avec la camera.
- Extrait le code colis.
- Ouvre directement la page details/action du colis.

Partie importante :

```dart
final route = parcelDetailsRouteForCode(code);
Navigator.pushReplacementNamed(context, route, arguments: {'code': code});
```

Donc le scan ne reste pas seulement sur une page scanner : il envoie vers la fiche colis.

---

### 5.6 Clic sur un colis affecte vers details colis

Fichier :

```text
mz_livreur_app/lib/screens/assigned_parcels.dart
```

Role :

- Affiche les colis affectes au livreur.
- Quand le livreur clique sur un colis, l'app ouvre la meme page details/action.

Partie importante :

```dart
Navigator.pushNamed(
  context,
  '/colis-action?code=${Uri.encodeQueryComponent(code)}',
  arguments: {'code': code, 'colis': item},
);
```

Donc il y a le meme comportement dans les deux cas :

- scan QR,
- clic sur colis.

Les deux ouvrent la page `/colis-action`.

---

### 5.7 Page details/action du colis avec bouton appel

Fichier :

```text
mz_livreur_app/lib/screens/parcel_status.dart
```

Role :

- Affiche la fiche du colis.
- Affiche le numero destinataire.
- Affiche le bouton **Ouvrir l'appel**.
- Lance l'application Telephone.
- Enregistre ensuite l'appel dans le backend.

Import important :

```dart
import 'package:url_launcher/url_launcher.dart';
```

Fonction qui nettoie le numero :

```dart
String _dialablePhone(String value) {
  final raw = value.trim();
  final digits = raw.replaceAll(RegExp(r'[^0-9]'), '');
  if (digits.isEmpty) return '';
  if (raw.startsWith('+')) return '+$digits';
  if (digits.startsWith('00') && digits.length > 2) {
    return '+${digits.substring(2)}';
  }
  return digits;
}
```

Fonction principale :

```dart
Future<void> _callRecipient() async {
  final colisId = _currentColisId();
  final phone = _recipientPhoneFromData(_colis);
  final dialablePhone = _dialablePhone(phone);

  final launched = await launchUrl(
    Uri.parse('tel:$dialablePhone'),
    mode: LaunchMode.externalApplication,
  );

  if (!launched) {
    // erreur : impossible d'ouvrir l'app telephone
    return;
  }

  final log = await Api.postJson(
    '/courier/colis/$colisId/call',
    body: {},
    withAuth: true,
  );
}
```

Bouton visuel :

```dart
class _RecipientCallButton extends StatelessWidget
```

Ce widget affiche :

- le numero du destinataire,
- un bouton vert,
- un loader pendant l'ouverture,
- un etat desactive si le numero n'existe pas.

---

## 6. Fichiers frontend web concernes

### 6.1 Modal historique admin

Fichier :

```text
PFE2026_frontend/src/pages/admin/AdminColisHistoryModal.jsx
```

Role :

- Affiche l'historique complet du colis pour l'admin.
- Reconnait les evenements `courier_call`.
- Compte les appels.
- Affiche une carte/statistique **Appels**.

Partie importante :

```javascript
const callCount = timeline.filter((event) => event.kind === "courier_call").length;
```

Dans le modal admin, les appels apparaissent dans :

- la statistique `Appels`,
- la chronologie complete,
- le journal operationnel.

---

### 6.2 Historique expediteur

Fichier :

```text
PFE2026_frontend/src/pages/shipper/HistoriqueColis.jsx
```

Role :

- Affiche l'historique colis cote expediteur.
- Donne un style special aux evenements d'appel.

Partie importante :

```javascript
courier_call: {
  label: "Appel",
  accent: "#0891b2",
  bg: "rgba(8,145,178,.10)",
  glow: "rgba(8,145,178,.18)"
}
```

Les appels du livreur sont donc visibles aussi pour l'expediteur.

---

## 7. Pourquoi on ne sauvegarde pas la duree de l'appel

Actuellement, l'application peut ouvrir l'app Telephone avec :

```text
tel:numero
```

Mais apres cela, l'appel est gere par Android/iOS et par l'application Telephone du systeme.

Flutter ne recoit pas automatiquement :

- si la personne a vraiment repondu,
- si l'appel a ete refuse,
- si l'appel a dure 5 secondes ou 2 minutes,
- l'heure exacte de fin d'appel.

Donc la version actuelle enregistre ce qui est fiable :

- le livreur a appuye sur le bouton appel,
- l'application Telephone s'est ouverte,
- l'evenement a ete enregistre avec timestamp,
- le compteur d'appels augmente.

Pour enregistrer la duree reelle, il faudrait une implementation native Android plus avancee avec permissions sensibles, par exemple :

- permission lecture journal d'appels,
- permission etat du telephone,
- code natif Android,
- gestion stricte des restrictions Google Play,
- cas particulier iOS beaucoup plus limite.

Pour le PFE et pour un resultat stable, la solution actuelle est plus propre : elle enregistre l'action d'appel sans demander de permissions sensibles.

---

## 8. Comment verifier que ca marche

### Test cote livreur

1. Lancer le backend.
2. Lancer l'app livreur.
3. Se connecter avec un compte livreur.
4. Ouvrir un colis affecte.
5. Verifier que la fiche colis contient un numero destinataire.
6. Appuyer sur **Ouvrir l'appel**.
7. L'application Telephone doit s'ouvrir.
8. Revenir dans l'app livreur.
9. Un message doit indiquer que l'appel est enregistre.

### Test cote admin

1. Ouvrir le dashboard web admin.
2. Aller dans les colis confirmes ou la liste des colis.
3. Ouvrir l'historique du colis.
4. Verifier que l'evenement `Appel destinataire #1` apparait.
5. Refaire un appel depuis l'app livreur.
6. Verifier que l'historique affiche `Appel destinataire #2`.

### Test SQL direct

Remplacer `MZ-IA-00522-65857` par le numero du colis a verifier :

```sql
SELECT e.id, e.kind, e.title, e.note, e.event_at
FROM colis_history_events e
JOIN colis c ON c.id = e.colis_id
WHERE c.numero_suivi = 'MZ-IA-00522-65857'
ORDER BY e.event_at ASC;
```

Pour compter seulement les appels :

```sql
SELECT COUNT(*) AS total_appels
FROM colis_history_events e
JOIN colis c ON c.id = e.colis_id
WHERE c.numero_suivi = 'MZ-IA-00522-65857'
  AND e.kind = 'courier_call';
```

---

## 9. Erreurs possibles

### Erreur : "Ce colis n'est pas ton colis"

Cause :

- Le colis n'est pas affecte au livreur connecte.
- Ou la tournee n'est pas en statut `accepted`.

Verification :

```sql
SELECT t.id, t.nom, t.status, t.livreur_id, tc.colis_id
FROM tournee_colis tc
JOIN tournees t ON t.id = tc.tournee_id
WHERE tc.colis_id = ID_DU_COLIS;
```

---

### Erreur : "Aucun telephone destinataire"

Cause :

- Le champ `telephone_destinataire` du colis est vide.

Verification :

```sql
SELECT id, numero_suivi, telephone_destinataire
FROM colis
WHERE numero_suivi = 'MZ-IA-00522-65857';
```

---

### L'appel s'ouvre mais l'historique ne se met pas a jour

Ca peut arriver si :

- le backend est eteint,
- le telephone n'est pas sur le meme reseau que le backend,
- l'IP dans `mz_livreur_app/lib/core/api.dart` n'est pas correcte,
- le token du livreur est expire,
- le colis n'est pas affecte au livreur.

Fichier a verifier :

```text
mz_livreur_app/lib/core/api.dart
```

Exemple :

```dart
return 'http://192.168.1.14:8000';
```

Cette IP doit etre l'IP du PC qui lance le backend.

---

## 10. Conclusion simple

La partie appel fonctionne comme un **journal d'action**.

Elle ne sauvegarde pas l'audio et ne mesure pas la duree de conversation.

Elle sauvegarde :

- le fait que le livreur a lance un appel,
- la date et l'heure,
- le colis concerne,
- le numero d'appel dans l'ordre : #1, #2, #3,
- l'information visible dans l'historique admin et expediteur.

La table importante est :

```text
colis_history_events
```

Le type d'evenement important est :

```text
courier_call
```

Le endpoint important est :

```text
POST /courier/colis/{colis_id}/call
```

Les fichiers les plus importants sont :

```text
mz_livreur_app/lib/screens/parcel_status.dart
PFE2026-backend/app/api/routes/courier_colis.py
PFE2026-backend/app/core/colis_events.py
PFE2026-backend/app/models/colis_event.py
PFE2026_frontend/src/pages/admin/AdminColisHistoryModal.jsx
PFE2026_frontend/src/pages/shipper/HistoriqueColis.jsx
```

