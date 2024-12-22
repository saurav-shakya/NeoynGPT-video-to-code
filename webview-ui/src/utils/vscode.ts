import type { WebviewApi } from "vscode-webview"

declare global {
  interface Window {
    acquireVsCodeApi: <T = unknown>() => WebviewApi<T>
  }
}

export const vscode = window.acquireVsCodeApi()
