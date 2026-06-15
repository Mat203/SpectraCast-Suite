import { create } from 'zustand';
import { createJSONStorage, persist } from 'zustand/middleware';
import type { OutlierStrategyKey } from '../lib/outlierStrategies';
import type { MissingStrategyKey } from '../lib/missingValueStrategies';
import { apiFetch } from '../lib/api';

export type VisualStandardizerTab = 'plot_generator' | 'code_standardizer' | 'style_creator';

interface ActiveDatasetState {
  file: File | null;
  fileId: string | null;
  originalFilename: string | null;
  columns: string[];
}

interface DataQualityState {
  selectedOutlierCol: string | null;
  outlierStrategy: OutlierStrategyKey;
  strategyPreview: OutlierStrategyKey;
  isStrategyPanelVisible: boolean;
  selectedMissingCol: string | null;
  missingStrategy: MissingStrategyKey;
  missingStrategyPreview: MissingStrategyKey;
  isMissingPanelVisible: boolean;
}

interface SharedUiState {
  isDragging: boolean;
  isLoading: boolean;
  error: string | null;
  recentDatasets: unknown[];
  isLoadingRecent: boolean;
  recentError: string | null;
}

interface DataQualityUiState extends SharedUiState {
  report: unknown | null;
  toastMessage: string | null;
  isFixingTimestamps: boolean;
  isUndoing: boolean;
  isSaving: boolean;
  isOutlierModalOpen: boolean;
  isProcessingAction: boolean;
  previewData: unknown | null;
  isPreviewLoading: boolean;
  previewError: string | null;
  isMissingModalOpen: boolean;
  missingPreviewData: unknown | null;
  isMissingPreviewLoading: boolean;
  missingPreviewError: string | null;
}

interface LeadingIndicatorsState {
  targetColumn: string;
  region: string;
  geoCode: string;
  extraContext: string;
}

interface LeadingIndicatorsUiState extends SharedUiState {
  result: unknown | null;
}

type LeadingIndicatorsToastMode = 'progress' | 'done' | 'error';

interface LeadingIndicatorsStreamState {
  requestId: number;
  requestPayload: Record<string, unknown> | null;
  requestHeaders: Record<string, string> | null;
  isProcessing: boolean;
  currentStage: string;
  error: string | null;
  result: unknown | null;
  toastVisible: boolean;
  toastMode: LeadingIndicatorsToastMode;
  toastDismissed: boolean;
}

interface VisualStandardizerYAxis {
  column: string;
  axis: 'primary' | 'secondary';
}

interface VisualStandardizerState {
  activeTab: VisualStandardizerTab;
  xAxis: string;
  yAxes: VisualStandardizerYAxis[];
  plotType: string;
  selectedStyle: string;
  outputFilename: string;
  codeStyle: string;
  rawCode: string;
  title: string;
  xLabel: string;
  yLabel: string;
  y2Label: string;
}

interface VisualStandardizerUiState extends SharedUiState {
  styles: string[];
  plotResult: unknown | null;
  cleanedCode: string;
  chartCode: string;
}

export interface AppStoreState {
  activeDataset: ActiveDatasetState;
  dataQuality: DataQualityState;
  dataQualityUi: DataQualityUiState;
  leadingIndicators: LeadingIndicatorsState;
  leadingIndicatorsUi: LeadingIndicatorsUiState;
  leadingIndicatorsStream: LeadingIndicatorsStreamState;
  visualStandardizer: VisualStandardizerState;
  visualStandardizerUi: VisualStandardizerUiState;
  setActiveDataset: (updates: Partial<ActiveDatasetState>) => void;
  setDatasetColumns: (columns: string[]) => void;
  resetActiveDataset: () => void;
  setDataQuality: (updates: Partial<DataQualityState>) => void;
  setDataQualityUi: (updates: Partial<DataQualityUiState>) => void;
  setLeadingIndicators: (updates: Partial<LeadingIndicatorsState>) => void;
  setLeadingIndicatorsUi: (updates: Partial<LeadingIndicatorsUiState>) => void;
  setLeadingIndicatorsStream: (updates: Partial<LeadingIndicatorsStreamState>) => void;
  triggerLeadingIndicatorsStream: (
    payload: Record<string, unknown>,
    headers?: Record<string, string>,
  ) => void;
  dismissLeadingIndicatorsToast: () => void;
  setVisualStandardizer: (updates: Partial<VisualStandardizerState>) => void;
  setVisualStandardizerUi: (updates: Partial<VisualStandardizerUiState>) => void;
  resetAppState: () => void;
  loadRecentDatasets: () => Promise<void>;
}

