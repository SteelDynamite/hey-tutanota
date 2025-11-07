import m, { Children, Component, Vnode } from "mithril"
import { assertMainOrNode } from "../../../common/api/common/Env.js"
import { PaperTrailViewModel, PaperTrailCategory, PaperTrailTimeRange } from "./PaperTrailViewModel.js"
import { Mail } from "../../../common/api/entities/tutanota/TypeRefs.js"
import { lang } from "../../../common/misc/LanguageViewModel.js"
import { Button, ButtonType, ButtonColor } from "../../../common/gui/base/Button.js"
import { Icons } from "../../../common/gui/base/icons/Icons.js"
import { TextField } from "../../../common/gui/base/TextField.js"
import { DropDownSelector } from "../../../common/gui/base/DropDownSelector.js"
import ColumnEmptyMessageBox from "../../../common/gui/base/ColumnEmptyMessageBox.js"
import { px, size } from "../../../common/gui/size.js"
import { theme } from "../../../common/gui/theme.js"
import { formatDateWithMonth } from "../../../common/misc/Formatter.js"

assertMainOrNode()

export interface PaperTrailViewAttrs {
	viewModel: PaperTrailViewModel
}

/**
 * The Paper Trail View - Archive for receipts, confirmations, and transactional emails.
 * Optimized for search and retrieval rather than reading.
 */
export class PaperTrailView implements Component<PaperTrailViewAttrs> {
	view({ attrs }: Vnode<PaperTrailViewAttrs>): Children {
		const { viewModel } = attrs

		return m(".paper-trail-view.fill-absolute.flex.col", [this.renderHeader(viewModel), this.renderFilters(viewModel), this.renderContent(viewModel)])
	}

