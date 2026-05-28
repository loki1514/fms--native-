import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import AsyncStorage from '@react-native-async-storage/async-storage';

interface DashboardState {
  tickets: any[];
  ticketCounts: { total: number; open: number; closed: number };
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
  loadedPropertyId: string | null;
  lastUpdatedAt: number | null;
  backgroundImage: string;
  setBackgroundImage: (url: string) => void;
  setDashboardData: (data: Partial<DashboardState>) => void;
  clearCache: () => void;
}

const initialState = {
  tickets: [],
  ticketCounts: { total: 0, open: 0, closed: 0 },
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
  loadedPropertyId: null,
  lastUpdatedAt: null,
  backgroundImage: 'https://images.unsplash.com/photo-1519681393784-d120267933ba?q=80&w=1200&auto=format&fit=crop', // Night sky default
};

export const useDashboardStore = create<DashboardState>()(
  persist(
    (set) => ({
      ...initialState,
      setBackgroundImage: (url) => set((state) => ({ ...state, backgroundImage: url })),
      setDashboardData: (data) => set((state) => ({ ...state, ...data })),
      clearCache: () => set({ ...initialState }),
    }),
    {
      name: 'autopilot-dashboard-store',
      storage: createJSONStorage(() => AsyncStorage),
      partialize: (state) => ({
        tickets: state.tickets,
        ticketCounts: state.ticketCounts,
        sopCount: state.sopCount,
        sopTotal: state.sopTotal,
        energyKwh: state.energyKwh,
        energyTrend: state.energyTrend,
        propertyName: state.propertyName,
        vmsStats: state.vmsStats,
        vendorStats: state.vendorStats,
        dieselStats: state.dieselStats,
        healthScore: state.healthScore,
        attentionItems: state.attentionItems,
        ticketFunnel: state.ticketFunnel,
        hasLoadedInitialData: state.hasLoadedInitialData,
        loadedPropertyId: state.loadedPropertyId,
        lastUpdatedAt: state.lastUpdatedAt,
        backgroundImage: state.backgroundImage,
      }),
    }
  )
);