const initialState = {
  activeDataset: {
    file: null,
    fileId: null,
    originalFilename: null,
    columns: [] as string[],
  },
  dataQuality: {
    selectedOutlierCol: null,
    outlierStrategy: 'clip_iqr',
    strategyPreview: 'clip_iqr',
    isStrategyPanelVisible: false,
    selectedMissingCol: null,
    missingStrategy: '3',
    missingStrategyPreview: '3',
    isMissingPanelVisible: false,
  },
  dataQualityUi: {
    isDragging: false,
    isLoading: false,
    error: null,
    report: null,
    toastMessage: null,
    isFixingTimestamps: false,
    isUndoing: false,
    isSaving: false,
    isOutlierModalOpen: false,
    isProcessingAction: false,
    previewData: null,
    isPreviewLoading: false,
    previewError: null,
    isMissingModalOpen: false,
    missingPreviewData: null,
    isMissingPreviewLoading: false,
    missingPreviewError: null,
    recentDatasets: [] as unknown[],
    isLoadingRecent: false,
    recentError: null,
  },
  leadingIndicators: {
    targetColumn: '',
    region: '',
    geoCode: 'UA',
    extraContext: '',
  },
  leadingIndicatorsUi: {
    isDragging: false,
    isLoading: false,
    error: null,
    result: null,
    recentDatasets: [] as unknown[],
    isLoadingRecent: false,
    recentError: null,
  },
  leadingIndicatorsStream: {
    requestId: 0,
    requestPayload: null,
    requestHeaders: null,
    isProcessing: false,
    currentStage: '',
    error: null,
    result: null,
    toastVisible: false,
    toastMode: 'progress',
    toastDismissed: false,
  },
  visualStandardizer: {
    activeTab: 'plot_generator',
    xAxis: '',
    yAxes: [] as VisualStandardizerYAxis[],
    plotType: 'line',
    selectedStyle: '',
    outputFilename: 'plot.png',
    codeStyle: '',
    rawCode: '',
    title: '',
    xLabel: '',
    yLabel: '',
    y2Label: '',
  },
  visualStandardizerUi: {
    isDragging: false,
    isLoading: false,
    error: null,
    styles: [] as string[],
    plotResult: null,
    recentDatasets: [] as unknown[],
    isLoadingRecent: false,
    recentError: null,
    cleanedCode: '',
    chartCode: '',
  },
} as const;

