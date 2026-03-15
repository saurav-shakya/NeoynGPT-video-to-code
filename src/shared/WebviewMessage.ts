import { ApiConfiguration, ApiProvider } from "./api"

export interface WebviewMessage {
	type:
		| "newTask"
		| "askResponse"
		| "clearTask"
		| "didShowAnnouncement"
		| "selectImages"
		| "exportCurrentTask"
		| "showTaskWithId"
		| "deleteTaskWithId"
		| "exportTaskWithId"
		| "resetState"
		| "apiConfiguration"
		| "customInstructions"
		| "alwaysAllowReadOnly"
		| "webviewDidLaunch"
		| "openInNewTab"
		| "openMention"
		| "cancelTask"
		// Video messages
		| "uploadVideo"
		| "analyzeVideo"
		| "analyzeYouTubeVideo"
		| "clearVideo"
		| "sendMessage"
	text?: string
	askResponse?: ClineAskResponse
	apiConfiguration?: ApiConfiguration
	images?: string[]
	bool?: boolean
	hasVideo?: boolean
}

export type ClineAskResponse = "yesButtonClicked" | "noButtonClicked" | "messageResponse"
