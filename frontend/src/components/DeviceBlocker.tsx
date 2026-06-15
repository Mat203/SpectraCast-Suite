import React, { useEffect, useState } from 'react'

interface DeviceBlockerProps {
  children: React.ReactNode
}

export const DeviceBlocker: React.FC<DeviceBlockerProps> = ({ children }) => {
  const [isSmartphone, setIsSmartphone] = useState(false)

  useEffect(() => {
    const checkDevice = () => {
      const isSmallScreen = window.innerWidth < 500 || window.innerHeight < 400

      setIsSmartphone(isSmartphone || isSmallScreen)
    }

    checkDevice()
    window.addEventListener('resize', checkDevice)
    return () => window.removeEventListener('resize', checkDevice)
  }, [])

  if (isSmartphone) {
    return (
      <div className="relative flex min-h-screen items-center justify-center overflow-hidden bg-gradient-to-br from-slate-900 via-slate-950 to-cyan-950 px-6 py-12 text-white font-sans selection:bg-cyan-500/30">
        <div className="pointer-events-none absolute -top-40 right-10 h-96 w-96 rounded-full bg-cyan-500/10 blur-3xl" />
        <div className="pointer-events-none absolute -bottom-40 -left-10 h-96 w-96 rounded-full bg-slate-500/10 blur-3xl" />

        <div className="pointer-events-none absolute inset-0 bg-[linear-gradient(to_right,#0f172a_1px,transparent_1px),linear-gradient(to_bottom,#0f172a_1px,transparent_1px)] bg-[size:4rem_4rem] [mask-image:radial-gradient(ellipse_60%_50%_at_50%_50%,#000_70%,transparent_100%)] opacity-30" />

        <div className="relative w-full max-w-md text-center">
          <div className="mx-auto mb-8 flex h-24 w-24 items-center justify-center rounded-3xl border border-slate-800 bg-slate-900/60 p-5 shadow-2xl backdrop-blur-md">
            <svg
              className="h-12 w-12 text-cyan-400 animate-pulse"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
              strokeWidth={1.5}
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                d="M9 17.25v1.007a3 3 0 01-.879 2.122L7.5 21h9l-.621-.621A3 3 0 0115 18.257V17.25m6-12V15a2.25 2.25 0 01-2.25 2.25H5.25A2.25 2.25 0 013 15V5.25m18 0A2.25 2.25 0 0018.75 3H5.25A2.25 2.25 0 003 5.25m18 0V12a2.25 2.25 0 01-2.25 2.25H5.25A2.25 2.25 0 013 12V5.25"
              />
            </svg>
          </div>

          <p className="text-xs font-semibold uppercase tracking-[0.35em] text-cyan-500/80 mb-3">
            SpectraCast Suite
          </p>

          <h1
            className="text-3xl font-semibold leading-tight text-white mb-6 md:text-4xl tracking-tight"
            style={{ fontFamily: '"Fraunces", serif' }}
          >
            Access Restricted
          </h1>

          <div className="space-y-4 text-slate-300 text-base leading-relaxed max-w-sm mx-auto">
            <p>
              SpectraCast Suite only works on <span className="font-semibold text-white">computers</span> or{' '}
              <span className="font-semibold text-white">tablets</span>.
            </p>
            <p className="text-sm text-slate-400">
              Please switch to a computer or tablet device to continue.
            </p>
          </div>
        
        </div>
      </div>
    )
  }

  return <>{children}</>
}
