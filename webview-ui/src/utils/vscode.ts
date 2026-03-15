interface WebviewApi<T = unknown> {
  postMessage(message: unknown): void
  getState(): T | undefined
  setState<S extends T | undefined>(newState: S): S
}

declare global {
  interface Window {
    acquireVsCodeApi: <T = unknown>() => WebviewApi<T>
  }
}

export const vscode = window.acquireVsCodeApi()
