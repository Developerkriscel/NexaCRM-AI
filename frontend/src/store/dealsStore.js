import { create } from 'zustand'

export const useDealsStore = create((set, get) => ({
  deals: {},
  loading: false,
  error: null,

  moveDeal: (dealId, fromStage, toStage) => {
    set((s) => {
      const deal = s.deals[fromStage]?.find((d) => d.id === dealId)
      if (!deal) return s
      return {
        deals: {
          ...s.deals,
          [fromStage]: s.deals[fromStage].filter((d) => d.id !== dealId),
          [toStage]:   [...(s.deals[toStage] ?? []), deal],
        }
      }
    })
  },

  addDeal: (stage, deal) =>
    set((s) => ({
      deals: { ...s.deals, [stage]: [{ ...deal, id: `d${Date.now()}` }, ...(s.deals[stage] ?? [])] }
    })),

  updateDeal: (dealId, data) =>
    set((s) => {
      const deals = {}
      for (const [stage, list] of Object.entries(s.deals)) {
        deals[stage] = list.map((d) => (d.id === dealId ? { ...d, ...data } : d))
      }
      return { deals }
    }),

  deleteDeal: (dealId) =>
    set((s) => {
      const deals = {}
      for (const [stage, list] of Object.entries(s.deals)) {
        deals[stage] = list.filter((d) => d.id !== dealId)
      }
      return { deals }
    }),

  getTotalValue: () => {
    const s = get()
    return Object.values(s.deals).flat().reduce((acc, d) => acc + (d.value ?? 0), 0)
  },
}))
