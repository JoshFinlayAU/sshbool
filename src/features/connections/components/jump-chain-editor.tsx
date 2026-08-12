import { ArrowDown, ArrowUp, Plus, Route, X } from "lucide-react"

import { Button } from "@/components/ui/button"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import {
  describeRoute,
  eligibleJumpHosts,
  moveItem,
} from "@/features/connections/jump-chain"
import type { HostDto } from "@/lib/ipc/types"
import { cn } from "@/lib/utils"

type JumpChainEditorProps = {
  /** The host being edited. */
  hostId: string
  /** Label of the host being edited, used in the route preview. */
  hostLabel: string
  /** Current chain, nearest hop first. */
  chain: string[]
  /** All hosts, for the picker. */
  hosts: HostDto[]
  /** Every host's chain, used to hide options that would create a loop. */
  chainByHost: Record<string, string[]>
  onChange: (chain: string[]) => void
}

/**
 * Edit an ordered ProxyJump chain.
 *
 * Order is meaningful: hop 1 is dialled directly and each later hop is
 * tunnelled through the one above it, with the target reached from the last.
 */
export function JumpChainEditor({
  hostId,
  hostLabel,
  chain,
  hosts,
  chainByHost,
  onChange,
}: JumpChainEditorProps) {
  const byId = new Map(hosts.map((h) => [h.id, h]))
  const labelOf = (id: string) => byId.get(id)?.label ?? "(deleted host)"
  const available = eligibleJumpHosts(hosts, chainByHost, hostId, chain)

  return (
    <div className="space-y-2">
      <div className="flex items-center gap-1.5 text-xs font-semibold text-foreground">
        <Route className="size-3.5 text-primary" />
        <span>Jump Hosts</span>
      </div>
      <p className="text-[11px] text-muted-foreground">
        Connect through one or more bastions. The first hop is dialled directly;
        each hop below it is reached through the one above.
      </p>

      {chain.length > 0 && (
        <ol className="space-y-1">
          {chain.map((id, index) => (
            <li
              key={id}
              className="flex items-center gap-1.5 rounded-md border border-border/70 bg-background/60 px-2 py-1.5"
            >
              <span className="text-muted-foreground w-4 shrink-0 text-center font-mono text-[10px]">
                {index + 1}
              </span>
              <span
                className={cn(
                  "min-w-0 flex-1 truncate text-xs",
                  !byId.has(id) && "text-destructive italic",
                )}
              >
                {labelOf(id)}
                {byId.get(id) && (
                  <span className="text-muted-foreground ml-1.5 font-mono text-[10px]">
                    {byId.get(id)!.hostname}
                  </span>
                )}
              </span>
              <Button
                type="button"
                variant="ghost"
                size="icon"
                className="size-6"
                aria-label={`Move ${labelOf(id)} earlier`}
                disabled={index === 0}
                onClick={() => onChange(moveItem(chain, index, index - 1))}
              >
                <ArrowUp className="size-3" />
              </Button>
              <Button
                type="button"
                variant="ghost"
                size="icon"
                className="size-6"
                aria-label={`Move ${labelOf(id)} later`}
                disabled={index === chain.length - 1}
                onClick={() => onChange(moveItem(chain, index, index + 1))}
              >
                <ArrowDown className="size-3" />
              </Button>
              <Button
                type="button"
                variant="ghost"
                size="icon"
                className="text-muted-foreground hover:text-destructive size-6"
                aria-label={`Remove ${labelOf(id)}`}
                onClick={() => onChange(chain.filter((h) => h !== id))}
              >
                <X className="size-3" />
              </Button>
            </li>
          ))}
        </ol>
      )}

      {available.length > 0 ? (
        <Select
          value=""
          onValueChange={(v) => {
            if (v) onChange([...chain, v])
          }}
        >
          <SelectTrigger className="h-8 w-full text-xs">
            <span className="flex items-center gap-1.5">
              <Plus className="size-3" />
              <SelectValue placeholder="Add a jump host" />
            </span>
          </SelectTrigger>
          <SelectContent>
            {available.map((h) => (
              <SelectItem key={h.id} value={h.id}>
                {h.label}
                <span className="text-muted-foreground ml-1.5 font-mono text-[10px]">
                  {h.hostname}
                </span>
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      ) : (
        <p className="text-[11px] text-muted-foreground italic">
          {chain.length > 0
            ? "No other hosts can be added without creating a loop."
            : "Add another host first to use it as a jump host."}
        </p>
      )}

      {chain.length > 0 && (
        <p className="text-[11px] text-muted-foreground">
          Route:{" "}
          <span className="font-mono text-foreground">
            {describeRoute(chain, labelOf, hostLabel)}
          </span>
        </p>
      )}
    </div>
  )
}
