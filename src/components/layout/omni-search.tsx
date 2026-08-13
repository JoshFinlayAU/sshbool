import { useQuery } from "@tanstack/react-query"
import { FileText, Search, Server, TerminalSquare } from "lucide-react"
import { useEffect, useMemo, useRef, useState } from "react"

import { ipc } from "@/lib/ipc/commands"
import type { SearchResultDto } from "@/lib/ipc/types"
import { cn } from "@/lib/utils"
import {
  HOST_SCOPED_ACTIVITIES,
  useLayoutStore,
} from "@/stores/layout.store"

const KIND_ICON: Record<string, typeof Server> = {
  host: Server,
  snippet: TerminalSquare,
  note: FileText,
}

/** Debounce so a fast typist doesn't fire a query per keystroke. */
function useDebounced<T>(value: T, ms: number): T {
  const [debounced, setDebounced] = useState(value)
  useEffect(() => {
    const t = setTimeout(() => setDebounced(value), ms)
    return () => clearTimeout(t)
  }, [value, ms])
  return debounced
}

/**
 * Always-visible search field in the title bar.
 *
 * Searches hosts, snippets and notes; selecting a host opens it. Cmd/Ctrl+K
 * focuses the field, ↑/↓ move through results, Enter opens, Escape dismisses.
 */
export function OmniSearch() {
  const [query, setQuery] = useState("")
  const [open, setOpen] = useState(false)
  const [active, setActive] = useState(0)
  const inputRef = useRef<HTMLInputElement>(null)
  const containerRef = useRef<HTMLDivElement>(null)

  const setActivity = useLayoutStore((s) => s.setActivity)
  const setSelectedHostId = useLayoutStore((s) => s.setSelectedHostId)
  const rememberView = useLayoutStore((s) => s.rememberView)

  const debounced = useDebounced(query.trim(), 150)

  const results = useQuery({
    queryKey: ["search", debounced],
    queryFn: () => ipc.searchGlobal(debounced),
    enabled: debounced.length > 0,
    staleTime: 5_000,
  })

  const items: SearchResultDto[] = useMemo(
    () => results.data ?? [],
    [results.data],
  )

  // Reset the highlight whenever the result set changes.
  useEffect(() => setActive(0), [debounced])

  // Cmd/Ctrl+K focuses the bar from anywhere.
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
        e.preventDefault()
        inputRef.current?.focus()
        inputRef.current?.select()
        setOpen(true)
      }
    }
    window.addEventListener("keydown", onKey)
    return () => window.removeEventListener("keydown", onKey)
  }, [])

  // Dismiss when focus or a click lands outside.
  useEffect(() => {
    if (!open) return
    function onPointerDown(e: PointerEvent) {
      if (!containerRef.current?.contains(e.target as Node)) setOpen(false)
    }
    window.addEventListener("pointerdown", onPointerDown)
    return () => window.removeEventListener("pointerdown", onPointerDown)
  }, [open])

  /// Only hosts have somewhere to navigate to — snippets and notes have no
  /// route of their own yet, so their rows are shown but not selectable.
  function choose(result: SearchResultDto) {
    if (result.kind !== "host") return
    setSelectedHostId(result.id)
    const current = useLayoutStore.getState().activity
    const next = HOST_SCOPED_ACTIVITIES.includes(current) ? current : "terminal"
    setActivity(next)
    rememberView(result.id, next)
    setOpen(false)
    setQuery("")
    inputRef.current?.blur()
  }

  function onKeyDown(e: React.KeyboardEvent<HTMLInputElement>) {
    if (e.key === "Escape") {
      setOpen(false)
      inputRef.current?.blur()
      return
    }
    if (!items.length) return
    if (e.key === "ArrowDown") {
      e.preventDefault()
      setActive((i) => (i + 1) % items.length)
    } else if (e.key === "ArrowUp") {
      e.preventDefault()
      setActive((i) => (i - 1 + items.length) % items.length)
    } else if (e.key === "Enter") {
      e.preventDefault()
      const chosen = items[active]
      if (chosen) choose(chosen)
    }
  }

  const showPanel = open && debounced.length > 0

  return (
    <div
      ref={containerRef}
      className="relative mx-auto w-full max-w-md"
      style={{ WebkitAppRegion: "no-drag" } as React.CSSProperties}
    >
      <div className="relative">
        <Search className="text-muted-foreground pointer-events-none absolute top-1/2 left-2 size-3.5 -translate-y-1/2" />
        <input
          ref={inputRef}
          type="text"
          role="combobox"
          aria-expanded={showPanel}
          aria-controls="omni-results"
          aria-label="Search hosts, snippets and notes"
          className="border-border bg-background/60 focus:bg-background focus:border-primary/60 h-6 w-full rounded-md border pr-10 pl-7 text-xs outline-none transition-colors"
          placeholder="Search hosts, snippets, notes…"
          value={query}
          onChange={(e) => {
            setQuery(e.target.value)
            setOpen(true)
          }}
          onFocus={() => setOpen(true)}
          onKeyDown={onKeyDown}
          spellCheck={false}
        />
        <kbd className="text-muted-foreground pointer-events-none absolute top-1/2 right-2 -translate-y-1/2 font-mono text-[10px]">
          ⌘K
        </kbd>
      </div>

      {showPanel && (
        <div
          id="omni-results"
          role="listbox"
          className="bg-popover border-border absolute top-full right-0 left-0 z-50 mt-1 max-h-80 overflow-y-auto rounded-lg border shadow-lg"
        >
          {results.isLoading && (
            <p className="text-muted-foreground px-3 py-3 text-center text-xs">
              Searching…
            </p>
          )}
          {!results.isLoading && items.length === 0 && (
            <p className="text-muted-foreground px-3 py-3 text-center text-xs">
              No matches for “{debounced}”
            </p>
          )}
          {items.map((result, index) => {
            const Icon = KIND_ICON[result.kind] ?? Server
            return (
              <button
                key={`${result.kind}-${result.id}`}
                type="button"
                role="option"
                aria-selected={index === active}
                disabled={result.kind !== "host"}
                className={cn(
                  "flex w-full items-center gap-2 px-3 py-1.5 text-left",
                  index === active ? "bg-accent" : "hover:bg-muted/60",
                  result.kind !== "host" && "cursor-default opacity-70",
                )}
                onPointerEnter={() => setActive(index)}
                onClick={() => choose(result)}
              >
                <Icon className="text-muted-foreground size-3.5 shrink-0" />
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-xs">{result.title}</span>
                  {result.subtitle && (
                    <span className="text-muted-foreground block truncate font-mono text-[10px]">
                      {result.subtitle}
                    </span>
                  )}
                </span>
                <span className="text-muted-foreground shrink-0 text-[10px] uppercase">
                  {result.kind}
                </span>
              </button>
            )
          })}
        </div>
      )}
    </div>
  )
}
