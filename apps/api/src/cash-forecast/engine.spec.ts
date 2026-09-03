import { CashCategory, CashRecurrence } from "@prisma/client";
import { expandOccurrences, projectCashFlow, startOfWeek, ForecastLineInput } from "./engine";

const line = (overrides: Partial<ForecastLineInput>): ForecastLineInput => ({
  id: "l1",
  label: "test",
  category: CashCategory.AUTRE,
  amount: 100,
  startDate: new Date("2026-09-07T00:00:00Z"), // un lundi
  recurrence: CashRecurrence.NONE,
  endDate: null,
  ...overrides,
});

describe("moteur de projection de trésorerie", () => {
  it("ramène toute date au lundi de sa semaine", () => {
    expect(startOfWeek(new Date("2026-09-09T15:00:00Z")).toISOString()).toBe("2026-09-07T00:00:00.000Z");
    expect(startOfWeek(new Date("2026-09-13T23:59:00Z")).toISOString()).toBe("2026-09-07T00:00:00.000Z");
    expect(startOfWeek(new Date("2026-09-14T00:00:00Z")).toISOString()).toBe("2026-09-14T00:00:00.000Z");
  });

  it("développe une récurrence mensuelle en respectant la fin de mois", () => {
    const occurrences = expandOccurrences(
      line({ startDate: new Date("2026-01-31T00:00:00Z"), recurrence: CashRecurrence.MONTHLY }),
      new Date("2026-01-01T00:00:00Z"),
      new Date("2026-04-30T00:00:00Z")
    );
    expect(occurrences.map((d) => d.toISOString().slice(0, 10))).toEqual([
      "2026-01-31",
      "2026-02-28",
      "2026-03-31",
      "2026-04-30",
    ]);
  });

  it("ignore les occurrences antérieures au début de projection et respecte endDate", () => {
    const occurrences = expandOccurrences(
      line({
        startDate: new Date("2026-08-03T00:00:00Z"),
        recurrence: CashRecurrence.WEEKLY,
        endDate: new Date("2026-09-21T00:00:00Z"),
      }),
      new Date("2026-09-07T00:00:00Z"),
      new Date("2026-12-31T00:00:00Z")
    );
    expect(occurrences.map((d) => d.toISOString().slice(0, 10))).toEqual(["2026-09-07", "2026-09-14", "2026-09-21"]);
  });

  it("projette le solde semaine par semaine et détecte le point bas", () => {
    const projection = projectCashFlow(
      1000,
      [
        line({ id: "salaires", amount: -600, startDate: new Date("2026-09-10T00:00:00Z"), recurrence: CashRecurrence.MONTHLY }),
        line({ id: "clients", amount: 900, startDate: new Date("2026-09-21T00:00:00Z"), recurrence: CashRecurrence.MONTHLY }),
      ],
      new Date("2026-09-07T00:00:00Z"),
      6
    );

    expect(projection.weeks).toHaveLength(6);
    // Semaine 1 (7-13/09) : -600 → 400 ; semaine 3 (21-27/09) : +900 → 1300 ;
    // semaine 5 (5-11/10) : -600 → 700 (le 10/10) ; rien d'autre sur l'horizon.
    expect(projection.weeks.map((w) => w.closingBalance)).toEqual([400, 400, 1300, 1300, 700, 700]);
    expect(projection.lowestBalance).toBe(400);
    expect(projection.lowestWeekStart?.toISOString().slice(0, 10)).toBe("2026-09-07");
    expect(projection.weeks[0].status).toBe("bon");
  });

  it("marque la semaine en critique quand le solde devient négatif", () => {
    const projection = projectCashFlow(
      100,
      [line({ amount: -250, startDate: new Date("2026-09-08T00:00:00Z") })],
      new Date("2026-09-07T00:00:00Z"),
      2
    );
    expect(projection.weeks[0].closingBalance).toBe(-150);
    expect(projection.weeks[0].status).toBe("critique");
    expect(projection.weeks[1].status).toBe("critique");
  });

  it("marque en attention un solde qui tombe sous 20 % du solde d'ouverture", () => {
    const projection = projectCashFlow(
      1000,
      [line({ amount: -850, startDate: new Date("2026-09-08T00:00:00Z") })],
      new Date("2026-09-07T00:00:00Z"),
      1
    );
    expect(projection.weeks[0].status).toBe("attention");
  });
});
