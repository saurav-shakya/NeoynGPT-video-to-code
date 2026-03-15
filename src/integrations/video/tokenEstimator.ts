export interface TokenEstimate {
	visualTokens: number
	audioTokens: number
	totalTokens: number
	estimatedCost: { input: number }
	withinContextWindow: boolean
	maxContextWindow: number
}

const TOKENS_PER_FRAME_DEFAULT = 258
const TOKENS_PER_FRAME_LOW = 66
const AUDIO_TOKENS_PER_SECOND = 32
const DEFAULT_FPS = 1

export function estimateVideoTokens(
	durationSeconds: number,
	resolution: "default" | "low" = "default",
	fps: number = DEFAULT_FPS,
): { visualTokens: number; audioTokens: number; totalTokens: number } {
	const tokensPerFrame = resolution === "low" ? TOKENS_PER_FRAME_LOW : TOKENS_PER_FRAME_DEFAULT
	const visualTokens = Math.ceil(durationSeconds * fps * tokensPerFrame)
	const audioTokens = Math.ceil(durationSeconds * AUDIO_TOKENS_PER_SECOND)
	return {
		visualTokens,
		audioTokens,
		totalTokens: visualTokens + audioTokens,
	}
}

export function estimateFullAnalysis(
	durationSeconds: number,
	resolution: "default" | "low" = "default",
	modelId: string = "gemini-2.5-flash",
): TokenEstimate {
	const { visualTokens, audioTokens, totalTokens } = estimateVideoTokens(durationSeconds, resolution)

	const pricing: Record<string, { input: number; contextWindow: number }> = {
		"gemini-2.5-pro": { input: 1.25, contextWindow: 1_048_576 },
		"gemini-2.5-flash": { input: 0.15, contextWindow: 1_048_576 },
		"gemini-2.5-flash-lite": { input: 0.075, contextWindow: 1_048_576 },
		"gemini-2.0-flash": { input: 0.10, contextWindow: 1_048_576 },
	}

	const modelPricing = pricing[modelId] || pricing["gemini-2.5-flash"]
	const inputCost = (totalTokens / 1_000_000) * modelPricing.input

	return {
		visualTokens,
		audioTokens,
		totalTokens,
		estimatedCost: { input: inputCost },
		withinContextWindow: totalTokens < modelPricing.contextWindow,
		maxContextWindow: modelPricing.contextWindow,
	}
}

export function formatTokenEstimate(estimate: TokenEstimate): string {
	const tokens = estimate.totalTokens
	let tokenStr: string
	if (tokens >= 1_000_000) {
		tokenStr = `${(tokens / 1_000_000).toFixed(1)}M`
	} else if (tokens >= 1_000) {
		tokenStr = `${(tokens / 1_000).toFixed(0)}K`
	} else {
		tokenStr = `${tokens}`
	}

	const costStr = estimate.estimatedCost.input < 0.01
		? `<$0.01`
		: `~$${estimate.estimatedCost.input.toFixed(2)}`

	const warning = estimate.withinContextWindow ? "" : " (exceeds context window!)"

	return `${tokenStr} tokens, ${costStr}${warning}`
}

export function getMaxVideoDuration(resolution: "default" | "low", contextWindow: number = 1_048_576): number {
	const tokensPerSecond = resolution === "low"
		? TOKENS_PER_FRAME_LOW + AUDIO_TOKENS_PER_SECOND  // ~98/s
		: TOKENS_PER_FRAME_DEFAULT + AUDIO_TOKENS_PER_SECOND  // ~290/s

	return Math.floor(contextWindow / tokensPerSecond)
}

export function formatDuration(seconds: number): string {
	const h = Math.floor(seconds / 3600)
	const m = Math.floor((seconds % 3600) / 60)
	if (h > 0) {
		return `${h}h ${m}m`
	}
	return `${m}m`
}
