import type { HostDto, HostTreeNode } from "@/lib/ipc/types"

/** Move the item at `from` to `to`, returning a new array. */
export function moveItem<T>(items: T[], from: number, to: number): T[] {
  if (
    from === to ||
    from < 0 ||
    to < 0 ||
    from >= items.length ||
    to >= items.length
  ) {
    return items
  }
  const next = [...items]
  const [moved] = next.splice(from, 1)
  next.splice(to, 0, moved!)
  return next
}

/**
 * Hosts that may be added as a hop for `hostId`.
 *
 * Excludes the host itself, hops already in the chain, and any host whose own
 * chain routes back here — picking one of those would be rejected on save, so
 * it should never be offered. Mirrors the backend's `save_jump_chain` rules.
 */
export function eligibleJumpHosts(
  hosts: HostDto[],
  chainByHost: Record<string, string[]>,
  hostId: string,
  currentChain: string[],
): HostDto[] {
  const routesBackToHost = (candidate: string): boolean => {
    const seen = new Set<string>()
    const queue = [candidate]
    while (queue.length) {
      const current = queue.pop()!
      if (current === hostId) return true
      if (seen.has(current)) continue
      seen.add(current)
      queue.push(...(chainByHost[current] ?? []))
    }
    return false
  }

  return hosts.filter(
    (h) =>
      h.id !== hostId &&
      !currentChain.includes(h.id) &&
      !routesBackToHost(h.id),
  )
}

/** Flatten a host tree into a list, preserving order. */
export function flattenTree(nodes: HostTreeNode[]): HostDto[] {
  const out: HostDto[] = []
  for (const node of nodes) {
    if (node.kind === "host") out.push(node.host)
    else out.push(...flattenTree(node.children))
  }
  return out
}

/** Human-readable summary of the route a chain produces. */
export function describeRoute(
  chain: string[],
  labelOf: (id: string) => string,
  targetLabel: string,
): string {
  return [...chain.map(labelOf), targetLabel].join(" → ")
}
