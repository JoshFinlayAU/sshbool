import { useQuery } from "@tanstack/react-query"
import { ReactNode, useEffect } from "react"
import { ipc } from "@/lib/ipc/commands"

const ALLOWED_FONTS = new Set([
  "Inter",
  "Roboto",
  "Ubuntu",
  "JetBrains Mono",
  "Fira Code",
  "Source Code Pro",
  "Cascadia Code",
  "Noto Sans Arabic",
  "IBM Plex Mono",
  "Geist",
  "system-ui",
  "monospace",
  "sans-serif",
  "serif",
])

function sanitizeFontName(font?: string | null): string | null {
  if (!font) return null
  const trimmed = font.trim()
  if (ALLOWED_FONTS.has(trimmed)) {
    return trimmed
  }
  // Sanitize fallback to basic alphanumeric with spaces only
  const safe = trimmed.replace(/[^a-zA-Z0-9 -]/g, "")
  return safe.length > 0 ? safe : null
}

export function FontProvider({ children }: { children: ReactNode }) {
  const appFont = useQuery({
    queryKey: ["settings", "appFont"],
    queryFn: () => ipc.settingsGet("appFont") as Promise<string | null>,
  })

  const appFontName = sanitizeFontName(appFont.data)

  useEffect(() => {
    if (appFontName) {
      document.documentElement.style.setProperty(
        "--font-sans",
        `"${appFontName}", system-ui, sans-serif`
      )
    } else {
      document.documentElement.style.removeProperty("--font-sans")
    }
  }, [appFontName])

  return <>{children}</>
}
