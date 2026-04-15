"use client";

import { useCallback, useSyncExternalStore } from "react";
import { initialBusinessState } from "@/lib/seed";
import { BusinessState, ExpenseCategory, SaleItem, UnitType } from "@/lib/types";

const STORAGE_KEY = "hisab.business.state.v1";
const listeners = new Set<() => void>();

export const id = () =>
  `id-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 7)}`;

const isUnitType = (value: unknown): value is UnitType =>
  ["pcs", "box", "set", "kg", "meter"].includes(String(value));

const isExpenseCategory = (value: unknown): value is ExpenseCategory =>
  ["Packaging", "Material", "Shipping", "Ads", "Interest", "Other"].includes(
    String(value),
  );

const normalizeState = (state: BusinessState): BusinessState => {
  // Backward compatibility: migrate legacy loan principal to Rahul investment.
  const legacyState = state as unknown as { loan?: { principal?: unknown }; investments?: unknown };
  const legacyLoanPrincipal =
    typeof legacyState.loan?.principal === "number"
      ? legacyState.loan.principal
      : 0;

  const normalizedInvestments = Array.isArray(legacyState.investments)
    ? (legacyState.investments as Array<Record<string, unknown>>)
        .map((entry) => ({
          id: typeof entry.id === "string" ? entry.id : id(),
          partner: (entry.partner === "Manav" || entry.partner === "Rahul" ? entry.partner : "Rahul") as "Manav" | "Rahul",
          amount: Number.isFinite(entry.amount) ? Number(entry.amount) : 0,
          investedOn:
            typeof entry.investedOn === "string"
              ? entry.investedOn
              : new Date().toISOString().slice(0, 10),
          note: typeof entry.note === "string" ? entry.note : "",
          cashBefore: Number.isFinite(entry.cashBefore) ? Number(entry.cashBefore) : 0,
          cashAfter: Number.isFinite(entry.cashAfter) ? Number(entry.cashAfter) : Number(entry.amount ?? 0),
        }))
        .filter((entry) => entry.amount > 0)
    : [];

  const investments =
    normalizedInvestments.length > 0
      ? normalizedInvestments
      : legacyLoanPrincipal > 0
        ? [{
            id: "legacy-rahul-investment",
            partner: "Rahul" as const,
            amount: legacyLoanPrincipal,
            investedOn: new Date().toISOString().slice(0, 10),
            note: "Migrated from legacy loan principal",
            cashBefore: 0,
            cashAfter: legacyLoanPrincipal,
          }]
        : [];

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const normalizedSales = state.sales.map((sale: any) => {
    const items: SaleItem[] = Array.isArray(sale.items) && sale.items.length > 0
      ? (sale.items as SaleItem[]).map((it: SaleItem) => ({
          inventoryItemId: it.inventoryItemId ?? "",
          itemTitle: it.itemTitle ?? "",
          unit: isUnitType(it.unit) ? it.unit : "pcs" as UnitType,
          quantity: Number.isFinite(it.quantity) ? it.quantity : 0,
          unitCost: Number.isFinite(it.unitCost) ? it.unitCost : 0,
        }))
      : [{
          inventoryItemId: sale.inventoryItemId ?? "",
          itemTitle: sale.itemTitle ?? "",
          unit: isUnitType(sale.unit) ? sale.unit : "pcs" as UnitType,
          quantity: Number.isFinite(sale.quantity) ? sale.quantity : 0,
          unitCost: sale.quantity > 0 ? (sale.costBasis ?? 0) / sale.quantity : 0,
        }];

    return {
      id: sale.id,
      items,
      saleValue: typeof sale.saleValue === "number" ? sale.saleValue : 0,
      receivedAmount:
        typeof sale.receivedAmount === "number" ? sale.receivedAmount : (sale.saleValue ?? 0),
      costBasis: typeof sale.costBasis === "number" ? sale.costBasis : 0,
      soldOn: sale.soldOn ?? new Date().toISOString().slice(0, 10),
      cashBefore: typeof sale.cashBefore === "number" ? sale.cashBefore : undefined,
      cashAfter: typeof sale.cashAfter === "number" ? sale.cashAfter : undefined,
    };
  });

  const soldQtyByInventoryId = new Map<string, number>();
  const soldQtyByTitleUnit = new Map<string, number>();

  for (const sale of normalizedSales) {
    for (const item of sale.items) {
      const qty = Number.isFinite(item.quantity) ? Math.max(item.quantity, 0) : 0;
      if (item.inventoryItemId) {
        soldQtyByInventoryId.set(
          item.inventoryItemId,
          (soldQtyByInventoryId.get(item.inventoryItemId) ?? 0) + qty,
        );
      }
      const key = `${item.itemTitle}::${item.unit}`;
      soldQtyByTitleUnit.set(key, (soldQtyByTitleUnit.get(key) ?? 0) + qty);
    }
  }

  const normalizedInventory = state.inventory.map((item) => {
    const unit = isUnitType((item as { unit?: unknown }).unit) ? item.unit : "pcs";
    const explicitPurchased = (item as { purchasedQuantity?: unknown }).purchasedQuantity;
    const soldById = soldQtyByInventoryId.get(item.id) ?? 0;
    const soldByTitleUnit = soldQtyByTitleUnit.get(`${item.title}::${unit}`) ?? 0;
    const inferredPurchased = item.quantity + Math.max(soldById, soldByTitleUnit);

    const purchasedQuantity =
      typeof explicitPurchased === "number" && explicitPurchased >= item.quantity
        ? explicitPurchased
        : inferredPurchased;

    return {
      ...item,
      unit,
      purchasedQuantity: Math.max(item.quantity, purchasedQuantity),
    };
  });

  return {
    ...state,
    inventory: normalizedInventory,
    sales: normalizedSales,
    expenses: state.expenses.map((expense) => {
    const paidAmountRaw =
      typeof (expense as { paidAmount?: unknown }).paidAmount === "number"
        ? (expense as { paidAmount: number }).paidAmount
        : expense.amount;
    const paidAmount = Math.max(0, Math.min(paidAmountRaw, expense.amount));
    const statusRaw = (expense as { paymentStatus?: unknown }).paymentStatus;
    const paymentStatus: "Paid" | "Pending" =
      statusRaw === "Paid" || statusRaw === "Pending"
        ? statusRaw
        : paidAmount >= expense.amount
          ? "Paid"
          : "Pending";

    return {
      ...expense,
      category: isExpenseCategory(expense.category) ? expense.category : "Other",
      paidAmount,
      paymentStatus,
      saleId:
        typeof (expense as { saleId?: unknown }).saleId === "string"
          ? (expense as { saleId: string }).saleId
          : undefined,
      cashBefore:
        typeof (expense as { cashBefore?: unknown }).cashBefore === "number"
          ? (expense as { cashBefore: number }).cashBefore
          : undefined,
      cashAfter:
        typeof (expense as { cashAfter?: unknown }).cashAfter === "number"
          ? (expense as { cashAfter: number }).cashAfter
          : undefined,
    };
  }),
    investments,
    withdrawals: state.withdrawals.map((entry) => ({
      ...entry,
      cashBefore:
        typeof (entry as { cashBefore?: unknown }).cashBefore === "number"
          ? (entry as { cashBefore: number }).cashBefore
          : undefined,
      cashAfter:
        typeof (entry as { cashAfter?: unknown }).cashAfter === "number"
          ? (entry as { cashAfter: number }).cashAfter
          : undefined,
    })),
  };
};

