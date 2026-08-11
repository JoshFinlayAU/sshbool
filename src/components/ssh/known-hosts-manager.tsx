import { useState } from "react"
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query"
import { ShieldCheck, Copy, Check, Server, Key, Trash2, Search, X, ShieldAlert } from "lucide-react"
import { Button } from "@/components/ui/button"
import { ipc } from "@/lib/ipc/commands"
import { KnownHostDto } from "@/lib/ipc/types"
import { toast } from "@/stores/toast.store"

interface KnownHostKeysManagerProps {
  open: boolean
  onClose: () => void
}

export function KnownHostKeysManager({ open, onClose }: KnownHostKeysManagerProps) {
  const queryClient = useQueryClient()
  const [searchQuery, setSearchQuery] = useState("")
  const [copiedId, setCopiedId] = useState<string | null>(null)
  const [deletingId, setDeletingId] = useState<string | null>(null)

  const { data: knownHosts = [], isLoading } = useQuery({
    queryKey: ["known_hosts"],
    queryFn: async () => {
      const list = await ipc.knownHostsList()
      return list as KnownHostDto[]
    },
    enabled: open,
  })

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      await ipc.knownHostsDelete(id)
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["known_hosts"] })
      toast.success("Host key removed. Reconnecting will trigger verification prompt.")
      setDeletingId(null)
    },
    onError: (err) => {
      toast.error(`Failed to delete host key: ${String(err)}`)
      setDeletingId(null)
    },
  })

  if (!open) return null

  const filteredHosts = knownHosts.filter((h) => {
    const q = searchQuery.toLowerCase()
    return (
      h.host.toLowerCase().includes(q) ||
      h.keyType.toLowerCase().includes(q) ||
      h.fingerprintSha256.toLowerCase().includes(q) ||
      String(h.port).includes(q)
    )
  })

  const handleCopy = (text: string, id: string) => {
    navigator.clipboard.writeText(text)
    setCopiedId(id)
    setTimeout(() => setCopiedId(null), 2000)
  }

  let content
  if (isLoading) {
    content = (
      <div className="py-12 text-center text-xs text-zinc-500">
        Loading trusted host keys...
      </div>
    )
  } else if (filteredHosts.length === 0) {
    content = (
      <div className="py-12 text-center border border-dashed border-zinc-800 rounded-xl p-8">
        <ShieldAlert className="h-8 w-8 text-zinc-600 mx-auto mb-2" />
        <p className="text-sm text-zinc-400 font-medium">No trusted host keys found</p>
        <p className="text-xs text-zinc-500 mt-1">
          {searchQuery
            ? "No host keys matched your filter criteria."
            : "Trusted SSH server keys will appear here when you connect."}
        </p>
      </div>
    )
  } else {
    content = filteredHosts.map((item) => {
      const isDeleting = deletingId === item.id

      return (
        <div
          key={item.id}
          className="rounded-xl border border-zinc-800/90 bg-zinc-900/40 p-4 transition-all hover:border-amber-500/30 hover:bg-zinc-900/60"
        >
          {/* Top info tiles */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mb-3">
            <div className="rounded-lg border border-zinc-800/80 bg-zinc-900/80 p-3">
              <div className="flex items-center gap-1.5 text-[11px] font-medium text-zinc-400 mb-1">
                <Server className="h-3.5 w-3.5 text-amber-500/70" />
                Connecting To
              </div>
              <div className="font-mono text-sm font-semibold text-zinc-100">
                {item.host}:{item.port}
              </div>
            </div>

            <div className="rounded-lg border border-zinc-800/80 bg-zinc-900/80 p-3">
              <div className="flex items-center gap-1.5 text-[11px] font-medium text-zinc-400 mb-1">
                <Key className="h-3.5 w-3.5 text-amber-500/70" />
                Key Algorithm
              </div>
              <div className="font-mono text-sm font-semibold text-amber-400">
                {item.keyType}
              </div>
            </div>
          </div>

          {/* Fingerprints */}
          <div className="space-y-2.5 mb-3">
            {/* SHA-256 */}
            <div>
              <div className="flex items-center justify-between text-[11px] text-zinc-400 font-medium mb-1">
                <span>SHA-256 Fingerprint</span>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => handleCopy(item.fingerprintSha256, `${item.id}-sha`)}
                  className="h-6 px-2 text-[10px] text-zinc-400 hover:text-amber-400 hover:bg-amber-500/10 border border-zinc-800/80"
                >
                  {copiedId === `${item.id}-sha` ? (
                    <>
                      <Check className="h-3 w-3 text-emerald-400 mr-1" />
                      Copied
                    </>
                  ) : (
                    <>
                      <Copy className="h-3 w-3 mr-1" />
                      Copy
                    </>
                  )}
                </Button>
              </div>
              <code className="block break-all rounded-lg border border-zinc-800/90 bg-zinc-950/90 p-2.5 text-xs font-mono text-amber-300/90 select-all">
                {item.fingerprintSha256}
              </code>
            </div>
          </div>

          {/* Card actions / timestamp */}
          <div className="flex items-center justify-between pt-2 border-t border-zinc-800/60 text-[11px] text-zinc-500">
            <div>
              Verified:{" "}
              <span className="text-zinc-400 font-medium">
                {new Date(item.firstSeenAt).toLocaleDateString()}
              </span>
            </div>

            <Button
              variant="ghost"
              size="sm"
              disabled={isDeleting}
              onClick={() => {
                setDeletingId(item.id)
                deleteMutation.mutate(item.id)
              }}
              className="h-7 px-2.5 text-xs text-red-400 hover:text-red-300 hover:bg-red-500/10 border border-red-500/20"
            >
              <Trash2 className="h-3.5 w-3.5 mr-1" />
              {isDeleting ? "Revoking..." : "Revoke Trust"}
            </Button>
          </div>
        </div>
      )
    })
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-md p-4 animate-in fade-in duration-200">
      <div className="w-full max-w-3xl rounded-2xl border border-amber-500/20 bg-zinc-950/95 p-6 shadow-2xl shadow-amber-950/20 text-foreground overflow-hidden relative flex flex-col max-h-[85vh]">
        {/* Sleek amber accent line */}
        <div className="absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-amber-600 via-amber-500 to-amber-600" />

        {/* Header */}
        <div className="flex items-center justify-between border-b border-zinc-800/80 pb-4 mb-4">
          <div className="flex items-center gap-3">
            <div className="rounded-xl bg-amber-500/10 p-2.5 text-amber-400 border border-amber-500/20">
              <ShieldCheck className="h-6 w-6" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-lg font-bold tracking-tight text-zinc-100">
                  Trusted SSH Host Keys
                </h2>
                <span className="rounded-full bg-amber-500/10 px-2.5 py-0.5 text-[10px] font-semibold text-amber-400 border border-amber-500/20 uppercase tracking-wider">
                  {knownHosts.length} Saved Keys
                </span>
              </div>
              <p className="text-xs text-zinc-400 mt-0.5">
                View, copy fingerprints, or revoke trusted remote host keys
              </p>
            </div>
          </div>

          <Button
            variant="ghost"
            size="icon"
            onClick={onClose}
            className="rounded-lg text-zinc-400 hover:text-white hover:bg-zinc-900"
          >
            <X className="h-5 w-5" />
          </Button>
        </div>

        {/* Search bar */}
        <div className="relative mb-4">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-zinc-500" />
          <input
            type="text"
            placeholder="Filter by host IP, port, algorithm, or fingerprint..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full rounded-xl bg-zinc-900/90 border border-zinc-800 pl-9 pr-4 py-2 text-xs text-zinc-200 placeholder:text-zinc-500 focus:outline-none focus:border-amber-500/50 transition-colors"
          />
        </div>

        {/* Content list */}
        <div className="flex-1 overflow-y-auto space-y-4 pr-1">
          {content}
        </div>

        {/* Footer */}
        <div className="pt-4 border-t border-zinc-800/80 mt-4 flex items-center justify-between">
          <p className="text-[11px] text-zinc-500">
            Revoking a host key will prompt verification on next SSH handshake.
          </p>
          <Button
            variant="outline"
            size="sm"
            onClick={onClose}
            className="border-zinc-800 bg-zinc-900 text-zinc-300 hover:bg-zinc-800 hover:text-white text-xs px-4"
          >
            Close
          </Button>
        </div>
      </div>
    </div>
  )
}
