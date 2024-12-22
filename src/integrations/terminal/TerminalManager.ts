import * as vscode from "vscode"
import { arePathsEqual } from "../../utils/path"
import { mergePromise, TerminalProcess, TerminalProcessResultPromise } from "./TerminalProcess"
import { TerminalInfo, TerminalRegistry } from "./TerminalRegistry"
import pWaitFor from "p-wait-for"

export class TerminalManager {
	private terminalIds: Set<number> = new Set()
	private processes: Map<number, TerminalProcess> = new Map()
	private disposables: vscode.Disposable[] = []

	constructor() {
		let disposable: vscode.Disposable | undefined
		try {
			const window = vscode.window as any
			if (window.onDidStartTerminalShellExecution) {
				disposable = window.onDidStartTerminalShellExecution(async (e: any) => {
					if (e?.execution?.read) {
						e.execution.read()
					}
				})
			}
		} catch (error) {
			// Ignore error
		}
		if (disposable) {
			this.disposables.push(disposable)
		}
	}

	runCommand(terminalInfo: TerminalInfo, command: string): TerminalProcessResultPromise {
		terminalInfo.busy = true
		terminalInfo.lastCommand = command
		const process = new TerminalProcess()
		this.processes.set(terminalInfo.id, process)

		process.once("completed", () => {
			terminalInfo.busy = false
		})

		process.once("no_shell_integration", () => {
			console.log(`no_shell_integration received for terminal ${terminalInfo.id}`)
			TerminalRegistry.removeTerminal(terminalInfo.id)
			this.terminalIds.delete(terminalInfo.id)
			this.processes.delete(terminalInfo.id)
		})

		const promise = new Promise<void>((resolve, reject) => {
			process.once("continue", () => {
				resolve()
			})
			process.once("error", (error) => {
				console.error(`Error in terminal ${terminalInfo.id}:`, error)
				reject(error)
			})
		})

		const terminal = terminalInfo.terminal as any
		if (terminal.shellIntegration) {
			process.waitForShellIntegration = false
			process.run(terminalInfo.terminal, command)
		} else {
			pWaitFor(() => {
				return (terminalInfo.terminal as any).shellIntegration !== undefined
			}, { timeout: 4000 }).finally(() => {
				const existingProcess = this.processes.get(terminalInfo.id)
				if (existingProcess && existingProcess.waitForShellIntegration) {
					existingProcess.waitForShellIntegration = false
					existingProcess.run(terminalInfo.terminal, command)
				}
			})
		}

		return mergePromise(process, promise)
	}

	async getOrCreateTerminal(cwd: string): Promise<TerminalInfo> {
		const availableTerminal = TerminalRegistry.getAllTerminals().find((t) => {
			if (t.busy) {
				return false
			}
			const terminal = t.terminal as any
			const terminalCwd = terminal.shellIntegration?.cwd
			if (!terminalCwd) {
				return false
			}
			return arePathsEqual(vscode.Uri.file(cwd).fsPath, terminalCwd.fsPath)
		})
		if (availableTerminal) {
			this.terminalIds.add(availableTerminal.id)
			return availableTerminal
		}

		const newTerminalInfo = TerminalRegistry.createTerminal(cwd)
		this.terminalIds.add(newTerminalInfo.id)
		return newTerminalInfo
	}

	getTerminals(busy: boolean): { id: number; lastCommand: string }[] {
		return Array.from(this.terminalIds)
			.map((id) => TerminalRegistry.getTerminal(id))
			.filter((t): t is TerminalInfo => t !== undefined && t.busy === busy)
			.map((t) => ({ id: t.id, lastCommand: t.lastCommand }))
	}

	getUnretrievedOutput(terminalId: number): string {
		if (!this.terminalIds.has(terminalId)) {
			return ""
		}
		const process = this.processes.get(terminalId)
		return process ? process.getUnretrievedOutput() : ""
	}

	isProcessHot(terminalId: number): boolean {
		const process = this.processes.get(terminalId)
		return process ? process.isHot : false
	}

	disposeAll() {
		this.terminalIds.clear()
		this.processes.clear()
		this.disposables.forEach((disposable) => disposable.dispose())
		this.disposables = []
	}
}