const serverSnapshot = normalizeState(initialBusinessState);
let cachedState: BusinessState = serverSnapshot;
let clientInitialized = false;
let serverSyncDone = false;
let serverPollStarted = false;
let lastServerSignature = "";
let lastSyncTime = 0;  // Track when we last synced to prevent polling override
let hasPendingServerWrite = false;

const syncToServer = (state: BusinessState) => {
  hasPendingServerWrite = true;
  lastSyncTime = Date.now();  // Mark sync attempt time
  fetch("/api/state", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(state),
  }).then(res => {
    if (res.ok) {
      // Mark successful sync - polling can now update
      hasPendingServerWrite = false;
      lastServerSignature = stateSignature(state);
    } else {
      res.json().then(data => console.warn("Server error:", data)).catch(() => {});
    }
  }).catch((err) => {
    console.warn("Sync failed:", err);
  });
};

const parseBusinessState = (raw: string | null): BusinessState => {
  if (!raw) {
    return serverSnapshot;
  }

  try {
    const parsed = JSON.parse(raw) as BusinessState;
    return normalizeState(parsed);
  } catch {
    return serverSnapshot;
  }
};

const stateSignature = (state: BusinessState) => JSON.stringify(state);

const getServerSnapshot = () => serverSnapshot;

const initClientSnapshot = () => {
  if (clientInitialized || typeof window === "undefined") {
    return;
  }

  // Read localStorage first for instant render (sync)
  cachedState = parseBusinessState(window.localStorage.getItem(STORAGE_KEY));
  lastServerSignature = stateSignature(cachedState);
  clientInitialized = true;

  const pullLatestFromServer = () => {
    // If local changes could not be persisted, do not allow stale server
    // state to overwrite in-browser data.
    if (hasPendingServerWrite) {
      return;
    }

    fetch("/api/state")
      .then((res) => res.json())
      .then((data: unknown) => {
        if (!data || typeof data !== "object" || !("sales" in data)) {
          return;
        }

        const serverState = normalizeState(data as BusinessState);
        const signature = stateSignature(serverState);

        // No-op when browser already has the latest state.
        if (signature === lastServerSignature) {
          return;
        }

        // During sync grace period (3s after sync), trust local state over server
        // This prevents polling from reverting changes before they save
        const timeSinceSync = Date.now() - lastSyncTime;
        if (timeSinceSync < 3000) {
          // We just synced - don't let server override our local state yet
          return;
        }

        cachedState = serverState;
        lastServerSignature = signature;
        window.localStorage.setItem(STORAGE_KEY, JSON.stringify(serverState));
        emitChange();
      })
      .catch(() => {
        // Ignore transient network failures and keep current UI state.
      });
  };

  // Then fetch from server — server is the source of truth across all browsers
  if (!serverSyncDone) {
    serverSyncDone = true;
    fetch("/api/state")
      .then((res) => res.json())
      .then((data: unknown) => {
        if (data && typeof data === "object" && "sales" in data) {
          // Server has data — merge intelligently
          const serverState = normalizeState(data as BusinessState);
          // If localStorage has more inventory items, it's likely the richer
          // source (e.g. real data vs seed). Keep the one with more items.
          if (cachedState.inventory.length > serverState.inventory.length) {
            // localStorage has more data — upload to server instead
            syncToServer(cachedState);
            lastServerSignature = stateSignature(cachedState);
          } else {
            cachedState = serverState;
            lastServerSignature = stateSignature(serverState);
            window.localStorage.setItem(STORAGE_KEY, JSON.stringify(serverState));
            emitChange();
          }
        } else {
          // Server is empty — upload current localStorage data to server
          // (first-time migration, e.g. Edge browser data)
          const localRaw = window.localStorage.getItem(STORAGE_KEY);
          if (localRaw) {
            syncToServer(cachedState);
          }
        }
      })
      .catch(() => {
        // Server unreachable — stay on localStorage data silently
      });
  }

  // Keep all browser tabs/devices in sync by polling the server snapshot.
  // Only poll when tab is visible to save Upstash free-tier requests.
  if (!serverPollStarted) {
    serverPollStarted = true;
    let pollInterval: ReturnType<typeof setInterval> | null = null;

    const startPolling = () => {
      if (!pollInterval) {
        pollInterval = setInterval(pullLatestFromServer, 10_000);
      }
    };

    const stopPolling = () => {
      if (pollInterval) {
        clearInterval(pollInterval);
        pollInterval = null;
      }
    };

    // Start immediately if tab is visible
    if (!document.hidden) startPolling();

    // Pause polling when tab is hidden, resume when visible
    document.addEventListener("visibilitychange", () => {
      if (document.hidden) {
        stopPolling();
      } else {
        pullLatestFromServer(); // Immediately sync when tab becomes visible
        startPolling();
      }
    });
  }
};

