import m, { Children, Component, Vnode } from "mithril"
import { assertMainOrNode } from "../../../common/api/common/Env.js"
import { Mail } from "../../../common/api/entities/tutanota/TypeRefs.js"
import { formatDateWithMonth } from "../../../common/misc/Formatter.js"
import { px, size } from "../../../common/gui/size.js"
import { theme } from "../../../common/gui/theme.js"
import { Icons } from "../../../common/gui/base/icons/Icons.js"
import { IconButton } from "../../../common/gui/base/IconButton.js"
import { ButtonSize } from "../../../common/gui/base/ButtonSize.js"

assertMainOrNode()

export interface FeedItemAttrs {
	mail: Mail
	isLast: boolean
	onVisible: () => void
	onArchive: () => Promise<void>
}

/**
 * A feed item component for displaying a single email in the Feed.
 * Shows the email fully expanded in a card format optimized for reading.
 */
export class FeedItem implements Component<FeedItemAttrs> {
	private hasBeenVisible: boolean = false
	private intersectionObserver: IntersectionObserver | null = null

	view({ attrs }: Vnode<FeedItemAttrs>): Children {
		const { mail } = attrs

		return m(
			".feed-item.mb",
			{
				style: {
					backgroundColor: theme.elevated_bg,
					border: `1px solid ${theme.content_border}`,
					borderRadius: "8px",
					marginBottom: px(size.vpad_large),
					overflow: "hidden",
					opacity: mail.unread ? "1" : "0.85",
				},
				oncreate: (vnode: any) => {
					this.setupVisibilityObserver(vnode.dom, attrs.onVisible)
				},
				onremove: () => {
					this.teardownVisibilityObserver()
				},
			},
			[this.renderHeader(mail, attrs.onArchive), this.renderContent(mail), this.renderFooter(mail)],
		)
	}

	private renderHeader(mail: Mail, onArchive: () => Promise<void>): Children {
		const senderName = mail.sender.name || mail.sender.address
		const date = formatDateWithMonth(mail.receivedDate)

		return m(
			".feed-item-header.flex.items-center.justify-between",
			{
				style: {
					padding: px(size.hpad),
					borderBottom: `1px solid ${theme.content_border}`,
					backgroundColor: mail.unread ? theme.list_bg : "transparent",
				},
			},
			[
				m(".feed-item-sender.flex.items-center.gap-s", [
					// Sender avatar placeholder
					m(
						".sender-avatar",
						{
							style: {
								width: "32px",
								height: "32px",
								borderRadius: "50%",
								backgroundColor: theme.content_accent,
								display: "flex",
								alignItems: "center",
								justifyContent: "center",
								color: theme.content_button_selected,
								fontSize: "14px",
								fontWeight: "600",
							},
						},
						senderName.charAt(0).toUpperCase(),
					),
					m(".sender-info.flex.col", [
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
						m(
							".sender-date",
							{
								style: {
									fontSize: "12px",
									color: theme.content_fg,
									opacity: "0.7",
									marginTop: "2px",
								},
							},
							date,
						),
					]),
				]),
				m(".feed-item-actions.flex.gap-xs", [
					m(IconButton, {
						title: "Archive",
						icon: Icons.Archive,
						size: ButtonSize.Compact,
						click: onArchive,
					}),
				]),
			],
		)
	}

	private renderContent(mail: Mail): Children {
		return m(
			".feed-item-content",
			{
				style: {
					padding: px(size.hpad),
				},
			},
			[
				// Subject
				m(
					"h2.feed-item-subject",
					{
						style: {
							fontSize: "18px",
							fontWeight: "600",
							color: theme.content_fg,
							margin: "0 0 12px 0",
						},
					},
					mail.subject || "(No subject)",
				),
				// Email body content
				// Note: In real implementation, this would render the mail body HTML
				m(
					".feed-item-body",
					{
						style: {
							fontSize: "14px",
							lineHeight: "1.6",
							color: theme.content_fg,
							wordWrap: "break-word",
						},
					},
					m(".mail-body-placeholder", [
						m("p", "Email content would be rendered here."),
						m("p", "This would include the full HTML body of the email,"),
						m("p", "with proper sanitization and styling."),
					]),
				),
			],
		)
	}

	private renderFooter(mail: Mail): Children {
		// Show attachments if any
		if (!mail.attachments || mail.attachments.length === 0) {
			return null
		}

		return m(
			".feed-item-footer",
			{
				style: {
					padding: px(size.hpad),
					borderTop: `1px solid ${theme.content_border}`,
					backgroundColor: theme.list_bg,
				},
			},
			m(
				".attachments.flex.items-center.gap-s",
				{
					style: {
						fontSize: "13px",
						color: theme.content_fg,
					},
				},
				[
					m(Icons.Attachment, {
						style: {
							fill: theme.content_fg,
						},
					}),
					m("span", `${mail.attachments.length} attachment${mail.attachments.length > 1 ? "s" : ""}`),
				],
			),
		)
	}

	/**
	 * Set up intersection observer to track when the item becomes visible
	 */
	private setupVisibilityObserver(element: HTMLElement, onVisible: () => void): void {
		// Only trigger once when item scrolls into view
		if (this.hasBeenVisible) {
			return
		}

		this.intersectionObserver = new IntersectionObserver(
			(entries) => {
				entries.forEach((entry) => {
					if (entry.isIntersecting && !this.hasBeenVisible) {
						this.hasBeenVisible = true
						onVisible()
					}
				})
			},
			{
				threshold: 0.5, // Trigger when 50% visible
			},
		)

		this.intersectionObserver.observe(element)
	}

	private teardownVisibilityObserver(): void {
		if (this.intersectionObserver) {
			this.intersectionObserver.disconnect()
			this.intersectionObserver = null
		}
	}
}
