# Référentiel sectoriel

La carte « Comparaison sectorielle » du diagnostic situe chaque dossier dans
les quartiles de son secteur. Le moteur est en place ; il est livré **sans
données**, et la carte reste invisible tant qu'aucun référentiel n'est chargé.

## Pourquoi il est vide

La source visée est la Banque de France : fascicules d'indicateurs sectoriels
FIBEN, environ 90 secteurs, quartiles par ratio. Deux textes s'appliquent, et
ils ne disent pas la même chose :

- les mentions légales du site autorisent la réutilisation, y compris
  commerciale, à condition de citer la source, d'afficher la date de dernière
  mise à jour et d'indiquer que les informations viennent du site
  institutionnel de la Banque de France ;
- chaque fascicule PDF interdit toute reproduction, même partielle, « sans
  l'autorisation expresse de la Banque de France ».

Le texte le plus restrictif l'emporte tant que la Banque de France ne s'est
pas prononcée. Aucune de ses valeurs n'est donc versionnée — pas même dans les
tests, dont les quartiles sont inventés.

**Contact :** fiben@banque-france.fr. Demande à faire au nom de la société,
pour un usage commercial, en précisant : affichage des quartiles à l'unité de
secteur, mention de source et de date sur chaque écran, pas de redistribution
des fichiers.

## Activer, une fois l'autorisation écrite reçue

1. Convertir les fascicules du millésime voulu au format décrit dans
   `apps/api/src/benchmark/import-reference.ts` (un fichier JSON par
   millésime).
2. Console d'administration → Plateforme → Référentiel sectoriel → charger le
   fichier. Le fichier est refusé en entier à la première anomalie, avec son
   motif ; rien n'est chargé à moitié.
3. Ouvrir le diagnostic d'un dossier qui a un code NAF et un exercice complet :
   la carte apparaît.

Charger un millésime remplace celui de même millésime ; le plus récent est
celui qu'on affiche. « Retirer » supprime un millésime, et la carte disparaît
s'il n'en reste aucun.

## Ce que le moteur garantit

- Les ratios suivent les définitions des fascicules (délai clients sur le
  chiffre d'affaires TTC et 360 jours, taux de marge sur la valeur ajoutée,
  dénominateur nul ou négatif → pas de ratio). Ceux qu'on ne peut reproduire
  exactement depuis nos agrégats portent « ≈ » à l'écran, avec l'écart.
- Seuls les extrêmes sont qualifiés (« Favorable », « Défavorable »), et
  jamais un ratio de structure.
- Avertissements affichés quand la division n'est pas publiée (repli sur la
  section), quand le dossier est plus petit que le premier quartile de
  l'échantillon, et quand l'effectif manque.
- La mention de source et de date est produite par le serveur, pour qu'aucun
  écran ne puisse l'omettre.
