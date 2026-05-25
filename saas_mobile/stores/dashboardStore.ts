import { create } from 'zustand';

interface DashboardState {
  tickets: any[];
  sopCount: number;
  sopTotal: number;
  energyKwh: number;
  energyTrend: number;
  propertyName: string;
  vmsStats: { total: number; in: number; out: number };
  vendorStats: { revenue: number; commission: number };
  dieselStats: { level: number; consumption: number };
  healthScore: any;
  attentionItems: any[];
  ticketFunnel: any[];
  hasLoadedInitialData: boolean;
  setDashboardData: (data: Partial<DashboardState>) => void;
  clearCache: () => void;
}

export const useDashboardStore = create<DashboardState>((set) => ({
  tickets: [],
  sopCount: 0,
  sopTotal: 0,
  energyKwh: 0,
  energyTrend: 12,
  propertyName: 'Property',
  vmsStats: { total: 0, in: 0, out: 0 },
  vendorStats: { revenue: 0, commission: 0 },
  dieselStats: { level: 0, consumption: 0 },
  healthScore: null,
  attentionItems: [],
  ticketFunnel: [],
  hasLoadedInitialData: false,
  setDashboardData: (data) => set((state) => ({ ...state, ...data })),
  clearCache: () => set({ hasLoadedInitialData: false }),
}));
