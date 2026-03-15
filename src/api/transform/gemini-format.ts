import { Anthropic } from "@anthropic-ai/sdk"
import { Content, Part } from "@google/genai"

export function convertAnthropicContentToGeminiParts(
	content:
		| string
		| Array<
				| Anthropic.Messages.TextBlockParam
				| Anthropic.Messages.ImageBlockParam
				| Anthropic.Messages.ToolUseBlockParam
				| Anthropic.Messages.ToolResultBlockParam
		  >,
): Part[] {
	if (typeof content === "string") {
		return [{ text: content }]
	}
	return content.flatMap((block): Part | Part[] => {
		switch (block.type) {
			case "text":
				return { text: block.text }
			case "image":
				if (block.source.type !== "base64") {
					throw new Error("Unsupported image source type")
				}
				return {
					inlineData: {
						data: block.source.data,
						mimeType: block.source.media_type,
					},
				}
			case "tool_use":
				return {
					functionCall: {
						name: block.name,
						args: block.input as Record<string, unknown>,
					},
				}
			case "tool_result":
				const name = block.tool_use_id.split("-")[0]
				if (!block.content) {
					return []
				}
				if (typeof block.content === "string") {
					return {
						functionResponse: {
							name,
							response: {
								name,
								content: block.content,
							},
						},
					}
				} else {
					const textParts = block.content.filter((part) => part.type === "text")
					const imageParts = block.content.filter((part) => part.type === "image")
					const text = textParts.length > 0 ? textParts.map((part) => part.text).join("\n\n") : ""
					const imageText = imageParts.length > 0 ? "\n\n(See next part for image)" : ""
					return [
						{
							functionResponse: {
								name,
								response: {
									name,
									content: text + imageText,
								},
							},
						},
						...imageParts.map(
							(part): Part => ({
								inlineData: {
									data: part.source.data,
									mimeType: part.source.media_type,
								},
							}),
						),
					]
				}
			default:
				throw new Error(`Unsupported content block type: ${(block as any).type}`)
		}
	})
}

export function convertAnthropicMessageToGeminiContent(message: Anthropic.Messages.MessageParam): Content {
	return {
		role: message.role === "assistant" ? "model" : "user",
		parts: convertAnthropicContentToGeminiParts(message.content),
	}
}

/*
Gemini likes to double escape certain characters when writing file contents:
https://discuss.ai.google.dev/t/function-call-string-property-is-double-escaped/37867
*/
export function unescapeGeminiContent(content: string) {
	return content
		.replace(/\\n/g, "\n")
		.replace(/\\'/g, "'")
		.replace(/\\"/g, '"')
		.replace(/\\r/g, "\r")
		.replace(/\\t/g, "\t")
}
