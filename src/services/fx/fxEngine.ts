import type { CurrencyCode, Expense, FxRate } from '@/models';

export function convertAmount(amount: number, rate: FxRate): number {
  return roundMoney(amount * rate.rate);
}

export function applyBaseCurrency(expense: Expense, baseCurrency: CurrencyCode, rates: FxRate[]): Expense {
  if (expense.currency === baseCurrency) {
    return { ...expense, fxRateToBase: 1, baseAmount: expense.amount };
  }

  const rate = rates.find(
    (candidate) =>
      candidate.baseCurrency === expense.currency &&
      candidate.quoteCurrency === baseCurrency &&
      candidate.rateDate === expense.occurredAt.slice(0, 10),
  );

  if (!rate) {
    return expense;
  }

  return {
    ...expense,
    fxRateToBase: rate.rate,
    baseAmount: convertAmount(expense.amount, rate),
  };
}

function roundMoney(value: number): number {
  return Math.round((value + Number.EPSILON) * 100) / 100;
}
