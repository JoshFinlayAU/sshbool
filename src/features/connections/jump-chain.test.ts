import { describe, expect, it } from "vitest"

import {
  describeRoute,
  eligibleJumpHosts,
  flattenTree,
  moveItem,
} from "@/features/connections/jump-chain"
import type { HostDto, HostTreeNode } from "@/lib/ipc/types"

function host(id: string, label = id): HostDto {
  return {
    id,
    groupId: null,
    label,
    hostname: `${id}.example.net`,
    port: 22,
    username: null,
    authMethod: "key",
    identityId: null,
    color: null,
    icon: null,
    isFavorite: false,
    isPinned: false,
    notes: null,
    lastConnectedAt: null,
    connectCount: 0,
  }
}

describe("moveItem", () => {
  it("moves an item earlier", () => {
    expect(moveItem(["a", "b", "c"], 2, 1)).toEqual(["a", "c", "b"])
  })

  it("moves an item later", () => {
    expect(moveItem(["a", "b", "c"], 0, 2)).toEqual(["b", "c", "a"])
  })

  it("leaves the list untouched for a no-op or out-of-range move", () => {
    const items = ["a", "b", "c"]
    expect(moveItem(items, 1, 1)).toBe(items)
    expect(moveItem(items, -1, 0)).toBe(items)
    expect(moveItem(items, 0, 9)).toBe(items)
  })

  it("does not mutate the input", () => {
    const items = ["a", "b"]
    moveItem(items, 0, 1)
    expect(items).toEqual(["a", "b"])
  })
})

describe("eligibleJumpHosts", () => {
  const hosts = [host("target"), host("bastion"), host("core"), host("dmz")]

  it("excludes the host being edited", () => {
    const ids = eligibleJumpHosts(hosts, {}, "target", []).map((h) => h.id)
    expect(ids).not.toContain("target")
  })

  it("excludes hops already in the chain", () => {
    const ids = eligibleJumpHosts(hosts, {}, "target", ["bastion"]).map(
      (h) => h.id,
    )
    expect(ids).not.toContain("bastion")
    expect(ids).toContain("core")
  })

  it("excludes a host that routes directly back", () => {
    // bastion already jumps through target, so offering it would loop.
    const ids = eligibleJumpHosts(
      hosts,
      { bastion: ["target"] },
      "target",
      [],
    ).map((h) => h.id)
    expect(ids).not.toContain("bastion")
  })

  it("excludes a host that routes back indirectly", () => {
    // dmz -> core -> target
    const ids = eligibleJumpHosts(
      hosts,
      { dmz: ["core"], core: ["target"] },
      "target",
      [],
    ).map((h) => h.id)
    expect(ids).not.toContain("dmz")
    expect(ids).not.toContain("core")
  })

  it("allows a shared bastion used by another host", () => {
    // A diamond is not a cycle.
    const ids = eligibleJumpHosts(
      hosts,
      { core: ["bastion"] },
      "target",
      [],
    ).map((h) => h.id)
    expect(ids).toContain("bastion")
    expect(ids).toContain("core")
  })

  it("terminates on a pre-existing cycle in the stored graph", () => {
    // Defensive: bad data must not hang the picker.
    const ids = eligibleJumpHosts(
      hosts,
      { core: ["dmz"], dmz: ["core"] },
      "target",
      [],
    ).map((h) => h.id)
    expect(ids).toContain("core")
  })
})

describe("flattenTree", () => {
  it("collects hosts from nested groups in order", () => {
    const tree: HostTreeNode[] = [
      { kind: "host", host: host("a") },
      {
        kind: "group",
        group: {
          id: "g",
          name: "Group",
          parentId: null,
          color: null,
          icon: null,
          sortOrder: 0,
        },
        children: [
          { kind: "host", host: host("b") },
          {
            kind: "group",
            group: {
              id: "g2",
              name: "Nested",
              parentId: "g",
              color: null,
              icon: null,
              sortOrder: 0,
            },
            children: [{ kind: "host", host: host("c") }],
          },
        ],
      },
    ]
    expect(flattenTree(tree).map((h) => h.id)).toEqual(["a", "b", "c"])
  })
})

describe("describeRoute", () => {
  it("renders hops then the target", () => {
    expect(describeRoute(["a", "b"], (id) => id.toUpperCase(), "prod")).toBe(
      "A → B → prod",
    )
  })

  it("renders just the target for an empty chain", () => {
    expect(describeRoute([], (id) => id, "prod")).toBe("prod")
  })
})
