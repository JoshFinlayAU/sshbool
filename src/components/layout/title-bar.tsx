import { OmniSearch } from "@/components/layout/omni-search"
import { WindowChrome } from "@/components/layout/window-chrome"

/** Main-window title bar — shared chrome compound, with search in the centre. */
export function TitleBar() {
  return (
    <WindowChrome>
      <OmniSearch />
    </WindowChrome>
  )
}
