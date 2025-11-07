import m, { Children, Component, Vnode } from "mithril"
import { assertMainOrNode } from "../../../common/api/common/Env.js"
import { ReplyLaterViewModel } from "./ReplyLaterViewModel.js"
import { Mail } from "../../../common/api/entities/tutanota/TypeRefs.js"
import { lang } from "../../../common/misc/LanguageViewModel.js"
import { Button, ButtonType, ButtonColor } from "../../../common/gui/base/Button.js"
import { Icons } from "../../../common/gui/base/icons/Icons.js"
import { IconButton } from "../../../common/gui/base/IconButton.js"
import { ButtonSize } from "../../../common/gui/base/ButtonSize.js"
import ColumnEmptyMessageBox from "../../../common/gui/base/ColumnEmptyMessageBox.js"
import { px, size } from "../../../common/gui/size.js"
import { theme } from "../../../common/gui/theme.js"
import { formatDateWithMonth } from "../../../common/misc/Formatter.js"

assertMainOrNode()

export interface ReplyLaterViewAttrs {
	viewModel: ReplyLaterViewModel
}

/**
 * The Reply Later View - Queue for emails that need responses.
 * Supports focused batch reply mode for processing multiple emails efficiently.
 */
export class ReplyLaterView implements Component<ReplyLaterViewAttrs> {
	view({ attrs }: Vnode<ReplyLaterViewAttrs>): Children {
		const { viewModel } = attrs

		if (viewModel.batchReplyMode()) {
			return this.renderBatchMode(viewModel)
		}

		return m(".reply-later-view.fill-absolute.flex.col", [this.renderHeader(viewModel), this.renderContent(viewModel)])
	}

	private renderHeader(viewModel: ReplyLaterViewModel): Children {
		const count = viewModel.queuedMails().length

		return m(
			".reply-later-header.flex.items-center.justify-between",
			{
				style: {
					padding: px(size.hpad),
					borderBottom: `1px solid ${theme.content_border}`,
					minHeight: px(size.button_height + size.vpad * 2),
					backgroundColor: theme.navigation_bg,
				},
			},
			[
				m(".flex.col", [
					m("h1.text-break", {
						style: {
							fontSize: "20px",
							fontWeight: "600",
							margin: "0",
						},
					}, "Reply Later"),
					m(
						".text-break",
						{
							style: {
								fontSize: "13px",
								color: theme.content_fg,
								marginTop: "4px",
							},
						},
						count === 0 ? "No emails in queue" : count === 1 ? "1 email waiting" : `${count} emails waiting`,
					),
				]),
				count > 0 &&
					m(
						".reply-later-actions.flex.gap-s",
						{
							style: {
								gap: px(size.hpad_small),
							},
						},
						[
							m(Button, {
								label: "Focus & Reply",
								icon: () => Icons.Edit,
								type: ButtonType.Primary,
								colors: ButtonColor.Content,
								click: () => viewModel.startBatchReply(),
							}),
							m(Button, {
								label: "Refresh",
								icon: () => Icons.Reload,
								type: ButtonType.Secondary,
								colors: ButtonColor.DrawerNav,
								click: () => viewModel.refresh(),
							}),
						],
					),
			],
		)
	}

	private renderContent(viewModel: ReplyLaterViewModel): Children {
		if (viewModel.loading()) {
			return this.renderLoading()
		}

		const mails = viewModel.queuedMails()
		if (mails.length === 0) {
			return this.renderEmpty()
		}

		return m(
			".reply-later-content.flex-grow.scroll",
			{
				style: {
					overflowY: "auto",
					backgroundColor: theme.content_bg,
				},
			},
			m(
				".reply-later-list",
				{
					style: {
						maxWidth: "900px",
						margin: "0 auto",
						padding: px(size.hpad),
					},
				},
				mails.map((mail, index) => this.renderMailCard(mail, index + 1, viewModel)),
			),
		)
	}

