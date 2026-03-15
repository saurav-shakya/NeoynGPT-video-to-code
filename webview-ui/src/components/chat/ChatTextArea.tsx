import React, { forwardRef, useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from "react"
import { mentionRegex, mentionRegexGlobal } from "../../../../src/shared/context-mentions"
import { useExtensionState } from "../../context/ExtensionStateContext"
import {
	ContextMenuOptionType,
	getContextMenuOptions,
	insertMention,
	removeMention,
	shouldShowContextMenu,
} from "../../utils/context-mentions"
import { MAX_IMAGES_PER_MESSAGE } from "./ChatView"
import { vscode } from "../../utils/vscode"
import VideoPreview from "./VideoPreview"
import styled from "styled-components"

interface VideoInfo {
	uri: string
	mimeType: string
	name: string
	displayName: string
	sizeBytes?: string
}

interface ChatTextAreaProps {
	inputValue: string
	setInputValue: (value: string) => void
	textAreaDisabled: boolean
	placeholderText: string
	selectedImages: string[]
	setSelectedImages: React.Dispatch<React.SetStateAction<string[]>>
	onSend: () => void
	onSelectImages: () => void
	shouldDisableImages: boolean
	onHeightChange?: (height: number) => void
	// Video props
	uploadedVideo?: VideoInfo | null
	videoUploadStatus?: string | null
	isVideoUploading: boolean
	youtubeUrl?: string | null
	onUploadVideo: () => void
	onRemoveVideo: () => void
	onYouTubeUrlDetected: (url: string | null) => void
}

const YOUTUBE_URL_REGEX = /(?:https?:\/\/)?(?:www\.)?(?:youtube\.com\/watch\?v=|youtu\.be\/|youtube\.com\/shorts\/|youtube\.com\/embed\/)[a-zA-Z0-9_-]{11}/

const InputSection = styled.div`
	padding: 10px 15px 15px 15px;
	background-color: #1a1f2e;
`

const InputContainer = styled.div`
	display: flex;
	flex-direction: column;
	gap: 0;
`

const TextAreaWrapper = styled.div`
	position: relative;
	display: flex;
	align-items: flex-end;
	background: #1e2538;
	border-radius: 8px;
	padding: 8px 10px;
	margin: 0 5px;
`

const StyledTextArea = styled.textarea`
	flex: 1;
	background: none;
	border: none;
	color: #e0e0e0;
	padding: 4px 8px;
	font-size: 13px;
	outline: none;
	resize: none;
	min-height: 20px;
	max-height: 150px;
	line-height: 1.4;
	font-family: inherit;
	overflow-y: auto;

	&::placeholder {
		color: #8e8e8e;
	}
`

const ToolbarRow = styled.div`
	display: flex;
	align-items: center;
	gap: 4px;
	flex-shrink: 0;
`

const IconButton = styled.button<{ $active?: boolean; $disabled?: boolean }>`
	background: ${(p) => (p.$active ? "rgba(74, 144, 226, 0.2)" : "none")};
	border: ${(p) => (p.$active ? "1px solid rgba(74, 144, 226, 0.4)" : "1px solid transparent")};
	cursor: ${(p) => (p.$disabled ? "not-allowed" : "pointer")};
	padding: 4px 6px;
	opacity: ${(p) => (p.$disabled ? 0.3 : 0.7)};
	transition: all 0.15s;
	border-radius: 4px;
	display: flex;
	align-items: center;
	justify-content: center;

	&:hover {
		opacity: ${(p) => (p.$disabled ? 0.3 : 1)};
		background: ${(p) => (p.$disabled ? "none" : "rgba(255,255,255,0.05)")};
	}

	span {
		font-size: 16px;
	}
`

const SendButton = styled.button<{ $hasContent?: boolean }>`
	background: ${(p) => (p.$hasContent ? "linear-gradient(135deg, #4a90e2, #a64be1)" : "rgba(255,255,255,0.05)")};
	border: none;
	cursor: ${(p) => (p.$hasContent ? "pointer" : "default")};
	padding: 4px 8px;
	border-radius: 4px;
	display: flex;
	align-items: center;
	justify-content: center;
	transition: all 0.15s;
	margin-left: 4px;

	&:hover {
		opacity: ${(p) => (p.$hasContent ? 0.9 : 1)};
	}

	span {
		font-size: 16px;
		color: ${(p) => (p.$hasContent ? "#fff" : "#8e8e8e")};
	}
`

const YouTubeBadge = styled.span`
	font-size: 10px;
	padding: 2px 6px;
	border-radius: 3px;
	background: rgba(255, 0, 0, 0.15);
	color: #ff4444;
	margin-left: 4px;
	white-space: nowrap;
`

const ChatTextArea = forwardRef<HTMLTextAreaElement, ChatTextAreaProps>(
	(
		{
			inputValue,
			setInputValue,
			textAreaDisabled,
			placeholderText,
			selectedImages,
			setSelectedImages,
			onSend,
			onSelectImages,
			shouldDisableImages,
			onHeightChange,
			uploadedVideo,
			videoUploadStatus,
			isVideoUploading,
			youtubeUrl,
			onUploadVideo,
			onRemoveVideo,
			onYouTubeUrlDetected,
		},
		ref,
	) => {
		const { filePaths } = useExtensionState()
		const [showContextMenu, setShowContextMenu] = useState(false)
		const [cursorPosition, setCursorPosition] = useState(0)
		const [searchQuery, setSearchQuery] = useState("")
		const textAreaRef = useRef<HTMLTextAreaElement | null>(null)
		const [isMouseDownOnMenu, setIsMouseDownOnMenu] = useState(false)
		const highlightLayerRef = useRef<HTMLDivElement>(null)
		const [selectedMenuIndex, setSelectedMenuIndex] = useState(-1)
		const [selectedType, setSelectedType] = useState<ContextMenuOptionType | null>(null)
		const [justDeletedSpaceAfterMention, setJustDeletedSpaceAfterMention] = useState(false)
		const [intendedCursorPosition, setIntendedCursorPosition] = useState<number | null>(null)
		const contextMenuContainerRef = useRef<HTMLDivElement>(null)

		const queryItems = useMemo(() => {
			return [
				{ type: ContextMenuOptionType.Problems, value: "problems" },
				...filePaths
					.map((file) => "/" + file)
					.map((path) => ({
						type: path.endsWith("/") ? ContextMenuOptionType.Folder : ContextMenuOptionType.File,
						value: path,
					})),
			]
		}, [filePaths])

		useEffect(() => {
			const handleClickOutside = (event: MouseEvent) => {
				if (
					contextMenuContainerRef.current &&
					!contextMenuContainerRef.current.contains(event.target as Node)
				) {
					setShowContextMenu(false)
				}
			}

			if (showContextMenu) {
				document.addEventListener("mousedown", handleClickOutside)
			}

			return () => {
				document.removeEventListener("mousedown", handleClickOutside)
			}
		}, [showContextMenu, setShowContextMenu])

		// Auto-detect YouTube URLs in input
		useEffect(() => {
			const match = inputValue.match(YOUTUBE_URL_REGEX)
			if (match) {
				onYouTubeUrlDetected(match[0])
			} else {
				onYouTubeUrlDetected(null)
			}
		}, [inputValue, onYouTubeUrlDetected])

		// Auto-resize textarea
		useEffect(() => {
			if (textAreaRef.current) {
				textAreaRef.current.style.height = "auto"
				textAreaRef.current.style.height = Math.min(textAreaRef.current.scrollHeight, 150) + "px"
			}
		}, [inputValue])

		const handleMentionSelect = useCallback(
			(type: ContextMenuOptionType, value?: string) => {
				if (type === ContextMenuOptionType.NoResults) {
					return
				}

				if (type === ContextMenuOptionType.File || type === ContextMenuOptionType.Folder) {
					if (!value) {
						setSelectedType(type)
						setSearchQuery("")
						setSelectedMenuIndex(0)
						return
					}
				}

				setShowContextMenu(false)
				setSelectedType(null)
				if (textAreaRef.current) {
					let insertValue = value || ""
					if (type === ContextMenuOptionType.URL) {
						insertValue = value || ""
					} else if (type === ContextMenuOptionType.File || type === ContextMenuOptionType.Folder) {
						insertValue = value || ""
					} else if (type === ContextMenuOptionType.Problems) {
						insertValue = "problems"
					}

					const { newValue, mentionIndex } = insertMention(
						textAreaRef.current.value,
						cursorPosition,
						insertValue,
					)

					setInputValue(newValue)
					const newCursorPosition = newValue.indexOf(" ", mentionIndex + insertValue.length) + 1
					setCursorPosition(newCursorPosition)
					setIntendedCursorPosition(newCursorPosition)

					setTimeout(() => {
						if (textAreaRef.current) {
							textAreaRef.current.blur()
							textAreaRef.current.focus()
						}
					}, 0)
				}
			},
			[setInputValue, cursorPosition],
		)

		const handleKeyDown = useCallback(
			(event: React.KeyboardEvent<HTMLTextAreaElement>) => {
				if (showContextMenu) {
					if (event.key === "Escape") {
						setSelectedType(null)
						setSelectedMenuIndex(3)
						return
					}

					if (event.key === "ArrowUp" || event.key === "ArrowDown") {
						event.preventDefault()
						setSelectedMenuIndex((prevIndex) => {
							const direction = event.key === "ArrowUp" ? -1 : 1
							const options = getContextMenuOptions(searchQuery, selectedType, queryItems)
							const optionsLength = options.length

							if (optionsLength === 0) return prevIndex

							const selectableOptions = options.filter(
								(option) =>
									option.type !== ContextMenuOptionType.URL &&
									option.type !== ContextMenuOptionType.NoResults,
							)

							if (selectableOptions.length === 0) return -1

							const currentSelectableIndex = selectableOptions.findIndex(
								(option) => option === options[prevIndex],
							)

							const newSelectableIndex =
								(currentSelectableIndex + direction + selectableOptions.length) %
								selectableOptions.length

							return options.findIndex((option) => option === selectableOptions[newSelectableIndex])
						})
						return
					}
					if ((event.key === "Enter" || event.key === "Tab") && selectedMenuIndex !== -1) {
						event.preventDefault()
						const selectedOption = getContextMenuOptions(searchQuery, selectedType, queryItems)[
							selectedMenuIndex
						]
						if (
							selectedOption &&
							selectedOption.type !== ContextMenuOptionType.URL &&
							selectedOption.type !== ContextMenuOptionType.NoResults
						) {
							handleMentionSelect(selectedOption.type, selectedOption.value)
						}
						return
					}
				}

				const isComposing = event.nativeEvent?.isComposing ?? false
				if (event.key === "Enter" && !event.shiftKey && !isComposing) {
					event.preventDefault()
					onSend()
				}

				if (event.key === "Backspace" && !isComposing) {
					const charBeforeCursor = inputValue[cursorPosition - 1]
					const charAfterCursor = inputValue[cursorPosition + 1]

					const charBeforeIsWhitespace =
						charBeforeCursor === " " || charBeforeCursor === "\n" || charBeforeCursor === "\r\n"
					const charAfterIsWhitespace =
						charAfterCursor === " " || charAfterCursor === "\n" || charAfterCursor === "\r\n"
					if (
						charBeforeIsWhitespace &&
						inputValue.slice(0, cursorPosition - 1).match(new RegExp(mentionRegex.source + "$"))
					) {
						const newCursorPosition = cursorPosition - 1
						if (!charAfterIsWhitespace) {
							event.preventDefault()
							textAreaRef.current?.setSelectionRange(newCursorPosition, newCursorPosition)
							setCursorPosition(newCursorPosition)
						}
						setCursorPosition(newCursorPosition)
						setJustDeletedSpaceAfterMention(true)
					} else if (justDeletedSpaceAfterMention) {
						const { newText, newPosition } = removeMention(inputValue, cursorPosition)
						if (newText !== inputValue) {
							event.preventDefault()
							setInputValue(newText)
							setIntendedCursorPosition(newPosition)
						}
						setJustDeletedSpaceAfterMention(false)
						setShowContextMenu(false)
					} else {
						setJustDeletedSpaceAfterMention(false)
					}
				}
			},
			[
				onSend,
				showContextMenu,
				searchQuery,
				selectedMenuIndex,
				handleMentionSelect,
				selectedType,
				inputValue,
				cursorPosition,
				setInputValue,
				justDeletedSpaceAfterMention,
				queryItems,
			],
		)

		useLayoutEffect(() => {
			if (intendedCursorPosition !== null && textAreaRef.current) {
				textAreaRef.current.setSelectionRange(intendedCursorPosition, intendedCursorPosition)
				setIntendedCursorPosition(null)
			}
		}, [inputValue, intendedCursorPosition])

		const handleInputChange = useCallback(
			(e: React.ChangeEvent<HTMLTextAreaElement>) => {
				const newValue = e.target.value
				const newCursorPosition = e.target.selectionStart
				setInputValue(newValue)
				setCursorPosition(newCursorPosition)
				const showMenu = shouldShowContextMenu(newValue, newCursorPosition)

				setShowContextMenu(showMenu)
				if (showMenu) {
					const lastAtIndex = newValue.lastIndexOf("@", newCursorPosition - 1)
					const query = newValue.slice(lastAtIndex + 1, newCursorPosition)
					setSearchQuery(query)
					if (query.length > 0) {
						setSelectedMenuIndex(0)
					} else {
						setSelectedMenuIndex(3)
					}
				} else {
					setSearchQuery("")
					setSelectedMenuIndex(-1)
				}
			},
			[setInputValue],
		)

		useEffect(() => {
			if (!showContextMenu) {
				setSelectedType(null)
			}
		}, [showContextMenu])

		const handleBlur = useCallback(() => {
			if (!isMouseDownOnMenu) {
				setShowContextMenu(false)
			}
		}, [isMouseDownOnMenu])

		const handlePaste = useCallback(
			async (e: React.ClipboardEvent) => {
				const items = e.clipboardData.items

				const pastedText = e.clipboardData.getData("text")
				const urlRegex = /^\S+:\/\/\S+$/
				if (urlRegex.test(pastedText.trim())) {
					e.preventDefault()
					const trimmedUrl = pastedText.trim()
					const newValue =
						inputValue.slice(0, cursorPosition) + trimmedUrl + " " + inputValue.slice(cursorPosition)
					setInputValue(newValue)
					const newCursorPosition = cursorPosition + trimmedUrl.length + 1
					setCursorPosition(newCursorPosition)
					setIntendedCursorPosition(newCursorPosition)
					setShowContextMenu(false)

					setTimeout(() => {
						if (textAreaRef.current) {
							textAreaRef.current.blur()
							textAreaRef.current.focus()
						}
					}, 0)

					return
				}

				const acceptedTypes = ["png", "jpeg", "webp"]
				const imageItems = Array.from(items).filter((item) => {
					const [type, subtype] = item.type.split("/")
					return type === "image" && acceptedTypes.includes(subtype)
				})
				if (!shouldDisableImages && imageItems.length > 0) {
					e.preventDefault()
					const imagePromises = imageItems.map((item) => {
						return new Promise<string | null>((resolve) => {
							const blob = item.getAsFile()
							if (!blob) {
								resolve(null)
								return
							}
							const reader = new FileReader()
							reader.onloadend = () => {
								if (reader.error) {
									console.error("Error reading file:", reader.error)
									resolve(null)
								} else {
									const result = reader.result
									resolve(typeof result === "string" ? result : null)
								}
							}
							reader.readAsDataURL(blob)
						})
					})
					const imageDataArray = await Promise.all(imagePromises)
					const dataUrls = imageDataArray.filter((dataUrl): dataUrl is string => dataUrl !== null)
					if (dataUrls.length > 0) {
						setSelectedImages((prevImages) => [...prevImages, ...dataUrls].slice(0, MAX_IMAGES_PER_MESSAGE))
					} else {
						console.warn("No valid images were processed")
					}
				}
			},
			[shouldDisableImages, setSelectedImages, cursorPosition, setInputValue, inputValue],
		)

		const handleMenuMouseDown = useCallback(() => {
			setIsMouseDownOnMenu(true)
		}, [])

		const updateHighlights = useCallback(() => {
			if (!textAreaRef.current || !highlightLayerRef.current) return

			const text = textAreaRef.current.value

			highlightLayerRef.current.innerHTML = text
				.replace(/\n$/, "\n\n")
				.replace(/[<>&]/g, (c) => ({ "<": "&lt;", ">": "&gt;", "&": "&amp;" })[c] || c)
				.replace(mentionRegexGlobal, '<mark class="mention-context-textarea-highlight">$&</mark>')

			highlightLayerRef.current.scrollTop = textAreaRef.current.scrollTop
			highlightLayerRef.current.scrollLeft = textAreaRef.current.scrollLeft
		}, [])

		useLayoutEffect(() => {
			updateHighlights()
		}, [inputValue, updateHighlights])

		const updateCursorPosition = useCallback(() => {
			if (textAreaRef.current) {
				setCursorPosition(textAreaRef.current.selectionStart)
			}
		}, [])

		const handleKeyUp = useCallback(
			(e: React.KeyboardEvent<HTMLTextAreaElement>) => {
				if (["ArrowLeft", "ArrowRight", "ArrowUp", "ArrowDown", "Home", "End"].includes(e.key)) {
					updateCursorPosition()
				}
			},
			[updateCursorPosition],
		)

		const hasVideo = !!(uploadedVideo || youtubeUrl)
		const hasContent = inputValue.trim().length > 0 || selectedImages.length > 0 || hasVideo

		return (
			<InputSection>
				<InputContainer>
					{/* Video preview */}
					<VideoPreview
						video={uploadedVideo}
						uploadStatus={videoUploadStatus}
						isUploading={isVideoUploading}
						youtubeUrl={youtubeUrl}
						onRemove={onRemoveVideo}
					/>

					<TextAreaWrapper>
						<StyledTextArea
							ref={(el) => {
								textAreaRef.current = el
								if (typeof ref === "function") {
									ref(el)
								} else if (ref) {
									ref.current = el
								}
							}}
							value={inputValue}
							onChange={handleInputChange}
							onKeyDown={handleKeyDown}
							onKeyUp={handleKeyUp}
							onBlur={handleBlur}
							onPaste={handlePaste}
							placeholder={placeholderText}
							disabled={textAreaDisabled}
							rows={1}
						/>
						<ToolbarRow>
							{/* Video upload button */}
							<IconButton
								onClick={onUploadVideo}
								$active={hasVideo}
								$disabled={textAreaDisabled || isVideoUploading}
								title="Upload video for analysis"
							>
								<span className="codicon codicon-device-camera-video"></span>
							</IconButton>

							{/* Image button */}
							<IconButton
								onClick={onSelectImages}
								$disabled={shouldDisableImages}
								title="Attach images"
							>
								<span className="codicon codicon-file-media"></span>
							</IconButton>

							{/* @ mention button */}
							<IconButton
								onClick={() => {
									if (textAreaRef.current) {
										const pos = textAreaRef.current.selectionStart
										const newValue = inputValue.slice(0, pos) + "@" + inputValue.slice(pos)
										setInputValue(newValue)
										setCursorPosition(pos + 1)
										setIntendedCursorPosition(pos + 1)
										setShowContextMenu(true)
										setSearchQuery("")
										setSelectedMenuIndex(3)
										textAreaRef.current.focus()
									}
								}}
								$disabled={textAreaDisabled}
								title="Reference files with @"
							>
								<span className="codicon codicon-mention"></span>
							</IconButton>

							{/* YouTube detected badge */}
							{youtubeUrl && <YouTubeBadge>YT</YouTubeBadge>}

							{/* Send button */}
							<SendButton
								onClick={onSend}
								$hasContent={hasContent && !textAreaDisabled}
								disabled={!hasContent || textAreaDisabled}
								title="Send message"
							>
								<span className="codicon codicon-send"></span>
							</SendButton>
						</ToolbarRow>
					</TextAreaWrapper>
				</InputContainer>
			</InputSection>
		)
	},
)

export default ChatTextArea
