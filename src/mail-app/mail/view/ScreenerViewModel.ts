import { Mail, MailFolder } from "../../../common/api/entities/tutanota/TypeRefs.js"
import { assertMainOrNode } from "../../../common/api/common/Env.js"
import Stream from "mithril/stream"
import { MailModel } from "../model/MailModel.js"
import { MailClassifier, MailDestination } from "../model/MailClassifier.js"
import { asyncFind, mapWithout, promiseMap } from "@tutao/tutanota-utils"
import { getElementId } from "../../../common/api/common/utils/EntityUtils.js"
import m from "mithril"

assertMainOrNode()

/**
 * ViewModel for the Screener view.
 * Manages the list of unscreened emails and handles sender classification.
 */
export class ScreenerViewModel {
	/** List of emails awaiting screening */
	readonly unscreenedMails: Stream<ReadonlyArray<Mail>>
	/** Currently selected mail for detailed view */
	readonly selectedMail: Stream<Mail | null>
	/** Whether the view is currently loading */
	readonly loading: Stream<boolean>
	/** The screener folder */
	private screenerFolder: MailFolder | null = null

	constructor(
		private readonly mailModel: MailModel,
		private readonly classifier: MailClassifier,
	) {
		this.unscreenedMails = Stream([])
		this.selectedMail = Stream(null)
		this.loading = Stream(false)
	}

	/**
	 * Initialize the screener view with the screener folder
	 */
	async init(screenerFolder: MailFolder): Promise<void> {
		this.screenerFolder = screenerFolder
		await this.loadUnscreenedMails()
	}

	/**
	 * Load all emails in the screener folder
	 */
	async loadUnscreenedMails(): Promise<void> {
		if (!this.screenerFolder) {
			console.warn("Screener folder not set")
			return
		}

		this.loading(true)
		try {
			// Load mails from screener folder
			// Note: This would need to integrate with MailListModel for proper loading
			// For now, this is a simplified version
			const mails = await this.mailModel.getMailsInFolder(this.screenerFolder)
			this.unscreenedMails(mails)

			// Auto-select first mail if none selected
			if (!this.selectedMail() && mails.length > 0) {
				this.selectedMail(mails[0])
			}
		} catch (error) {
			console.error("Failed to load unscreened mails", error)
			this.unscreenedMails([])
		} finally {
			this.loading(false)
			m.redraw()
		}
	}

	/**
	 * Classify a sender and move this email (and all others from same sender)
	 */
	async classifySender(mail: Mail, destination: MailDestination): Promise<void> {
		const senderAddress = mail.sender.address

		try {
			// Save classification
			await this.classifier.classifySender(senderAddress, destination)

			// Move this email to destination folder
			await this.moveToDestination([mail], destination)

			// Find and move all other emails from the same sender
			const otherMailsFromSender = this.unscreenedMails().filter((m) => m.sender.address === senderAddress && getElementId(m) !== getElementId(mail))

			if (otherMailsFromSender.length > 0) {
				await this.moveToDestination(otherMailsFromSender, destination)
			}

			// Remove classified mails from the list
			const mailsToRemove = [mail, ...otherMailsFromSender]
			this.unscreenedMails(mapWithout(this.unscreenedMails(), mailsToRemove))

			// Select next mail if current was removed
			if (this.selectedMail() && mailsToRemove.includes(this.selectedMail()!)) {
				const remaining = this.unscreenedMails()
				this.selectedMail(remaining.length > 0 ? remaining[0] : null)
			}

			m.redraw()
		} catch (error) {
			console.error("Failed to classify sender", error)
			throw error
		}
	}

	/**
	 * Classify multiple emails at once
	 */
	async classifyBatch(mails: ReadonlyArray<Mail>, destination: MailDestination): Promise<void> {
		this.loading(true)
		try {
			// Group by sender
			const mailsBySender = new Map<string, Mail[]>()
			for (const mail of mails) {
				const sender = mail.sender.address
				if (!mailsBySender.has(sender)) {
					mailsBySender.set(sender, [])
				}
				mailsBySender.get(sender)!.push(mail)
			}

			// Classify each sender
			await promiseMap([...mailsBySender.keys()], async (sender) => {
				await this.classifier.classifySender(sender, destination)
			})

			// Move all mails
			await this.moveToDestination(mails, destination)

			// Remove from list
			this.unscreenedMails(mapWithout(this.unscreenedMails(), mails))

			// Clear selection if selected mail was removed
			if (this.selectedMail() && mails.includes(this.selectedMail()!)) {
				const remaining = this.unscreenedMails()
				this.selectedMail(remaining.length > 0 ? remaining[0] : null)
			}

			m.redraw()
		} catch (error) {
			console.error("Failed to classify batch", error)
			throw error
		} finally {
			this.loading(false)
		}
	}

	/**
	 * Skip classification for now (keeps mail in screener)
	 */
	skipMail(mail: Mail): void {
		// Just move to next mail, leave this one in screener
		const mails = this.unscreenedMails()
		const currentIndex = mails.indexOf(mail)
		if (currentIndex !== -1 && currentIndex < mails.length - 1) {
			this.selectedMail(mails[currentIndex + 1])
		}
	}

	/**
	 * Select a mail for viewing
	 */
	selectMail(mail: Mail): void {
		this.selectedMail(mail)
		m.redraw()
	}

	/**
	 * Get count of unscreened emails
	 */
	getUnscreenedCount(): number {
		return this.unscreenedMails().length
	}

	/**
	 * Move emails to the destination folder based on classification
	 */
	private async moveToDestination(mails: ReadonlyArray<Mail>, destination: MailDestination): Promise<void> {
		const targetFolder = await this.getTargetFolder(destination)
		if (!targetFolder) {
			throw new Error(`Target folder for destination ${destination} not found`)
		}

		await this.mailModel.moveMails(mails, targetFolder)
	}

	/**
	 * Get the target folder for a given destination
	 */
	private async getTargetFolder(destination: MailDestination): Promise<MailFolder | null> {
		// Note: These folder types would need to be added to MailSetKind
		// For now, we'll map to existing folders as placeholders
		const folderSystem = await this.mailModel.getMailboxDetails().then((details) => details.mailbox.folders)

		switch (destination) {
			case MailDestination.IMBOX:
				// TODO: Get IMBOX folder (new system folder)
				// For now, use INBOX as fallback
				return folderSystem?.getSystemFolderByType(MailSetKind.INBOX) ?? null
			case MailDestination.FEED:
				// TODO: Get FEED folder (new system folder)
				// For now, use custom folder or ARCHIVE
				return folderSystem?.getSystemFolderByType(MailSetKind.ARCHIVE) ?? null
			case MailDestination.PAPER_TRAIL:
				// TODO: Get PAPER_TRAIL folder (new system folder)
				// For now, use ARCHIVE
				return folderSystem?.getSystemFolderByType(MailSetKind.ARCHIVE) ?? null
			case MailDestination.BLOCKED:
				return folderSystem?.getSystemFolderByType(MailSetKind.SPAM) ?? null
			default:
				return folderSystem?.getSystemFolderByType(MailSetKind.INBOX) ?? null
		}
	}

	/**
	 * Cleanup when view is destroyed
	 */
	dispose(): void {
		// Cleanup if needed
		this.unscreenedMails([])
		this.selectedMail(null)
	}
}
