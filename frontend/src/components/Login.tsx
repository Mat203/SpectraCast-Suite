import React, { useEffect, useState } from 'react';
import { GoogleLogin, type CredentialResponse } from '@react-oauth/google';
import { Link, useNavigate } from 'react-router-dom';
import { apiFetch } from '../lib/api';
import { isAuthenticated, setToken } from '../lib/auth';

interface TokenResponse {
  access_token: string;
  token_type: string;
}

export const Login: React.FC = () => {
  const navigate = useNavigate();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    if (isAuthenticated()) {
      navigate('/app', { replace: true });
    }
  }, [navigate]);

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setError(null);
    setIsSubmitting(true);

    try {
      const response = await apiFetch('/api/auth/login', {
        method: 'POST',
        auth: false,
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          email: email.trim(),
          password,
        }),
      });

      if (!response.ok) {
        let message = `Login failed (HTTP ${response.status})`;
        try {
          const data = await response.json();
          message = data?.detail || data?.message || message;
        } catch {
          message = `Login failed (HTTP ${response.status})`;
        }
        throw new Error(message);
      }

      const data = (await response.json()) as TokenResponse;
      if (!data.access_token) {
        throw new Error('Login succeeded but no token was returned.');
      }

      setToken(data.access_token);
      navigate('/app', { replace: true });
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Login failed. Please try again.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleGoogleSuccess = async (credentialResponse: CredentialResponse) => {
    if (!credentialResponse.credential) {
      setError('Google sign-in failed. Please try again.');
      return;
    }

    setError(null);
    setIsSubmitting(true);

    try {
      const response = await apiFetch('/api/auth/google', {
        method: 'POST',
        auth: false,
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ token: credentialResponse.credential }),
      });

      if (!response.ok) {
        let message = `Google login failed (HTTP ${response.status})`;
        try {
          const data = await response.json();
          message = data?.detail || data?.message || message;
        } catch {
          message = `Google login failed (HTTP ${response.status})`;
        }
        throw new Error(message);
      }

      const data = (await response.json()) as TokenResponse;
      if (!data.access_token) {
        throw new Error('Google login succeeded but no token was returned.');
      }

      setToken(data.access_token);
      navigate('/app', { replace: true });
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Google login failed. Please try again.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="relative min-h-screen overflow-hidden bg-gradient-to-br from-amber-50 via-sky-50 to-slate-50 px-4 py-10">
      <div className="pointer-events-none absolute -top-32 right-10 h-72 w-72 rounded-full bg-amber-200/70 blur-3xl" />
      <div className="pointer-events-none absolute bottom-0 left-0 h-64 w-64 rounded-full bg-sky-200/70 blur-3xl" />

      <div className="relative z-10 mx-auto flex w-full max-w-4xl flex-col gap-8">
        <header className="text-center">
          <p className="text-xs font-semibold uppercase tracking-[0.3em] text-slate-500">SpectraCast Suite</p>
          <h1
            className="mt-4 text-4xl font-semibold text-slate-900"
            style={{ fontFamily: '"Fraunces", serif' }}
          >
            Welcome back to your data studio
          </h1>
          <p className="mt-3 text-slate-600">
            Sign in to continue analyzing quality, trends, and visual standards in one workspace.
          </p>
        </header>

        <div className="mx-auto w-full max-w-md rounded-3xl border border-white/60 bg-white/80 p-8 shadow-xl backdrop-blur">
          <form onSubmit={handleSubmit} className="space-y-5">
            <label className="block text-sm font-semibold text-slate-700">
              Email
              <input
                type="email"
                required
                value={email}
                onChange={(event) => setEmail(event.target.value)}
                className="mt-2 w-full rounded-xl border border-slate-200 bg-white px-4 py-3 text-slate-900 shadow-sm outline-none transition focus:border-sky-500 focus:ring-2 focus:ring-sky-200"
                placeholder="you@company.com"
              />
            </label>

            <label className="block text-sm font-semibold text-slate-700">
              Password
              <input
                type="password"
                required
                value={password}
                onChange={(event) => setPassword(event.target.value)}
                className="mt-2 w-full rounded-xl border border-slate-200 bg-white px-4 py-3 text-slate-900 shadow-sm outline-none transition focus:border-sky-500 focus:ring-2 focus:ring-sky-200"
                placeholder="••••••••"
              />
            </label>

            {error && (
              <div className="rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">
                {error}
              </div>
            )}

            <button
              type="submit"
              disabled={isSubmitting}
              className="w-full rounded-xl bg-slate-900 px-4 py-3 text-sm font-semibold text-white shadow-sm transition hover:bg-slate-800 disabled:cursor-not-allowed disabled:bg-slate-400"
            >
              {isSubmitting ? 'Signing in...' : 'Sign in'}
            </button>
          </form>

          <div className="my-6 flex items-center gap-3 text-xs font-semibold uppercase tracking-[0.3em] text-slate-400">
            <span className="h-px flex-1 bg-slate-200" />
            Or
            <span className="h-px flex-1 bg-slate-200" />
          </div>

          <div className="flex justify-center">
            <GoogleLogin
              onSuccess={handleGoogleSuccess}
              onError={() => setError('Google sign-in failed. Please try again.')}
              width="360"
              theme="outline"
              size="large"
              shape="pill"
              text="continue_with"
              disabled={isSubmitting}
            />
          </div>

          <p className="mt-6 text-center text-sm text-slate-600">
            New here?{' '}
            <Link className="font-semibold text-slate-900 hover:underline" to="/register">
              Create an account
            </Link>
          </p>
        </div>
      </div>
    </div>
  );
};
