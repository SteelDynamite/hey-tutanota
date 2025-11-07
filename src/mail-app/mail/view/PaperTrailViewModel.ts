import { Mail, MailFolder } from "../../../common/api/entities/tutanota/TypeRefs.js"
import { assertMainOrNode } from "../../../common/api/common/Env.js"
import Stream from "mithril/stream"
import { MailModel } from "../model/MailModel.js"
import { getElementId } from "../../../common/api/common/utils/EntityUtils.js"
import m from "mithril"

assertMainOrNode()

/**
 * Filter categories for Paper Trail
 */
export enum PaperTrailCategory {
	ALL = "all",
	ECOMMERCE = "ecommerce",
	TRAVEL = "travel",
	FINANCE = "finance",
	UTILITIES = "utilities",
	SUBSCRIPTIONS = "subscriptions",
	OTHER = "other",
}

/**
 * Time range filter for Paper Trail
 */
export enum PaperTrailTimeRange {
	LAST_7_DAYS = "7days",
	LAST_30_DAYS = "30days",
	LAST_90_DAYS = "90days",
	LAST_YEAR = "year",
	ALL_TIME = "all",
}

/**
 * ViewModel for the Paper Trail view.
 * Manages receipts, confirmations, and transactional emails.
 */
export class PaperTrailViewModel {
	/** List of emails in paper trail */
	readonly mails: Stream<ReadonlyArray<Mail>>
	/** Currently selected mail */
	readonly selectedMail: Stream<Mail | null>
	/** Whether the view is currently loading */
	readonly loading: Stream<boolean>
	/** Current category filter */
	readonly categoryFilter: Stream<PaperTrailCategory>
	/** Current time range filter */
	readonly timeRangeFilter: Stream<PaperTrailTimeRange>
	/** Search query */
	readonly searchQuery: Stream<string>
	/** The paper trail folder */
	private paperTrailFolder: MailFolder | null = null

	constructor(private readonly mailModel: MailModel) {
		this.mails = Stream([])
		this.selectedMail = Stream(null)
		this.loading = Stream(false)
		this.categoryFilter = Stream(PaperTrailCategory.ALL)
		this.timeRangeFilter = Stream(PaperTrailTimeRange.LAST_30_DAYS)
		this.searchQuery = Stream("")

		// Re-filter when filters change
		this.categoryFilter.map(() => this.applyFilters())
		this.timeRangeFilter.map(() => this.applyFilters())
		this.searchQuery.map(() => this.applyFilters())
	}

	/**
	 * Initialize the paper trail view with the folder
	 */
	async init(paperTrailFolder: MailFolder): Promise<void> {
		this.paperTrailFolder = paperTrailFolder
		await this.loadPaperTrailMails()
	}

	/**
	 * Load emails from paper trail folder
	 */
	async loadPaperTrailMails(): Promise<void> {
		if (!this.paperTrailFolder) {
			console.warn("Paper Trail folder not set")
			return
		}

		this.loading(true)
		try {
			// Load all paper trail emails (could be paginated for large datasets)
			const mails = await this.mailModel.getMailsInFolder(this.paperTrailFolder, {
				limit: 500, // Paper trail might have many emails
				sortDescending: true,
			})

			this.mails(mails)
			await this.applyFilters()

			// Auto-select first mail if none selected
			const filteredMails = this.mails()
			if (!this.selectedMail() && filteredMails.length > 0) {
				this.selectedMail(filteredMails[0])
			}
		} catch (error) {
			console.error("Failed to load paper trail mails", error)
			this.mails([])
		} finally {
			this.loading(false)
			m.redraw()
		}
	}

	/**
	 * Apply current filters to the mail list
	 */
	private async applyFilters(): Promise<void> {
		if (!this.paperTrailFolder) return

		const allMails = await this.mailModel.getMailsInFolder(this.paperTrailFolder, {
			limit: 500,
			sortDescending: true,
		})

		let filtered = allMails

		// Apply time range filter
		filtered = this.filterByTimeRange(filtered)

		// Apply category filter
		if (this.categoryFilter() !== PaperTrailCategory.ALL) {
			filtered = this.filterByCategory(filtered)
		}

		// Apply search query
		if (this.searchQuery().trim().length > 0) {
			filtered = this.filterBySearch(filtered)
		}

		this.mails(filtered)
		m.redraw()
	}