export const useAppStore = create<AppStoreState>()(
  persist(
    (set) => ({
      ...initialState,
      setActiveDataset: (updates) =>
        set((state) => ({
          activeDataset: {
            ...state.activeDataset,
            ...updates,
          },
        })),
      setDatasetColumns: (columns) =>
        set((state) => ({
          activeDataset: {
            ...state.activeDataset,
            columns,
          },
        })),
      resetActiveDataset: () =>
        set({
          activeDataset: {
            file: null,
            fileId: null,
            originalFilename: null,
            columns: [] as string[],
          },
        }),
      setDataQuality: (updates) =>
        set((state) => ({
          dataQuality: {
            ...state.dataQuality,
            ...updates,
          },
        })),
      setDataQualityUi: (updates) =>
        set((state) => ({
          dataQualityUi: {
            ...state.dataQualityUi,
            ...updates,
          },
        })),
      setLeadingIndicators: (updates) =>
        set((state) => ({
          leadingIndicators: {
            ...state.leadingIndicators,
            ...updates,
          },
        })),
      setLeadingIndicatorsUi: (updates) =>
        set((state) => ({
          leadingIndicatorsUi: {
            ...state.leadingIndicatorsUi,
            ...updates,
          },
        })),
      setLeadingIndicatorsStream: (updates) =>
        set((state) => ({
          leadingIndicatorsStream: {
            ...state.leadingIndicatorsStream,
            ...updates,
          },
        })),
      triggerLeadingIndicatorsStream: (payload, headers) =>
        set((state) => ({
          leadingIndicatorsStream: {
            ...state.leadingIndicatorsStream,
            requestId: state.leadingIndicatorsStream.requestId + 1,
            requestPayload: payload,
            requestHeaders: headers || null,
            isProcessing: true,
            currentStage: '',
            error: null,
            result: null,
            toastVisible: true,
            toastMode: 'progress',
            toastDismissed: false,
          },
        })),
      dismissLeadingIndicatorsToast: () =>
        set((state) => ({
          leadingIndicatorsStream: {
            ...state.leadingIndicatorsStream,
            toastVisible: false,
            toastDismissed: true,
          },
        })),
      setVisualStandardizer: (updates) =>
        set((state) => ({
          visualStandardizer: {
            ...state.visualStandardizer,
            ...updates,
          },
        })),
      setVisualStandardizerUi: (updates) =>
        set((state) => ({
          visualStandardizerUi: {
            ...state.visualStandardizerUi,
            ...updates,
          },
        })),
      resetAppState: () =>
        set({
          ...initialState,
        }),
      loadRecentDatasets: async () => {
        set((state) => ({
          dataQualityUi: { ...state.dataQualityUi, isLoadingRecent: true, recentError: null },
          leadingIndicatorsUi: { ...state.leadingIndicatorsUi, isLoadingRecent: true, recentError: null },
          visualStandardizerUi: { ...state.visualStandardizerUi, isLoadingRecent: true, recentError: null },
        }));

        try {
          const response = await apiFetch('/api/users/me');
          if (!response.ok) {
            throw new Error('Failed to load recent datasets');
          }
          const data = (await response.json()) as { datasets?: any[] };
          const recent = (data.datasets || []).slice(0, 10);

          set((state) => ({
            dataQualityUi: { ...state.dataQualityUi, recentDatasets: recent, isLoadingRecent: false },
            leadingIndicatorsUi: { ...state.leadingIndicatorsUi, recentDatasets: recent, isLoadingRecent: false },
            visualStandardizerUi: { ...state.visualStandardizerUi, recentDatasets: recent, isLoadingRecent: false },
          }));
        } catch (err) {
          const errMsgSimple = err instanceof Error ? err.message : 'Failed to load recent datasets';
          set((state) => ({
            dataQualityUi: { ...state.dataQualityUi, recentError: errMsgSimple, isLoadingRecent: false },
            leadingIndicatorsUi: { ...state.leadingIndicatorsUi, recentError: errMsgSimple, isLoadingRecent: false },
            visualStandardizerUi: { ...state.visualStandardizerUi, recentError: errMsgSimple, isLoadingRecent: false },
          }));
        }
      },
    }),
    {
      name: 'spectracast_app_state',
      storage: createJSONStorage(() => localStorage),
      partialize: (state) => ({
        // Active dataset metadata (file object excluded — not serializable)
        activeDataset: { ...state.activeDataset, file: null },
        // User strategy/column preferences only — NOT error/loading/preview state
        dataQuality: state.dataQuality,
        // Leading indicators form choices
        leadingIndicators: state.leadingIndicators,
        // Visual standardizer user choices (axis, style, labels, etc.)
        visualStandardizer: state.visualStandardizer,
      }),
    },
  ),
);
