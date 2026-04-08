import { BusinessState } from "@/lib/types";

export const initialBusinessState: BusinessState = {
  partners: ["Manav", "Rahul"],
  investments: [
    {
      id: "invst-1",
      partner: "Rahul",
      amount: 107000,
      investedOn: "2026-03-10",
      note: "Initial business investment",
      cashBefore: 0,
      cashAfter: 107000,
    },
  ],
  inventory: [
    {
      id: "inv-1",
      title: "RTX 3060 12GB",
      category: "GPU",
      unit: "pcs",
      quantity: 3,
      purchasedQuantity: 3,
      unitCost: 24000,
      purchasedOn: "2026-03-10",
    },
    {
      id: "inv-2",
      title: "Dell Latitude Refurb",
      category: "Laptop",
      unit: "pcs",
      quantity: 2,
      purchasedQuantity: 2,
      unitCost: 28500,
      purchasedOn: "2026-03-12",
    },
    {
      id: "inv-3",
      title: "Ryzen Build Kit",
      category: "Desktop Part",
      unit: "pcs",
      quantity: 5,
      purchasedQuantity: 5,
      unitCost: 9300,
      purchasedOn: "2026-03-18",
    },
  ],
  sales: [
    {
      id: "s-1",
      items: [
        {
          inventoryItemId: "inv-1",
          itemTitle: "RTX 3060 12GB",
          unit: "pcs",
          quantity: 1,
          unitCost: 24000,
        },
      ],
      receivedAmount: 29500,
      saleValue: 29500,
      costBasis: 24000,
      soldOn: "2026-03-25",
    },
    {
      id: "s-2",
      items: [
        {
          inventoryItemId: "inv-3",
          itemTitle: "Ryzen Build Kit",
          unit: "pcs",
          quantity: 2,
          unitCost: 9300,
        },
      ],
      receivedAmount: 19000,
      saleValue: 24800,
      costBasis: 18600,
      soldOn: "2026-04-01",
    },
  ],
  expenses: [
    {
      id: "e-1",
      category: "Packaging",
      paymentStatus: "Paid",
      paidAmount: 600,
      amount: 600,
      note: "Boxes and bubble wrap",
      spentOn: "2026-03-25",
    },
    {
      id: "e-2",
      category: "Shipping",
      paymentStatus: "Paid",
      paidAmount: 950,
      amount: 950,
      note: "Courier charges",
      spentOn: "2026-03-26",
    },
    {
      id: "e-3",
      category: "Ads",
      paymentStatus: "Pending",
      paidAmount: 700,
      amount: 1400,
      note: "Instagram and FB ads",
      spentOn: "2026-04-01",
    },
  ],
  withdrawals: [
    {
      id: "w-1",
      partner: "Rahul",
      amount: 2000,
      withdrawnOn: "2026-04-02",
    },
  ],
  tasks: [
    {
      id: "t-2",
      title: "Reconcile 30-day sales report",
      dueDate: "2026-04-05",
      done: false,
    },
  ],
};
