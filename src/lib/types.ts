export type PartnerName = "Manav" | "Rahul";
export type UnitType = "pcs" | "box" | "set" | "kg" | "meter";

export type ExpenseCategory =
  | "Packaging"
  | "Material"
  | "Shipping"
  | "Ads"
  | "Interest"
  | "Other";

export type InventoryItem = {
  id: string;
  title: string;
  category: "Laptop" | "GPU" | "Desktop Part" | "Full Desktop" | "Other";
  unit: UnitType;
  quantity: number;
  purchasedQuantity: number;
  unitCost: number;
  purchasedOn: string;
  purchaseCashBefore?: number;
  purchaseCashAfter?: number;
};

export type SaleItem = {
  inventoryItemId: string;
  itemTitle: string;
  unit: UnitType;
  quantity: number;
  unitCost: number;
};

export type Sale = {
  id: string;
  items: SaleItem[];
  receivedAmount: number;
  saleValue: number;
  costBasis: number;
  soldOn: string;
  cashBefore?: number;
  cashAfter?: number;
};

export type Expense = {
  id: string;
  category: ExpenseCategory;
  paymentStatus: "Paid" | "Pending";
  paidAmount: number;
  amount: number;
  note: string;
  spentOn: string;
  cashBefore?: number;
  cashAfter?: number;
};

export type Withdrawal = {
  id: string;
  partner: PartnerName;
  amount: number;
  withdrawnOn: string;
  cashBefore?: number;
  cashAfter?: number;
};

export type Investment = {
  id: string;
  partner: PartnerName;
  amount: number;
  investedOn: string;
  note?: string;
  cashBefore: number;
  cashAfter: number;
};

export type Task = {
  id: string;
  title: string;
  dueDate: string;
  done: boolean;
};

export type BusinessState = {
  partners: PartnerName[];
  investments: Investment[];
  inventory: InventoryItem[];
  sales: Sale[];
  expenses: Expense[];
  withdrawals: Withdrawal[];
  tasks: Task[];
};
