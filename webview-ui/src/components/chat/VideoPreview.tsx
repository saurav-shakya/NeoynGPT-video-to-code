import React from "react"
import styled from "styled-components"

interface VideoInfo {
	uri: string
	mimeType: string
	name: string
	displayName: string
	sizeBytes?: string
}

interface VideoPreviewProps {
	video?: VideoInfo | null
	uploadStatus?: string | null
	isUploading: boolean
	youtubeUrl?: string | null
	onRemove: () => void
}

const Container = styled.div`
	display: flex;
	align-items: center;
	gap: 8px;
	padding: 6px 10px;
	margin: 0 5px 6px 5px;
	border-radius: 6px;
	background: rgba(74, 144, 226, 0.1);
	border: 1px solid rgba(74, 144, 226, 0.3);
	font-size: 12px;
	color: #ccc;
`

const VideoIcon = styled.span`
	font-size: 16px;
	flex-shrink: 0;
`

const Info = styled.div`
	flex: 1;
	min-width: 0;
	overflow: hidden;
`

const FileName = styled.div`
	font-weight: 500;
	white-space: nowrap;
	overflow: hidden;
	text-overflow: ellipsis;
	color: #e0e0e0;
`

const StatusText = styled.div<{ $isError?: boolean }>`
	font-size: 11px;
	color: ${(p) => (p.$isError ? "#ef5350" : "#8e8e8e")};
	margin-top: 2px;
`

const RemoveButton = styled.button`
	background: none;
	border: none;
	color: #8e8e8e;
	cursor: pointer;
	padding: 2px 4px;
	font-size: 14px;
	line-height: 1;
	flex-shrink: 0;
	border-radius: 3px;

	&:hover {
		color: #ef5350;
		background: rgba(239, 83, 80, 0.1);
	}
`

const Spinner = styled.span`
	display: inline-block;
	width: 12px;
	height: 12px;
	border: 2px solid rgba(74, 144, 226, 0.3);
	border-top-color: #4a90e2;
	border-radius: 50%;
	animation: spin 0.8s linear infinite;
	flex-shrink: 0;

	@keyframes spin {
		to {
			transform: rotate(360deg);
		}
	}
`

const ReadyBadge = styled.span`
	font-size: 10px;
	padding: 1px 6px;
	border-radius: 3px;
	background: rgba(76, 175, 80, 0.2);
	color: #4caf50;
	flex-shrink: 0;
`

function formatBytes(bytes?: string): string {
	if (!bytes) return ""
	const b = parseInt(bytes, 10)
	if (isNaN(b)) return ""
	if (b < 1024) return `${b} B`
	if (b < 1024 * 1024) return `${(b / 1024).toFixed(1)} KB`
	return `${(b / (1024 * 1024)).toFixed(1)} MB`
}

const VideoPreview: React.FC<VideoPreviewProps> = ({ video, uploadStatus, isUploading, youtubeUrl, onRemove }) => {
	if (!video && !isUploading && !youtubeUrl) return null

	const displayName = youtubeUrl ? youtubeUrl : video?.displayName || "Video"
	const sizeText = video?.sizeBytes ? ` (${formatBytes(video.sizeBytes)})` : ""

	return (
		<Container>
			<VideoIcon>{youtubeUrl ? "\u25B6" : "\uD83C\uDFA5"}</VideoIcon>
			<Info>
				<FileName>
					{displayName}
					{sizeText}
				</FileName>
				{isUploading && uploadStatus && <StatusText>{uploadStatus}</StatusText>}
				{!isUploading && video && <StatusText>Ready for analysis</StatusText>}
				{youtubeUrl && !video && <StatusText>YouTube video attached</StatusText>}
			</Info>
			{isUploading ? <Spinner /> : video ? <ReadyBadge>Ready</ReadyBadge> : null}
			{!isUploading && <RemoveButton onClick={onRemove} title="Remove video">{"\u2715"}</RemoveButton>}
		</Container>
	)
}

export default VideoPreview
