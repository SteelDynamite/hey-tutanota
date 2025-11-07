import m, { Children, Component, Vnode } from "mithril"
import { assertMainOrNode } from "../../../common/api/common/Env.js"
import { SetAsideViewModel } from "./SetAsideViewModel.js"
import { Mail } from "../../../common/api/entities/tutanota/TypeRefs.js"
import { BubbleUpDialog } from "./BubbleUpDialog.js"
import { lang } from "../../../common/misc/LanguageViewModel.js"
import { Button, ButtonType, ButtonColor } from "../../../common/gui/base/Button.js"
import { Icons } from "../../../common/gui/base/icons/Icons.js"
import { IconButton } from "../../../common/gui/base/IconButton.js"
import { ButtonSize } from "../../../common/gui/base/ButtonSize.js"
import ColumnEmptyMessageBox from "../../../common/gui/base/ColumnEmptyMessageBox.js"
import { px, size } from "../../../common/gui/size.js"
import { theme } from "../../../common/gui/theme.js"
import { formatDateWithMonth, formatDateWithWeekday } from "../../../common/misc/Formatter.js"

assertMainOrNode()

export interface SetAsideViewAttrs {
	viewModel: SetAsideViewModel
}

/**
 * The Set Aside View - Temporary holding area for emails to review later.
 * Supports "Bubble Up" scheduling to resurface emails at specific times.
 */
export class SetAsideView implements Component<SetAsideViewAttrs> {
	private showBubbleUpDialog: boolean = false
	private bubbleUpDialogMail: Mail | null = null

	view({ attrs }: Vnode<SetAsideViewAttrs>): Children {
		const { viewModel } = attrs

		return m(".set-aside-view.fill-absolute.flex.col", [
			this.renderHeader(viewModel),
			this.renderContent(viewModel),
			this.showBubbleUpDialog && this.bubbleUpDialogMail && this.renderBubbleUpDialog(viewModel, this.bubbleUpDialogMail),
		])
	}

