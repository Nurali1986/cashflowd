import { createContext, useCallback, useContext, useEffect, useState, type ReactNode } from 'react'
import { api, type Meta } from './api'

interface MetaState {
  meta: Meta | null
  error: string | null
  reload: () => Promise<void>
  /** Bumped after any data change so report pages refetch. */
  version: number
  touch: () => void
}

const MetaContext = createContext<MetaState | null>(null)

export function MetaProvider({ children }: { children: ReactNode }) {
  const [meta, setMeta] = useState<Meta | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [version, setVersion] = useState(0)

  const reload = useCallback(async () => {
    try {
      setMeta(await api.get<Meta>('/api/meta'))
      setError(null)
    } catch (e) {
      setError((e as Error).message)
    }
  }, [])

  const touch = useCallback(() => {
    setVersion(v => v + 1)
    void reload()
  }, [reload])

  useEffect(() => { void reload() }, [reload])

  return <MetaContext.Provider value={{ meta, error, reload, version, touch }}>{children}</MetaContext.Provider>
}

export function useMeta(): MetaState & { meta: Meta } {
  const ctx = useContext(MetaContext)
  if (!ctx) throw new Error('MetaProvider missing')
  return ctx as MetaState & { meta: Meta }
}

/** Load data from the API, refetching when deps or the global data version change. */
export function useData<T>(url: string | null, deps: unknown[] = []) {
  const { version } = useMeta()
  const [data, setData] = useState<T | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)
  const [tick, setTick] = useState(0)

  useEffect(() => {
    if (!url) return
    let cancelled = false
    setLoading(true)
    api.get<T>(url)
      .then(d => { if (!cancelled) { setData(d); setError(null) } })
      .catch(e => { if (!cancelled) setError((e as Error).message) })
      .finally(() => { if (!cancelled) setLoading(false) })
    return () => { cancelled = true }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [url, version, tick, ...deps])

  return { data, error, loading, refresh: () => setTick(t => t + 1), setData }
}
