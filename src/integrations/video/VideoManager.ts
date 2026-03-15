import { GoogleGenAI, createUserContent, createPartFromUri } from "@google/genai"

export interface VideoUploadOptions {
	filePath: string
	mimeType?: string
	displayName?: string
}

export interface VideoAnalysisOptions {
	prompt: string
	modelId?: string
	startOffset?: string // "MM:SS" format
	endOffset?: string // "MM:SS" format
	resolution?: "default" | "low"
}

export interface VideoUploadProgress {
	status: "uploading" | "processing" | "ready" | "failed"
	progress?: number // 0-100
	message?: string
}

export interface UploadedVideo {
	uri: string
	mimeType: string
	name: string
	displayName: string
	sizeBytes?: string
}

export class VideoManager {
	private ai: GoogleGenAI
	private onProgress?: (progress: VideoUploadProgress) => void

	constructor(apiKey: string) {
		this.ai = new GoogleGenAI({ apiKey })
	}

	setProgressCallback(callback: (progress: VideoUploadProgress) => void): void {
		this.onProgress = callback
	}

	async uploadLocalVideo(options: VideoUploadOptions): Promise<UploadedVideo> {
		this.emitProgress({ status: "uploading", progress: 0, message: "Starting upload..." })

		const mimeType = options.mimeType || this.getMimeType(options.filePath)
		const displayName = options.displayName || this.getFileName(options.filePath)

		const uploadResult = await this.ai.files.upload({
			file: options.filePath,
			config: { mimeType, displayName },
		})

		this.emitProgress({ status: "processing", message: "Video uploaded. Processing on Gemini servers..." })

		const file = await this.waitForProcessing(uploadResult.name!)

		this.emitProgress({ status: "ready", progress: 100, message: "Video ready for analysis" })

		return {
			uri: file.uri!,
			mimeType: file.mimeType!,
			name: file.name!,
			displayName: file.displayName || displayName,
			sizeBytes: file.sizeBytes?.toString(),
		}
	}

	async analyzeUploadedVideo(fileUri: string, fileMimeType: string, options: VideoAnalysisOptions): Promise<string> {
		const modelId = options.modelId || "gemini-2.5-flash"

		const parts: any[] = [createPartFromUri(fileUri, fileMimeType)]

		let prompt = options.prompt
		if (options.startOffset || options.endOffset) {
			prompt += `\n\nFocus your analysis on the segment from ${options.startOffset || "00:00"} to ${options.endOffset || "end"}.`
		}
		parts.push(prompt)

		const config: any = {}
		if (options.resolution === "low") {
			config.mediaResolution = "low"
		}

		return this.withRetry(async () => {
			const response = await this.ai.models.generateContent({
				model: modelId,
				contents: createUserContent(parts),
				config,
			})
			return response.text || ""
		})
	}

	async analyzeYouTubeVideo(youtubeUrl: string, options: VideoAnalysisOptions): Promise<string> {
		const modelId = options.modelId || "gemini-2.5-flash"

		const parts: any[] = [
			{
				fileData: {
					fileUri: youtubeUrl,
					mimeType: "video/*",
				},
			},
		]

		let prompt = options.prompt
		if (options.startOffset || options.endOffset) {
			prompt += `\n\nFocus your analysis on the segment from ${options.startOffset || "00:00"} to ${options.endOffset || "end"}.`
		}
		parts.push(prompt)

		const config: any = {}
		if (options.resolution === "low") {
			config.mediaResolution = "low"
		}

		return this.withRetry(async () => {
			const response = await this.ai.models.generateContent({
				model: modelId,
				contents: createUserContent(parts),
				config,
			})
			return response.text || ""
		})
	}

	async deleteVideo(fileName: string): Promise<void> {
		await this.ai.files.delete({ name: fileName })
	}

	private async withRetry<T>(fn: () => Promise<T>, maxRetries: number = 3): Promise<T> {
		let lastError: Error | undefined
		for (let attempt = 1; attempt <= maxRetries; attempt++) {
			try {
				return await fn()
			} catch (error: any) {
				lastError = error
				const isRetryable =
					error.message?.includes("429") ||
					error.message?.includes("503") ||
					error.message?.includes("500") ||
					error.message?.includes("RESOURCE_EXHAUSTED") ||
					error.message?.includes("UNAVAILABLE")
				if (!isRetryable || attempt === maxRetries) {
					throw error
				}
				const delay = Math.min(1000 * Math.pow(2, attempt - 1), 10000)
				await new Promise((resolve) => setTimeout(resolve, delay))
			}
		}
		throw lastError
	}

	private async waitForProcessing(fileName: string): Promise<any> {
		let file = await this.ai.files.get({ name: fileName })
		let pollCount = 0

		while (file.state === "PROCESSING") {
			pollCount++
			this.emitProgress({
				status: "processing",
				message: `Processing video... (${pollCount * 5}s elapsed)`,
			})
			await new Promise((resolve) => setTimeout(resolve, 5000))
			file = await this.ai.files.get({ name: fileName })
		}

		if (file.state === "FAILED") {
			this.emitProgress({ status: "failed", message: "Video processing failed" })
			throw new Error("Video processing failed on Gemini servers")
		}

		return file
	}

	private emitProgress(progress: VideoUploadProgress): void {
		this.onProgress?.(progress)
	}

	private getMimeType(filePath: string): string {
		const extension = filePath.split(".").pop()?.toLowerCase()
		const mimeTypes: Record<string, string> = {
			mp4: "video/mp4",
			mpeg: "video/mpeg",
			mov: "video/mov",
			avi: "video/avi",
			flv: "video/x-flv",
			mpg: "video/mpg",
			webm: "video/webm",
			wmv: "video/wmv",
			"3gp": "video/3gpp",
		}
		return mimeTypes[extension || ""] || "video/mp4"
	}

	private getFileName(filePath: string): string {
		return filePath.split(/[\\/]/).pop() || "uploaded_video"
	}
}
