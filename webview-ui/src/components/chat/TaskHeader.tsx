import styled from "styled-components"

const Header = styled.div`
	display: flex;
	justify-content: space-between;
	align-items: center;
	padding: 12px 20px;
	border-bottom: 1px solid #1e2538;
	background: #0f1117;
`

const Logo = styled.div`
	display: flex;
	align-items: center;
	gap: 15px;
`

const WebsiteName = styled.span`
	color: white;
	font-size: 16px;
`

const SocialIcons = styled.div`
	display: flex;
	gap: 10px;
	margin-left: 15px;
`

const ActionIcons = styled.div`
	display: flex;
	gap: 15px;
`

const IconButton = styled.button`
	background: none;
	border: none;
	cursor: pointer;
	padding: 5px;
	opacity: 0.7;
	transition: opacity 0.2s;

	&:hover {
		opacity: 1;
	}

	img {
		width: 18px;
		height: 18px;
		filter: invert(1);
	}
`

const TaskHeader = () => {
	return (
		<Header>
			<Logo>
				<WebsiteName>www.neoyn.com</WebsiteName>
				<SocialIcons>
					<IconButton>
						<img src="icons/instagram.svg" alt="Instagram" />
					</IconButton>
					<IconButton>
						<img src="icons/twitter.svg" alt="Twitter" />
					</IconButton>
					<IconButton>
						<img src="icons/facebook.svg" alt="Facebook" />
					</IconButton>
				</SocialIcons>
			</Logo>
			<ActionIcons>
				<IconButton>
					<img src="icons/add.svg" alt="Add" />
				</IconButton>
				<IconButton>
					<img src="icons/history.svg" alt="History" />
				</IconButton>
				<IconButton>
					<img src="icons/refresh.svg" alt="Refresh" />
				</IconButton>
				<IconButton>
					<img src="icons/settings.svg" alt="Settings" />
				</IconButton>
			</ActionIcons>
		</Header>
	)
}

export default TaskHeader
