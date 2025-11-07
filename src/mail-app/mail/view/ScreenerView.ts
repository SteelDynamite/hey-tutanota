import m, { Children, Component, Vnode } from "mithril"
import { assertMainOrNode } from "../../../common/api/common/Env.js"
import { ScreenerViewModel } from "./ScreenerViewModel.js"
import { Mail } from "../../../common/api/entities/tutanota/TypeRefs.js"
import { ScreenerCard } from "./ScreenerCard.js"
import { lang } from "../../../common/misc/LanguageViewModel.js"
import { Button, ButtonColor, ButtonType } from "../../../common/gui/base/Button.js"
import { Icons } from "../../../common/gui/base/icons/Icons.js"
import ColumnEmptyMessageBox from "../../../common/gui/base/ColumnEmptyMessageBox.js"
import { MailDestination } from "../model/MailClassifier.js"
import { px, size } from "../../../common/gui/size.js"
import { theme } from "../../../common/gui/theme.js"

assertMainOrNode()

export interface ScreenerViewAttrs {
	viewModel: ScreenerViewModel
}

/**
 * The Screener View - HEY-style email screening interface.
 * Shows emails from new senders and allows users to classify them.
 */
export class ScreenerView implements Component<ScreenerViewAttrs> {
	view({ attrs }: Vnode<ScreenerViewAttrs>): Children {
		const { viewModel } = attrs
		const mails = viewModel.unscreenedMails()
		const selectedMail = viewModel.selectedMail()

		return m(".screener-view.fill-absolute.flex.col", [this.renderHeader(viewModel, mails), this.renderContent(viewModel, mails, selectedMail)])
	}

	private renderHeader(viewModel: ScreenerViewModel, mails: ReadonlyArray<Mail>): Children {
		const count = mails.length
		const countText = count === 1 ? "1 email to screen" : `${count} emails to screen`

		return m(
			".screener-header.flex.items-center.justify-between",
			{
				style: {
					padding: px(size.hpad),
					borderBottom: `1px solid ${theme.content_border}`,
					minHeight: px(size.button_height + size.vpad * 2),
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
					}, "The Screener"),
					m(
						".text-break",
						{
							style: {
								fontSize: "13px",
								color: theme.content_fg,
								marginTop: "4px",
							},
						},
						count === 0 ? "No emails to screen" : countText,
					),
				]),
				count > 0 &&
					m(
						".screener-actions.flex.gap-s",
						{
							style: {
								gap: px(size.hpad_small),
							},
						},
						[
							// Batch actions placeholder
							// Could add "Select All", "Archive All", etc.
						],
					),
			],
		)
	}

	private renderContent(viewModel: ScreenerViewModel, mails: ReadonlyArray<Mail>, selectedMail: Mail | null): Children {
		if (viewModel.loading()) {
			return this.renderLoading()
		}

		if (mails.length === 0) {
			return this.renderEmpty()
		}

		return m(
			".screener-content.flex-grow.scroll",
			{
				style: {
					padding: px(size.hpad),
					overflowY: "auto",
				},
			},
			m(
				".screener-cards",
				{
					style: {
						maxWidth: "800px",
						margin: "0 auto",
					},
				},
				mails.map((mail) =>
					m(ScreenerCard, {
						mail,
						selected: selectedMail ? mail._id === selectedMail._id : false,
						onSelect: () => viewModel.selectMail(mail),
						onClassify: (destination: MailDestination) => viewModel.classifySender(mail, destination),
						onSkip: () => viewModel.skipMail(mail),
					}),
				),
			),
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
			message: () => "All caught up! No new senders to screen.",
			icon: Icons.Checkmark,
			color: theme.content_accent,
		})
	}
}
