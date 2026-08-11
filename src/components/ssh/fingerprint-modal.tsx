import { useState } from "react"
import { ShieldCheck, Copy, Check, Server, Key, AlertTriangle, ShieldAlert } from "lucide-react"
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
      <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-xs p-4 animate-in fade-in duration-150">
        <div className="w-full max-w-md rounded-xl border border-destructive/40 bg-background p-5 shadow-lg text-foreground">
          <div className="flex items-start gap-3.5 mb-4 border-b border-border pb-3.5">
            <div className="rounded-lg bg-destructive/10 p-2 text-destructive shrink-0 mt-0.5">
              <ShieldAlert className="h-5 w-5" />
            </div>
            <div>
              <h2 className="text-sm font-semibold text-destructive">
                Host Key Verification Failed
              </h2>
              <p className="text-xs text-muted-foreground mt-0.5">
                Security Warning — Server host key mismatch detected
              </p>
            </div>
          </div>

          <p className="text-xs text-muted-foreground leading-relaxed mb-4">
            The host key offered by the server does not match the key saved in your database. This could indicate a Man-in-the-Middle attack or a server re-installation.
          </p>

          <div className="space-y-2.5 rounded-lg border border-destructive/20 bg-destructive/5 p-3 text-xs font-mono mb-5">
            <div>
              <span className="text-muted-foreground block mb-1 font-sans text-[11px]">Expected (Database):</span>
              <code className="block break-all rounded bg-muted/60 p-2 text-foreground text-[11px]">
                {pendingHostKeyChanged.expected}
              </code>
            </div>
            <div>
              <span className="text-destructive block mb-1 font-sans text-[11px] font-medium">Received (Server):</span>
              <code className="block break-all rounded bg-destructive/10 p-2 text-destructive text-[11px]">
                {pendingHostKeyChanged.actual}
              </code>
            </div>
          </div>

          <div className="flex justify-end gap-2">
            <Button
              variant="destructive"
              size="sm"
              className="text-xs font-medium px-4"
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
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-xs p-4 animate-in fade-in duration-150">
      <div className="w-full max-w-lg rounded-xl border border-border bg-background p-5 shadow-lg text-foreground">
        {/* Modal Header */}
        <div className="flex items-start gap-3.5 mb-4 border-b border-border pb-3.5">
          <div className="rounded-lg bg-muted p-2 text-foreground shrink-0 mt-0.5">
            <ShieldCheck className="h-5 w-5" />
          </div>
          <div className="flex-1">
            <div className="flex items-center justify-between">
              <h2 className="text-sm font-semibold tracking-tight">
                Host Key Verification
              </h2>
              <span className="text-[10px] font-mono uppercase px-2 py-0.5 rounded bg-muted text-muted-foreground border border-border">
                New Host Key
              </span>
            </div>
            <p className="text-xs text-muted-foreground mt-0.5">
              The authenticity of this remote host has not been verified yet.
            </p>
          </div>
        </div>

        {/* Host & Key Alg Details */}
        <div className="grid grid-cols-2 gap-3 mb-3">
          <div className="rounded-lg border border-border bg-muted/20 p-2.5">
            <div className="flex items-center gap-1.5 text-[11px] text-muted-foreground mb-1">
              <Server className="h-3.5 w-3.5" />
              <span>Connecting To</span>
            </div>
            <div className="font-mono text-xs font-medium text-foreground truncate select-all">
              {pendingFingerprint.host}:{pendingFingerprint.port}
            </div>
          </div>
          <div className="rounded-lg border border-border bg-muted/20 p-2.5">
            <div className="flex items-center gap-1.5 text-[11px] text-muted-foreground mb-1">
              <Key className="h-3.5 w-3.5" />
              <span>Key Algorithm</span>
            </div>
            <div className="font-mono text-xs font-medium text-foreground truncate">
              {pendingFingerprint.keyType}
            </div>
          </div>
        </div>

        {/* Fingerprints Container */}
        <div className="space-y-3 rounded-lg border border-border bg-muted/10 p-3.5 mb-3">
          {/* SHA-256 */}
          <div>
            <div className="flex items-center justify-between mb-1">
              <span className="text-xs font-medium text-muted-foreground">
                SHA-256 Fingerprint
              </span>
              <button
                type="button"
                onClick={() => copyToClipboard(cleanSha256, "sha256")}
                className="text-[10px] text-muted-foreground hover:text-foreground flex items-center gap-1 transition-colors px-2 py-0.5 rounded bg-muted border border-border"
              >
                {copiedField === "sha256" ? (
                  <>
                    <Check className="h-3 w-3 text-emerald-500" />
                    <span>Copied</span>
                  </>
                ) : (
                  <>
                    <Copy className="h-3 w-3" />
                    <span>Copy</span>
                  </>
                )}
              </button>
            </div>
            <code className="block break-all rounded border border-border bg-muted/40 p-2 font-mono text-xs text-foreground select-all">
              {cleanSha256}
            </code>
          </div>

          {/* MD5 Fingerprint */}
          {cleanMd5 && (
            <div>
              <div className="flex items-center justify-between mb-1 pt-1">
                <span className="text-xs font-medium text-muted-foreground">
                  MD5 Fingerprint
                </span>
                <button
                  type="button"
                  onClick={() => copyToClipboard(cleanMd5, "md5")}
                  className="text-[10px] text-muted-foreground hover:text-foreground flex items-center gap-1 transition-colors px-2 py-0.5 rounded bg-muted border border-border"
                >
                  {copiedField === "md5" ? (
                    <>
                      <Check className="h-3 w-3 text-emerald-500" />
                      <span>Copied</span>
                    </>
                  ) : (
                    <>
                      <Copy className="h-3 w-3" />
                      <span>Copy</span>
                    </>
                  )}
                </button>
              </div>
              <code className="block break-all rounded border border-border bg-muted/40 p-2 font-mono text-xs text-muted-foreground select-all">
                {cleanMd5}
              </code>
            </div>
          )}
        </div>

        {/* Warning Notice */}
        <div className="flex items-start gap-2.5 rounded-lg border border-border bg-muted/20 p-2.5 text-xs text-muted-foreground mb-4">
          <AlertTriangle className="h-3.5 w-3.5 text-amber-500 shrink-0 mt-0.5" />
          <span>
            Please verify the fingerprint with your administrator before accepting.
          </span>
        </div>

        {/* Action Buttons */}
        <div className="flex items-center justify-end gap-2 pt-2 border-t border-border">
          <Button
            variant="ghost"
            size="sm"
            disabled={loading}
            className="text-xs text-muted-foreground hover:text-foreground"
            onClick={() => {
              useConnectionStore.getState().setError(pendingFingerprint.hostId, "Connection cancelled by user")
              setPendingFingerprint(null)
            }}
          >
            Cancel
          </Button>

          <Button
            variant="outline"
            size="sm"
            disabled={loading}
            className="text-xs font-medium"
            onClick={handleAcceptOnce}
          >
            Accept Once
          </Button>

          <Button
            size="sm"
            disabled={loading}
            className="text-xs font-medium px-4"
            onClick={handleAcceptAndSave}
          >
            {loading ? "Saving..." : "Accept & Save"}
          </Button>
        </div>
      </div>
    </div>
  )
}
