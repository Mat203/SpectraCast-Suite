import React, { useEffect, useState } from 'react';
import { apiFetch, downloadFile } from '../lib/api';
import { LLM_MODELS, LLM_PROVIDERS } from '../lib/llmModels';
import type { LlmProvider } from '../lib/llmModels';

interface ProfileResponse {
  email: string;
  datasets: string[];
}

export const Profile: React.FC = () => {
  const [profile, setProfile] = useState<ProfileResponse | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [downloadingId, setDownloadingId] = useState<string | null>(null);
  const [isLlmEnabled, setIsLlmEnabled] = useState(false);
  const [llmProvider, setLlmProvider] = useState<LlmProvider>('openai');
  const [llmModel, setLlmModel] = useState<string>(LLM_MODELS.openai[0]);
  const [llmCustomModel, setLlmCustomModel] = useState<string>('');
  const [llmApiKey, setLlmApiKey] = useState<string>('');
  const [llmError, setLlmError] = useState<string | null>(null);
  const [llmSuccess, setLlmSuccess] = useState<string | null>(null);
  const [isValidatingKey, setIsValidatingKey] = useState(false);
  const [isLlmInitialized, setIsLlmInitialized] = useState(false);

  useEffect(() => {
    let isActive = true;

    const loadProfile = async () => {
      setIsLoading(true);
      setError(null);

      try {
        const response = await apiFetch('/api/users/me');
        if (!response.ok) {
          let message = `Failed to load profile (HTTP ${response.status})`;
          try {
            const data = await response.json();
            message = data?.detail || data?.message || message;
          } catch {
            message = `Failed to load profile (HTTP ${response.status})`;
          }
          throw new Error(message);
        }

        const data = (await response.json()) as ProfileResponse;
        if (isActive) {
          setProfile(data);
        }
      } catch (err) {
        if (isActive) {
          setError(err instanceof Error ? err.message : 'Failed to load profile.');
        }
      } finally {
        if (isActive) {
          setIsLoading(false);
        }
      }
    };

    loadProfile();

    return () => {
      isActive = false;
    };
  }, []);

  useEffect(() => {
    const storedKey = localStorage.getItem('user_llm_api_key');
    const storedEnabled = localStorage.getItem('user_llm_byok_enabled');
    const storedProvider = localStorage.getItem('user_llm_provider') as LlmProvider | null;
    const storedModel = localStorage.getItem('user_llm_model');
    const storedCustomModel = localStorage.getItem('user_llm_custom_model');

    if (storedKey) setLlmApiKey(storedKey);
    if (storedEnabled) setIsLlmEnabled(storedEnabled === 'true');
    if (storedProvider && LLM_MODELS[storedProvider]) setLlmProvider(storedProvider);
    if (storedModel) setLlmModel(storedModel);
    if (storedCustomModel) setLlmCustomModel(storedCustomModel);

    setIsLlmInitialized(true);
  }, []);

  useEffect(() => {
    const models = LLM_MODELS[llmProvider];
    if (!models.includes(llmModel)) {
      setLlmModel(models[0]);
    }
  }, [llmProvider, llmModel]);

  useEffect(() => {
    if (!isLlmInitialized) return;
    localStorage.setItem('user_llm_byok_enabled', String(isLlmEnabled));
  }, [isLlmEnabled, isLlmInitialized]);

  useEffect(() => {
    if (!isLlmInitialized) return;
    localStorage.setItem('user_llm_provider', llmProvider);
  }, [llmProvider, isLlmInitialized]);

  useEffect(() => {
    if (!isLlmInitialized) return;
    localStorage.setItem('user_llm_model', llmModel);
  }, [llmModel, isLlmInitialized]);

  useEffect(() => {
    if (!isLlmInitialized) return;
    localStorage.setItem('user_llm_custom_model', llmCustomModel);
  }, [llmCustomModel, isLlmInitialized]);

  const extractApiError = async (response: Response, fallbackPrefix: string) => {
    try {
      const data = (await response.json()) as {
        detail?: string;
        message?: string;
        error?: { message?: string };
      };
      const detail = data.detail || data.error?.message || data.message;
      return detail ? `${fallbackPrefix}: ${detail}` : `${fallbackPrefix} (HTTP ${response.status})`;
    } catch {
      return `${fallbackPrefix} (HTTP ${response.status})`;
    }
  };

  const handleDownload = async (fileId: string) => {
    setError(null);
    setDownloadingId(fileId);

    try {
      await downloadFile(`/api/dq/download/${fileId}`, `dataset_${fileId}.csv`);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Download failed.');
    } finally {
      setDownloadingId(null);
    }
  };

  const handleValidateLlmKey = async () => {
    setLlmError(null);
    setLlmSuccess(null);

    if (!isLlmEnabled) {
      setLlmError('Enable BYOK to activate LLM requests.');
      return;
    }

    const trimmedKey = llmApiKey.trim();
    if (!trimmedKey) {
      setLlmError('API key is required to validate.');
      return;
    }

    const resolvedModel = llmModel === 'other' ? llmCustomModel.trim() : llmModel;
    if (!resolvedModel) {
      setLlmError('Provide a model name to validate.');
      return;
    }

    setIsValidatingKey(true);

    try {
      const response = await apiFetch('/api/llm/proxy', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-llm-api-key': trimmedKey,
        },
        body: JSON.stringify({
          provider: llmProvider,
          model: resolvedModel,
          prompt: 'Validate API key for SpectraCast Suite.',
          max_tokens: 1,
        }),
      });

      if (!response.ok) {
        throw new Error(await extractApiError(response, 'Validation failed'));
      }

      localStorage.setItem('user_llm_api_key', trimmedKey);
      setLlmSuccess('API key validated and saved locally.');
    } catch (err) {
      setLlmError(err instanceof Error ? err.message : 'Validation failed.');
    } finally {
      setIsValidatingKey(false);
    }
  };

  return (
    <div className="flex-1 h-full bg-slate-100 p-4 md:p-8 overflow-auto">
      <div className="mx-auto w-full max-w-4xl space-y-6">
        <header>
          <h2 className="text-3xl md:text-4xl font-bold tracking-tight text-slate-900">User Profile</h2>
          <p className="mt-2 text-slate-600">View your account details and uploaded datasets.</p>
        </header>

        <section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
          <h3 className="text-lg font-semibold text-slate-800">Account</h3>
          {isLoading && (
            <p className="mt-3 text-sm text-slate-500">Loading profile...</p>
          )}
          {error && (
            <p className="mt-3 rounded-md border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-700">
              {error}
            </p>
          )}
          {!isLoading && !error && profile && (
            <div className="mt-4 rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-700">
              <span className="text-xs uppercase tracking-wide text-slate-500">Email</span>
              <p className="mt-1 text-base font-semibold text-slate-900">{profile.email}</p>
            </div>
          )}
        </section>

        <section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
          <h3 className="text-lg font-semibold text-slate-800">LLM API Settings</h3>
          <p className="mt-2 text-sm text-slate-500">
            Bring your own key to unlock model-powered features. Keys are stored only in this browser.
          </p>

          <label className="mt-4 flex items-center gap-3 text-sm font-medium text-slate-700">
            <input
              type="checkbox"
              checked={isLlmEnabled}
              onChange={(event) => {
                setIsLlmEnabled(event.target.checked);
                setLlmError(null);
                setLlmSuccess(null);
              }}
              className="h-4 w-4 rounded border-slate-300 text-slate-900 focus:ring-2 focus:ring-sky-200"
            />
            Enable BYOK for LLM requests
          </label>

          <div className="mt-4 grid grid-cols-1 gap-4 md:grid-cols-2">
            <label className="flex flex-col gap-2 text-sm font-medium text-slate-700">
              Provider
              <select
                value={llmProvider}
                onChange={(event) => setLlmProvider(event.target.value as LlmProvider)}
                disabled={!isLlmEnabled}
                className="rounded-lg border border-slate-300 bg-white px-3 py-2.5 text-slate-900 shadow-sm outline-none transition focus:border-sky-500 focus:ring-2 focus:ring-sky-200"
              >
                {LLM_PROVIDERS.map((provider) => (
                  <option key={provider.id} value={provider.id}>
                    {provider.label}
                  </option>
                ))}
              </select>
            </label>

            <label className="flex flex-col gap-2 text-sm font-medium text-slate-700">
              Model
              <select
                value={llmModel}
                onChange={(event) => setLlmModel(event.target.value)}
                disabled={!isLlmEnabled}
                className="rounded-lg border border-slate-300 bg-white px-3 py-2.5 text-slate-900 shadow-sm outline-none transition focus:border-sky-500 focus:ring-2 focus:ring-sky-200"
              >
                {LLM_MODELS[llmProvider].map((model) => (
                  <option key={model} value={model}>
                    {model}
                  </option>
                ))}
              </select>
            </label>
          </div>

          {llmModel === 'other' && (
            <label className="mt-4 flex flex-col gap-2 text-sm font-medium text-slate-700">
              Custom Model Name
              <input
                type="text"
                value={llmCustomModel}
                onChange={(event) => setLlmCustomModel(event.target.value)}
                disabled={!isLlmEnabled}
                placeholder="Enter your model name"
                className="rounded-lg border border-slate-300 bg-white px-3 py-2.5 text-slate-900 shadow-sm outline-none transition focus:border-sky-500 focus:ring-2 focus:ring-sky-200"
              />
            </label>
          )}

          <label className="mt-4 flex flex-col gap-2 text-sm font-medium text-slate-700">
            API Key
            <input
              type="password"
              value={llmApiKey}
              onChange={(event) => setLlmApiKey(event.target.value)}
              disabled={!isLlmEnabled}
              placeholder="Enter your API key"
              className="rounded-lg border border-slate-300 bg-white px-3 py-2.5 text-slate-900 shadow-sm outline-none transition focus:border-sky-500 focus:ring-2 focus:ring-sky-200"
            />
          </label>

          <div className="mt-4 flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
            <button
              type="button"
              onClick={handleValidateLlmKey}
              disabled={isValidatingKey || !isLlmEnabled}
              className="inline-flex items-center justify-center rounded-md border border-slate-300 bg-slate-900 px-4 py-2 text-sm font-semibold text-white transition hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-60"
            >
              {isValidatingKey ? 'Validating...' : 'Save & Validate'}
            </button>
            <span className="text-xs text-slate-500">
              {isLlmEnabled ? 'Stored locally in this browser only.' : 'Enable BYOK to activate validation.'}
            </span>
          </div>

          {llmError && (
            <p className="mt-3 rounded-md border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-700">
              {llmError}
            </p>
          )}
          {llmSuccess && (
            <p className="mt-3 rounded-md border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm text-emerald-700">
              {llmSuccess}
            </p>
          )}
        </section>

        <section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
          <div className="flex items-center justify-between">
            <h3 className="text-lg font-semibold text-slate-800">Uploaded Datasets</h3>
            <span className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-400">
              {profile?.datasets?.length ?? 0} total
            </span>
          </div>

          {!isLoading && !error && profile && profile.datasets.length === 0 && (
            <p className="mt-4 rounded-lg border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-600">
              No files uploaded yet.
            </p>
          )}

          {!isLoading && !error && profile && profile.datasets.length > 0 && (
            <ul className="mt-4 space-y-2">
              {profile.datasets.map((fileId) => (
                <li
                  key={fileId}
                  className="flex items-center justify-between rounded-lg border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-700"
                >
                  <span className="font-mono text-xs text-slate-600">{fileId}</span>
                  <button
                    type="button"
                    onClick={() => handleDownload(fileId)}
                    disabled={downloadingId === fileId}
                    className="rounded-md border border-slate-300 bg-white px-3 py-1.5 text-xs font-semibold text-slate-700 transition hover:bg-slate-100 disabled:cursor-not-allowed disabled:opacity-60"
                  >
                    {downloadingId === fileId ? 'Downloading...' : 'Download'}
                  </button>
                </li>
              ))}
            </ul>
          )}
        </section>
      </div>
    </div>
  );
};