	private renderHeader(viewModel: PaperTrailViewModel): Children {
		const count = viewModel.mails().length

		return m(
			".paper-trail-header.flex.items-center.justify-between",
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
					}, "Paper Trail"),
					m(
						".text-break",
						{
							style: {
								fontSize: "13px",
								color: theme.content_fg,
								marginTop: "4px",
							},
						},
						`${count} receipt${count !== 1 ? "s" : ""}`,
					),
				]),
				m(
					".paper-trail-actions.flex.gap-s",
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

	private renderFilters(viewModel: PaperTrailViewModel): Children {
		return m(
			".paper-trail-filters.flex.items-center.gap",
			{
				style: {
					padding: px(size.hpad),
					borderBottom: `1px solid ${theme.content_border}`,
					backgroundColor: theme.list_bg,
					gap: px(size.hpad),
					flexWrap: "wrap",
				},
			},
			[
				// Search
				m(
					".filter-search.flex-grow",
					{
						style: {
							minWidth: "200px",
							maxWidth: "400px",
						},
					},
					m(TextField, {
						label: "search_label",
						value: viewModel.searchQuery(),
						oninput: (value: string) => viewModel.setSearchQuery(value),
						placeholder: "Search receipts...",
					}),
				),

				// Category filter
				m(
					".filter-category",
					{
						style: {
							minWidth: "150px",
						},
					},
					m(DropDownSelector, {
						label: "category_label",
						items: this.getCategoryItems(),
						selectedValue: viewModel.categoryFilter(),
						selectionChangedHandler: (value: PaperTrailCategory) => viewModel.setCategory(value),
						dropdownWidth: 200,
					}),
				),

				// Time range filter
				m(
					".filter-time",
					{
						style: {
							minWidth: "150px",
						},
					},
					m(DropDownSelector, {
						label: "time_range_label",
						items: this.getTimeRangeItems(),
						selectedValue: viewModel.timeRangeFilter(),
						selectionChangedHandler: (value: PaperTrailTimeRange) => viewModel.setTimeRange(value),
						dropdownWidth: 180,
					}),
				),
			],
		)
	}

	private renderContent(viewModel: PaperTrailViewModel): Children {
		if (viewModel.loading()) {
			return this.renderLoading()
		}

		const mails = viewModel.mails()
		if (mails.length === 0) {
			return this.renderEmpty(viewModel)
		}

		return m(
			".paper-trail-content.flex-grow.scroll",
			{
				style: {
					overflowY: "auto",
					backgroundColor: theme.content_bg,
				},
			},
			m(
				".paper-trail-list",
				{
					style: {
						maxWidth: "1000px",
						margin: "0 auto",
						padding: px(size.hpad),
					},
				},
				mails.map((mail) => this.renderMailRow(mail, viewModel)),
			),
		)
	}

	private renderMailRow(mail: Mail, viewModel: PaperTrailViewModel): Children {
		const selected = viewModel.selectedMail()?._id === mail._id
		const senderName = mail.sender.name || mail.sender.address
		const date = formatDateWithMonth(mail.receivedDate)

		return m(
			".paper-trail-row.flex.items-center.justify-between.mb-s.clickable",
			{
				style: {
					padding: px(size.hpad_small),
					backgroundColor: selected ? theme.list_bg_selected : theme.elevated_bg,
					border: `1px solid ${selected ? theme.content_accent : theme.content_border}`,
					borderRadius: "6px",
					cursor: "pointer",
					transition: "all 0.2s ease",
				},
				onclick: () => viewModel.selectMail(mail),
				onmouseenter: (e: MouseEvent) => {
					if (!selected) {
						const target = e.currentTarget as HTMLElement
						target.style.backgroundColor = theme.list_bg
					}
				},
				onmouseleave: (e: MouseEvent) => {
					if (!selected) {
						const target = e.currentTarget as HTMLElement
						target.style.backgroundColor = theme.elevated_bg
					}
				},
			},
			[
				// Mail icon
				m(
					".row-icon",
					{
						style: {
							marginRight: px(size.hpad_small),
						},
					},
					m(Icons.Mail, {
						style: {
							fill: theme.content_fg,
						},
					}),
				),

				// Mail info
				m(".row-info.flex.col.flex-grow", [
					m(
						".row-subject",
						{
							style: {
								fontWeight: "500",
								fontSize: "14px",
								color: theme.content_fg,
								marginBottom: "4px",
							},
						},
						mail.subject || "(No subject)",
					),
					m(
						".row-sender",
						{
							style: {
								fontSize: "12px",
								color: theme.content_fg,
								opacity: "0.7",
							},
						},
						`From: ${senderName}`,
					),
				]),

				// Date
				m(
					".row-date",
					{
						style: {
							fontSize: "12px",
							color: theme.content_fg,
							opacity: "0.7",
							marginLeft: px(size.hpad),
							whiteSpace: "nowrap",
						},
					},
					date,
				),

				// Attachments indicator
				mail.attachments &&
					mail.attachments.length > 0 &&
					m(
						".row-attachments",
						{
							style: {
								fontSize: "12px",
								color: theme.content_fg,
								opacity: "0.7",
								marginLeft: px(size.hpad_small),
								display: "flex",
								alignItems: "center",
								gap: "4px",
							},
						},
						[
							m(Icons.Attachment, {
								style: {
									fill: theme.content_fg,
									width: "14px",
									height: "14px",
								},
							}),
							m("span", mail.attachments.length),
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

	private renderEmpty(viewModel: PaperTrailViewModel): Children {
		const hasFilters = viewModel.categoryFilter() !== PaperTrailCategory.ALL || viewModel.searchQuery().trim().length > 0

		const message = hasFilters ? "No receipts match your filters." : "No receipts or transactional emails found."

		return m(ColumnEmptyMessageBox, {
			message: () => message,
			icon: Icons.Archive,
			color: theme.content_fg,
		})
	}

	private getCategoryItems(): Array<{ name: string; value: PaperTrailCategory }> {
		return [
			{ name: "All Receipts", value: PaperTrailCategory.ALL },
			{ name: "E-commerce", value: PaperTrailCategory.ECOMMERCE },
			{ name: "Travel", value: PaperTrailCategory.TRAVEL },
			{ name: "Finance", value: PaperTrailCategory.FINANCE },
			{ name: "Utilities", value: PaperTrailCategory.UTILITIES },
			{ name: "Subscriptions", value: PaperTrailCategory.SUBSCRIPTIONS },
			{ name: "Other", value: PaperTrailCategory.OTHER },
		]
	}

	private getTimeRangeItems(): Array<{ name: string; value: PaperTrailTimeRange }> {
		return [
			{ name: "Last 7 days", value: PaperTrailTimeRange.LAST_7_DAYS },
			{ name: "Last 30 days", value: PaperTrailTimeRange.LAST_30_DAYS },
			{ name: "Last 90 days", value: PaperTrailTimeRange.LAST_90_DAYS },
			{ name: "Last year", value: PaperTrailTimeRange.LAST_YEAR },
			{ name: "All time", value: PaperTrailTimeRange.ALL_TIME },
		]
	}
}
