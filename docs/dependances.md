# Dépendances et vulnérabilités connues

`npm audit` n'est pas vert, et ce n'est pas un oubli. Ce fichier dit pourquoi,
pour chaque entrée qui reste. Il est tenu à jour avec le résultat de la
commande : une entrée qui disparaît de l'audit disparaît d'ici.

Un cabinet qui nous évalue lancera `npm audit` ; il doit trouver la réponse
écrite plutôt qu'avoir à la demander.

---

## `uuid` < 11.1.1 — modérée — **laissée en l'état, chemin inatteignable**

*GHSA-w5hq-g745-h8pq — Missing buffer bounds check in v3/v5/v6 when `buf` is
provided.*

Arrive par `exceljs`, qui sert à produire les rapports au format Excel.

**Pourquoi elle ne nous atteint pas.** L'avis porte sur `v3`, `v5` et `v6`
appelés avec un argument `buf`. `exceljs` n'utilise `uuid` qu'à un seul
endroit — `lib/xlsx/xform/sheet/cf-ext/cf-rule-ext-xform.js` — et y appelle
`v4()`, deux fois, sans argument. Le code vulnérable n'est pas sur le chemin.

**Pourquoi on ne la force pas.** `npm audit fix --force` propose
`exceljs@3.4.0`, une version majeure en arrière, dont l'API diffère : on
casserait l'export Excel, qui fonctionne, pour corriger un chemin qu'on
n'emprunte pas. Une surcharge `overrides` vers `uuid@^11` a été essayée : npm
l'enregistre mais ne réécrit pas l'arbre sans régénérer le verrou, et imposer
une version majeure dans la dépendance d'une bibliothèque qu'on ne maintient
pas se paierait tôt ou tard par une panne à l'export.

**Ce qui la ferait disparaître.** Une version d'`exceljs` qui relève `uuid` —
à surveiller à chaque mise à jour.

---

## Résolu

### `xlsx` (SheetJS) — élevée — **remplacé le 6 octobre 2026**

*GHSA-4r6h-8v6p-xvw6 (pollution de prototype) et GHSA-5pgg-2g8v-p4x9 (déni de
service par expression régulière).*

SheetJS a quitté npm : la version qui y reste publiée porte ces deux failles,
et **aucun correctif n'y viendra**. La version corrigée n'existe que sur le
CDN de l'éditeur.

Les paquets npm qui proposent cette version corrigée — `@e965/xlsx`,
`xlsx-republish` — sont des republications du tarball officiel par des tiers.
Les retenir aurait échangé une faille connue et bornée contre un intermédiaire
non officiel dans la chaîne d'approvisionnement, sur l'outil qui lit les grands
livres de nos clients. Ce n'est pas un progrès.

Remplacé par **`read-excel-file`**, bibliothèque indépendante et maintenue,
sans vulnérabilité connue. Elle rend des lignes de cellules et non des objets :
les objets sont construits par `parseFile.ts` sur un prototype nul, ce qui
retire la pollution de prototype de la liste des choses possibles au lieu de la
corriger après coup.

**Ce qui a été perdu**, et qu'il faut dire aux clients : les classeurs `.xls`
d'avant 2007, que SheetJS savait lire. L'import les refuse maintenant avec une
phrase qui dit quoi faire — réenregistrer en `.xlsx` ou en CSV — plutôt qu'un
« fichier illisible ».
