import m, { Children, Component, Vnode } from "mithril"
import { assertMainOrNode } from "../../../common/api/common/Env.js"
import { FeedViewModel } from "./FeedViewModel.js"
import { Mail } from "../../../common/api/entities/tutanota/TypeRefs.js"
import { FeedItem } from "./FeedItem.js"
import { lang } from "../../../common/misc/LanguageViewModel.js"
import { Button, ButtonColor, ButtonType } from "../../../common/gui/base/Button.js"
import { Icons } from "../../../common/gui/base/icons/Icons.js"
import ColumnEmptyMessageBox from "../../../common/gui/base/ColumnEmptyMessageBox.js"
import { px, size } from "../../../common/gui/size.js"
import { theme } from "../../../common/gui/theme.js"

assertMainOrNode()

export interface FeedViewAttrs {
	viewModel: FeedViewModel
}

/**
 * The Feed View - HEY-style newsletter and bulk email reader.
 * Shows emails in a scrollable feed format, similar to social media.
 */
export class FeedView implements Component<FeedViewAttrs> {
	private scrollContainer: HTMLElement | null = null
	private lastScrollPosition: number = 0

	view({ attrs }: Vnode<FeedViewAttrs>): Children {
		const { viewModel } = attrs
		const mails = viewModel.mails()

		return m(".feed-view.fill-absolute.flex.col", [this.renderHeader(viewModel, mails), this.renderContent(viewModel, mails)])
	}

	private renderHeader(viewModel: FeedViewModel, mails: ReadonlyArray<Mail>): Children {
		const unreadCount = mails.filter((m) => m.unread).length

		return m(
			".feed-header.flex.items-center.justify-between",
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
					}, "The Feed"),
					unreadCount > 0 &&
						m(
							".text-break",
							{
								style: {
									fontSize: "13px",
									color: theme.content_fg,
									marginTop: "4px",
								},
							},
							`${unreadCount} unread`,
						),
				]),
				m(
					".feed-actions.flex.gap-s",
					{
						style: {
							gap: px(size.hpad_small),
						},
					},
					[
						m(Button, {
							label: "Mark all as seen",
							type: ButtonType.Secondary,
							colors: ButtonColor.DrawerNav,
							click: () => viewModel.markAllAsSeen(),
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

	private renderContent(viewModel: FeedViewModel, mails: ReadonlyArray<Mail>): Children {
		if (viewModel.loading()) {
			return this.renderLoading()
		}

		if (mails.length === 0) {
			return this.renderEmpty()
		}

		return m(
			".feed-content.flex-grow.scroll",
			{
				style: {
					overflowY: "auto",
					overflowX: "hidden",
					backgroundColor: theme.content_bg,
				},
				oncreate: (vnode: any) => {
					this.scrollContainer = vnode.dom
					this.setupScrollListener(viewModel)
				},
				onremove: () => {
					this.teardownScrollListener()
				},
			},
			[
				m(
					".feed-items",
					{
						style: {
							maxWidth: "900px",
							margin: "0 auto",
							padding: px(size.hpad),
						},
					},
					[
						...mails.map((mail, index) =>
							m(FeedItem, {
								mail,
								isLast: index === mails.length - 1,
								onVisible: () => viewModel.markAsSeen(mail),
								onArchive: () => viewModel.archiveMail(mail),
							}),
						),
						viewModel.loadingMore() && this.renderLoadingMore(),
						!viewModel.hasMore() && mails.length > 0 && this.renderNoMore(),
					],
				),
			],
		)
	}

	private setupScrollListener(viewModel: FeedViewModel): void {
		if (!this.scrollContainer) return

		this.scrollContainer.addEventListener("scroll", this.handleScroll.bind(this, viewModel))
	}

	private teardownScrollListener(): void {
		if (!this.scrollContainer) return

		this.scrollContainer.removeEventListener("scroll", this.handleScroll.bind(this))
		this.scrollContainer = null
	}

	private handleScroll(viewModel: FeedViewModel, event: Event): void {
		const element = event.target as HTMLElement
		const scrollTop = element.scrollTop
		const scrollHeight = element.scrollHeight
		const clientHeight = element.clientHeight

		// Calculate scroll percentage
		const scrollPercentage = (scrollTop + clientHeight) / scrollHeight

		// Load more when scrolled 80%
		if (scrollPercentage > 0.8 && !viewModel.loadingMore() && viewModel.hasMore()) {
			viewModel.loadMoreMails()
		}

		this.lastScrollPosition = scrollTop
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
			message: () => "No newsletters or bulk emails in your feed.",
			icon: Icons.ListAlt,
			color: theme.content_fg,
		})
	}

	private renderLoadingMore(): Children {
		return m(
			".feed-loading-more.center",
			{
				style: {
					padding: `${px(size.vpad_large)} 0`,
					textAlign: "center",
				},
			},
			m(
				".spinner",
				{
					style: {
						fontSize: "13px",
						color: theme.content_fg,
					},
				},
				"Loading more...",
			),
		)
	}

	private renderNoMore(): Children {
		return m(
			".feed-no-more.center",
			{
				style: {
					padding: `${px(size.vpad_large)} 0`,
					textAlign: "center",
					fontSize: "13px",
					color: theme.content_fg,
					opacity: "0.7",
				},
			},
			"You've reached the end of the feed",
		)
	}
}
