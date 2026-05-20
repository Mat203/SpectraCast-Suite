import { create } from 'zustand';
import { createJSONStorage, persist } from 'zustand/middleware';
import type { OutlierStrategyKey } from '../lib/outlierStrategies';
import type { MissingStrategyKey } from '../lib/missingValueStrategies';

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

interface DataQualityUiState {
  isDragging: boolean;
  isLoading: boolean;
  error: string | null;
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
  recentDatasets: unknown[];
  isLoadingRecent: boolean;
  recentError: string | null;
}

interface LeadingIndicatorsState {
  targetColumn: string;
  region: string;
  geoCode: string;
  extraContext: string;
}

interface LeadingIndicatorsUiState {
  isDragging: boolean;
  isLoading: boolean;
  error: string | null;
  result: unknown | null;
  recentDatasets: unknown[];
  isLoadingRecent: boolean;
  recentError: string | null;
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

interface VisualStandardizerState {
  activeTab: VisualStandardizerTab;
  xAxis: string;
  yAxes: string[];
  plotType: string;
  selectedStyle: string;
  outputFilename: string;
  codeStyle: string;
  rawCode: string;
}

interface VisualStandardizerUiState {
  isDragging: boolean;
  isLoading: boolean;
  error: string | null;
  styles: string[];
  plotResult: unknown | null;
  recentDatasets: unknown[];
  isLoadingRecent: boolean;
  recentError: string | null;
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
}

const initialState = {
  activeDataset: {
    file: null,
    fileId: null,
    originalFilename: null,
    columns: [],
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
    recentDatasets: [],
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
    recentDatasets: [],
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
    yAxes: [],
    plotType: 'line',
    selectedStyle: '',
    outputFilename: 'plot.png',
    codeStyle: '',
    rawCode: '',
  },
  visualStandardizerUi: {
    isDragging: false,
    isLoading: false,
    error: null,
    styles: [],
    plotResult: null,
    recentDatasets: [],
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
            columns: [],
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
    }),
    {
      name: 'spectracast_app_state',
      storage: createJSONStorage(() => localStorage),
      partialize: (state) => ({
        activeDataset: { ...state.activeDataset, file: null },
        dataQuality: state.dataQuality,
        dataQualityUi: state.dataQualityUi,
        leadingIndicators: state.leadingIndicators,
        leadingIndicatorsUi: state.leadingIndicatorsUi,
        visualStandardizer: state.visualStandardizer,
        visualStandardizerUi: state.visualStandardizerUi,
      }),
    },
  ),
);
