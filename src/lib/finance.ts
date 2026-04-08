import { BusinessState, Expense, Sale } from "@/lib/types";

const THIRTY_DAYS = 30 * 24 * 60 * 60 * 1000;

const toDate = (value: string) => new Date(value).getTime();

const inLast30Days = (value: string, now: number) => {
  const time = toDate(value);
  return now - time <= THIRTY_DAYS && now >= time;
};

export const sum = (values: number[]) => values.reduce((acc, n) => acc + n, 0);

export const stockValue = (state: BusinessState) =>
  sum(state.inventory.map((item) => item.quantity * item.unitCost));

export const purchaseValue = (state: BusinessState) =>
  sum(state.inventory.map((item) => item.purchasedQuantity * item.unitCost));

export const salesRevenue = (sales: Sale[]) => sum(sales.map((sale) => sale.saleValue));

export const salesReceived = (sales: Sale[]) =>
  sum(sales.map((sale) => sale.receivedAmount ?? sale.saleValue));

export const cogsValue = (sales: Sale[]) => sum(sales.map((sale) => sale.costBasis));

export const expenseValue = (expenses: Expense[]) =>
  sum(expenses.map((expense) => expense.amount));

export const expensePaidValue = (expenses: Expense[]) =>
  sum(expenses.map((expense) => expense.paidAmount ?? expense.amount));

export const totalInvested = (state: BusinessState) =>
  sum(state.investments.map((entry) => entry.amount));

export const investedByPartner = (state: BusinessState, partner: "Manav" | "Rahul") =>
  sum(state.investments.filter((entry) => entry.partner === partner).map((entry) => entry.amount));

export const withdrawnValue = (state: BusinessState) =>
  sum(state.withdrawals.map((entry) => entry.amount));

export const withdrawnByPartner = (state: BusinessState, partner: "Manav" | "Rahul") =>
  sum(state.withdrawals.filter((entry) => entry.partner === partner).map((entry) => entry.amount));

export const netInvestmentByPartner = (state: BusinessState, partner: "Manav" | "Rahul") =>
  investedByPartner(state, partner) - withdrawnByPartner(state, partner);

export const totalProfit = (state: BusinessState) =>
  salesRevenue(state.sales) - cogsValue(state.sales) - expenseValue(state.expenses);

export const retainedProfit = (state: BusinessState) =>
  totalProfit(state) - withdrawnValue(state);

export const cashInHand = (state: BusinessState) => {
  const incoming = totalInvested(state) + salesReceived(state.sales);
  const outgoing =
    purchaseValue(state) +
    expensePaidValue(state.expenses) +
    withdrawnValue(state);
  return incoming - outgoing;
};

export const netPosition = (state: BusinessState) =>
  cashInHand(state) + stockValue(state);

export const metrics30Days = (state: BusinessState, now = Date.now()) => {
  const recentSales = state.sales.filter((sale) => inLast30Days(sale.soldOn, now));
  const recentExpenses = state.expenses.filter((expense) =>
    inLast30Days(expense.spentOn, now),
  );

  const revenue = salesRevenue(recentSales);
  const cogs = cogsValue(recentSales);
  const expenses = expenseValue(recentExpenses);

  return {
    revenue,
    cogs,
    expenses,
    profit: revenue - cogs - expenses,
  };
};

export const partnerSettlement = (state: BusinessState) => {
  const split = totalProfit(state) / 2;

  return {
    Manav: {
      entitled: split,
      withdrawn: withdrawnByPartner(state, "Manav"),
      pending: split - withdrawnByPartner(state, "Manav"),
    },
    Rahul: {
      entitled: split,
      withdrawn: withdrawnByPartner(state, "Rahul"),
      pending: split - withdrawnByPartner(state, "Rahul"),
    },
  };
};
