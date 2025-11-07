import { Mail, MailFolder } from "../../../common/api/entities/tutanota/TypeRefs.js"
import { assertMainOrNode } from "../../../common/api/common/Env.js"
import Stream from "mithril/stream"
import { MailModel } from "../model/MailModel.js"
import { getElementId } from "../../../common/api/common/utils/EntityUtils.js"
import m from "mithril"

assertMainOrNode()

/**
 * ViewModel for the Feed view.
 * Manages the scrollable feed of newsletters and bulk emails.
 */
export class FeedViewModel {
	/** List of emails in the feed */
	readonly mails: Stream<ReadonlyArray<Mail>>
	/** Whether the view is currently loading */
	readonly loading: Stream<boolean>
	/** Whether we're loading more emails (pagination) */
	readonly loadingMore: Stream<boolean>
	/** Whether there are more emails to load */
	readonly hasMore: Stream<boolean>
	/** The feed folder */
	private feedFolder: MailFolder | null = null
	/** Set of mail IDs that have been seen (scrolled into view) */
	private seenMailIds: Set<Id> = new Set()
	/** Batch timer for marking mails as seen */
	private markAsSeenTimer: number | null = null
	private mailsToMarkAsSeen: Mail[] = []

	constructor(private readonly mailModel: MailModel) {
		this.mails = Stream([])
		this.loading = Stream(false)
		this.loadingMore = Stream(false)
		this.hasMore = Stream(true)
	}

	/**
	 * Initialize the feed view with the feed folder
	 */
	async init(feedFolder: MailFolder): Promise<void> {
		this.feedFolder = feedFolder
		await this.loadFeedMails()
	}

	/**
	 * Load initial batch of feed emails
	 */
	async loadFeedMails(): Promise<void> {
		if (!this.feedFolder) {
			console.warn("Feed folder not set")
			return
		}

		this.loading(true)
		try {
			// Load most recent emails (sorted by date descending)
			// Note: This would integrate with MailListModel for proper loading
			const mails = await this.mailModel.getMailsInFolder(this.feedFolder, {
				limit: 50,
				sortDescending: true,
			})

			this.mails(mails)
			this.hasMore(mails.length === 50)
		} catch (error) {
			console.error("Failed to load feed mails", error)
			this.mails([])
			this.hasMore(false)
		} finally {
			this.loading(false)
			m.redraw()
		}
	}

	/**
	 * Load more emails (pagination)
	 */
	async loadMoreMails(): Promise<void> {
		if (this.loading() || this.loadingMore() || !this.hasMore()) {
			return
		}

		const currentMails = this.mails()
		if (currentMails.length === 0) {
			return
		}

		this.loadingMore(true)
		try {
			const lastMail = currentMails[currentMails.length - 1]

			// Load next batch after the last mail
			// Note: This would integrate with MailListModel for proper pagination
			const moreMails = await this.mailModel.getMailsInFolder(this.feedFolder!, {
				limit: 20,
				sortDescending: true,
				startAfter: getElementId(lastMail),
			})

			this.mails([...currentMails, ...moreMails])
			this.hasMore(moreMails.length === 20)
		} catch (error) {
			console.error("Failed to load more feed mails", error)
			this.hasMore(false)
		} finally {
			this.loadingMore(false)
			m.redraw()
		}
	}

	/**
	 * Mark a mail as seen when it's scrolled into view
	 * Uses batching to avoid too many API calls
	 */
	markAsSeen(mail: Mail): void {
		const mailId = getElementId(mail)

		// Already marked as seen
		if (this.seenMailIds.has(mailId)) {
			return
		}

		// Skip if already read
		if (!mail.unread) {
			this.seenMailIds.add(mailId)
			return
		}

		// Add to batch
		this.mailsToMarkAsSeen.push(mail)
		this.seenMailIds.add(mailId)

		// Clear existing timer
		if (this.markAsSeenTimer !== null) {
			clearTimeout(this.markAsSeenTimer)
		}

		// Set new timer to batch the updates
		this.markAsSeenTimer = window.setTimeout(() => {
			this.flushSeenMails()
		}, 1000) // 1 second debounce
	}

	/**
	 * Flush batched seen mails to the API
	 */
	private async flushSeenMails(): Promise<void> {
		if (this.mailsToMarkAsSeen.length === 0) {
			return
		}

		const mailsToUpdate = [...this.mailsToMarkAsSeen]
		this.mailsToMarkAsSeen = []
		this.markAsSeenTimer = null

		try {
			await this.mailModel.markAsUnread(mailsToUpdate, false)
		} catch (error) {
			console.error("Failed to mark mails as seen", error)
			// Remove from seen set so they can be retried
			mailsToUpdate.forEach((mail) => {
				this.seenMailIds.delete(getElementId(mail))
			})
		}
	}

	/**
	 * Mark all emails in the feed as seen
	 */
	async markAllAsSeen(): Promise<void> {
		const unreadMails = this.mails().filter((m) => m.unread)

		if (unreadMails.length === 0) {
			return
		}

		try {
			await this.mailModel.markAsUnread(unreadMails, false)

			// Add all to seen set
			unreadMails.forEach((mail) => {
				this.seenMailIds.add(getElementId(mail))
			})

			m.redraw()
		} catch (error) {
			console.error("Failed to mark all as seen", error)
			throw error
		}
	}

	/**
	 * Archive an email from the feed
	 */
	async archiveMail(mail: Mail): Promise<void> {
		try {
			await this.mailModel.moveMails([mail], await this.getArchiveFolder())

			// Remove from feed
			this.mails(this.mails().filter((m) => getElementId(m) !== getElementId(mail)))

			m.redraw()
		} catch (error) {
			console.error("Failed to archive mail", error)
			throw error
		}
	}

	/**
	 * Get the archive folder
	 */
	private async getArchiveFolder(): Promise<MailFolder> {
		const mailboxDetails = await this.mailModel.getMailboxDetails()
		const archiveFolder = mailboxDetails.mailbox.folders?.getSystemFolderByType(MailSetKind.ARCHIVE)

		if (!archiveFolder) {
			throw new Error("Archive folder not found")
		}

		return archiveFolder
	}

	/**
	 * Refresh the feed
	 */
	async refresh(): Promise<void> {
		this.seenMailIds.clear()
		this.mailsToMarkAsSeen = []
		if (this.markAsSeenTimer !== null) {
			clearTimeout(this.markAsSeenTimer)
			this.markAsSeenTimer = null
		}
		await this.loadFeedMails()
	}

	/**
	 * Cleanup when view is destroyed
	 */
	dispose(): void {
		// Flush any pending seen mail updates
		if (this.mailsToMarkAsSeen.length > 0) {
			this.flushSeenMails()
		}

		if (this.markAsSeenTimer !== null) {
			clearTimeout(this.markAsSeenTimer)
		}

		this.mails([])
		this.seenMailIds.clear()
	}
}
