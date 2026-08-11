import { useState } from "react"
import { ShieldAlert, ShieldCheck, Copy, Check, Server, Key, AlertTriangle } from "lucide-react"
import { Button } from "@/components/ui/button"
import { useTofuStore } from "@/stores/tofu.store"
import { ipc } from "@/lib/ipc/commands"
import { useConnectionStore } from "@/stores/connection.store"
import { useSessionStore } from "@/stores/session.store"
import { clearTerminalScrollback } from "@/features/terminal/terminal-scrollback"
import { toast } from "@/stores/toast.store"

export function FingerprintVerificationModal() {
  const pendingFingerprint = useTofuStore((s) => s.pendingFingerprint)
  const setPendingFingerprint = useTofuStore((s) => s.setPendingFingerprint)
  const pendingHostKeyChanged = useTofuStore((s) => s.pendingHostKeyChanged)
  const setPendingHostKeyChanged = useTofuStore((s) => s.setPendingHostKeyChanged)

  const [copiedField, setCopiedField] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)

  const copyToClipboard = (text: string, fieldName: string) => {
    navigator.clipboard.writeText(text)
    setCopiedField(fieldName)
    setTimeout(() => setCopiedField(null), 2000)
  }

  // Security alert when host key has changed
  if (pendingHostKeyChanged) {
    return (
      <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-md p-4 animate-in fade-in duration-200">
        <div className="w-full max-w-lg rounded-2xl border border-red-500/30 bg-zinc-950/95 p-6 shadow-2xl shadow-red-950/30 text-foreground overflow-hidden relative">
          <div className="absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-red-600 via-red-500 to-red-600" />
          
          <div className="flex items-start gap-4 mb-4 border-b border-zinc-800/80 pb-4">
            <div className="rounded-xl bg-red-500/10 p-3 text-red-400 border border-red-500/20 shrink-0">
              <ShieldAlert className="h-6 w-6" />
            </div>
            <div>
              <h2 className="text-lg font-bold text-red-400">
                Host Key Verification Failed
              </h2>
              <p className="text-xs text-zinc-400 mt-1">
                SECURITY RISK — REMOTE HOST KEY HAS CHANGED
              </p>
            </div>
          </div>

          <p className="text-xs text-zinc-300 leading-relaxed mb-4">
            The host key offered by the server does not match the saved key in your database. This could indicate a Man-in-the-Middle attack or a server re-installation.
          </p>

          <div className="space-y-3 rounded-xl border border-red-500/20 bg-red-950/20 p-3.5 text-xs font-mono mb-6">
            <div>
              <span className="text-red-400 font-medium block mb-1">Expected Key (Database):</span>
              <code className="block break-all rounded-lg bg-zinc-900/90 p-2.5 text-zinc-300 border border-zinc-800 select-all">
                {pendingHostKeyChanged.expected}
              </code>
            </div>
            <div>
              <span className="text-red-400 font-medium block mb-1">Received Key (Server):</span>
              <code className="block break-all rounded-lg bg-zinc-900/90 p-2.5 text-red-300 border border-red-500/30 select-all font-bold">
                {pendingHostKeyChanged.actual}
              </code>
            </div>
          </div>

          <div className="flex justify-end gap-3">
            <Button
              variant="destructive"
              className="w-full sm:w-auto font-semibold px-5 text-xs"
              onClick={() => {
                useConnectionStore.getState().setError(pendingHostKeyChanged.hostId, "Host key changed — connection aborted")
                setPendingHostKeyChanged(null)
              }}
            >
              Abort Connection
            </Button>
          </div>
        </div>
      </div>
    )
  }

  if (!pendingFingerprint) return null

  // Format clean fingerprints
  const cleanSha256 = pendingFingerprint.fingerprint.startsWith("SHA256:")
    ? pendingFingerprint.fingerprint
    : `SHA256:${pendingFingerprint.fingerprint}`

  const cleanMd5 = pendingFingerprint.fingerprintMd5
    ? (pendingFingerprint.fingerprintMd5.startsWith("MD5:") ? pendingFingerprint.fingerprintMd5 : `MD5:${pendingFingerprint.fingerprintMd5}`)
    : null

  const handleAcceptAndSave = async () => {
    setLoading(true)
    try {
      await ipc.knownHostsTrust(
        pendingFingerprint.host,
        pendingFingerprint.port,
        cleanSha256,
        pendingFingerprint.keyType,
      )

      const { sessionId } = await ipc.sessionOpen(pendingFingerprint.hostId)
      useConnectionStore.getState().setConnected(pendingFingerprint.hostId, sessionId)

      if (pendingFingerprint.opts?.openPane !== false) {
        const pane = await ipc.paneOpen(pendingFingerprint.hostId, 120, 40)
        clearTerminalScrollback(pane.paneId)
        useSessionStore.getState().addPane({
          ...pane,
          title: pendingFingerprint.opts?.label ?? pane.title,
        })
      }

      toast.success("Host Trusted & Saved", `Fingerprint saved for ${pendingFingerprint.host}`)
      setPendingFingerprint(null)
    } catch (err) {
      toast.error("Failed to connect", err instanceof Error ? err.message : String(err))
      useConnectionStore.getState().setError(pendingFingerprint.hostId, "Connection rejected")
      setPendingFingerprint(null)
    } finally {
      setLoading(false)
    }
  }

  const handleAcceptOnce = async () => {
    setLoading(true)
    try {
      const { sessionId } = await ipc.sessionOpen(pendingFingerprint.hostId)
      useConnectionStore.getState().setConnected(pendingFingerprint.hostId, sessionId)

      if (pendingFingerprint.opts?.openPane !== false) {
        const pane = await ipc.paneOpen(pendingFingerprint.hostId, 120, 40)
        clearTerminalScrollback(pane.paneId)
        useSessionStore.getState().addPane({
          ...pane,
          title: pendingFingerprint.opts?.label ?? pane.title,
        })
      }

      toast.info("Accepted Once", `Connected to ${pendingFingerprint.host} for this session only`)
      setPendingFingerprint(null)
    } catch (err) {
      toast.error("Failed to connect", err instanceof Error ? err.message : String(err))
      useConnectionStore.getState().setError(pendingFingerprint.hostId, "Connection rejected")
      setPendingFingerprint(null)
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-md p-4 animate-in fade-in duration-200">
      <div className="w-full max-w-xl rounded-2xl border border-zinc-800/90 bg-zinc-950/95 p-6 shadow-2xl shadow-black/80 text-foreground overflow-hidden relative">
        {/* Subtle Warm Top Accent Bar */}
        <div className="absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-amber-500/70 via-amber-400/50 to-amber-500/70" />

        {/* Modal Header */}
        <div className="flex items-start gap-3.5 mb-5 border-b border-zinc-800/80 pb-4">
          <div className="rounded-xl bg-amber-500/10 p-2.5 text-amber-400/90 border border-amber-500/20 shrink-0 mt-0.5">
            <ShieldCheck className="h-6 w-6" />
          </div>
          <div className="flex-1">
            <div className="flex items-center justify-between">
              <h2 className="text-lg font-bold text-zinc-100 tracking-tight">
                Host Key Verification
              </h2>
              <span className="text-[10px] font-medium tracking-wider uppercase px-2.5 py-0.5 rounded-full bg-amber-500/10 text-amber-300/90 border border-amber-500/20">
                New Host Key
              </span>
            </div>
            <p className="text-xs text-zinc-400 mt-0.5">
              The authenticity of this remote host has not been verified yet.
            </p>
          </div>
        </div>

        {/* Connection & Algorithm Info Grid */}
        <div className="grid grid-cols-2 gap-3 mb-4">
          <div className="rounded-xl border border-zinc-800/80 bg-zinc-900/40 p-3">
            <div className="flex items-center gap-1.5 text-xs text-zinc-400 mb-1">
              <Server className="h-3.5 w-3.5 text-amber-400/80" />
              <span>Connecting To</span>
            </div>
            <div className="font-mono font-semibold text-xs text-zinc-200 truncate select-all">
              {pendingFingerprint.host}:{pendingFingerprint.port}
            </div>
          </div>
          <div className="rounded-xl border border-zinc-800/80 bg-zinc-900/40 p-3">
            <div className="flex items-center gap-1.5 text-xs text-zinc-400 mb-1">
              <Key className="h-3.5 w-3.5 text-amber-400/80" />
              <span>Key Algorithm</span>
            </div>
            <div className="font-mono font-semibold text-xs text-amber-300/90 truncate">
              {pendingFingerprint.keyType}
            </div>
          </div>
        </div>

        {/* Fingerprints Container */}
        <div className="space-y-3 rounded-xl border border-zinc-800/80 bg-zinc-900/30 p-4 mb-4">
          {/* SHA-256 */}
          <div>
            <div className="flex items-center justify-between mb-1.5">
              <span className="text-xs font-medium text-zinc-300">
                SHA-256 Fingerprint
              </span>
              <button
                type="button"
                onClick={() => copyToClipboard(cleanSha256, "sha256")}
                className="text-[11px] text-zinc-400 hover:text-amber-300 flex items-center gap-1 transition-colors px-2 py-0.5 rounded bg-zinc-800/60 border border-zinc-700/50"
              >
                {copiedField === "sha256" ? (
                  <>
                    <Check className="h-3 w-3 text-emerald-400" />
                    <span className="text-emerald-400">Copied</span>
                  </>
                ) : (
                  <>
                    <Copy className="h-3 w-3" />
                    <span>Copy</span>
                  </>
                )}
              </button>
            </div>
            <code className="block break-all rounded-lg border border-zinc-800 bg-zinc-950 p-2.5 font-mono text-xs text-amber-300/90 select-all leading-relaxed">
              {cleanSha256}
            </code>
          </div>

          {/* MD5 Fingerprint */}
          {cleanMd5 && (
            <div>
              <div className="flex items-center justify-between mb-1.5 pt-1">
                <span className="text-xs font-medium text-zinc-400">
                  MD5 Fingerprint
                </span>
                <button
                  type="button"
                  onClick={() => copyToClipboard(cleanMd5, "md5")}
                  className="text-[11px] text-zinc-400 hover:text-amber-300 flex items-center gap-1 transition-colors px-2 py-0.5 rounded bg-zinc-800/60 border border-zinc-700/50"
                >
                  {copiedField === "md5" ? (
                    <>
                      <Check className="h-3 w-3 text-emerald-400" />
                      <span className="text-emerald-400">Copied</span>
                    </>
                  ) : (
                    <>
                      <Copy className="h-3 w-3" />
                      <span>Copy</span>
                    </>
                  )}
                </button>
              </div>
              <code className="block break-all rounded-lg border border-zinc-800 bg-zinc-950 p-2.5 font-mono text-xs text-zinc-400 select-all leading-relaxed">
                {cleanMd5}
              </code>
            </div>
          )}
        </div>

        {/* Security Warning Notice */}
        <div className="flex items-start gap-2.5 rounded-xl border border-zinc-800/80 bg-zinc-900/40 p-3 text-xs text-zinc-400 mb-6">
          <AlertTriangle className="h-4 w-4 text-amber-400/80 shrink-0 mt-0.5" />
          <span>
            Please verify the fingerprint with your administrator. Accepting unverified keys is <strong>not recommended</strong>.
          </span>
        </div>

        {/* Action Buttons */}
        <div className="flex flex-col sm:flex-row items-center justify-end gap-2.5 pt-3 border-t border-zinc-800/80">
          <Button
            variant="outline"
            disabled={loading}
            className="w-full sm:w-auto text-xs text-zinc-400 border-zinc-800 hover:bg-zinc-900 hover:text-zinc-200"
            onClick={() => {
              useConnectionStore.getState().setError(pendingFingerprint.hostId, "Connection cancelled by user")
              setPendingFingerprint(null)
            }}
          >
            Cancel
          </Button>

          <Button
            variant="secondary"
            disabled={loading}
            className="w-full sm:w-auto text-xs bg-zinc-900 hover:bg-zinc-800 text-zinc-300 border border-zinc-800 font-medium"
            onClick={handleAcceptOnce}
          >
            Accept Once
          </Button>

          <Button
            disabled={loading}
            className="w-full sm:w-auto text-xs bg-amber-500/90 hover:bg-amber-500 text-zinc-950 font-semibold shadow-md shadow-amber-500/10 px-5"
            onClick={handleAcceptAndSave}
          >
            {loading ? "Saving..." : "Accept & Save"}
          </Button>
        </div>
      </div>
    </div>
  )
}