	/**
	 * Filter emails by time range
	 */
	private filterByTimeRange(mails: ReadonlyArray<Mail>): Mail[] {
		const now = Date.now()
		const range = this.timeRangeFilter()

		if (range === PaperTrailTimeRange.ALL_TIME) {
			return [...mails]
		}

		let cutoffDate: number
		switch (range) {
			case PaperTrailTimeRange.LAST_7_DAYS:
				cutoffDate = now - 7 * 24 * 60 * 60 * 1000
				break
			case PaperTrailTimeRange.LAST_30_DAYS:
				cutoffDate = now - 30 * 24 * 60 * 60 * 1000
				break
			case PaperTrailTimeRange.LAST_90_DAYS:
				cutoffDate = now - 90 * 24 * 60 * 60 * 1000
				break
			case PaperTrailTimeRange.LAST_YEAR:
				cutoffDate = now - 365 * 24 * 60 * 60 * 1000
				break
			default:
				return [...mails]
		}

		return mails.filter((mail) => mail.receivedDate.getTime() >= cutoffDate)
	}

	/**
	 * Filter emails by category based on content patterns
	 */
	private filterByCategory(mails: ReadonlyArray<Mail>): Mail[] {
		const category = this.categoryFilter()

		return mails.filter((mail) => {
			const subject = mail.subject.toLowerCase()
			const sender = mail.sender.address.toLowerCase()

			switch (category) {
				case PaperTrailCategory.ECOMMERCE:
					return (
						subject.includes("order") ||
						subject.includes("purchase") ||
						subject.includes("shipping") ||
						sender.includes("amazon") ||
						sender.includes("ebay") ||
						sender.includes("shop")
					)

				case PaperTrailCategory.TRAVEL:
					return (
						subject.includes("booking") ||
						subject.includes("reservation") ||
						subject.includes("flight") ||
						subject.includes("hotel") ||
						sender.includes("airline") ||
						sender.includes("booking.com") ||
						sender.includes("airbnb")
					)

				case PaperTrailCategory.FINANCE:
					return (
						subject.includes("statement") ||
						subject.includes("invoice") ||
						subject.includes("payment") ||
						subject.includes("bill") ||
						sender.includes("bank") ||
						sender.includes("paypal")
					)

				case PaperTrailCategory.UTILITIES:
					return (
						subject.includes("utility") ||
						subject.includes("electricity") ||
						subject.includes("water") ||
						subject.includes("internet") ||
						sender.includes("utilities")
					)

				case PaperTrailCategory.SUBSCRIPTIONS:
					return (
						subject.includes("subscription") ||
						subject.includes("renewal") ||
						subject.includes("membership") ||
						sender.includes("subscription")
					)

				default:
					return true
			}
		})
	}

	/**
	 * Filter emails by search query
	 */
	private filterBySearch(mails: ReadonlyArray<Mail>): Mail[] {
		const query = this.searchQuery().toLowerCase().trim()

		return mails.filter((mail) => {
			const subject = mail.subject.toLowerCase()
			const sender = mail.sender.address.toLowerCase()
			const senderName = mail.sender.name?.toLowerCase() || ""

			return subject.includes(query) || sender.includes(query) || senderName.includes(query)
		})
	}

	/**
	 * Set the category filter
	 */
	setCategory(category: PaperTrailCategory): void {
		this.categoryFilter(category)
	}

	/**
	 * Set the time range filter
	 */
	setTimeRange(range: PaperTrailTimeRange): void {
		this.timeRangeFilter(range)
	}

	/**
	 * Set the search query
	 */
	setSearchQuery(query: string): void {
		this.searchQuery(query)
	}

	/**
	 * Select a mail for viewing
	 */
	selectMail(mail: Mail): void {
		this.selectedMail(mail)
		m.redraw()
	}

	/**
	 * Get counts by category (for filter UI)
	 */
	getCategoryCounts(): Map<PaperTrailCategory, number> {
		const counts = new Map<PaperTrailCategory, number>()
		const allMails = this.mails()

		// Count all
		counts.set(PaperTrailCategory.ALL, allMails.length)

		// Count each category
		for (const category of Object.values(PaperTrailCategory)) {
			if (category === PaperTrailCategory.ALL) continue

			const prevFilter = this.categoryFilter()
			this.categoryFilter(category as PaperTrailCategory)
			const filtered = this.filterByCategory(allMails)
			counts.set(category as PaperTrailCategory, filtered.length)
			this.categoryFilter(prevFilter)
		}

		return counts
	}

	/**
	 * Refresh the paper trail
	 */
	async refresh(): Promise<void> {
		await this.loadPaperTrailMails()
	}

	/**
	 * Cleanup when view is destroyed
	 */
	dispose(): void {
		this.mails([])
		this.selectedMail(null)
	}
}
