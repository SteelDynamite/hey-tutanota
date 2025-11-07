import { Mail, MailFolder } from "../../../common/api/entities/tutanota/TypeRefs.js"
import { assertMainOrNode } from "../../../common/api/common/Env.js"
import Stream from "mithril/stream"
import { MailModel } from "../model/MailModel.js"
import { getElementId } from "../../../common/api/common/utils/EntityUtils.js"
import { mapWithout } from "@tutao/tutanota-utils"
import m from "mithril"

assertMainOrNode()

/**
 * ViewModel for the Reply Later queue.
 * Manages emails that need responses but not immediately.
 */
export class ReplyLaterViewModel {
	/** List of emails in the reply later queue */
	readonly queuedMails: Stream<ReadonlyArray<Mail>>
	/** Currently selected mail for reply */
	readonly selectedMail: Stream<Mail | null>
	/** Whether the view is currently loading */
	readonly loading: Stream<boolean>
	/** Whether in batch reply mode */
	readonly batchReplyMode: Stream<boolean>
	/** Current index in batch reply mode */
	readonly batchIndex: Stream<number>
	/** The reply later folder */
	private replyLaterFolder: MailFolder | null = null

	constructor(
		private readonly mailModel: MailModel,
		private readonly onCompose: (mail: Mail, replyAll: boolean) => Promise<void>,
	) {
		this.queuedMails = Stream([])
		this.selectedMail = Stream(null)
		this.loading = Stream(false)
		this.batchReplyMode = Stream(false)
		this.batchIndex = Stream(0)
	}

	/**
	 * Initialize the reply later view with the folder
	 */
	async init(replyLaterFolder: MailFolder): Promise<void> {
		this.replyLaterFolder = replyLaterFolder
		await this.loadQueuedMails()
	}

	/**
	 * Load emails from reply later folder
	 */
	async loadQueuedMails(): Promise<void> {
		if (!this.replyLaterFolder) {
			console.warn("Reply Later folder not set")
			return
		}

		this.loading(true)
		try {
			// Load mails sorted by date (oldest first - most urgent)
			const mails = await this.mailModel.getMailsInFolder(this.replyLaterFolder, {
				limit: 200,
				sortDescending: false, // Oldest first
			})

			this.queuedMails(mails)

			// Auto-select first mail if none selected
			if (!this.selectedMail() && mails.length > 0) {
				this.selectedMail(mails[0])
			}
		} catch (error) {
			console.error("Failed to load reply later mails", error)
			this.queuedMails([])
		} finally {
			this.loading(false)
			m.redraw()
		}
	}

	/**
	 * Add a mail to the reply later queue
	 */
	async addToQueue(mail: Mail): Promise<void> {
		if (!this.replyLaterFolder) {
			throw new Error("Reply Later folder not set")
		}

		try {
			await this.mailModel.moveMails([mail], this.replyLaterFolder)
			await this.loadQueuedMails()
		} catch (error) {
			console.error("Failed to add mail to Reply Later", error)
			throw error
		}
	}

	/**
	 * Remove a mail from the queue (archive it)
	 */
	async removeFromQueue(mail: Mail): Promise<void> {
		try {
			const archiveFolder = await this.getArchiveFolder()
			await this.mailModel.moveMails([mail], archiveFolder)

			// Remove from list
			this.queuedMails(mapWithout(this.queuedMails(), [mail]))

			// Update selection
			if (this.selectedMail() && getElementId(this.selectedMail()!) === getElementId(mail)) {
				const remaining = this.queuedMails()
				this.selectedMail(remaining.length > 0 ? remaining[0] : null)
			}

			m.redraw()
		} catch (error) {
			console.error("Failed to remove mail from Reply Later", error)
			throw error
		}
	}

	/**
	 * Reply to the selected mail
	 */
	async replyToMail(mail: Mail, replyAll: boolean = false): Promise<void> {
		try {
			// Open compose dialog
			await this.onCompose(mail, replyAll)

			// Optionally auto-archive after reply
			// (this could be a user preference)
			// await this.removeFromQueue(mail)
		} catch (error) {
			console.error("Failed to reply to mail", error)
			throw error
		}
	}

	/**
	 * Select a mail for viewing/replying
	 */
	selectMail(mail: Mail): void {
		this.selectedMail(mail)
		m.redraw()
	}

	/**
	 * Start batch reply mode
	 */
	startBatchReply(): void {
		if (this.queuedMails().length === 0) {
			return
		}

		this.batchReplyMode(true)
		this.batchIndex(0)
		this.selectedMail(this.queuedMails()[0])
		m.redraw()
	}

	/**
	 * Exit batch reply mode
	 */
	exitBatchReply(): void {
		this.batchReplyMode(false)
		this.batchIndex(0)
		m.redraw()
	}

	/**
	 * Move to next email in batch reply mode
	 */
	nextInBatch(): void {
		if (!this.batchReplyMode()) {
			return
		}

		const currentIndex = this.batchIndex()
		const mails = this.queuedMails()

		if (currentIndex < mails.length - 1) {
			this.batchIndex(currentIndex + 1)
			this.selectedMail(mails[currentIndex + 1])
		} else {
			// Reached the end
			this.exitBatchReply()
		}

		m.redraw()
	}

	/**
	 * Move to previous email in batch reply mode
	 */
	previousInBatch(): void {
		if (!this.batchReplyMode()) {
			return
		}

		const currentIndex = this.batchIndex()
		const mails = this.queuedMails()

		if (currentIndex > 0) {
			this.batchIndex(currentIndex - 1)
			this.selectedMail(mails[currentIndex - 1])
		}

		m.redraw()
	}

	/**
	 * Skip current email in batch reply mode
	 */
	skipInBatch(): void {
		this.nextInBatch()
	}

	/**
	 * Mark current email as done (archive) in batch reply mode
	 */
	async doneInBatch(): Promise<void> {
		const current = this.selectedMail()
		if (!current) {
			return
		}

		await this.removeFromQueue(current)
		this.nextInBatch()
	}

	/**
	 * Get the progress in batch reply mode
	 */
	getBatchProgress(): { current: number; total: number } {
		return {
			current: this.batchIndex() + 1,
			total: this.queuedMails().length,
		}
	}

	/**
	 * Get archive folder
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
	 * Refresh the queue
	 */
	async refresh(): Promise<void> {
		await this.loadQueuedMails()
	}

	/**
	 * Cleanup when view is destroyed
	 */
	dispose(): void {
		this.queuedMails([])
		this.selectedMail(null)
		this.batchReplyMode(false)
	}
}
