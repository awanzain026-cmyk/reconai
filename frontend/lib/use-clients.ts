"use client"

import { useCallback, useEffect, useState } from "react"
import { api, getErrorMessage } from "@/lib/api"
import type { Client } from "@/lib/api"
import {
  CLIENT_CHANGED_EVENT,
  getActiveClientId,
  setActiveClientId,
} from "@/lib/client-selection"

/**
 * Loads the workspace's clients and keeps the "active client" in sync across
 * components. Falls back to the first client when nothing valid is stored, so
 * a fresh account always has a working workspace.
 */
export function useClients() {
  const [clients, setClients] = useState<Client[]>([])
  const [activeId, setActiveId] = useState<number | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const reload = useCallback(async () => {
    try {
      const list = await api.getClients()
      setClients(list)

      const stored = getActiveClientId()
      const valid =
        stored !== null && list.some((c) => c.id === stored)
          ? stored
          : (list[0]?.id ?? null)

      if (valid !== stored) setActiveClientId(valid)
      setActiveId(valid)
      setError(null)
    } catch (err) {
      setError(getErrorMessage(err))
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    void reload()
  }, [reload])

  useEffect(() => {
    const onChange = () => setActiveId(getActiveClientId())
    window.addEventListener(CLIENT_CHANGED_EVENT, onChange)
    return () => window.removeEventListener(CLIENT_CHANGED_EVENT, onChange)
  }, [])

  const activeClient = clients.find((c) => c.id === activeId) ?? null

  return { clients, activeId, activeClient, loading, error, reload }
}
