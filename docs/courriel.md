# Envoi des courriels

Cadran envoie deux courriels transactionnels : le lien de réinitialisation de
mot de passe, et la confirmation qu'un mot de passe a été changé.

Sans configuration, **l'API ne plante pas** : elle écrit le message dans ses
journaux au lieu de l'expédier, et le signale à chaque envoi. C'est ce qui
permet de développer sans serveur de courrier — on lit le lien dans la
console. En production, c'est un défaut à corriger : le client ne reçoit rien.

## Les quatre variables

| Variable        | Rôle                                       | Exemple                                  |
| --------------- | ------------------------------------------ | ---------------------------------------- |
| `SMTP_HOST`     | Serveur d'envoi. **Son absence déclenche le mode journal.** | `smtp.resend.com`         |
| `SMTP_PORT`     | 587 (STARTTLS) ou 465 (TLS immédiat)       | `587`                                    |
| `SMTP_USER`     | Identifiant fourni par le service          | `resend`                                 |
| `SMTP_PASSWORD` | Clé d'API                                  | `re_xxxxxxxxxxxx`                        |
| `SMTP_FROM`     | Expéditeur affiché                         | `Cadran <bonjour@cadran.fr>`             |

`SMTP_PORT` détermine seul le mode TLS : 465 chiffre dès la connexion, tout
autre port passe par STARTTLS. Se tromper donne une erreur de protocole peu
parlante.

## Le point bloquant : le domaine

**On ne peut pas expédier depuis une adresse Gmail.** Ce n'est pas une
limitation de Cadran : Gmail publie une politique DMARC qui demande aux
serveurs destinataires de rejeter tout message prétendant venir de
`@gmail.com` sans être passé par les serveurs de Google. Un service tiers qui
signerait à sa place verrait ses messages refusés.

Il faut donc un domaine à soi. Une fois `cadran.fr` (ou autre) acheté :

1. Créer un compte chez le service d'envoi et y déclarer le domaine.
2. Poser les trois enregistrements DNS qu'il indique, chez le registrar :
   - **SPF** (`TXT`) — désigne les serveurs autorisés à expédier pour le domaine.
   - **DKIM** (`TXT`) — la clé publique qui permet de vérifier la signature
     apposée sur chaque message.
   - **DMARC** (`TXT`) — la consigne donnée aux destinataires quand SPF ou
     DKIM échoue. Commencer par `p=none` (observer), passer à `p=quarantine`
     une fois les rapports propres.
3. Attendre la vérification du domaine par le service (minutes à heures).
4. Poser les cinq variables ci-dessus sur le service d'API, et redéployer.

Sauter l'étape 2 est la cause n° 1 des courriels qui arrivent en
indésirables — voire qui n'arrivent pas du tout.

## Vérifier sans compte ni domaine

Un serveur SMTP minimal suffit à contrôler que l'API envoie réellement, et
que le message est correct. C'est ainsi que le gabarit HTML a été validé :

```bash
# Un puits SMTP sur le port 2525 qui écrit les messages reçus dans un fichier,
# puis, dans apps/api/.env :
#   SMTP_HOST="127.0.0.1"
#   SMTP_PORT=2525
```

Deux choses à contrôler dans le message capturé :

- **`multipart/alternative`** avec une version texte *et* une version HTML.
  Une version texte absente est en soi un signal de pourriel pour les filtres.
- **Le lien dans un attribut `href`.** En texte seul, le codage
  quoted-printable insère un saut de ligne souple au milieu de l'URL ; des
  clients de messagerie coupent alors l'adresse à cet endroit. C'est
  exactement ce que le gabarit HTML évite.

## Ce qui n'est pas fait

- **Pas de file d'attente.** `EmailService.envoyer()` ne lève jamais : un
  envoi raté est journalisé, et l'action qui l'a déclenché réussit quand même.
  C'est volontaire — un utilisateur qui demande un lien et reçoit une erreur
  500 conclut que son compte est cassé, alors que seul le serveur de courrier
  l'est. En contrepartie, un courriel perdu est perdu.
- **Pas de relance.** Les courriels de recouvrement d'impayé (dunning) sont à
  écrire quand Stripe sera branché.