	private renderMailCard(mail: Mail, position: number, viewModel: ReplyLaterViewModel): Children {
		const selected = viewModel.selectedMail()?._id === mail._id
		const senderName = mail.sender.name || mail.sender.address
		const date = formatDateWithMonth(mail.receivedDate)

		return m(
			".reply-later-card.mb",
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
				onclick: () => viewModel.selectMail(mail),
			},
			[
				// Header with position indicator
				m(".card-header.flex.items-center.justify-between.mb-s", [
					m(
						".position-indicator",
						{
							style: {
								backgroundColor: theme.content_accent,
								color: theme.content_button_selected,
								borderRadius: "50%",
								width: "24px",
								height: "24px",
								display: "flex",
								alignItems: "center",
								justifyContent: "center",
								fontSize: "12px",
								fontWeight: "600",
							},
						},
						position,
					),
					m(
						".card-date",
						{
							style: {
								fontSize: "12px",
								color: theme.content_fg,
								opacity: "0.7",
							},
						},
						date,
					),
				]),

				// Sender
				m(
					".card-sender",
					{
						style: {
							fontWeight: "600",
							fontSize: "14px",
							color: theme.content_fg,
							marginBottom: "4px",
						},
					},
					senderName,
				),

				// Subject
				m(
					".card-subject",
					{
						style: {
							fontSize: "14px",
							color: theme.content_fg,
							marginBottom: "8px",
						},
					},
					mail.subject || "(No subject)",
				),

				// Preview
				m(
					".card-preview",
					{
						style: {
							fontSize: "13px",
							color: theme.content_fg,
							opacity: "0.8",
							lineHeight: "1.4",
							maxHeight: "40px",
							overflow: "hidden",
							textOverflow: "ellipsis",
							display: "-webkit-box",
							WebkitLineClamp: "2",
							WebkitBoxOrient: "vertical",
							marginBottom: "12px",
						},
					},
					"Email preview would appear here...",
				),

				// Actions
				m(
					".card-actions.flex.gap-s",
					{
						style: {
							gap: px(size.hpad_small),
						},
						onclick: (e: MouseEvent) => e.stopPropagation(),
					},
					[
						m(Button, {
							label: "Reply",
							icon: () => Icons.Reply,
							type: ButtonType.Primary,
							colors: ButtonColor.Content,
							click: () => viewModel.replyToMail(mail, false),
						}),
						m(Button, {
							label: "Reply All",
							icon: () => Icons.ReplyAll,
							type: ButtonType.Secondary,
							colors: ButtonColor.DrawerNav,
							click: () => viewModel.replyToMail(mail, true),
						}),
						m(Button, {
							label: "Done",
							icon: () => Icons.Checkmark,
							type: ButtonType.Secondary,
							colors: ButtonColor.DrawerNav,
							click: () => viewModel.removeFromQueue(mail),
						}),
					],
				),
			],
		)
	}

	private renderBatchMode(viewModel: ReplyLaterViewModel): Children {
		const mail = viewModel.selectedMail()
		const progress = viewModel.getBatchProgress()

		if (!mail) {
			viewModel.exitBatchReply()
			return null
		}

		return m(
			".batch-reply-mode.fill-absolute.flex.col",
			{
				style: {
					backgroundColor: theme.content_bg,
				},
			},
			[
				// Batch mode header
				this.renderBatchHeader(viewModel, progress),

				// Email viewer
				this.renderBatchEmailViewer(mail),

				// Batch mode actions
				this.renderBatchActions(viewModel),
			],
		)
	}

	private renderBatchHeader(viewModel: ReplyLaterViewModel, progress: { current: number; total: number }): Children {
		return m(
			".batch-header.flex.items-center.justify-between",
			{
				style: {
					padding: px(size.hpad),
					borderBottom: `1px solid ${theme.content_border}`,
					backgroundColor: theme.navigation_bg,
				},
			},
			[
				m(".batch-title.flex.items-center.gap", [
					m(IconButton, {
						title: "Exit batch mode",
						icon: Icons.Cancel,
						size: ButtonSize.Compact,
						click: () => viewModel.exitBatchReply(),
					}),
					m("h2", {
						style: {
							fontSize: "18px",
							fontWeight: "600",
							margin: "0",
						},
					}, "Focus & Reply"),
				]),
				m(
					".batch-progress",
					{
						style: {
							fontSize: "14px",
							color: theme.content_fg,
						},
					},
					`${progress.current} / ${progress.total}`,
				),
			],
		)
	}

	private renderBatchEmailViewer(mail: Mail): Children {
		const senderName = mail.sender.name || mail.sender.address

		return m(
			".batch-email-viewer.flex-grow.scroll",
			{
				style: {
					overflowY: "auto",
					padding: px(size.hpad_large),
				},
			},
			m(
				".batch-email-content",
				{
					style: {
						maxWidth: "700px",
						margin: "0 auto",
					},
				},
				[
					// Sender
					m(
						".batch-sender",
						{
							style: {
								fontSize: "14px",
								color: theme.content_fg,
								opacity: "0.8",
								marginBottom: "8px",
							},
						},
						`From: ${senderName}`,
					),

					// Subject
					m(
						"h1.batch-subject",
						{
							style: {
								fontSize: "24px",
								fontWeight: "600",
								color: theme.content_fg,
								marginBottom: "16px",
							},
						},
						mail.subject || "(No subject)",
					),

					// Email body
					// Note: In real implementation, this would render the mail body
					m(
						".batch-body",
						{
							style: {
								fontSize: "14px",
								lineHeight: "1.6",
								color: theme.content_fg,
							},
						},
						m("p", "Email body content would be displayed here..."),
					),
				],
			),
		)
	}

	private renderBatchActions(viewModel: ReplyLaterViewModel): Children {
		return m(
			".batch-actions.flex.items-center.justify-between",
			{
				style: {
					padding: px(size.hpad),
					borderTop: `1px solid ${theme.content_border}`,
					backgroundColor: theme.navigation_bg,
					gap: px(size.hpad),
				},
			},
			[
				// Navigation
				m(
					".batch-nav.flex.gap-s",
					{
						style: {
							gap: px(size.hpad_small),
						},
					},
					[
						m(Button, {
							label: "Previous",
							icon: () => Icons.ArrowBackward,
							type: ButtonType.Secondary,
							colors: ButtonColor.DrawerNav,
							click: () => viewModel.previousInBatch(),
						}),
						m(Button, {
							label: "Skip",
							type: ButtonType.Secondary,
							colors: ButtonColor.DrawerNav,
							click: () => viewModel.skipInBatch(),
						}),
					],
				),

				// Primary actions
				m(
					".batch-primary.flex.gap-s",
					{
						style: {
							gap: px(size.hpad_small),
						},
					},
					[
						m(Button, {
							label: "Reply",
							icon: () => Icons.Reply,
							type: ButtonType.Primary,
							colors: ButtonColor.Content,
							click: () => {
								const mail = viewModel.selectedMail()
								if (mail) {
									viewModel.replyToMail(mail, false)
								}
							},
						}),
						m(Button, {
							label: "Done & Next",
							icon: () => Icons.Checkmark,
							type: ButtonType.Primary,
							colors: ButtonColor.Content,
							click: () => viewModel.doneInBatch(),
						}),
					],
				),
			],
		)
	}

	private renderLoading(): Children {
		return m(ColumnEmptyMessageBox, {
			message: () => lang.get("loading_msg"),
			icon: Icons.FileText,
			color: theme.content_fg,
		})
	}

	private renderEmpty(): Children {
		return m(ColumnEmptyMessageBox, {
			message: () => "All caught up! No emails need replies right now.",
			icon: Icons.Checkmark,
			color: theme.content_accent,
		})
	}
}
