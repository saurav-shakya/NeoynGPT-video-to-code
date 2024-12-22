import { ApiConfiguration, ApiProvider } from "./api"

export interface WebviewMessage {
	type: string;
	text?: string;
	hasVideo?: boolean;
	apiConfiguration?: any;
	bool?: boolean;
	askResponse?: any;
	images?: any[];
	// ... other existing properties ...
}

export type ClineAskResponse = "yesButtonClicked" | "noButtonClicked" | "messageResponse"