	private renderHeader(viewModel: SetAsideViewModel): Children {
		const count = viewModel.setAsideMails().length
		const grouped = viewModel.getGroupedMails()

		return m(
			".set-aside-header.flex.items-center.justify-between",
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
					}, "Set Aside"),
					m(
						".text-break",
						{
							style: {
								fontSize: "13px",
								color: theme.content_fg,
								marginTop: "4px",
							},
						},
						count === 0
							? "No emails set aside"
							: `${count} email${count !== 1 ? "s" : ""} • ${grouped.scheduled.length} scheduled`,
					),
				]),
				m(
					".set-aside-actions.flex.gap-s",
					{
						style: {
							gap: px(size.hpad_small),
						},
					},
					[
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

	private renderContent(viewModel: SetAsideViewModel): Children {
		if (viewModel.loading()) {
			return this.renderLoading()
		}

		const mails = viewModel.setAsideMails()
		if (mails.length === 0) {
			return this.renderEmpty()
		}

		const grouped = viewModel.getGroupedMails()

		return m(
			".set-aside-content.flex-grow.scroll",
			{
				style: {
					overflowY: "auto",
					backgroundColor: theme.content_bg,
				},
			},
			m(
				".set-aside-list",
				{
					style: {
						maxWidth: "900px",
						margin: "0 auto",
						padding: px(size.hpad),
					},
				},
				[
					// Scheduled section
					grouped.scheduled.length > 0 && [
						m(
							"h2.section-title",
							{
								style: {
									fontSize: "14px",
									fontWeight: "600",
									color: theme.content_fg,
									textTransform: "uppercase",
									letterSpacing: "0.5px",
									marginBottom: px(size.vpad),
								},
							},
							`Scheduled (${grouped.scheduled.length})`,
						),
						...grouped.scheduled.map((mail) => this.renderMailCard(mail, viewModel, true)),
						m(
							".section-divider",
							{
								style: {
									height: "1px",
									backgroundColor: theme.content_border,
									margin: `${px(size.vpad_large)} 0`,
								},
							},
						),
					],

					// Unscheduled section
					grouped.unscheduled.length > 0 && [
						m(
							"h2.section-title",
							{
								style: {
									fontSize: "14px",
									fontWeight: "600",
									color: theme.content_fg,
									textTransform: "uppercase",
									letterSpacing: "0.5px",
									marginBottom: px(size.vpad),
								},
							},
							`Not Scheduled (${grouped.unscheduled.length})`,
						),
						...grouped.unscheduled.map((mail) => this.renderMailCard(mail, viewModel, false)),
					],
				],
			),
		)
	}

	private renderMailCard(mail: Mail, viewModel: SetAsideViewModel, isScheduled: boolean): Children {
		const selected = viewModel.selectedMail()?._id === mail._id
		const senderName = mail.sender.name || mail.sender.address
		const date = formatDateWithMonth(mail.receivedDate)
		const schedule = viewModel.getBubbleUpScheduleForMail(mail)

		return m(
			".set-aside-card.mb",
			{
				style: {
					backgroundColor: selected ? theme.list_bg_selected : theme.elevated_bg,
					border: `1px solid ${selected ? theme.content_accent : theme.content_border}`,
					borderLeft: isScheduled ? `4px solid ${theme.content_accent}` : undefined,
					borderRadius: "8px",
					padding: px(size.hpad),
					marginBottom: px(size.vpad),
					cursor: "pointer",
					transition: "all 0.2s ease",
				},
				onclick: () => viewModel.selectMail(mail),
			},
			[
				// Header
				m(".card-header.flex.items-center.justify-between.mb-s", [
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
					isScheduled &&
						schedule &&
						m(
							".bubble-up-indicator.flex.items-center.gap-xs",
							{
								style: {
									fontSize: "12px",
									color: theme.content_accent,
									fontWeight: "500",
									gap: "4px",
								},
							},
							[m(Icons.Schedule), m("span", `Bubbles up ${formatDateWithWeekday(schedule.bubbleUpAt)}`)],
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
						!isScheduled
							? m(Button, {
									label: "Bubble Up",
									icon: () => Icons.Schedule,
									type: ButtonType.Primary,
									colors: ButtonColor.Content,
									click: () => this.openBubbleUpDialog(mail),
							  })
							: m(Button, {
									label: "Cancel Schedule",
									icon: () => Icons.Cancel,
									type: ButtonType.Secondary,
									colors: ButtonColor.DrawerNav,
									click: () => viewModel.cancelBubbleUpForMail(mail),
							  }),
						m(Button, {
							label: "Put Back",
							icon: () => Icons.Undo,
							type: ButtonType.Secondary,
							colors: ButtonColor.DrawerNav,
							click: () => viewModel.removeFromSetAside(mail, false),
						}),
						m(Button, {
							label: "Archive",
							icon: () => Icons.Archive,
							type: ButtonType.Secondary,
							colors: ButtonColor.DrawerNav,
							click: () => viewModel.removeFromSetAside(mail, true),
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
			message: () => "No emails set aside. Use 'Set Aside' to temporarily store emails you want to revisit later.",
			icon: Icons.Folder,
			color: theme.content_fg,
		})
	}

	private openBubbleUpDialog(mail: Mail): void {
		this.bubbleUpDialogMail = mail
		this.showBubbleUpDialog = true
		m.redraw()
	}

	private closeBubbleUpDialog(): void {
		this.showBubbleUpDialog = false
		this.bubbleUpDialogMail = null
		m.redraw()
	}

	private renderBubbleUpDialog(viewModel: SetAsideViewModel, mail: Mail): Children {
		return m(BubbleUpDialog, {
			mail,
			onSchedule: async (date: Date, notify: boolean) => {
				await viewModel.scheduleBubbleUpForMail(mail, date, notify)
				this.closeBubbleUpDialog()
			},
			onCancel: () => this.closeBubbleUpDialog(),
		})
	}
}
