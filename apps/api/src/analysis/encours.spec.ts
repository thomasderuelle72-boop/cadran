import { computeBalanceAgee, computeConcentration, type EcritureTiers } from "./encours";

const REFERENCE = new Date("2026-06-30T00:00:00.000Z");

let compteur = 0;

function ligne(partiel: Partial<EcritureTiers> & { accountCode: string }): EcritureTiers {
  compteur += 1;
  return {
    journalCode: "VTE",
    entryNum: String(compteur),
    entryDate: new Date("2026-06-01T00:00:00.000Z"),
    auxAccountCode: null,
    auxAccountLabel: null,
    pieceDate: null,
    debit: 0,
    credit: 0,
    lettering: null,
    ...partiel,
  };
}

/** Facture client : une ligne de tiers au débit, une ligne de produit au crédit. */
function facture(
  numero: string,
  tiers: string,
  nomTiers: string,
  datePiece: string,
  montantHt: number,
  tva = 0.2,
  lettering: string | null = null
): EcritureTiers[] {
  const pieceDate = new Date(`${datePiece}T00:00:00.000Z`);
  const ttc = Math.round(montantHt * (1 + tva) * 100) / 100;
  return [
    {
      journalCode: "VTE",
      entryNum: numero,
      entryDate: pieceDate,
      accountCode: "411000",
      auxAccountCode: tiers,
      auxAccountLabel: nomTiers,
      pieceDate,
      debit: ttc,
      credit: 0,
      lettering,
    },
    {
      journalCode: "VTE",
      entryNum: numero,
      entryDate: pieceDate,
      accountCode: "706000",
      auxAccountCode: null,
      auxAccountLabel: null,
      pieceDate,
      debit: 0,
      credit: montantHt,
      lettering: null,
    },
    {
      journalCode: "VTE",
      entryNum: numero,
      entryDate: pieceDate,
      accountCode: "445710",
      auxAccountCode: null,
      auxAccountLabel: null,
      pieceDate,
      debit: 0,
      credit: Math.round((ttc - montantHt) * 100) / 100,
      lettering: null,
    },
  ];
}

describe("balance âgée", () => {
  const ecritures = [
    // 12 000 TTC au 20 juin : 10 jours d'âge.
    ...facture("F1", "C001", "Atelier Dupont", "2026-06-20", 10000),
    // 6 000 TTC au 15 mai : 46 jours.
    ...facture("F2", "C002", "Menuiserie Lambert", "2026-05-15", 5000),
    // 3 600 TTC au 1er février : 149 jours.
    ...facture("F3", "C001", "Atelier Dupont", "2026-02-01", 3000),
    // Facture réglée : lettrée, donc hors encours.
    ...facture("F4", "C003", "Société Payée", "2026-03-01", 20000, 0.2, "AA"),
  ];

  const balance = computeBalanceAgee(ecritures, "CLIENT", REFERENCE);

  it("exclut les écritures lettrées de l'encours", () => {
    // 12 000 + 6 000 + 3 600 = 21 600 ; les 24 000 réglés n'y sont pas.
    expect(balance.encoursTotal).toBe(21600);
    expect(balance.tiers.some((t) => t.code === "C003")).toBe(false);
  });

  it("ne retient que les comptes de tiers du sens demandé", () => {
    // Les lignes 706 et 445 de chaque facture ne sont pas des créances.
    const somme = balance.tranches.reduce((total, tranche) => total + tranche.montant, 0);
    expect(somme).toBe(balance.encoursTotal);
  });

  it("ventile par tranche d'ancienneté à partir de la date de pièce", () => {
    const parId = Object.fromEntries(balance.tranches.map((t) => [t.id, t.montant]));
    expect(parId["0_30"]).toBe(12000);
    expect(parId["31_60"]).toBe(6000);
    expect(parId["61_90"]).toBe(0);
    expect(parId["90_plus"]).toBe(3600);
  });

  it("cumule l'encours par tiers et le classe du plus lourd au plus léger", () => {
    expect(balance.tiers.map((t) => t.code)).toEqual(["C001", "C002"]);
    expect(balance.tiers[0].encours).toBe(15600); // 12 000 + 3 600
    expect(balance.tiers[0].part).toBeCloseTo(15600 / 21600, 6);
  });

  it("calcule un âge moyen pondéré, insensible au biais de TVA", () => {
    // (12 000 × 10 + 6 000 × 46 + 3 600 × 149) / 21 600
    const attendu = (12000 * 10 + 6000 * 46 + 3600 * 149) / 21600;
    expect(balance.ageMoyenPondere).toBeCloseTo(attendu, 6);
  });

  it("isole ce qui dépasse le délai de paiement retenu", () => {
    // Délai par défaut de 30 jours : les factures de mai et février.
    expect(balance.delaiPaiementJours).toBe(30);
    expect(balance.encoursEnRetard).toBe(9600);
  });

  it("suit un délai de paiement négocié plus long", () => {
    const a60 = computeBalanceAgee(ecritures, "CLIENT", REFERENCE, 60);
    // À 60 jours, seule la facture de février est en retard.
    expect(a60.encoursEnRetard).toBe(3600);
  });

  it("remonte l'âge de la pièce ouverte la plus ancienne par tiers", () => {
    expect(balance.tiers[0].ageMaximal).toBe(149);
  });

  it("retombe sur la date d'écriture quand la date de pièce manque", () => {
    const sansPiece = computeBalanceAgee(
      [
        ligne({
          accountCode: "411000",
          auxAccountCode: "C009",
          auxAccountLabel: "Sans pièce",
          entryDate: new Date("2026-05-31T00:00:00.000Z"),
          pieceDate: null,
          debit: 1000,
        }),
      ],
      "CLIENT",
      REFERENCE
    );
    expect(sansPiece.tiers[0].ageMoyen).toBe(30);
  });

  it("regroupe à part les écritures sans compte auxiliaire", () => {
    const anonyme = computeBalanceAgee(
      [ligne({ accountCode: "411000", debit: 800, pieceDate: new Date("2026-06-10T00:00:00.000Z") })],
      "CLIENT",
      REFERENCE
    );
    expect(anonyme.encoursTotal).toBe(800);
    expect(anonyme.sansTiers).toBe(800);
    expect(anonyme.tiers).toHaveLength(0);
  });

  it("lit les dettes fournisseurs dans le sens créditeur", () => {
    const fournisseurs = computeBalanceAgee(
      [
        ligne({
          accountCode: "401000",
          auxAccountCode: "F001",
          auxAccountLabel: "Grossiste Martin",
          pieceDate: new Date("2026-06-01T00:00:00.000Z"),
          credit: 4500,
        }),
      ],
      "FOURNISSEUR",
      REFERENCE
    );
    expect(fournisseurs.encoursTotal).toBe(4500);
    expect(fournisseurs.tiers[0].label).toBe("Grossiste Martin");
  });

  it("rend un résultat exploitable sans aucune écriture", () => {
    const vide = computeBalanceAgee([], "CLIENT", REFERENCE);
    expect(vide.encoursTotal).toBe(0);
    expect(vide.ageMoyenPondere).toBeNull();
    expect(vide.tranches).toHaveLength(4);
  });
});

