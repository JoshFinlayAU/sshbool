import { useEffect, useMemo, useState } from "react"

import { ipc } from "@/lib/ipc/commands"
import { useLayoutStore } from "@/stores/layout.store"

/**
 * Command palette — actions only.
 *
 * Searching for hosts, snippets and notes lives in the title-bar omni search
 * (⌘K). This is bound to ⌘⇧P, following the same split as most editors: ⌘K
 * finds things, ⌘⇧P runs them.
 */
export function CommandPalette() {
  const [open, setOpen] = useState(false)
  const [query, setQuery] = useState("")
  const setActivity = useLayoutStore((s) => s.setActivity)
  const setSelectedHostId = useLayoutStore((s) => s.setSelectedHostId)

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if ((e.ctrlKey || e.metaKey) && e.shiftKey && e.key.toLowerCase() === "p") {
        e.preventDefault()
        setOpen((v) => !v)
      }
      if (e.key === "Escape") setOpen(false)
    }
    window.addEventListener("keydown", onKey)
    return () => window.removeEventListener("keydown", onKey)
  }, [])

  const commands = useMemo(
    () => [
      {
        id: "act-home",
        title: "Go to Overview",
        run: () => {
          setSelectedHostId(null)
          setActivity("home")
        },
      },
      { id: "act-terminal", title: "Go to Terminal", run: () => setActivity("terminal") },
      { id: "act-sftp", title: "Go to SFTP", run: () => setActivity("sftp") },
      { id: "act-editor", title: "Go to Editor", run: () => setActivity("editor") },
      { id: "act-keys", title: "Go to Keys", run: () => setActivity("keys") },
      { id: "act-settings", title: "Go to Settings", run: () => setActivity("settings") },
      { id: "lock", title: "Lock vault", run: () => void ipc.vaultLock() },
    ],
    [setActivity, setSelectedHostId],
  )

  const filtered = commands.filter((c) =>
    c.title.toLowerCase().includes(query.toLowerCase()),
  )

  if (!open) return null

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center bg-black/40 pt-[15vh]">
      <div className="glass w-full max-w-lg overflow-hidden rounded-xl shadow-lg">
        <input
          autoFocus
          className="placeholder:text-muted-foreground w-full border-b border-border bg-transparent px-4 py-3 text-sm outline-none"
          placeholder="Run a command…"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
        />
        <ul className="max-h-80 overflow-y-auto p-1 text-sm">
          {filtered.map((c) => (
            <li key={c.id}>
              <button
                type="button"
                className="hover:bg-muted/60 w-full rounded-md px-3 py-2 text-left"
                onClick={() => {
                  c.run()
                  setOpen(false)
                  setQuery("")
                }}
              >
                {c.title}
              </button>
            </li>
          ))}
          {filtered.length === 0 && (
            <li className="text-muted-foreground px-3 py-4 text-center text-xs">
              No matching command — press ⌘K to search hosts
            </li>
          )}
        </ul>
      </div>
    </div>
  )
}
