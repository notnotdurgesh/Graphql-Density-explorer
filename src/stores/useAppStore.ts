import { create } from 'zustand';
import { persist } from 'zustand/middleware';

export interface SavedEndpoint {
  url: string;
  headers: Record<string, string>;
  name?: string;
  lastUsed?: number;
}

export interface GraphQLField {
  name: string;
  type: string;
  isRequired: boolean;
  isList: boolean;
  description?: string;
  kind: string;
}

export interface GraphQLType {
  name: string;
  fields: GraphQLField[];
  description?: string;
}

export interface GraphQLEnumValue {
  name: string;
  description?: string;
  isDeprecated: boolean;
  deprecationReason?: string;
}

export interface GraphQLEnumType {
  name: string;
  description?: string;
  values: GraphQLEnumValue[];
}

export interface GraphQLInterfaceType {
  name: string;
  description?: string;
  fields: GraphQLField[];
  possibleTypes: string[];
}

export interface GraphQLUnionType {
  name: string;
  description?: string;
  possibleTypes: string[];
}

export interface GraphQLInputField {
  name: string;
  type: string;
  isRequired: boolean;
  isList: boolean;
  description?: string;
  defaultValue?: string;
}

export interface GraphQLInputType {
  name: string;
  description?: string;
  fields: GraphQLInputField[];
}

export interface GraphQLDirective {
  name: string;
  description?: string;
  locations: string[];
  args: { name: string; type: string; description?: string; defaultValue?: string }[];
}

export interface SchemaStats {
  objectTypeCount: number;
  enumTypeCount: number;
  interfaceTypeCount: number;
  unionTypeCount: number;
  inputTypeCount: number;
  directiveCount: number;
  totalFields: number;
  queryFields: string[];
  mutationFields: string[];
}

export interface ConnectionHealth {
  latencyMs: number;
  lastChecked: number;
  schemaSize: number;
}

export interface QueryHistoryItem {
  id: string;
  query: string;
  variables: string;
  result: string;
  error?: string;
  timestamp: number;
  durationMs: number;
}

interface FullSchema {
  enums: GraphQLEnumType[];
  interfaces: GraphQLInterfaceType[];
  unions: GraphQLUnionType[];
  inputTypes: GraphQLInputType[];
  directives: GraphQLDirective[];
}

interface AppState {
  endpoint: string;
  headers: Record<string, string>;
  savedEndpoints: SavedEndpoint[];
  schema: GraphQLType[];
  fullSchema: FullSchema;
  schemaStats: SchemaStats | null;
  selectedTypes: string[];
  densityData: Record<string, Record<string, number>>;
  sampleData: Record<string, any[]>;
  status: 'idle' | 'connecting' | 'connected' | 'error' | 'fetching';
  error: string | null;
  theme: 'light' | 'dark' | 'system';
  sampleSize: number;
  hasSeenOnboarding: boolean;
  heatmapColors: { low: string; medium: string; high: string };
  refreshInterval: number;
  connectionHealth: ConnectionHealth | null;
  queryHistory: QueryHistoryItem[];
  
  setEndpoint: (url: string) => void;
  setHeaders: (headers: Record<string, string>) => void;
  addSavedEndpoint: (endpoint: SavedEndpoint) => void;
  removeSavedEndpoint: (url: string) => void;
  setSchema: (schema: GraphQLType[]) => void;
  setFullSchema: (schema: FullSchema) => void;
  setSchemaStats: (stats: SchemaStats) => void;
  setSelectedTypes: (types: string[]) => void;
  setDensityData: (data: Record<string, Record<string, number>>) => void;
  setSampleData: (data: Record<string, any[]>) => void;
  setStatus: (status: AppState['status']) => void;
  setError: (error: string | null) => void;
  setTheme: (theme: 'light' | 'dark' | 'system') => void;
  setSampleSize: (size: number) => void;
  setHasSeenOnboarding: (seen: boolean) => void;
  setHeatmapColors: (colors: { low: string; medium: string; high: string }) => void;
  setRefreshInterval: (interval: number) => void;
  setConnectionHealth: (health: ConnectionHealth) => void;
  addQueryHistory: (item: QueryHistoryItem) => void;
  clearQueryHistory: () => void;
  reset: () => void;
}

const emptyFullSchema: FullSchema = {
  enums: [],
  interfaces: [],
  unions: [],
  inputTypes: [],
  directives: [],
};

export const useAppStore = create<AppState>()(
  persist(
    (set) => ({
      endpoint: '',
      headers: {},
      savedEndpoints: [],
      schema: [],
      fullSchema: emptyFullSchema,
      schemaStats: null,
      selectedTypes: [],
      densityData: {},
      sampleData: {},
      status: 'idle',
      error: null,
      theme: 'system',
      sampleSize: 200,
      hasSeenOnboarding: false,
      heatmapColors: { low: '#ef4444', medium: '#eab308', high: '#22c55e' },
      refreshInterval: 30,
      connectionHealth: null,
      queryHistory: [],

      setEndpoint: (url) => set({ endpoint: url }),
      setHeaders: (headers) => set({ headers }),
      addSavedEndpoint: (endpoint) =>
        set((state) => ({
          savedEndpoints: [
            ...state.savedEndpoints.filter((e) => e.url !== endpoint.url),
            { ...endpoint, lastUsed: Date.now() },
          ],
        })),
      removeSavedEndpoint: (url) =>
        set((state) => ({
          savedEndpoints: state.savedEndpoints.filter((e) => e.url !== url),
        })),
      setSchema: (schema) => set({ schema, status: 'connected', error: null }),
      setFullSchema: (fullSchema) => set({ fullSchema }),
      setSchemaStats: (schemaStats) => set({ schemaStats }),
      setSelectedTypes: (selectedTypes) => set({ selectedTypes }),
      setDensityData: (densityData) => set({ densityData }),
      setSampleData: (sampleData) => set({ sampleData }),
      setStatus: (status) => set({ status }),
      setError: (error) => set({ error, status: 'error' }),
      setTheme: (theme) => set({ theme }),
      setSampleSize: (sampleSize) => set({ sampleSize }),
      setHasSeenOnboarding: (hasSeenOnboarding) => set({ hasSeenOnboarding }),
      setHeatmapColors: (heatmapColors) => set({ heatmapColors }),
      setRefreshInterval: (refreshInterval) => set({ refreshInterval }),
      setConnectionHealth: (connectionHealth) => set({ connectionHealth }),
      addQueryHistory: (item) =>
        set((state) => ({
          queryHistory: [item, ...state.queryHistory].slice(0, 20),
        })),
      clearQueryHistory: () => set({ queryHistory: [] }),
      reset: () =>
        set({
          schema: [],
          fullSchema: emptyFullSchema,
          schemaStats: null,
          selectedTypes: [],
          densityData: {},
          sampleData: {},
          status: 'idle',
          error: null,
          connectionHealth: null,
        }),
    }),
    {
      name: 'data-density-storage',
      partialize: (state) => ({
        savedEndpoints: state.savedEndpoints,
        theme: state.theme,
        endpoint: state.endpoint,
        headers: state.headers,
        sampleSize: state.sampleSize,
        hasSeenOnboarding: state.hasSeenOnboarding,
        heatmapColors: state.heatmapColors,
        refreshInterval: state.refreshInterval,
        queryHistory: state.queryHistory.slice(0, 10),
      }),
    }
  )
);