describe("concentration", () => {
  const ecritures = [
    ...facture("F1", "C001", "Atelier Dupont", "2026-01-15", 60000),
    ...facture("F2", "C002", "Menuiserie Lambert", "2026-02-15", 25000),
    ...facture("F3", "C003", "Charpente Ovide", "2026-03-15", 10000),
    ...facture("F4", "C004", "Escaliers Rey", "2026-04-15", 5000),
  ];

  const concentration = computeConcentration(ecritures, "CLIENT");

  it("attribue le montant hors taxes au tiers porté par la ligne de compte auxiliaire", () => {
    // La TVA de chaque facture est exclue : 60 000 et non 72 000.
    expect(concentration.total).toBe(100000);
    expect(concentration.tiers[0]).toMatchObject({ code: "C001", montant: 60000 });
  });

  it("classe les tiers par poids décroissant", () => {
    expect(concentration.tiers.map((t) => t.code)).toEqual(["C001", "C002", "C003", "C004"]);
  });

  it("calcule les parts cumulées", () => {
    expect(concentration.partPremier).toBeCloseTo(0.6, 6);
    expect(concentration.partTroisPremiers).toBeCloseTo(0.95, 6);
    // Moins de dix clients : le cumul des dix premiers vaut la totalité.
    expect(concentration.partDixPremiers).toBeCloseTo(1, 6);
  });

  it("calcule l'indice de Herfindahl", () => {
    // 0,36 + 0,0625 + 0,01 + 0,0025 = 0,435, bien au-dessus du seuil de 0,25
    // au-delà duquel un portefeuille est considéré comme concentré.
    expect(concentration.herfindahl).toBeCloseTo(0.435, 6);
  });

  it("compte aussi les factures déjà réglées, contrairement à l'encours", () => {
    const avecReglee = computeConcentration(
      [...ecritures, ...facture("F5", "C005", "Client Payeur", "2026-05-15", 40000, 0.2, "AA")],
      "CLIENT"
    );
    expect(avecReglee.total).toBe(140000);
    expect(avecReglee.tiers.some((t) => t.code === "C005")).toBe(true);
  });

  it("ignore une écriture sans tiers identifiable", () => {
    const sansTiers = computeConcentration(
      [
        ligne({ journalCode: "OD", entryNum: "X1", accountCode: "706000", credit: 9000 }),
        ...facture("F1", "C001", "Atelier Dupont", "2026-01-15", 1000),
      ],
      "CLIENT"
    );
    expect(sansTiers.total).toBe(1000);
  });

  it("lit les achats par fournisseur", () => {
    const achats: EcritureTiers[] = [
      ligne({
        journalCode: "ACH",
        entryNum: "A1",
        accountCode: "401000",
        auxAccountCode: "F001",
        auxAccountLabel: "Grossiste Martin",
        credit: 12000,
      }),
      ligne({ journalCode: "ACH", entryNum: "A1", accountCode: "607000", debit: 10000 }),
      ligne({ journalCode: "ACH", entryNum: "A1", accountCode: "445660", debit: 2000 }),
    ];
    const resultat = computeConcentration(achats, "FOURNISSEUR");
    expect(resultat.total).toBe(10000);
    expect(resultat.tiers[0].label).toBe("Grossiste Martin");
  });

  it("rend un résultat exploitable sans aucune écriture", () => {
    const vide = computeConcentration([], "CLIENT");
    expect(vide.total).toBe(0);
    expect(vide.partPremier).toBeNull();
    expect(vide.herfindahl).toBeNull();
  });
});
