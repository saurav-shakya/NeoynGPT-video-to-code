export interface YouTubeVideoInfo {
	url: string
	videoId: string
	isValid: boolean
}

export class YouTubeHandler {
	private static URL_PATTERNS = [
		/(?:https?:\/\/)?(?:www\.)?youtube\.com\/watch\?v=([a-zA-Z0-9_-]{11})/,
		/(?:https?:\/\/)?youtu\.be\/([a-zA-Z0-9_-]{11})/,
		/(?:https?:\/\/)?(?:www\.)?youtube\.com\/embed\/([a-zA-Z0-9_-]{11})/,
		/(?:https?:\/\/)?(?:www\.)?youtube\.com\/shorts\/([a-zA-Z0-9_-]{11})/,
	]

	static isYouTubeUrl(text: string): boolean {
		return YouTubeHandler.URL_PATTERNS.some((pattern) => pattern.test(text))
	}

	static extractVideoInfo(url: string): YouTubeVideoInfo {
		for (const pattern of YouTubeHandler.URL_PATTERNS) {
			const match = url.match(pattern)
			if (match && match[1]) {
				return {
					url: url.trim(),
					videoId: match[1],
					isValid: true,
				}
			}
		}
		return { url: url.trim(), videoId: "", isValid: false }
	}

	static normalizeUrl(url: string): string {
		const info = YouTubeHandler.extractVideoInfo(url)
		if (info.isValid) {
			return `https://www.youtube.com/watch?v=${info.videoId}`
		}
		throw new Error("Invalid YouTube URL")
	}
}
