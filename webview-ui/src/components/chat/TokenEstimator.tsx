import React, { useMemo } from "react"
import styled from "styled-components"

interface TokenEstimatorProps {
	durationSeconds?: number
	resolution: "default" | "low"
	modelId: string
}

const TOKENS_PER_FRAME_DEFAULT = 258
const TOKENS_PER_FRAME_LOW = 66
const AUDIO_TOKENS_PER_SECOND = 32

const PRICING: Record<string, number> = {
	"gemini-2.5-pro": 1.25,
	"gemini-2.5-flash": 0.15,
	"gemini-2.5-flash-lite": 0.075,
	"gemini-2.0-flash": 0.10,
}

const Container = styled.div`
	display: flex;
	flex-wrap: wrap;
	gap: 8px;
	padding: 6px 10px;
	margin: 0 5px 6px 5px;
	border-radius: 6px;
	background: rgba(255, 255, 255, 0.03);
	border: 1px solid rgba(255, 255, 255, 0.06);
	font-size: 11px;
	color: #8e8e8e;
`

const Stat = styled.span<{ $warning?: boolean }>`
	color: ${(p) => (p.$warning ? "#ff9800" : "#aaa")};
`

const TokenEstimator: React.FC<TokenEstimatorProps> = ({ durationSeconds, resolution, modelId }) => {
	const estimate = useMemo(() => {
		if (!durationSeconds || durationSeconds <= 0) return null

		const tokensPerFrame = resolution === "low" ? TOKENS_PER_FRAME_LOW : TOKENS_PER_FRAME_DEFAULT
		const visualTokens = Math.ceil(durationSeconds * 1 * tokensPerFrame)
		const audioTokens = Math.ceil(durationSeconds * AUDIO_TOKENS_PER_SECOND)
		const totalTokens = visualTokens + audioTokens

		const pricePerMillion = PRICING[modelId] || PRICING["gemini-2.5-flash"]
		const cost = (totalTokens / 1_000_000) * pricePerMillion

		const maxContext = 1_048_576
		const withinLimit = totalTokens < maxContext

		return { totalTokens, cost, withinLimit }
	}, [durationSeconds, resolution, modelId])

	if (!estimate) return null

	const tokenStr =
		estimate.totalTokens >= 1_000_000
			? `${(estimate.totalTokens / 1_000_000).toFixed(1)}M`
			: estimate.totalTokens >= 1_000
			? `${(estimate.totalTokens / 1_000).toFixed(0)}K`
			: `${estimate.totalTokens}`

	const costStr = estimate.cost < 0.01 ? "<$0.01" : `~$${estimate.cost.toFixed(2)}`

	return (
		<Container>
			<Stat>Est. {tokenStr} tokens</Stat>
			<Stat>{costStr} input cost</Stat>
			{!estimate.withinLimit && (
				<Stat $warning>Exceeds 1M context — use shorter clip or low resolution</Stat>
			)}
		</Container>
	)
}

export default TokenEstimator
