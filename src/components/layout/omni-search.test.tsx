import { QueryClient, QueryClientProvider } from "@tanstack/react-query"
import { render, screen, waitFor } from "@testing-library/react"
import { beforeEach, describe, expect, it, vi } from "vitest"

import { OmniSearch } from "@/components/layout/omni-search"
import type { SearchResultDto } from "@/lib/ipc/types"
import { useLayoutStore } from "@/stores/layout.store"

const searchGlobal = vi.fn<(q: string) => Promise<SearchResultDto[]>>()

vi.mock("@/lib/ipc/commands", () => ({
  ipc: {
    searchGlobal: (q: string) => searchGlobal(q),
  },
}))

function renderBar() {
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  })
  return render(
    <QueryClientProvider client={client}>
      <OmniSearch />
    </QueryClientProvider>,
  )
}

function host(id: string, title: string, subtitle = "10.0.0.1"): SearchResultDto {
  return { kind: "host", id, title, subtitle }
}

describe("OmniSearch", () => {
  beforeEach(() => {
    searchGlobal.mockReset()
    searchGlobal.mockResolvedValue([])
    useLayoutStore.setState({ selectedHostId: null, activity: "home" })
  })

  it("renders a search field in the chrome", () => {
    renderBar()
    expect(
      screen.getByRole("combobox", { name: /search hosts/i }),
    ).toBeInTheDocument()
  })

  it("does not query the backend until something is typed", async () => {
    renderBar()
    await new Promise((r) => setTimeout(r, 200))
    expect(searchGlobal).not.toHaveBeenCalled()
  })

  it("debounces so a burst of keystrokes issues one query", async () => {
    renderBar()
    const input = screen.getByRole("combobox") as HTMLInputElement

    const { fireEvent } = await import("@testing-library/react")
    for (const value of ["c", "cl", "clo", "clou", "cloud"]) {
      fireEvent.change(input, { target: { value } })
    }

    await waitFor(() => expect(searchGlobal).toHaveBeenCalled(), { timeout: 1000 })
    expect(searchGlobal).toHaveBeenCalledTimes(1)
    expect(searchGlobal).toHaveBeenCalledWith("cloud")
  })

  it("shows results once they arrive", async () => {
    searchGlobal.mockResolvedValue([
      host("h1", "Cloud Plus VPN", "172.16.43.220"),
    ])
    renderBar()
    const { fireEvent } = await import("@testing-library/react")
    fireEvent.change(screen.getByRole("combobox"), {
      target: { value: "cloudplus" },
    })

    await waitFor(() => expect(screen.getByText("Cloud Plus VPN")).toBeInTheDocument())
    expect(screen.getByText("172.16.43.220")).toBeInTheDocument()
  })

  it("selects a host on Enter and routes to it", async () => {
    searchGlobal.mockResolvedValue([host("host-42", "prod-db")])
    renderBar()
    const { fireEvent } = await import("@testing-library/react")
    const input = screen.getByRole("combobox")
    fireEvent.change(input, { target: { value: "prod" } })

    await waitFor(() => expect(screen.getByText("prod-db")).toBeInTheDocument())
    fireEvent.keyDown(input, { key: "Enter" })

    expect(useLayoutStore.getState().selectedHostId).toBe("host-42")
    // Lands on a host-scoped view rather than staying on Overview.
    expect(useLayoutStore.getState().activity).toBe("terminal")
  })

  it("moves the highlight with the arrow keys", async () => {
    searchGlobal.mockResolvedValue([
      host("a", "first"),
      host("b", "second"),
    ])
    renderBar()
    const { fireEvent } = await import("@testing-library/react")
    const input = screen.getByRole("combobox")
    fireEvent.change(input, { target: { value: "s" } })

    await waitFor(() => expect(screen.getByText("second")).toBeInTheDocument())
    const options = screen.getAllByRole("option")
    expect(options[0]).toHaveAttribute("aria-selected", "true")

    fireEvent.keyDown(input, { key: "ArrowDown" })
    expect(screen.getAllByRole("option")[1]).toHaveAttribute("aria-selected", "true")

    // Wraps around to the start.
    fireEvent.keyDown(input, { key: "ArrowDown" })
    expect(screen.getAllByRole("option")[0]).toHaveAttribute("aria-selected", "true")
  })

  it("reports when nothing matched", async () => {
    searchGlobal.mockResolvedValue([])
    renderBar()
    const { fireEvent } = await import("@testing-library/react")
    fireEvent.change(screen.getByRole("combobox"), {
      target: { value: "zzzz" },
    })
    await waitFor(() => expect(screen.getByText(/no matches/i)).toBeInTheDocument())
  })

  it("closes on Escape without navigating", async () => {
    searchGlobal.mockResolvedValue([host("h1", "prod-db")])
    renderBar()
    const { fireEvent } = await import("@testing-library/react")
    const input = screen.getByRole("combobox")
    fireEvent.change(input, { target: { value: "prod" } })
    await waitFor(() => expect(screen.getByText("prod-db")).toBeInTheDocument())

    fireEvent.keyDown(input, { key: "Escape" })
    await waitFor(() => expect(screen.queryByText("prod-db")).not.toBeInTheDocument())
    expect(useLayoutStore.getState().selectedHostId).toBeNull()
  })

  it("does not navigate for a non-host result", async () => {
    searchGlobal.mockResolvedValue([
      { kind: "snippet", id: "s1", title: "restart nginx", subtitle: null },
    ])
    renderBar()
    const { fireEvent } = await import("@testing-library/react")
    const input = screen.getByRole("combobox")
    fireEvent.change(input, { target: { value: "restart" } })
    await waitFor(() => expect(screen.getByText("restart nginx")).toBeInTheDocument())

    fireEvent.keyDown(input, { key: "Enter" })
    expect(useLayoutStore.getState().selectedHostId).toBeNull()
  })
})
