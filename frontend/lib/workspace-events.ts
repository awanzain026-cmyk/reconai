// Cross-component signal that workspace data changed (an exception resolved,
// a manual match made, an upload removed...). Components that show derived
// counts — like the sidebar's open-exception badge — listen and refresh.

export const WORKSPACE_CHANGED_EVENT = "reconai:workspace-changed"

export function notifyWorkspaceChanged() {
  if (typeof window === "undefined") return
  window.dispatchEvent(new CustomEvent(WORKSPACE_CHANGED_EVENT))
}
