import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { apiFetch } from '../lib/api'
import { useUser } from '../lib/userContext'

const highlights = [
  {
    title: 'Data Quality Module',
    description: 'Detect missing values, outliers, and timestamp gaps, then apply imputation and outlier strategies with preview and one-step undo.',
  },
  {
    title: 'Leading Indicators Module',
    description: 'Run lag and correlation analysis to identify which signals lead your target metric across configurable time windows.',
  },
  {
    title: 'Visual Standardizer Module',
    description: 'Generate production-ready visualizations with consistent styling profiles for clear, comparable reporting outputs.',
  },
]

export const WelcomeView = () => {
  const navigate = useNavigate()
  const { setUser, user } = useUser()
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const handleGetStarted = async () => {
    if (isSubmitting) {
      return
    }

    setIsSubmitting(true)
    setError(null)

    try {
      const response = await apiFetch('/api/users/me/onboard', {
        method: 'PATCH',
      })

      if (!response.ok) {
        let message = `Failed to complete onboarding (HTTP ${response.status})`
        try {
          const data = (await response.json()) as { detail?: string; message?: string }
          message = data.detail || data.message || message
        } catch {
          message = `Failed to complete onboarding (HTTP ${response.status})`
        }
        throw new Error(message)
      }

      setUser((prev) => ({
        email: prev?.email ?? user?.email ?? '',
        is_onboarded: true,
      }))
      navigate('/app', { replace: true })
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Onboarding failed. Please try again.')
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <div className="relative min-h-screen overflow-hidden bg-gradient-to-br from-slate-100 via-white to-cyan-50 px-4 py-10 md:px-10">
      <div className="pointer-events-none absolute -top-24 right-12 h-72 w-72 rounded-full bg-cyan-200/40 blur-3xl" />
      <div className="pointer-events-none absolute bottom-0 left-0 h-80 w-80 rounded-full bg-slate-300/35 blur-3xl" />

      <div className="relative mx-auto flex min-h-[calc(100vh-5rem)] w-full max-w-6xl items-center">
        <section className="grid w-full gap-6 rounded-3xl border border-slate-200 bg-white/90 p-7 shadow-2xl backdrop-blur lg:grid-cols-[1.1fr_0.9fr] lg:p-10">
          <div className="space-y-6">
            <p className="text-xs font-semibold uppercase tracking-[0.35em] text-slate-500">SpectraCast Suite</p>
            <h1 className="text-4xl font-semibold leading-tight text-slate-900 md:text-5xl" style={{ fontFamily: '"Fraunces", serif' }}>
              Welcome to SpectraCast Suite
            </h1>
            <p className="max-w-2xl text-base leading-relaxed text-slate-600 md:text-lg">
              Your intelligent workspace for data quality, analytics, and interactive strategy visualization.
            </p>

            {error && (
              <div className="rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">
                {error}
              </div>
            )}

            <button
              type="button"
              onClick={handleGetStarted}
              disabled={isSubmitting}
              className="inline-flex items-center justify-center rounded-xl bg-slate-900 px-6 py-3 text-sm font-semibold text-white transition hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-70"
            >
              {isSubmitting ? (
                <>
                  <svg className="mr-2 h-4 w-4 animate-spin" viewBox="0 0 24 24" fill="none" aria-hidden="true">
                    <circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="3" className="opacity-25" />
                    <path d="M4 12a8 8 0 018-8" stroke="currentColor" strokeWidth="3" className="opacity-90" />
                  </svg>
                  Getting ready...
                </>
              ) : (
                'Get Started'
              )}
            </button>

            <p className="text-xs text-slate-600">
              By clicking Get Started, you agree to our <a href="#privacy-policy" className="text-blue-600 hover:text-blue-700 hover:underline font-medium">Privacy Policy</a> and <a href="#terms-of-service" className="text-blue-600 hover:text-blue-700 hover:underline font-medium">Terms of Service</a>.
            </p>
          </div>

          <div className="grid gap-3">
            {highlights.map((item) => (
              <article key={item.title} className="rounded-2xl border border-slate-200 bg-slate-50 p-5">
                <h2 className="text-sm font-semibold uppercase tracking-[0.18em] text-slate-700">{item.title}</h2>
                <p className="mt-2 text-sm leading-relaxed text-slate-600">{item.description}</p>
              </article>
            ))}
          </div>
        </section>
      </div>
    </div>
  )
}
