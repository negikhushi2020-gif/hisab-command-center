"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import {
  cashInHand,
  cogsValue,
  expenseValue,
  investedByPartner,
  metrics30Days,
  netInvestmentByPartner,
  netPosition,
  retainedProfit,
  salesRevenue,
  stockValue,
  totalInvested,
  totalProfit,
  withdrawnByPartner,
  withdrawnValue,
} from "@/lib/finance";
import { useBusinessState } from "@/lib/store";
import { ExpenseCategory, PartnerName, SaleItem } from "@/lib/types";

const categories: ExpenseCategory[] = [
  "Packaging",
  "Material",
  "Shipping",
  "Ads",
  "Interest",
  "Other",
];

const formatINR = (value: number) =>
  new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency: "INR",
    maximumFractionDigits: 0,
  }).format(value);

const id = () =>
  `id-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 7)}`;

export default function Home() {
  const { state, setState } = useBusinessState();
  const [saleItems, setSaleItems] = useState<SaleItem[]>([]);
  const [saleItemPicker, setSaleItemPicker] = useState({ inventoryItemId: "", quantity: "1" });
  const [saleTotals, setSaleTotals] = useState({
    saleValue: "",
    receivedAmount: "",
    extraExpenseAmount: "",
    extraExpenseCategory: "Shipping" as ExpenseCategory,
  });
  const [expenseForm, setExpenseForm] = useState({
    category: "Ads" as ExpenseCategory,
    amount: "",
    paidAmount: "",
    paymentStatus: "Paid" as "Paid" | "Pending",
    note: "",
  });
  const [withdrawForm, setWithdrawForm] = useState({
    partner: "Manav" as PartnerName,
    amount: "",
  });

  const computed = useMemo(() => {
    const revenue = salesRevenue(state.sales);
    const cogs = cogsValue(state.sales);
    const expenses = expenseValue(state.expenses);

    const cash = cashInHand(state);
    const sv = stockValue(state);

    return {
      revenue,
      cogs,
      expenses,
      stockValue: sv,
      cash,
      netWorth: cash + sv,
      totalProfit: totalProfit(state),
      retained: retainedProfit(state),
      withdrawn: withdrawnValue(state),
      totalInvested: totalInvested(state),
      manavInvested: investedByPartner(state, "Manav"),
      rahulInvested: investedByPartner(state, "Rahul"),
      manavWithdrawn: withdrawnByPartner(state, "Manav"),
      rahulWithdrawn: withdrawnByPartner(state, "Rahul"),
      manavNetInvestment: netInvestmentByPartner(state, "Manav"),
      rahulNetInvestment: netInvestmentByPartner(state, "Rahul"),
      netPosition: netPosition(state),
      recent: metrics30Days(state),
      pendingTasks: state.tasks.filter((task) => !task.done),
      expensesByCategory: categories.map((cat) => {
        const catExpenses = state.expenses.filter((e) => e.category === cat);
        return {
          category: cat,
          total: catExpenses.reduce((s, e) => s + e.amount, 0),
          paid: catExpenses.reduce((s, e) => s + e.paidAmount, 0),
          pending: catExpenses.reduce((s, e) => s + (e.amount - e.paidAmount), 0),
        };
      }).filter((row) => row.total > 0),
      expensesTotal: expenses,
      expensesPaid: state.expenses.reduce((s, e) => s + e.paidAmount, 0),
      expensesPending: state.expenses.reduce((s, e) => s + (e.amount - e.paidAmount), 0),
    };
  }, [state]);

  const totalCostBasis = saleItems.reduce((sum, it) => sum + it.quantity * it.unitCost, 0);

  const addSaleItem = () => {
    const invItem = state.inventory.find((it) => it.id === saleItemPicker.inventoryItemId);
    if (!invItem) return;
    const qty = Math.max(1, Number(saleItemPicker.quantity) || 0);
    const existing = saleItems.find((it) => it.inventoryItemId === invItem.id);
    const alreadyAdded = existing ? existing.quantity : 0;
    const available = invItem.quantity - alreadyAdded;
    if (qty > available || available <= 0) return;

    if (existing) {
      setSaleItems((prev) =>
        prev.map((it) =>
          it.inventoryItemId === invItem.id
            ? { ...it, quantity: it.quantity + qty }
            : it,
        ),
      );
    } else {
      setSaleItems((prev) => [
        ...prev,
        {
          inventoryItemId: invItem.id,
          itemTitle: invItem.title,
          unit: invItem.unit,
          quantity: qty,
          unitCost: invItem.unitCost,
        },
      ]);
    }
    setSaleItemPicker({ inventoryItemId: "", quantity: "1" });
  };

  const removeSaleItem = (inventoryItemId: string) => {
    setSaleItems((prev) => prev.filter((it) => it.inventoryItemId !== inventoryItemId));
  };

  const submitSale = (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (saleItems.length === 0) return;
    const saleValue = Number(saleTotals.saleValue || "0");
    const receivedAmountInput = Number(saleTotals.receivedAmount || "0");
    const extraExpenseAmount = Number(saleTotals.extraExpenseAmount || "0");

    setState((prev) => {
      const computedSaleValue = saleValue > 0 ? saleValue : receivedAmountInput;
      if (computedSaleValue <= 0 || receivedAmountInput < 0 || extraExpenseAmount < 0) return prev;

      const soldOn = new Date().toISOString().slice(0, 10);
      const costBasis = saleItems.reduce((sum, it) => sum + it.quantity * it.unitCost, 0);

      let nextInventory = prev.inventory;
      for (const si of saleItems) {
        const invItem = nextInventory.find((it) => it.id === si.inventoryItemId);
        if (!invItem || si.quantity > invItem.quantity) return prev;
        nextInventory = nextInventory.map((it) =>
          it.id === si.inventoryItemId
            ? { ...it, quantity: it.quantity - si.quantity }
            : it,
        );
      }

      const nextExpenses =
        extraExpenseAmount > 0
          ? [
              {
                id: id(),
                category: saleTotals.extraExpenseCategory,
                paymentStatus: "Paid" as const,
                paidAmount: extraExpenseAmount,
                amount: extraExpenseAmount,
                note: `Sale expense for ${saleItems.map((it) => it.itemTitle).join(", ")}`,
                spentOn: soldOn,
              },
              ...prev.expenses,
            ]
          : prev.expenses;

      return {
        ...prev,
        inventory: nextInventory,
        expenses: nextExpenses,
        sales: [
          {
            id: id(),
            items: saleItems,
            saleValue: computedSaleValue,
            receivedAmount: Math.max(
              0,
              Math.min(
                saleTotals.receivedAmount.trim() === ""
                  ? computedSaleValue
                  : receivedAmountInput,
                computedSaleValue,
              ),
            ),
            costBasis,
            soldOn,
          },
          ...prev.sales,
        ],
      };
    });

    setSaleItems([]);
    setSaleTotals({
      saleValue: "",
      receivedAmount: "",
      extraExpenseAmount: "",
      extraExpenseCategory: "Shipping",
    });
  };

  const submitExpense = (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const amount = Number(expenseForm.amount);
    const paidAmountInput = Number(expenseForm.paidAmount || "0");
    if (amount <= 0 || paidAmountInput < 0) {
      return;
    }

    const paidAmount = Math.min(
      expenseForm.paidAmount.trim() === "" && expenseForm.paymentStatus === "Paid"
        ? amount
        : paidAmountInput,
      amount,
    );
    const paymentStatus: "Paid" | "Pending" =
      expenseForm.paymentStatus === "Paid" && paidAmount >= amount ? "Paid" : "Pending";

    setState((prev) => {
      const availableCash = cashInHand(prev);
      if (paidAmount > availableCash) return prev;

      return {
        ...prev,
        expenses: [
          {
            id: id(),
            category: expenseForm.category,
            paymentStatus,
            paidAmount,
            amount,
            note: expenseForm.note.trim() || `${expenseForm.category} expense`,
            spentOn: new Date().toISOString().slice(0, 10),
            cashBefore: availableCash,
            cashAfter: availableCash - paidAmount,
          },
          ...prev.expenses,
        ],
      };
    });

    setExpenseForm({
      category: "Ads",
      amount: "",
      paidAmount: "",
      paymentStatus: "Paid",
      note: "",
    });
  };

  const submitWithdrawal = (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const amount = Number(withdrawForm.amount);
    if (amount <= 0) {
      return;
    }

    setState((prev) => {
      const availableCash = cashInHand(prev);
      const partnerNet = netInvestmentByPartner(prev, withdrawForm.partner);
      if (amount > availableCash || amount > partnerNet) return prev;

      return {
        ...prev,
        withdrawals: [
          {
            id: id(),
            partner: withdrawForm.partner,
            amount,
            withdrawnOn: new Date().toISOString().slice(0, 10),
            cashBefore: availableCash,
            cashAfter: availableCash - amount,
          },
          ...prev.withdrawals,
        ],
      };
    });

    setWithdrawForm((prev) => ({ ...prev, amount: "" }));
  };

  const markTaskDone = (taskId: string) => {
    setState((prev) => ({
      ...prev,
      tasks: prev.tasks.map((task) =>
        task.id === taskId
          ? {
              ...task,
              done: true,
            }
          : task,
      ),
    }));
  };

  return (
    <div className="mx-auto flex w-full max-w-7xl flex-col px-4 py-6 sm:px-6 lg:px-10">
      <header className="glass rise-in rounded-3xl p-6 sm:p-8">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <p className="text-xs font-semibold tracking-[0.22em] text-[#26415f] uppercase">
              Smart System
            </p>
            <h1 className="display-font mt-2 text-3xl font-semibold tracking-tight text-[#0f1b2e] sm:text-5xl">
              Hisab Command Center
            </h1>
            <p className="mt-3 max-w-3xl text-sm text-[#26415f] sm:text-base">
              Joint business intelligence for Manav and Rahul. Investments build cash,
              cash buys stock, sales return cash, and every rupee stays visible in one dashboard.
            </p>
          </div>
          <Link
            href="/admin"
            className="inline-flex h-fit items-center rounded-full bg-[#0f1b2e] px-5 py-2 text-sm font-semibold text-white transition hover:opacity-90"
          >
            Open Admin
          </Link>
        </div>
      </header>

      <main className="mt-6 grid grid-cols-1 gap-4 pb-8 sm:mt-8 sm:gap-6 lg:grid-cols-12">
        {[
          { title: "Cash In Hand", value: formatINR(computed.cash), accent: "#9fe0d2" },
          { title: "Stock Value", value: formatINR(computed.stockValue), accent: "#a5d8ff" },
          { title: "Net Worth", value: formatINR(computed.netWorth), accent: "#b5f0c8" },
          { title: "Total Invested", value: formatINR(computed.totalInvested), accent: "#ff8f8f" },
          { title: "Total Profit", value: formatINR(computed.totalProfit), accent: "#9fe0d2" },
          { title: "Retained Profit", value: formatINR(computed.retained), accent: "#a5d8ff" },
        ].map((metric, index) => (
          <section
            key={metric.title}
            className="glass rise-in col-span-1 rounded-2xl p-4 sm:p-5 lg:col-span-4"
            style={{ animationDelay: `${index * 90}ms` }}
          >
            <p className="text-xs font-semibold tracking-[0.14em] text-[#26415f] uppercase">
              {metric.title}
            </p>
            <p className="display-font mt-2 text-2xl font-semibold text-[#0f1b2e] sm:text-3xl">
              {metric.value}
            </p>
            <div
              className="mt-3 h-1.5 w-full rounded-full"
              style={{ backgroundColor: metric.accent }}
            />
          </section>
        ))}

        <section className="glass rise-in col-span-1 rounded-3xl p-5 sm:p-6 lg:col-span-5">
          <h2 className="display-font text-xl font-semibold text-[#0f1b2e] sm:text-2xl">
            Expenses Snapshot
          </h2>
          <div className="mt-1 flex items-center gap-4 text-xs text-[#26415f]">
            <span>Total: <strong className="text-[#0f1b2e]">{formatINR(computed.expensesTotal)}</strong></span>
            <span className="text-green-700">Paid: <strong>{formatINR(computed.expensesPaid)}</strong></span>
            <span className="text-orange-600">Pending: <strong>{formatINR(computed.expensesPending)}</strong></span>
          </div>
          <div className="mt-3 max-h-56 overflow-auto rounded-2xl bg-white/75 p-2">
            {computed.expensesByCategory.length === 0 ? (
              <p className="px-2 py-3 text-sm text-[#26415f]">No expenses recorded yet.</p>
            ) : (
              <table className="w-full min-w-[560px] text-left text-sm">
                <thead>
                  <tr className="text-xs tracking-wider text-[#26415f] uppercase">
                    <th className="px-2 py-2">Category</th>
                    <th className="px-2 py-2 text-right">Total</th>
                    <th className="px-2 py-2 text-right">Paid</th>
                    <th className="px-2 py-2 text-right">Pending</th>
                  </tr>
                </thead>
                <tbody>
                  {computed.expensesByCategory.map((row) => (
                    <tr key={row.category} className="border-t border-white/80">
                      <td className="px-2 py-2 font-medium text-[#0f1b2e]">{row.category}</td>
                      <td className="px-2 py-2 text-right text-[#26415f]">{formatINR(row.total)}</td>
                      <td className="px-2 py-2 text-right text-green-700">{formatINR(row.paid)}</td>
                      <td className="px-2 py-2 text-right text-orange-600">{row.pending > 0 ? formatINR(row.pending) : "—"}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
          <div className="mt-3 space-y-1">
            {state.expenses.slice(0, 5).map((expense) => (
              <div key={expense.id} className="flex items-center justify-between rounded-xl bg-white/80 px-3 py-2 text-xs">
                <span className="font-medium text-[#0f1b2e]">{expense.note || expense.category}</span>
                <div className="flex items-center gap-2">
                  <span className="text-[#26415f]">{formatINR(expense.paidAmount)} / {formatINR(expense.amount)}</span>
                  <span
                    className="rounded-full px-2 py-0.5 text-[10px] font-semibold"
                    style={{
                      backgroundColor: expense.paymentStatus === "Paid" ? "#b5f0c8" : "#ffbc66",
                      color: "#0f1b2e",
                    }}
                  >
                    {expense.paymentStatus}
                  </span>
                </div>
              </div>
            ))}
            {state.expenses.length > 5 && (
              <p className="px-2 text-xs text-[#26415f]">
                +{state.expenses.length - 5} more — manage in Admin
              </p>
            )}
          </div>
        </section>

        <section className="glass rise-in col-span-1 rounded-3xl p-5 sm:p-6 lg:col-span-7">
          <h2 className="display-font text-xl font-semibold text-[#0f1b2e] sm:text-2xl">
            Last 30 Days Metrics
          </h2>
          <div className="mt-4 grid grid-cols-1 gap-4 sm:grid-cols-3">
            <div className="rounded-2xl bg-white/80 p-4">
              <p className="text-xs tracking-widest text-[#26415f] uppercase">Revenue</p>
              <p className="mt-2 text-xl font-semibold text-[#0f1b2e]">
                {formatINR(computed.recent.revenue)}
              </p>
            </div>
            <div className="rounded-2xl bg-white/80 p-4">
              <p className="text-xs tracking-widest text-[#26415f] uppercase">Expenses</p>
              <p className="mt-2 text-xl font-semibold text-[#0f1b2e]">
                {formatINR(computed.recent.expenses)}
              </p>
            </div>
            <div className="rounded-2xl bg-white/80 p-4">
              <p className="text-xs tracking-widest text-[#26415f] uppercase">Net Profit</p>
              <p className="mt-2 text-xl font-semibold text-[#0f1b2e]">
                {formatINR(computed.recent.profit)}
              </p>
            </div>
          </div>
          <div className="mt-4 rounded-2xl border border-white/80 bg-white/75 p-4 text-sm text-[#26415f]">
            <p>
              Business Net Position: <strong>{formatINR(computed.netPosition)}</strong>
            </p>
            <p className="mt-1">
              Formula: cash in hand + stock value
            </p>
          </div>
        </section>

        <section className="glass rise-in col-span-1 rounded-3xl p-5 sm:p-6 lg:col-span-5">
          <h2 className="display-font text-xl font-semibold text-[#0f1b2e] sm:text-2xl">
            Pending Tasks
          </h2>
          <div className="mt-4 space-y-3">
            {computed.pendingTasks.length === 0 && (
              <p className="rounded-xl bg-white/80 p-3 text-sm text-[#26415f]">
                No pending tasks. Great discipline.
              </p>
            )}
            {computed.pendingTasks.map((task) => (
              <div
                key={task.id}
                className="flex flex-col gap-2 rounded-xl border border-white/90 bg-white/80 p-3 sm:flex-row sm:items-center sm:justify-between"
              >
                <div>
                  <p className="font-semibold text-[#0f1b2e]">{task.title}</p>
                  <p className="text-xs text-[#26415f]">Due {task.dueDate}</p>
                </div>
                <button
                  type="button"
                  onClick={() => markTaskDone(task.id)}
                  className="rounded-full bg-[#0f1b2e] px-4 py-2 text-xs font-semibold text-white transition hover:opacity-90"
                >
                  Mark Done
                </button>
              </div>
            ))}
          </div>
        </section>

        <section className="glass rise-in col-span-1 rounded-3xl p-5 sm:p-6 lg:col-span-6">
          <h3 className="display-font text-lg font-semibold text-[#0f1b2e]">Record Sale</h3>

          <div className="mt-4 space-y-3">
            <p className="text-xs font-semibold tracking-wider text-[#26415f] uppercase">Add Items from Inventory</p>
            <div className="grid grid-cols-1 gap-2 sm:grid-cols-[1fr_auto_auto]">
              <select
                value={saleItemPicker.inventoryItemId}
                onChange={(event) =>
                  setSaleItemPicker((prev) => ({ ...prev, inventoryItemId: event.target.value }))
                }
                className="w-full rounded-xl border border-white/90 bg-white/85 px-3 py-2 text-sm outline-none"
              >
                <option value="">Select inventory item</option>
                {state.inventory
                  .filter((item) => {
                    const alreadyAdded = saleItems.find((si) => si.inventoryItemId === item.id)?.quantity ?? 0;
                    return item.quantity - alreadyAdded > 0;
                  })
                  .map((item) => {
                    const alreadyAdded = saleItems.find((si) => si.inventoryItemId === item.id)?.quantity ?? 0;
                    return (
                      <option key={item.id} value={item.id}>
                        {item.title} · {item.quantity - alreadyAdded} {item.unit} avail · {formatINR(item.unitCost)}/each
                      </option>
                    );
                  })}
              </select>
              <input
                value={saleItemPicker.quantity}
                onChange={(event) =>
                  setSaleItemPicker((prev) => ({ ...prev, quantity: event.target.value }))
                }
                type="number"
                min={1}
                placeholder="Qty"
                className="w-20 rounded-xl border border-white/90 bg-white/85 px-3 py-2 text-sm outline-none"
              />
              <button
                type="button"
                onClick={addSaleItem}
                className="rounded-full bg-[#26415f] px-4 py-2 text-sm font-semibold text-white transition hover:opacity-90"
              >
                + Add
              </button>
            </div>

            {saleItems.length > 0 && (
              <div className="space-y-2 rounded-2xl bg-white/80 p-3">
                <p className="text-xs font-semibold tracking-wider text-[#26415f] uppercase">Items in this sale</p>
                {saleItems.map((si) => (
                  <div key={si.inventoryItemId} className="flex items-center justify-between rounded-xl border border-white/70 bg-white/60 px-3 py-2 text-sm">
                    <div>
                      <span className="font-semibold text-[#0f1b2e]">{si.itemTitle}</span>
                      <span className="ml-2 text-[#26415f]">{si.quantity} {si.unit} × {formatINR(si.unitCost)} = {formatINR(si.quantity * si.unitCost)}</span>
                    </div>
                    <button
                      type="button"
                      onClick={() => removeSaleItem(si.inventoryItemId)}
                      className="rounded-full bg-[#ff8f8f] px-3 py-1 text-xs font-semibold text-[#0f1b2e]"
                    >
                      Remove
                    </button>
                  </div>
                ))}
                <div className="flex items-center justify-between border-t border-white/70 pt-2">
                  <span className="text-sm font-semibold text-[#26415f]">Total Cost (auto)</span>
                  <span className="text-lg font-bold text-[#0f1b2e]">{formatINR(totalCostBasis)}</span>
                </div>
              </div>
            )}
          </div>

          <form className="mt-4 space-y-3" onSubmit={submitSale}>
            <p className="text-xs font-semibold tracking-wider text-[#26415f] uppercase">Selling Price & Payment</p>
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <input
                value={saleTotals.saleValue}
                onChange={(event) =>
                  setSaleTotals((prev) => ({ ...prev, saleValue: event.target.value }))
                }
                type="number"
                min={0}
                placeholder="Total selling price"
                className="w-full rounded-xl border border-white/90 bg-white/85 px-3 py-2 text-sm outline-none"
              />
              <input
                value={saleTotals.receivedAmount}
                onChange={(event) =>
                  setSaleTotals((prev) => ({ ...prev, receivedAmount: event.target.value }))
                }
                type="number"
                min={0}
                placeholder="Amount received"
                className="w-full rounded-xl border border-white/90 bg-white/85 px-3 py-2 text-sm outline-none"
              />
            </div>
            <div className="rounded-xl border border-white/90 bg-white/75 px-3 py-2 text-xs text-[#26415f]">
              Enter selling price of all items combined. Leave empty if same as received.
            </div>
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <input
                value={saleTotals.extraExpenseAmount}
                onChange={(event) =>
                  setSaleTotals((prev) => ({ ...prev, extraExpenseAmount: event.target.value }))
                }
                type="number"
                min={0}
                placeholder="Extra sale expense"
                className="w-full rounded-xl border border-white/90 bg-white/85 px-3 py-2 text-sm outline-none"
              />
              <select
                value={saleTotals.extraExpenseCategory}
                onChange={(event) =>
                  setSaleTotals((prev) => ({
                    ...prev,
                    extraExpenseCategory: event.target.value as ExpenseCategory,
                  }))
                }
                className="w-full rounded-xl border border-white/90 bg-white/85 px-3 py-2 text-sm outline-none"
              >
                {categories.map((category) => (
                  <option key={category} value={category}>
                    {category}
                  </option>
                ))}
              </select>
            </div>
            <button
              type="submit"
              disabled={saleItems.length === 0}
              className="w-full rounded-full bg-[#26415f] px-4 py-2 text-sm font-semibold text-white transition hover:opacity-90 disabled:opacity-50"
            >
              Save Sale ({saleItems.length} item{saleItems.length !== 1 ? "s" : ""})
            </button>
          </form>
        </section>

        <section className="glass rise-in col-span-1 rounded-3xl p-5 sm:p-6 lg:col-span-4">
          <h3 className="display-font text-lg font-semibold text-[#0f1b2e]">Add Expense</h3>
          <form className="mt-4 space-y-3" onSubmit={submitExpense}>
            <select
              value={expenseForm.category}
              onChange={(event) =>
                setExpenseForm((prev) => ({
                  ...prev,
                  category: event.target.value as ExpenseCategory,
                }))
              }
              className="w-full rounded-xl border border-white/90 bg-white/85 px-3 py-2 text-sm outline-none"
            >
              {categories.map((category) => (
                <option key={category} value={category}>
                  {category}
                </option>
              ))}
            </select>
            <input
              value={expenseForm.amount}
              onChange={(event) =>
                setExpenseForm((prev) => ({ ...prev, amount: event.target.value }))
              }
              type="number"
              min={1}
              placeholder="Total amount"
              className="w-full rounded-xl border border-white/90 bg-white/85 px-3 py-2 text-sm outline-none"
            />
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <select
                value={expenseForm.paymentStatus}
                onChange={(event) =>
                  setExpenseForm((prev) => ({
                    ...prev,
                    paymentStatus: event.target.value as "Paid" | "Pending",
                  }))
                }
                className="w-full rounded-xl border border-white/90 bg-white/85 px-3 py-2 text-sm outline-none"
              >
                <option value="Paid">Paid</option>
                <option value="Pending">Pending</option>
              </select>
              <input
                value={expenseForm.paidAmount}
                onChange={(event) =>
                  setExpenseForm((prev) => ({ ...prev, paidAmount: event.target.value }))
                }
                type="number"
                min={0}
                placeholder="Paid amount"
              className="w-full rounded-xl border border-white/90 bg-white/85 px-3 py-2 text-sm outline-none"
              />
            </div>
            <input
              value={expenseForm.note}
              onChange={(event) =>
                setExpenseForm((prev) => ({ ...prev, note: event.target.value }))
              }
              placeholder="Note"
              className="w-full rounded-xl border border-white/90 bg-white/85 px-3 py-2 text-sm outline-none"
            />
            <button
              type="submit"
              className="w-full rounded-full bg-[#26415f] px-4 py-2 text-sm font-semibold text-white transition hover:opacity-90"
            >
              Save Expense
            </button>
          </form>
        </section>

        <section className="glass rise-in col-span-1 rounded-3xl p-5 sm:p-6 lg:col-span-4">
          <h3 className="display-font text-lg font-semibold text-[#0f1b2e]">Withdraw Investment</h3>
          <form className="mt-4 space-y-3" onSubmit={submitWithdrawal}>
            <select
              value={withdrawForm.partner}
              onChange={(event) =>
                setWithdrawForm((prev) => ({
                  ...prev,
                  partner: event.target.value as PartnerName,
                }))
              }
              className="w-full rounded-xl border border-white/90 bg-white/85 px-3 py-2 text-sm outline-none"
            >
              <option value="Manav">Manav</option>
              <option value="Rahul">Rahul</option>
            </select>
            <input
              value={withdrawForm.amount}
              onChange={(event) =>
                setWithdrawForm((prev) => ({ ...prev, amount: event.target.value }))
              }
              type="number"
              min={1}
              placeholder="Amount"
              className="w-full rounded-xl border border-white/90 bg-white/85 px-3 py-2 text-sm outline-none"
            />
            <button
              type="submit"
              className="w-full rounded-full bg-[#0f1b2e] px-4 py-2 text-sm font-semibold text-white transition hover:opacity-90"
            >
              Save Withdrawal
            </button>
          </form>
          <p className="mt-2 text-xs text-[#26415f]">
            Withdrawal is blocked if cash is not enough or if partner net investment would go negative.
          </p>
        </section>

        <section className="glass rise-in col-span-1 rounded-3xl p-5 sm:p-6 lg:col-span-6">
          <h2 className="display-font text-xl font-semibold text-[#0f1b2e] sm:text-2xl">
            Partner Investment Snapshot
          </h2>
          <div className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-2">
            {(["Manav", "Rahul"] as const).map((partner) => (
              <div key={partner} className="rounded-2xl bg-white/80 p-4">
                <p className="text-sm font-semibold text-[#26415f]">{partner}</p>
                <p className="mt-2 text-xs text-[#26415f] uppercase">Invested</p>
                <p className="text-lg font-semibold text-[#0f1b2e]">
                  {formatINR(partner === "Manav" ? computed.manavInvested : computed.rahulInvested)}
                </p>
                <p className="mt-2 text-xs text-[#26415f] uppercase">Withdrawn</p>
                <p className="text-lg font-semibold text-[#0f1b2e]">
                  {formatINR(partner === "Manav" ? computed.manavWithdrawn : computed.rahulWithdrawn)}
                </p>
                <p className="mt-2 text-xs text-[#26415f] uppercase">Net Investment</p>
                <p className="text-lg font-semibold text-[#0f1b2e]">
                  {formatINR(partner === "Manav" ? computed.manavNetInvestment : computed.rahulNetInvestment)}
                </p>
              </div>
            ))}
          </div>
        </section>

        <section className="glass rise-in col-span-1 rounded-3xl p-5 sm:p-6 lg:col-span-6">
          <h2 className="display-font text-xl font-semibold text-[#0f1b2e] sm:text-2xl">
            Inventory Snapshot
          </h2>
          <div className="mt-4 max-h-72 overflow-auto rounded-2xl bg-white/75 p-2">
            <table className="w-full min-w-[560px] text-left text-sm">
              <thead>
                <tr className="text-xs tracking-wider text-[#26415f] uppercase">
                  <th className="px-2 py-2">Item</th>
                  <th className="px-2 py-2">Qty</th>
                  <th className="px-2 py-2">Unit Cost</th>
                  <th className="px-2 py-2">Value</th>
                </tr>
              </thead>
              <tbody>
                {state.inventory.map((item) => (
                  <tr key={item.id} className="border-t border-white/80">
                    <td className="px-2 py-2 text-[#0f1b2e]">{item.title}</td>
                    <td className="px-2 py-2 text-[#26415f]">{item.quantity}</td>
                    <td className="px-2 py-2 text-[#26415f]">{formatINR(item.unitCost)}</td>
                    <td className="px-2 py-2 font-semibold text-[#0f1b2e]">
                      {formatINR(item.quantity * item.unitCost)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      </main>
    </div>
  );
}
