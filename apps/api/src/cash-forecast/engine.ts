import { CashCategory, CashRecurrence } from "@prisma/client";

export interface ForecastLineInput {
  id: string;
  label: string;
  category: CashCategory;
  amount: number; // signé : + encaissement, − décaissement
  startDate: Date;
  recurrence: CashRecurrence;
  endDate: Date | null;
}

export interface WeekProjection {
  weekStart: Date;
  weekEnd: Date;
  inflows: number;
  outflows: number;
  net: number;
  closingBalance: number;
  status: "bon" | "attention" | "critique";
  movements: Array<{ lineId: string; label: string; category: CashCategory; date: Date; amount: number }>;
}

export interface CashProjection {
  openingBalance: number;
  horizonWeeks: number;
  from: Date;
  weeks: WeekProjection[];
  lowestBalance: number;
  lowestWeekStart: Date | null;
}

const DAY_MS = 24 * 60 * 60 * 1000;

function startOfDay(date: Date): Date {
  return new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()));
}

/** Lundi de la semaine (UTC) contenant la date. */
export function startOfWeek(date: Date): Date {
  const day = startOfDay(date);
  const weekday = (day.getUTCDay() + 6) % 7; // lundi = 0
  return new Date(day.getTime() - weekday * DAY_MS);
}

function addMonths(date: Date, months: number): Date {
  const result = new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth() + months, 1));
  // Conserve le jour du mois quand il existe, sinon dernier jour du mois (31 → 30/28).
  const lastDay = new Date(Date.UTC(result.getUTCFullYear(), result.getUTCMonth() + 1, 0)).getUTCDate();
  result.setUTCDate(Math.min(date.getUTCDate(), lastDay));
  return result;
}

/**
 * Développe une ligne (éventuellement récurrente) en occurrences datées
 * comprises dans [from, to]. Une occurrence antérieure à `from` est ignorée :
 * elle est censée être déjà reflétée dans le solde d'ouverture.
 */
export function expandOccurrences(line: ForecastLineInput, from: Date, to: Date): Date[] {
  const occurrences: Date[] = [];
  const hardEnd = line.endDate && line.endDate.getTime() < to.getTime() ? line.endDate : to;
  let cursor = startOfDay(line.startDate);
  let iteration = 0;

  while (cursor.getTime() <= hardEnd.getTime()) {
    if (cursor.getTime() >= from.getTime()) occurrences.push(cursor);
    if (line.recurrence === CashRecurrence.NONE) break;
    iteration += 1;
    cursor =
      line.recurrence === CashRecurrence.WEEKLY
        ? new Date(startOfDay(line.startDate).getTime() + iteration * 7 * DAY_MS)
        : addMonths(startOfDay(line.startDate), iteration);
    if (iteration > 520) break; // garde-fou : 10 ans de récurrence hebdo
  }
  return occurrences;
}

function statusFor(closingBalance: number, openingBalance: number): WeekProjection["status"] {
  if (closingBalance < 0) return "critique";
  // Sous 20 % du solde de départ (ou sous 0 si le départ est déjà négatif) :
  // marge de manœuvre faible, à surveiller.
  if (openingBalance > 0 && closingBalance < openingBalance * 0.2) return "attention";
  return "bon";
}

export function projectCashFlow(
  openingBalance: number,
  lines: ForecastLineInput[],
  from: Date,
  horizonWeeks: number
): CashProjection {
  const firstWeek = startOfWeek(from);
  const horizonEnd = new Date(firstWeek.getTime() + horizonWeeks * 7 * DAY_MS - DAY_MS);

  const buckets: WeekProjection[] = Array.from({ length: horizonWeeks }, (_, index) => {
    const weekStart = new Date(firstWeek.getTime() + index * 7 * DAY_MS);
    return {
      weekStart,
      weekEnd: new Date(weekStart.getTime() + 6 * DAY_MS),
      inflows: 0,
      outflows: 0,
      net: 0,
      closingBalance: 0,
      status: "bon",
      movements: [],
    };
  });

  for (const line of lines) {
    for (const date of expandOccurrences(line, startOfDay(from), horizonEnd)) {
      const index = Math.floor((startOfWeek(date).getTime() - firstWeek.getTime()) / (7 * DAY_MS));
      const bucket = buckets[index];
      if (!bucket) continue;
      bucket.movements.push({ lineId: line.id, label: line.label, category: line.category, date, amount: line.amount });
      if (line.amount >= 0) bucket.inflows += line.amount;
      else bucket.outflows += -line.amount;
    }
  }

  let balance = openingBalance;
  let lowestBalance = openingBalance;
  let lowestWeekStart: Date | null = null;
  for (const bucket of buckets) {
    bucket.net = bucket.inflows - bucket.outflows;
    balance += bucket.net;
    bucket.closingBalance = balance;
    bucket.status = statusFor(balance, openingBalance);
    bucket.movements.sort((a, b) => a.date.getTime() - b.date.getTime());
    if (balance < lowestBalance) {
      lowestBalance = balance;
      lowestWeekStart = bucket.weekStart;
    }
  }

  return { openingBalance, horizonWeeks, from: startOfDay(from), weeks: buckets, lowestBalance, lowestWeekStart };
}
