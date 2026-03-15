import { Anthropic } from "@anthropic-ai/sdk"
import { GoogleGenAI } from "@google/genai"
import { ApiHandler } from "../"
import { ApiHandlerOptions, geminiDefaultModelId, GeminiModelId, geminiModels, ModelInfo } from "../../shared/api"
import { convertAnthropicMessageToGeminiContent } from "../transform/gemini-format"
import { ApiStream } from "../transform/stream"

export class GeminiHandler implements ApiHandler {
	private options: ApiHandlerOptions
	private client: GoogleGenAI

	constructor(options: ApiHandlerOptions) {
		if (!options.geminiApiKey) {
			throw new Error("API key is required for Google Gemini")
		}
		this.options = options
		this.client = new GoogleGenAI({ apiKey: options.geminiApiKey })
	}

	async *createMessage(systemPrompt: string, messages: Anthropic.Messages.MessageParam[]): ApiStream {
		const modelId = this.getModel().id

		const contents = messages.map(convertAnthropicMessageToGeminiContent)

		const response = await this.client.models.generateContentStream({
			model: modelId,
			contents,
			config: {
				systemInstruction: systemPrompt,
				temperature: 0,
			},
		})

		let inputTokens = 0
		let outputTokens = 0

		for await (const chunk of response) {
			const text = chunk.text
			if (text) {
				yield {
					type: "text",
					text,
				}
			}
			if (chunk.usageMetadata) {
				inputTokens = chunk.usageMetadata.promptTokenCount ?? 0
				outputTokens = chunk.usageMetadata.candidatesTokenCount ?? 0
			}
		}

		yield {
			type: "usage",
			inputTokens,
			outputTokens,
		}
	}

	getModel(): { id: GeminiModelId; info: ModelInfo } {
		const modelId = this.options.apiModelId
		if (modelId && modelId in geminiModels) {
			const id = modelId as GeminiModelId
			return { id, info: geminiModels[id] }
		}
		return { id: geminiDefaultModelId, info: geminiModels[geminiDefaultModelId] }
	}
}
