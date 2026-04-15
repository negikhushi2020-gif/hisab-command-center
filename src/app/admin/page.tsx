"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import {
  cashInHand,
  expenseValue,
  investedByPartner,
  netInvestmentByPartner,
  retainedProfit,
  salesRevenue,
  stockValue,
  totalInvested,
  totalProfit,
  withdrawnByPartner,
} from "@/lib/finance";
import { id, useBusinessState } from "@/lib/store";
import { Expense, ExpenseCategory, PartnerName, SaleItem, UnitType } from "@/lib/types";

const expenseCategories: ExpenseCategory[] = [
  "Packaging",
  "Material",
  "Shipping",
  "Ads",
  "Interest",
  "Other",
];

const itemCategories = ["Laptop", "GPU", "Desktop Part", "Full Desktop", "Other"];
const unitOptions: UnitType[] = ["pcs", "box", "set", "kg", "meter"];

const formatINR = (value: number) =>
  new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency: "INR",
    maximumFractionDigits: 0,
  }).format(value);

export default function AdminPage() {
  const { state, setState } = useBusinessState();

  const [investmentForm, setInvestmentForm] = useState({
    partner: "Rahul" as PartnerName,
    amount: "",
    note: "",
  });
  const [inventoryForm, setInventoryForm] = useState({
    title: "",
    category: "GPU",
    unit: "pcs" as UnitType,
    quantity: "1",
    unitCost: "",
  });
  const [saleItems, setSaleItems] = useState<SaleItem[]>([]);
  const [saleItemPicker, setSaleItemPicker] = useState({ inventoryItemId: "", quantity: "1" });
  const [saleTotals, setSaleTotals] = useState({
    saleValue: "",
    receivedAmount: "",
    extraExpenseAmount: "",
    extraExpenseCategory: "Shipping" as ExpenseCategory,
  });
  const [editingSaleId, setEditingSaleId] = useState<string | null>(null);
  const [expenseForm, setExpenseForm] = useState({
    category: "Ads" as ExpenseCategory,
    amount: "",
    paidAmount: "",
    paymentStatus: "Paid" as "Paid" | "Pending",
    note: "",
  });
  const [editingExpenseId, setEditingExpenseId] = useState<string | null>(null);
  const [withdrawForm, setWithdrawForm] = useState({
    partner: "Manav" as PartnerName,
    amount: "",
  });
  const [taskForm, setTaskForm] = useState({
    title: "",
    dueDate: new Date().toISOString().slice(0, 10),
  });

  const summary = useMemo(
    () => ({
      cash: cashInHand(state),
      stock: stockValue(state),
      sales: salesRevenue(state.sales),
      expenses: expenseValue(state.expenses),
      profit: totalProfit(state),
      retained: retainedProfit(state),
      totalInvested: totalInvested(state),
      rahulInvested: investedByPartner(state, "Rahul"),
      manavInvested: investedByPartner(state, "Manav"),
      rahulWithdrawn: withdrawnByPartner(state, "Rahul"),
      manavWithdrawn: withdrawnByPartner(state, "Manav"),
      rahulNetInvestment: netInvestmentByPartner(state, "Rahul"),
      manavNetInvestment: netInvestmentByPartner(state, "Manav"),
      netWorth: cashInHand(state) + stockValue(state),
    }),
    [state],
  );

  const isExpenseLinkedToSale = (expense: Expense, sale: { id: string; soldOn: string; items: SaleItem[] }) => {
    if (expense.saleId === sale.id) return true;
    if (!expense.saleId) {
      const notePrefix = `Sale expense for ${sale.items.map((it) => it.itemTitle).join(", ")}`;
      return expense.note === notePrefix && expense.spentOn === sale.soldOn && expense.amount > 0;
    }
    return false;
  };

  const getSaleLinkedExpenseAmount = (expenses: Expense[], sale: { id: string; soldOn: string; items: SaleItem[] }) =>
    expenses
      .filter((expense) => isExpenseLinkedToSale(expense, sale))
      .reduce((sum, expense) => sum + expense.paidAmount, 0);

  const removeSaleLinkedExpenses = (expenses: Expense[], sale: { id: string; soldOn: string; items: SaleItem[] }) =>
    expenses.filter((expense) => !isExpenseLinkedToSale(expense, sale));

  const ledgerRows = useMemo(() => {
    type EntryType = "Investment" | "Purchase" | "Sale" | "Expense" | "Withdrawal";
    const order: Record<EntryType, number> = {
      Investment: 0,
      Purchase: 1,
      Sale: 2,
      Expense: 3,
      Withdrawal: 4,
    };

    const entries = [
      ...state.investments.map((entry) => ({
        date: entry.investedOn,
        type: "Investment" as const,
        badge: "#b5f0c8",
        description: `${entry.partner}${entry.note ? ` · ${entry.note}` : ""}`,
        amount: entry.amount,
        effect: "+" as const,
      })),
      ...state.inventory.map((entry) => ({
        date: entry.purchasedOn,
        type: "Purchase" as const,
        badge: "#a5d8ff",
        description: `${entry.title} × ${entry.purchasedQuantity} @ ${formatINR(entry.unitCost)}`,
        amount: entry.purchasedQuantity * entry.unitCost,
        effect: "-" as const,
      })),
      ...state.sales.map((entry) => ({
        date: entry.soldOn,
        type: "Sale" as const,
        badge: "#9fe0d2",
        description: entry.items.map((it) => `${it.itemTitle} ×${it.quantity}`).join(", "),
        amount: entry.receivedAmount,
        effect: "+" as const,
      })),
      ...state.expenses.map((entry) => ({
        date: entry.spentOn,
        type: "Expense" as const,
        badge: "#ffbc66",
        description: `${entry.category}${entry.note ? ` · ${entry.note}` : ""}`,
        amount: entry.paidAmount,
        effect: "-" as const,
      })),
      ...state.withdrawals.map((entry) => ({
        date: entry.withdrawnOn,
        type: "Withdrawal" as const,
        badge: "#ff8f8f",
        description: `${entry.partner} withdrawal`,
        amount: entry.amount,
        effect: "-" as const,
      })),
    ];

    let balance = 0;
    return entries
      .sort((a, b) => {
        const dateComparison = a.date.localeCompare(b.date);
        if (dateComparison !== 0) return dateComparison;
        return order[a.type] - order[b.type];
      })
      .map((entry) => {
        const cashBefore = balance;
        balance += entry.effect === "+" ? entry.amount : -entry.amount;
        return {
          ...entry,
          cashBefore,
          cashAfter: balance,
        };
      })
      .reverse();
  }, [state]);

  const deleteSale = (saleId: string) => {
    setState((prev) => {
      const sale = prev.sales.find((entry) => entry.id === saleId);
      if (!sale) return prev;

      const inventoryRestored = prev.inventory.map((item) => {
        const soldItem =
          sale.items.find((it) => it.inventoryItemId === item.id) ||
          sale.items.find(
            (it) =>
              !it.inventoryItemId &&
              it.itemTitle === item.title &&
              it.unit === item.unit &&
              it.unitCost === item.unitCost,
          );
        if (!soldItem) return item;
        return { ...item, quantity: item.quantity + soldItem.quantity };
      });

      return {
        ...prev,
        inventory: inventoryRestored,
        expenses: removeSaleLinkedExpenses(prev.expenses, sale),
        sales: prev.sales.filter((entry) => entry.id !== saleId),
      };
    });
  };

  const addInvestment = (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const amount = Number(investmentForm.amount);
    if (amount <= 0) return;

    setState((prev) => {
      const cashBefore = cashInHand(prev);
      const cashAfter = cashBefore + amount;

      return {
        ...prev,
        investments: [
          {
            id: id(),
            partner: investmentForm.partner,
            amount,
            note: investmentForm.note.trim() || "Investment added",
            investedOn: new Date().toISOString().slice(0, 10),
            cashBefore,
            cashAfter,
          },
          ...prev.investments,
        ],
      };
    });

    setInvestmentForm((prev) => ({ ...prev, amount: "", note: "" }));
  };

  const addInventory = (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const quantity = Number(inventoryForm.quantity);
    const unitCost = Number(inventoryForm.unitCost);

    if (!inventoryForm.title.trim() || quantity <= 0 || unitCost <= 0) {
      return;
    }

    setState((prev) => {
      const purchaseAmount = quantity * unitCost;
      const cashBefore = cashInHand(prev);
      if (purchaseAmount > cashBefore) {
        return prev;
      }

      return {
        ...prev,
        inventory: [
          {
            id: id(),
            title: inventoryForm.title.trim(),
            category: inventoryForm.category as
              | "Laptop"
              | "GPU"
              | "Desktop Part"
              | "Full Desktop"
              | "Other",
            unit: inventoryForm.unit,
            quantity,
            purchasedQuantity: quantity,
            unitCost,
            purchasedOn: new Date().toISOString().slice(0, 10),
            purchaseCashBefore: cashBefore,
            purchaseCashAfter: cashBefore - purchaseAmount,
          },
          ...prev.inventory,
        ],
      };
    });

    setInventoryForm({ title: "", category: "GPU", unit: "pcs", quantity: "1", unitCost: "" });
  };

  const totalCostBasis = saleItems.reduce((sum, it) => sum + it.quantity * it.unitCost, 0);

  // When in edit mode the old sale's items are already deducted from inventory,
  // so we need to add them back to the effective available count.
  const oldSaleItems: SaleItem[] = editingSaleId
    ? (state.sales.find((s) => s.id === editingSaleId)?.items ?? [])
    : [];

  const addSaleItem = () => {
    const invItem = state.inventory.find((it) => it.id === saleItemPicker.inventoryItemId);
    if (!invItem) return;
    const qty = Math.max(1, Number(saleItemPicker.quantity) || 0);
    const existing = saleItems.find((it) => it.inventoryItemId === invItem.id);
    const alreadyAdded = existing ? existing.quantity : 0;
    const oldQty = oldSaleItems.find((it) => it.inventoryItemId === invItem.id)?.quantity ?? 0;
    const available = invItem.quantity + oldQty - alreadyAdded;
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

  const resetSaleForm = () => {
    setSaleItems([]);
    setSaleTotals({ saleValue: "", receivedAmount: "", extraExpenseAmount: "", extraExpenseCategory: "Shipping" });
    setEditingSaleId(null);
  };

  const startEditSale = (saleId: string) => {
    const sale = state.sales.find((s) => s.id === saleId);
    if (!sale) return;

    const linkedExpenses = state.expenses.filter((expense) => expense.saleId === saleId);
    const extraExpenseAmount = linkedExpenses.reduce((sum, expense) => sum + expense.paidAmount, 0);

    setSaleItems(sale.items.map((it) => ({ ...it })));
    setSaleTotals({
      saleValue: String(sale.saleValue),
      receivedAmount: String(sale.receivedAmount),
      extraExpenseAmount: extraExpenseAmount ? String(extraExpenseAmount) : "",
      extraExpenseCategory: linkedExpenses[0]?.category ?? "Shipping",
    });
    setEditingSaleId(saleId);
    // Scroll form into view
    document.getElementById("sale-form-section")?.scrollIntoView({ behavior: "smooth", block: "start" });
  };

  const addSale = (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (saleItems.length === 0) return;
    const saleValue = Number(saleTotals.saleValue || "0");
    const receivedAmountInput = Number(saleTotals.receivedAmount || "0");
    const extraExpenseAmount = Number(saleTotals.extraExpenseAmount || "0");
    const saleId = editingSaleId ?? id();

    setState((prev) => {
      const computedSaleValue = saleValue > 0 ? saleValue : receivedAmountInput;
      if (computedSaleValue <= 0 || receivedAmountInput < 0 || extraExpenseAmount < 0) return prev;

      const soldOn = new Date().toISOString().slice(0, 10);
      const costBasis = saleItems.reduce((sum, it) => sum + it.quantity * it.unitCost, 0);
      const computedReceived = Math.max(
        0,
        Math.min(
          saleTotals.receivedAmount.trim() === "" ? computedSaleValue : receivedAmountInput,
          computedSaleValue,
        ),
      );

      const saleExpenseNote = `Sale expense for ${saleItems.map((it) => it.itemTitle).join(", ")}`;
      const nextSaleExpense = extraExpenseAmount > 0
        ? [
            {
              id: id(),
              category: saleTotals.extraExpenseCategory,
              paymentStatus: "Paid" as const,
              paidAmount: extraExpenseAmount,
              amount: extraExpenseAmount,
              note: saleExpenseNote,
              spentOn: soldOn,
              saleId,
            },
          ]
        : [];

      if (editingSaleId) {
        const originalSale = prev.sales.find((s) => s.id === editingSaleId);
        if (!originalSale) return prev;

        const originalSaleExpense = getSaleLinkedExpenseAmount(prev.expenses, originalSale);
        const baselineCash = cashInHand(prev) - originalSale.receivedAmount + originalSaleExpense;

        let nextInventory = prev.inventory;
        for (const oi of originalSale.items) {
          nextInventory = nextInventory.map((it) =>
            it.id === oi.inventoryItemId
              ? { ...it, quantity: it.quantity + oi.quantity }
              : it,
          );
        }

        for (const si of saleItems) {
          const invItem = nextInventory.find((it) => it.id === si.inventoryItemId);
          if (!invItem || si.quantity > invItem.quantity) return prev;
          nextInventory = nextInventory.map((it) =>
            it.id === si.inventoryItemId
              ? { ...it, quantity: it.quantity - si.quantity }
              : it,
          );
        }

        const nextExpenses = [
          ...nextSaleExpense,
          ...removeSaleLinkedExpenses(prev.expenses, originalSale),
        ];

        return {
          ...prev,
          inventory: nextInventory,
          expenses: nextExpenses,
          sales: prev.sales.map((s) =>
            s.id === editingSaleId
              ? {
                  ...s,
                  items: saleItems,
                  saleValue: computedSaleValue,
                  receivedAmount: computedReceived,
                  costBasis,
                  cashBefore: baselineCash,
                  cashAfter: baselineCash + computedReceived - extraExpenseAmount,
                }
              : s,
          ),
        };
      }

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

      return {
        ...prev,
        inventory: nextInventory,
        expenses: [...nextSaleExpense, ...prev.expenses],
        sales: [
          {
            id: saleId,
            items: saleItems,
            saleValue: computedSaleValue,
            receivedAmount: computedReceived,
            costBasis,
            soldOn,
            cashBefore: cashInHand(prev),
            cashAfter: cashInHand(prev) + computedReceived - extraExpenseAmount,
          },
          ...prev.sales,
        ],
      };
    });

    resetSaleForm();
  };

  const resetExpenseForm = () => {
    setExpenseForm({ category: "Ads", amount: "", paidAmount: "", paymentStatus: "Paid", note: "" });
    setEditingExpenseId(null);
  };

  const startEditExpense = (expenseId: string) => {
    const expense = state.expenses.find((e) => e.id === expenseId);
    if (!expense) return;
    setExpenseForm({
      category: expense.category,
      amount: String(expense.amount),
      paidAmount: String(expense.paidAmount),
      paymentStatus: expense.paymentStatus,
      note: expense.note,
    });
    setEditingExpenseId(expenseId);
    document.getElementById("expense-form-section")?.scrollIntoView({ behavior: "smooth", block: "start" });
  };

  const addExpense = (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const amount = Number(expenseForm.amount);
    const paidAmountInput = Number(expenseForm.paidAmount || "0");
    if (amount <= 0 || paidAmountInput < 0) return;

    const paidAmount = Math.min(
      expenseForm.paidAmount.trim() === "" && expenseForm.paymentStatus === "Paid"
        ? amount
        : paidAmountInput,
      amount,
    );
    const paymentStatus: "Paid" | "Pending" =
      expenseForm.paymentStatus === "Paid" && paidAmount >= amount ? "Paid" : "Pending";

    const availableCash = cashInHand(state);
    if (paidAmount > availableCash) return;

    if (editingExpenseId) {
      setState((prev) => {
        const originalExpense = prev.expenses.find((e) => e.id === editingExpenseId);
        const baselineCash = cashInHand(prev) + (originalExpense?.paidAmount ?? 0);
        if (paidAmount > baselineCash) return prev;

        return {
          ...prev,
          expenses: prev.expenses.map((e) =>
            e.id === editingExpenseId
              ? {
                  ...e,
                  category: expenseForm.category,
                  paymentStatus,
                  paidAmount,
                  amount,
                  note: expenseForm.note.trim() || `${expenseForm.category} expense`,
                  cashBefore: baselineCash,
                  cashAfter: baselineCash - paidAmount,
                }
              : e,
          ),
        };
      });
    } else {
      setState((prev) => ({
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
            cashBefore: cashInHand(prev),
            cashAfter: cashInHand(prev) - paidAmount,
          },
          ...prev.expenses,
        ],
      }));
    }

    resetExpenseForm();
  };

  const addWithdrawal = (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const amount = Number(withdrawForm.amount);
    if (amount <= 0) {
      return;
    }

    setState((prev) => {
      const availableCash = cashInHand(prev);
      const partnerNet = netInvestmentByPartner(prev, withdrawForm.partner);
      if (amount > availableCash || amount > partnerNet) {
        return prev;
      }

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

  const addTask = (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!taskForm.title.trim()) {
      return;
    }

    setState((prev) => ({
      ...prev,
      tasks: [
        {
          id: id(),
          title: taskForm.title.trim(),
          dueDate: taskForm.dueDate,
          done: false,
        },
        ...prev.tasks,
      ],
    }));

    setTaskForm((prev) => ({ ...prev, title: "" }));
  };

  return (
    <div className="mx-auto flex w-full max-w-7xl flex-col px-4 py-6 sm:px-6 lg:px-10">
      <header className="glass rise-in rounded-3xl p-6 sm:p-8">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <p className="text-xs font-semibold tracking-[0.22em] text-[#26415f] uppercase">
              Admin Control
            </p>
            <h1 className="display-font mt-2 text-3xl font-semibold tracking-tight text-[#0f1b2e] sm:text-5xl">
              Business Management Console
            </h1>
            <p className="mt-3 max-w-3xl text-sm text-[#26415f] sm:text-base">
              Manage partner investments, stock, sales, expenses, withdrawals, and task lifecycle from one page.
            </p>
          </div>
          <Link
            href="/"
            className="inline-flex h-fit items-center rounded-full bg-[#0f1b2e] px-5 py-2 text-sm font-semibold text-white transition hover:opacity-90"
          >
            Back to Dashboard
          </Link>
        </div>
      </header>

      <main className="mt-6 grid grid-cols-1 gap-4 pb-8 sm:mt-8 sm:gap-6 lg:grid-cols-12">
        <section className="glass rise-in col-span-1 rounded-2xl p-4 sm:p-5 lg:col-span-3">
          <p className="text-xs tracking-wider text-[#26415f] uppercase">Cash</p>
          <p className="display-font mt-2 text-2xl font-semibold text-[#0f1b2e]">{formatINR(summary.cash)}</p>
        </section>
        <section className="glass rise-in col-span-1 rounded-2xl p-4 sm:p-5 lg:col-span-3">
          <p className="text-xs tracking-wider text-[#26415f] uppercase">Stock Value</p>
          <p className="display-font mt-2 text-2xl font-semibold text-[#0f1b2e]">{formatINR(summary.stock)}</p>
        </section>
        <section className="glass rise-in col-span-1 rounded-2xl p-4 sm:p-5 lg:col-span-3">
          <p className="text-xs tracking-wider text-[#26415f] uppercase">Total Profit</p>
          <p className="display-font mt-2 text-2xl font-semibold text-[#0f1b2e]">{formatINR(summary.profit)}</p>
        </section>
        <section className="glass rise-in col-span-1 rounded-2xl p-4 sm:p-5 lg:col-span-3">
          <p className="text-xs tracking-wider text-[#26415f] uppercase">Net Worth</p>
          <p className="display-font mt-2 text-2xl font-semibold text-[#0f1b2e]">{formatINR(summary.netWorth)}</p>
        </section>

        <section className="glass rise-in col-span-1 rounded-3xl p-5 sm:p-6 lg:col-span-6">
          <h2 className="display-font text-xl font-semibold text-[#0f1b2e]">Add Investment</h2>
          <form className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-2" onSubmit={addInvestment}>
            <select
              value={investmentForm.partner}
              onChange={(event) =>
                setInvestmentForm((prev) => ({ ...prev, partner: event.target.value as PartnerName }))
              }
              className="w-full rounded-xl border border-white/90 bg-white/85 px-3 py-2 text-sm outline-none"
            >
              <option value="Rahul">Rahul</option>
              <option value="Manav">Manav</option>
            </select>
            <input
              value={investmentForm.amount}
              onChange={(event) => setInvestmentForm((prev) => ({ ...prev, amount: event.target.value }))}
              type="number"
              min={1}
              placeholder="Investment amount"
              className="w-full rounded-xl border border-white/90 bg-white/85 px-3 py-2 text-sm outline-none"
            />
            <input
              value={investmentForm.note}
              onChange={(event) => setInvestmentForm((prev) => ({ ...prev, note: event.target.value }))}
              placeholder="Note (optional)"
              className="w-full rounded-xl border border-white/90 bg-white/85 px-3 py-2 text-sm outline-none sm:col-span-2"
            />
            <button
              type="submit"
              className="rounded-full bg-[#26415f] px-4 py-2 text-sm font-semibold text-white transition hover:opacity-90"
            >
              Add Investment
            </button>
          </form>

          <div className="mt-4 grid grid-cols-1 gap-2 text-xs sm:grid-cols-2">
            <div className="rounded-xl bg-white/75 px-3 py-2 text-[#26415f]">
              Rahul Invested: <strong className="text-[#0f1b2e]">{formatINR(summary.rahulInvested)}</strong>
            </div>
            <div className="rounded-xl bg-white/75 px-3 py-2 text-[#26415f]">
              Manav Invested: <strong className="text-[#0f1b2e]">{formatINR(summary.manavInvested)}</strong>
            </div>
            <div className="rounded-xl bg-white/75 px-3 py-2 text-[#26415f]">
              Rahul Net (after withdrawal): <strong className="text-[#0f1b2e]">{formatINR(summary.rahulNetInvestment)}</strong>
            </div>
            <div className="rounded-xl bg-white/75 px-3 py-2 text-[#26415f]">
              Manav Net (after withdrawal): <strong className="text-[#0f1b2e]">{formatINR(summary.manavNetInvestment)}</strong>
            </div>
          </div>

          <div className="mt-4 max-h-44 overflow-auto rounded-2xl bg-white/80 p-2">
            {state.investments.map((entry) => (
              <div key={entry.id} className="border-b border-white/70 px-2 py-2 text-xs">
                <div className="flex items-center justify-between">
                  <span className="font-semibold text-[#0f1b2e]">{entry.partner} · {formatINR(entry.amount)}</span>
                  <span className="text-[#26415f]">{entry.investedOn}</span>
                </div>
                <div className="mt-1 text-[#26415f]">
                  Cash Snapshot: {formatINR(entry.cashBefore)} → {formatINR(entry.cashAfter)}
                </div>
                {entry.note ? <div className="mt-1 text-[#26415f]">{entry.note}</div> : null}
              </div>
            ))}
          </div>

          <p className="mt-2 text-xs text-[#26415f]">
            Total Invested: {formatINR(summary.totalInvested)} · Rahul Withdrawn: {formatINR(summary.rahulWithdrawn)} · Manav Withdrawn: {formatINR(summary.manavWithdrawn)}
          </p>
        </section>

        <section className="glass rise-in col-span-1 rounded-3xl p-5 sm:p-6 lg:col-span-6">
          <h2 className="display-font text-xl font-semibold text-[#0f1b2e]">Inventory Controls</h2>
          <form className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-2" onSubmit={addInventory}>
            <input
              value={inventoryForm.title}
              onChange={(event) => setInventoryForm((prev) => ({ ...prev, title: event.target.value }))}
              placeholder="Item title"
              className="w-full rounded-xl border border-white/90 bg-white/85 px-3 py-2 text-sm outline-none"
            />
            <select
              value={inventoryForm.category}
              onChange={(event) =>
                setInventoryForm((prev) => ({ ...prev, category: event.target.value }))
              }
              className="w-full rounded-xl border border-white/90 bg-white/85 px-3 py-2 text-sm outline-none"
            >
              {itemCategories.map((category) => (
                <option key={category} value={category}>
                  {category}
                </option>
              ))}
            </select>
            <select
              value={inventoryForm.unit}
              onChange={(event) =>
                setInventoryForm((prev) => ({ ...prev, unit: event.target.value as UnitType }))
              }
              className="w-full rounded-xl border border-white/90 bg-white/85 px-3 py-2 text-sm outline-none"
            >
              {unitOptions.map((unit) => (
                <option key={unit} value={unit}>
                  {unit}
                </option>
              ))}
            </select>
            <input
              value={inventoryForm.quantity}
              onChange={(event) =>
                setInventoryForm((prev) => ({ ...prev, quantity: event.target.value }))
              }
              type="number"
              min={1}
              placeholder="Quantity"
              className="w-full rounded-xl border border-white/90 bg-white/85 px-3 py-2 text-sm outline-none"
            />
            <input
              value={inventoryForm.unitCost}
              onChange={(event) =>
                setInventoryForm((prev) => ({ ...prev, unitCost: event.target.value }))
              }
              type="number"
              min={1}
              placeholder="Unit cost"
              className="w-full rounded-xl border border-white/90 bg-white/85 px-3 py-2 text-sm outline-none"
            />
            <button
              type="submit"
              className="rounded-full bg-[#26415f] px-4 py-2 text-sm font-semibold text-white transition hover:opacity-90"
            >
              Add Inventory Item
            </button>
          </form>
          <div className="mt-4 max-h-44 overflow-auto rounded-2xl bg-white/80 p-2">
            {state.inventory.map((item) => (
              <div key={item.id} className="border-b border-white/70 px-2 py-2 text-sm">
                <div className="flex items-center justify-between">
                  <span className="text-[#0f1b2e]">{item.title}</span>
                  <span className="text-[#26415f]">{item.quantity} {item.unit} x {formatINR(item.unitCost)}</span>
                  <button
                    type="button"
                    onClick={() =>
                      setState((prev) => ({
                        ...prev,
                        inventory: prev.inventory.filter((entry) => entry.id !== item.id),
                      }))
                    }
                    disabled={item.quantity !== item.purchasedQuantity}
                    title={
                      item.quantity !== item.purchasedQuantity
                        ? "Cannot delete a sold or partially sold purchase because it would corrupt cash tracking"
                        : "Delete this inventory purchase"
                    }
                    className={`rounded-full px-3 py-1 text-xs font-semibold text-[#0f1b2e] ${
                      item.quantity !== item.purchasedQuantity
                        ? "bg-[#f3f4f6] cursor-not-allowed"
                        : "bg-[#ff8f8f]"
                    }`}
                  >
                    Delete
                  </button>
                </div>
                <div className="mt-1 text-xs text-[#26415f]">
                  Cash Snapshot: {item.purchaseCashBefore === undefined ? "-" : formatINR(item.purchaseCashBefore)} → {item.purchaseCashAfter === undefined ? "-" : formatINR(item.purchaseCashAfter)}
                </div>
              </div>
            ))}
          </div>
        </section>

        <section id="sale-form-section" className="glass rise-in col-span-1 rounded-3xl p-5 sm:p-6 lg:col-span-6">
          <div className="flex items-center justify-between">
            <h2 className="display-font text-xl font-semibold text-[#0f1b2e]">
              {editingSaleId ? "Edit Sale" : "Sales"}
            </h2>
            {editingSaleId && (
              <button
                type="button"
                onClick={resetSaleForm}
                className="rounded-full border border-[#26415f] px-4 py-1.5 text-xs font-semibold text-[#26415f] transition hover:opacity-70"
              >
                Cancel Edit
              </button>
            )}
          </div>

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
                    const oldQty = oldSaleItems.find((oi) => oi.inventoryItemId === item.id)?.quantity ?? 0;
                    return item.quantity + oldQty - alreadyAdded > 0;
                  })
                  .map((item) => {
                    const alreadyAdded = saleItems.find((si) => si.inventoryItemId === item.id)?.quantity ?? 0;
                    const oldQty = oldSaleItems.find((oi) => oi.inventoryItemId === item.id)?.quantity ?? 0;
                    const available = item.quantity + oldQty - alreadyAdded;
                    return (
                      <option key={item.id} value={item.id}>
                        {item.title} · {available} {item.unit} avail · {formatINR(item.unitCost)}/each
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

          <form className="mt-4 space-y-3" onSubmit={addSale}>
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
                {expenseCategories.map((category) => (
                  <option key={category} value={category}>
                    {category}
                  </option>
                ))}
              </select>
            </div>
            <button
              type="submit"
              disabled={saleItems.length === 0}
              className="w-full rounded-full bg-[#26415f] px-4 py-2 text-sm font-semibold text-white disabled:opacity-50"
            >
              {editingSaleId
                ? `Update Sale (${saleItems.length} item${saleItems.length !== 1 ? "s" : ""})`
                : `Add Sale (${saleItems.length} item${saleItems.length !== 1 ? "s" : ""})`}
            </button>
          </form>
          <div className="mt-4 max-h-56 overflow-auto rounded-2xl bg-white/80 p-2">
            {state.sales.map((sale) => (
              <div
                key={sale.id}
                className={`border-b border-white/70 px-2 py-2 text-xs${editingSaleId === sale.id ? " rounded-xl bg-[#a5d8ff]/40 outline outline-1 outline-[#26415f]/30" : ""}`}
              >
                <div className="flex items-center justify-between gap-2">
                  <span className="font-semibold text-[#0f1b2e]">
                    {sale.items.map((it) => `${it.itemTitle} (${it.quantity} ${it.unit})`).join(", ")}
                  </span>
                  <div className="flex shrink-0 gap-1">
                    <button
                      type="button"
                      onClick={() => startEditSale(sale.id)}
                      className="rounded-full bg-[#a5d8ff] px-2 py-1 font-semibold text-[#0f1b2e]"
                    >
                      Edit
                    </button>
                    <button
                      type="button"
                      onClick={() => deleteSale(sale.id)}
                      className="rounded-full bg-[#ff8f8f] px-2 py-1 font-semibold text-[#0f1b2e]"
                    >
                      Delete
                    </button>
                  </div>
                </div>
                <div className="mt-1 text-[#26415f]">
                  Cost: {formatINR(sale.costBasis)} · Sold: {formatINR(sale.saleValue)} · Received: {formatINR(sale.receivedAmount)} · {sale.soldOn}
                </div>
                <div className="mt-1 text-[#26415f]">
                  Cash Snapshot: {sale.cashBefore === undefined ? "-" : formatINR(sale.cashBefore)} → {sale.cashAfter === undefined ? "-" : formatINR(sale.cashAfter)}
                </div>
              </div>
            ))}
          </div>
        </section>

        <section id="expense-form-section" className="glass rise-in col-span-1 rounded-3xl p-5 sm:p-6 lg:col-span-4">
          <div className="flex items-center justify-between">
            <h2 className="display-font text-xl font-semibold text-[#0f1b2e]">
              {editingExpenseId ? "Edit Expense" : "Expenses"}
            </h2>
            {editingExpenseId && (
              <button
                type="button"
                onClick={resetExpenseForm}
                className="rounded-full border border-[#26415f] px-4 py-1.5 text-xs font-semibold text-[#26415f] transition hover:opacity-70"
              >
                Cancel Edit
              </button>
            )}
          </div>
          <form className="mt-4 space-y-3" onSubmit={addExpense}>
            <select
              value={expenseForm.category}
              onChange={(event) =>
                setExpenseForm((prev) => ({ ...prev, category: event.target.value as ExpenseCategory }))
              }
              className="w-full rounded-xl border border-white/90 bg-white/85 px-3 py-2 text-sm outline-none"
            >
              {expenseCategories.map((category) => (
                <option key={category} value={category}>
                  {category}
                </option>
              ))}
            </select>
            <input
              value={expenseForm.amount}
              onChange={(event) => setExpenseForm((prev) => ({ ...prev, amount: event.target.value }))}
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
                onChange={(event) => setExpenseForm((prev) => ({ ...prev, paidAmount: event.target.value }))}
                type="number"
                min={0}
                placeholder="Paid amount"
                className="w-full rounded-xl border border-white/90 bg-white/85 px-3 py-2 text-sm outline-none"
              />
            </div>
            <input
              value={expenseForm.note}
              onChange={(event) => setExpenseForm((prev) => ({ ...prev, note: event.target.value }))}
              placeholder="Note"
              className="w-full rounded-xl border border-white/90 bg-white/85 px-3 py-2 text-sm outline-none"
            />
            <button
              type="submit"
              className="w-full rounded-full bg-[#26415f] px-4 py-2 text-sm font-semibold text-white"
            >
              {editingExpenseId ? "Update Expense" : "Add Expense"}
            </button>
          </form>
          <div className="mt-4 max-h-44 overflow-auto rounded-2xl bg-white/80 p-2">
            {state.expenses.map((expense) => (
              <div
                key={expense.id}
                className={`border-b border-white/70 px-2 py-2 text-xs${editingExpenseId === expense.id ? " rounded-xl bg-[#a5d8ff]/40 outline outline-1 outline-[#26415f]/30" : ""}`}
              >
                <div className="flex items-center justify-between gap-2">
                  <div className="min-w-0">
                    <span className="font-medium text-[#0f1b2e]">{expense.category}</span>
                    <span className="ml-1 text-[#26415f]">({expense.paymentStatus})</span>
                    {expense.note ? <span className="ml-1 truncate text-[#26415f]">· {expense.note}</span> : null}
                    <div className="mt-1 text-[#26415f]">
                      Cash Snapshot: {expense.cashBefore === undefined ? "-" : formatINR(expense.cashBefore)} → {expense.cashAfter === undefined ? "-" : formatINR(expense.cashAfter)}
                    </div>
                  </div>
                  <div className="flex shrink-0 items-center gap-2">
                    <span className="text-[#26415f]">{formatINR(expense.paidAmount)} / {formatINR(expense.amount)}</span>
                    <button
                      type="button"
                      onClick={() => startEditExpense(expense.id)}
                      className="rounded-full bg-[#a5d8ff] px-2 py-1 font-semibold text-[#0f1b2e]"
                    >
                      Edit
                    </button>
                    <button
                      type="button"
                      onClick={() =>
                        setState((prev) => ({
                          ...prev,
                          expenses: prev.expenses.filter((entry) => entry.id !== expense.id),
                        }))
                      }
                      className="rounded-full bg-[#ff8f8f] px-2 py-1 font-semibold text-[#0f1b2e]"
                    >
                      Delete
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </section>

        <section className="glass rise-in col-span-1 rounded-3xl p-5 sm:p-6 lg:col-span-4">
          <h2 className="display-font text-xl font-semibold text-[#0f1b2e]">Withdraw Investment</h2>
          <form className="mt-4 space-y-3" onSubmit={addWithdrawal}>
            <select
              value={withdrawForm.partner}
              onChange={(event) =>
                setWithdrawForm((prev) => ({ ...prev, partner: event.target.value as PartnerName }))
              }
              className="w-full rounded-xl border border-white/90 bg-white/85 px-3 py-2 text-sm outline-none"
            >
              <option value="Manav">Manav</option>
              <option value="Rahul">Rahul</option>
            </select>
            <input
              value={withdrawForm.amount}
              onChange={(event) => setWithdrawForm((prev) => ({ ...prev, amount: event.target.value }))}
              type="number"
              min={1}
              placeholder="Amount"
              className="w-full rounded-xl border border-white/90 bg-white/85 px-3 py-2 text-sm outline-none"
            />
            <button
              type="submit"
              className="w-full rounded-full bg-[#0f1b2e] px-4 py-2 text-sm font-semibold text-white"
            >
              Withdraw
            </button>
          </form>
          <p className="mt-2 text-xs text-[#26415f]">
            No negative withdrawal allowed. Amount must be within available cash and partner net investment.
          </p>
          <div className="mt-4 max-h-44 overflow-auto rounded-2xl bg-white/80 p-2">
            {state.withdrawals.map((withdrawal) => (
              <div key={withdrawal.id} className="border-b border-white/70 px-2 py-2 text-xs">
                <div className="flex items-center justify-between">
                  <span className="text-[#0f1b2e]">{withdrawal.partner}</span>
                  <span className="text-[#26415f]">{formatINR(withdrawal.amount)}</span>
                  <button
                    type="button"
                    onClick={() =>
                      setState((prev) => ({
                        ...prev,
                        withdrawals: prev.withdrawals.filter((entry) => entry.id !== withdrawal.id),
                      }))
                    }
                    className="rounded-full bg-[#ff8f8f] px-2 py-1 font-semibold text-[#0f1b2e]"
                  >
                    Delete
                  </button>
                </div>
                <div className="mt-1 text-[#26415f]">
                  Cash Snapshot: {withdrawal.cashBefore === undefined ? "-" : formatINR(withdrawal.cashBefore)} → {withdrawal.cashAfter === undefined ? "-" : formatINR(withdrawal.cashAfter)}
                </div>
              </div>
            ))}
          </div>
        </section>

        <section className="glass rise-in col-span-1 rounded-3xl p-5 sm:p-6 lg:col-span-12">
          <h2 className="display-font text-xl font-semibold text-[#0f1b2e]">Tasks</h2>
          <form className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-[1fr_auto_auto]" onSubmit={addTask}>
            <input
              value={taskForm.title}
              onChange={(event) => setTaskForm((prev) => ({ ...prev, title: event.target.value }))}
              placeholder="Task title"
              className="w-full rounded-xl border border-white/90 bg-white/85 px-3 py-2 text-sm outline-none"
            />
            <input
              value={taskForm.dueDate}
              onChange={(event) => setTaskForm((prev) => ({ ...prev, dueDate: event.target.value }))}
              type="date"
              className="w-full rounded-xl border border-white/90 bg-white/85 px-3 py-2 text-sm outline-none"
            />
            <button
              type="submit"
              className="rounded-full bg-[#26415f] px-4 py-2 text-sm font-semibold text-white"
            >
              Add Task
            </button>
          </form>
          <div className="mt-4 max-h-64 overflow-auto rounded-2xl bg-white/80 p-2">
            {state.tasks.map((task) => (
              <div key={task.id} className="flex flex-col gap-2 border-b border-white/70 px-2 py-2 text-sm sm:flex-row sm:items-center sm:justify-between">
                <div>
                  <p className="font-semibold text-[#0f1b2e]">{task.title}</p>
                  <p className="text-xs text-[#26415f]">Due {task.dueDate}</p>
                </div>
                <div className="flex gap-2">
                  <button
                    type="button"
                    onClick={() =>
                      setState((prev) => ({
                        ...prev,
                        tasks: prev.tasks.map((entry) =>
                          entry.id === task.id ? { ...entry, done: !entry.done } : entry,
                        ),
                      }))
                    }
                    className="rounded-full bg-[#9fe0d2] px-3 py-1 text-xs font-semibold text-[#0f1b2e]"
                  >
                    {task.done ? "Mark Pending" : "Mark Done"}
                  </button>
                  <button
                    type="button"
                    onClick={() =>
                      setState((prev) => ({
                        ...prev,
                        tasks: prev.tasks.filter((entry) => entry.id !== task.id),
                      }))
                    }
                    className="rounded-full bg-[#ff8f8f] px-3 py-1 text-xs font-semibold text-[#0f1b2e]"
                  >
                    Delete
                  </button>
                </div>
              </div>
            ))}
          </div>
        </section>

        <section className="glass rise-in col-span-1 rounded-3xl p-5 sm:p-6 lg:col-span-12">
          <h2 className="display-font text-xl font-semibold text-[#0f1b2e]">Transaction Ledger</h2>
          <p className="mt-1 text-sm text-[#26415f]">Every transaction in chronological order with cash balance snapshot.</p>
          <div className="mt-4 overflow-auto rounded-2xl bg-white/80">
            <table className="w-full min-w-[800px] text-left text-xs">
              <thead className="sticky top-0 bg-white/95">
                <tr className="text-[10px] tracking-widest text-[#26415f] uppercase">
                  <th className="px-3 py-2">Date</th>
                  <th className="px-3 py-2">Type</th>
                  <th className="px-3 py-2">Description</th>
                  <th className="px-3 py-2 text-right">Amount</th>
                  <th className="px-3 py-2 text-right">Cash Before</th>
                  <th className="px-3 py-2 text-right">Cash After</th>
                  <th className="px-3 py-2 text-right">Effect</th>
                </tr>
              </thead>
              <tbody>
                {ledgerRows.map((row, i) => (
                    <tr key={i} className="border-t border-white/70 hover:bg-white/60">
                      <td className="px-3 py-2 text-[#26415f]">{row.date}</td>
                      <td className="px-3 py-2">
                        <span
                          className="rounded-full px-2 py-0.5 text-[10px] font-semibold text-[#0f1b2e]"
                          style={{ backgroundColor: row.badge }}
                        >
                          {row.type}
                        </span>
                      </td>
                      <td className="px-3 py-2 text-[#0f1b2e]">{row.description}</td>
                      <td className="px-3 py-2 text-right font-semibold text-[#0f1b2e]">
                        {row.effect} {formatINR(row.amount)}
                      </td>
                      <td className="px-3 py-2 text-right text-[#26415f]">
                        {row.cashBefore !== undefined ? formatINR(row.cashBefore) : "—"}
                      </td>
                      <td className="px-3 py-2 text-right text-[#26415f]">
                        {row.cashAfter !== undefined ? formatINR(row.cashAfter) : "—"}
                      </td>
                      <td className="px-3 py-2 text-right">
                        {row.cashBefore !== undefined && row.cashAfter !== undefined ? (
                          <span
                            className="font-semibold"
                            style={{ color: row.cashAfter >= row.cashBefore ? "#16a34a" : "#dc2626" }}
                          >
                            {row.cashAfter >= row.cashBefore ? "▲" : "▼"} {formatINR(Math.abs(row.cashAfter - row.cashBefore))}
                          </span>
                        ) : "—"}
                      </td>
                    </tr>
                  ))}
              </tbody>
            </table>
          </div>
        </section>

        <section className="glass rise-in col-span-1 rounded-3xl p-5 sm:p-6 lg:col-span-12">
          <h2 className="display-font text-xl font-semibold text-[#0f1b2e]">System Actions</h2>
          <p className="mt-1 text-sm text-[#26415f]">
            Retained Profit: {formatINR(summary.retained)} · Sales: {formatINR(summary.sales)} · Expenses: {formatINR(summary.expenses)}
          </p>

          <div className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-3">
            <div className="rounded-2xl bg-white/80 p-4">
              <p className="text-xs font-semibold tracking-wider text-[#26415f] uppercase">Export Data</p>
              <p className="mt-1 text-xs text-[#26415f]">Download all your business data as a JSON backup file.</p>
              <button
                type="button"
                onClick={() => {
                  const raw = window.localStorage.getItem("hisab.business.state.v1");
                  if (!raw) return;
                  const blob = new Blob([raw], { type: "application/json" });
                  const url = URL.createObjectURL(blob);
                  const a = document.createElement("a");
                  a.href = url;
                  a.download = `hisab-backup-${new Date().toISOString().slice(0, 10)}.json`;
                  a.click();
                  URL.revokeObjectURL(url);
                }}
                className="mt-3 w-full rounded-full bg-[#26415f] px-4 py-2 text-sm font-semibold text-white transition hover:opacity-90"
              >
                Export JSON Backup
              </button>
            </div>

            <div className="rounded-2xl bg-white/80 p-4">
              <p className="text-xs font-semibold tracking-wider text-[#26415f] uppercase">Import Data</p>
              <p className="mt-1 text-xs text-[#26415f]">Load a backup JSON file. This will replace all current data.</p>
              <label className="mt-3 flex w-full cursor-pointer items-center justify-center rounded-full bg-[#0f1b2e] px-4 py-2 text-sm font-semibold text-white transition hover:opacity-90">
                Choose Backup File
                <input
                  type="file"
                  accept="application/json,.json"
                  className="hidden"
                  onChange={(event) => {
                    const file = event.target.files?.[0];
                    if (!file) return;
                    const reader = new FileReader();
                    reader.onload = (e) => {
                      try {
                        const text = e.target?.result as string;
                        JSON.parse(text); // validate it's valid JSON
                        window.localStorage.setItem("hisab.business.state.v1", text);
                        window.location.reload();
                      } catch {
                        alert("Invalid backup file. Please choose a valid Hisab JSON export.");
                      }
                    };
                    reader.readAsText(file);
                    event.target.value = "";
                  }}
                />
              </label>
            </div>

            <div className="rounded-2xl bg-white/80 p-4">
              <p className="text-xs font-semibold tracking-wider text-[#26415f] uppercase">Reset</p>
              <p className="mt-1 text-xs text-[#26415f]">Wipe everything and reload the default seed data.</p>
              <button
                type="button"
                onClick={() => {
                  if (!window.confirm("This will delete ALL your data and load sample data. Are you sure?")) return;
                  window.localStorage.removeItem("hisab.business.state.v1");
                  window.location.reload();
                }}
                className="mt-3 w-full rounded-full bg-[#ff8f8f] px-4 py-2 text-sm font-semibold text-[#0f1b2e] transition hover:opacity-90"
              >
                Reset to Seed Data
              </button>
            </div>
          </div>
        </section>
      </main>
    </div>
  );
}
