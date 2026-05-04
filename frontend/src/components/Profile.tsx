import React, { useEffect, useState } from 'react';
import { apiFetch, downloadFile } from '../lib/api';

interface ProfileResponse {
  email: string;
  datasets: string[];
}

export const Profile: React.FC = () => {
  const [profile, setProfile] = useState<ProfileResponse | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [downloadingId, setDownloadingId] = useState<string | null>(null);

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