const getClientSnapshot = () => {
  if (typeof window === "undefined") {
    return getServerSnapshot();
  }

  initClientSnapshot();
  return cachedState;
};

const subscribe = (listener: () => void) => {
  listeners.add(listener);

  const onStorage = (event: StorageEvent) => {
    if (event.key === STORAGE_KEY) {
      cachedState = parseBusinessState(event.newValue);
      lastServerSignature = stateSignature(cachedState);
      listener();
    }
  };

  if (typeof window !== "undefined") {
    window.addEventListener("storage", onStorage);
  }

  return () => {
    listeners.delete(listener);
    if (typeof window !== "undefined") {
      window.removeEventListener("storage", onStorage);
    }
  };
};

const emitChange = () => {
  listeners.forEach((listener) => listener());
};

export const useBusinessState = () => {
  const state = useSyncExternalStore(subscribe, getClientSnapshot, getServerSnapshot);

  const setState = useCallback(
    (nextState: BusinessState | ((prevState: BusinessState) => BusinessState)) => {
      if (typeof window === "undefined") {
        return;
      }

      initClientSnapshot();
      const previous = cachedState;
      const resolved =
        typeof nextState === "function"
          ? (nextState as (prevState: BusinessState) => BusinessState)(previous)
          : nextState;

      cachedState = normalizeState(resolved);
      lastServerSignature = stateSignature(cachedState);

      window.localStorage.setItem(STORAGE_KEY, JSON.stringify(cachedState));
      syncToServer(cachedState);
      emitChange();
    },
    [],
  );

  return { state, setState, storageKey: STORAGE_KEY };
};
