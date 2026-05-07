import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react'
import type { Dispatch, ReactNode, SetStateAction } from 'react'
import { apiFetch } from './api'
import { isAuthenticated } from './auth'

interface UserState {
  email: string
  is_onboarded: boolean
}

interface UserContextValue {
  user: UserState | null
  isLoading: boolean
  setUser: Dispatch<SetStateAction<UserState | null>>
  refreshUser: () => Promise<void>
}

const UserContext = createContext<UserContextValue | undefined>(undefined)

interface UserProviderProps {
  children: ReactNode
}

export const UserProvider = ({ children }: UserProviderProps) => {
  const [user, setUser] = useState<UserState | null>(null)
  const [isLoading, setIsLoading] = useState(true)

  const refreshUser = useCallback(async () => {
    if (!isAuthenticated()) {
      setUser(null)
      setIsLoading(false)
      return
    }

    setIsLoading(true)

    try {
      const response = await apiFetch('/api/users/me')

      if (!response.ok) {
        throw new Error(`Failed to load user profile (HTTP ${response.status})`)
      }

      const data = (await response.json()) as {
        email: string
        is_onboarded?: boolean
      }

      setUser({
        email: data.email,
        is_onboarded: Boolean(data.is_onboarded),
      })
    } catch {
      setUser(null)
    } finally {
      setIsLoading(false)
    }
  }, [])

  useEffect(() => {
    void refreshUser()
  }, [refreshUser])

  const value = useMemo(
    () => ({
      user,
      isLoading,
      setUser,
      refreshUser,
    }),
    [user, isLoading, refreshUser],
  )

  return <UserContext.Provider value={value}>{children}</UserContext.Provider>
}

export const useUser = () => {
  const context = useContext(UserContext)
  if (!context) {
    throw new Error('useUser must be used within UserProvider')
  }
  return context
}
