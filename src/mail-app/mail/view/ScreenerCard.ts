import m, { Children, Component, Vnode } from "mithril"
import { assertMainOrNode } from "../../../common/api/common/Env.js"
import { Mail } from "../../../common/api/entities/tutanota/TypeRefs.js"
import { MailDestination } from "../model/MailClassifier.js"
import { Button, ButtonColor, ButtonType } from "../../../common/gui/base/Button.js"
import { Icons } from "../../../common/gui/base/icons/Icons.js"
import { formatDateWithMonth, formatDateWithWeekday } from "../../../common/misc/Formatter.js"
import { px, size } from "../../../common/gui/size.js"
import { theme } from "../../../common/gui/theme.js"
import { getMailBodyText } from "./MailViewerUtils.js"
import { lang } from "../../../common/misc/LanguageViewModel.js"

assertMainOrNode()

export interface ScreenerCardAttrs {
	mail: Mail
	selected: boolean
	onSelect: () => void
	onClassify: (destination: MailDestination) => Promise<void>
	onSkip: () => void
}

/**
 * A card component for displaying a single email in the Screener.
 * Shows sender, subject, preview, and classification actions.
 */
export class ScreenerCard implements Component<ScreenerCardAttrs> {
	private expanded: boolean = false
	private classifying: boolean = false

	view({ attrs }: Vnode<ScreenerCardAttrs>): Children {
		const { mail, selected, onSelect } = attrs

		return m(
			".screener-card.mb",
			{
				style: {
					backgroundColor: selected ? theme.list_bg_selected : theme.elevated_bg,
					border: `1px solid ${selected ? theme.content_accent : theme.content_border}`,
					borderRadius: "8px",
					padding: px(size.hpad),
					marginBottom: px(size.vpad),
					cursor: "pointer",
					transition: "all 0.2s ease",
				},
				onclick: () => {
					onSelect()
					this.expanded = !this.expanded
				},
			},
			[this.renderHeader(mail), this.renderPreview(mail), this.expanded && this.renderActions(attrs)],
		)
	}

	private renderHeader(mail: Mail): Children {
		const senderName = mail.sender.name || mail.sender.address
		const senderAddress = mail.sender.address
		const showAddress = mail.sender.name && mail.sender.name.length > 0
		const date = formatDateWithMonth(mail.receivedDate)

		return m(".screener-card-header.flex.items-center.justify-between.mb-s", [
			m(".screener-card-sender.flex.col", [
				m(
					".sender-name",
					{
						style: {
							fontWeight: "600",
							fontSize: "14px",
							color: theme.content_fg,
						},
					},
					senderName,
				),
				showAddress &&
					m(
						".sender-address",
						{
							style: {
								fontSize: "12px",
								color: theme.content_fg,
								opacity: "0.7",
								marginTop: "2px",
							},
						},
						senderAddress,
					),
			]),
			m(
				".screener-card-date",
				{
					style: {
						fontSize: "12px",
						color: theme.content_fg,
						opacity: "0.7",
					},
				},
				date,
			),
		])
	}

	private renderPreview(mail: Mail): Children {
		return m(".screener-card-content", [
			m(
				".subject",
				{
					style: {
						fontWeight: "500",
						fontSize: "14px",
						color: theme.content_fg,
						marginBottom: "6px",
					},
				},
				mail.subject || "(No subject)",
			),
			m(
				".preview",
				{
					style: {
						fontSize: "13px",
						color: theme.content_fg,
						opacity: "0.8",
						lineHeight: "1.4",
						maxHeight: this.expanded ? "none" : "40px",
						overflow: "hidden",
						textOverflow: "ellipsis",
						display: "-webkit-box",
						WebkitLineClamp: this.expanded ? "none" : "2",
						WebkitBoxOrient: "vertical",
					},
				},
				// Note: In real implementation, this would load and display email preview
				"Email preview would appear here...",
			),
		])
	}

	private renderActions(attrs: ScreenerCardAttrs): Children {
		const { onClassify, onSkip } = attrs

		return m(
			".screener-card-actions.mt",
			{
				style: {
					marginTop: px(size.vpad),
					paddingTop: px(size.vpad),
					borderTop: `1px solid ${theme.content_border}`,
				},
				onclick: (e: MouseEvent) => {
					// Prevent card collapse when clicking buttons
					e.stopPropagation()
				},
			},
			[
				m(
					".actions-label.mb-xs",
					{
						style: {
							fontSize: "12px",
							fontWeight: "600",
							color: theme.content_fg,
							textTransform: "uppercase",
							letterSpacing: "0.5px",
							marginBottom: px(size.vpad_small),
						},
					},
					"Where should emails from this sender go?",
				),
				m(
					".actions-buttons.flex.gap-s.wrap",
					{
						style: {
							gap: px(size.hpad_small),
							flexWrap: "wrap",
						},
					},
					[
						m(Button, {
							label: "Imbox",
							icon: () => Icons.InboxRounded,
							type: ButtonType.Primary,
							colors: ButtonColor.Content,
							click: async () => {
								this.classifying = true
								try {
									await onClassify(MailDestination.IMBOX)
								} finally {
									this.classifying = false
								}
							},
						}),
						m(Button, {
							label: "Feed",
							icon: () => Icons.ListAlt,
							type: ButtonType.Primary,
							colors: ButtonColor.Content,
							click: async () => {
								this.classifying = true
								try {
									await onClassify(MailDestination.FEED)
								} finally {
									this.classifying = false
								}
							},
						}),
						m(Button, {
							label: "Paper Trail",
							icon: () => Icons.Archive,
							type: ButtonType.Primary,
							colors: ButtonColor.Content,
							click: async () => {
								this.classifying = true
								try {
									await onClassify(MailDestination.PAPER_TRAIL)
								} finally {
									this.classifying = false
								}
							},
						}),
						m(Button, {
							label: "Block",
							icon: () => Icons.Cancel,
							type: ButtonType.Secondary,
							colors: ButtonColor.DrawerNav,
							click: async () => {
								this.classifying = true
								try {
									await onClassify(MailDestination.BLOCKED)
								} finally {
									this.classifying = false
								}
							},
						}),
					],
				),
				m(
					".actions-skip.mt-s",
					{
						style: {
							marginTop: px(size.vpad_small),
						},
					},
					m(Button, {
						label: "Skip for now",
						type: ButtonType.Secondary,
						colors: ButtonColor.DrawerNav,
						click: () => onSkip(),
					}),
				),
			],
		)
	}
}
