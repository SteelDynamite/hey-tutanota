import { Mail, MailFolder } from "../../../common/api/entities/tutanota/TypeRefs.js"
import { assertMainOrNode } from "../../../common/api/common/Env.js"
import Stream from "mithril/stream"
import { MailModel } from "../model/MailModel.js"
import { getElementId } from "../../../common/api/common/utils/EntityUtils.js"
import { mapWithout } from "@tutao/tutanota-utils"
import { BubbleUpSchedule } from "../model/HeyStyleTypes.js"
import m from "mithril"

assertMainOrNode()

/**
 * ViewModel for the Set Aside view.
 * Manages emails temporarily set aside for later review.
 * Supports "Bubble Up" scheduling to resurface emails at specific times.
 */
export class SetAsideViewModel {
	/** List of set aside emails */
	readonly setAsideMails: Stream<ReadonlyArray<Mail>>
	/** Currently selected mail */
	readonly selectedMail: Stream<Mail | null>
	/** Whether the view is currently loading */
	readonly loading: Stream<boolean>
	/** Map of mail ID to bubble up schedule */
	private bubbleUpSchedules: Map<Id, BubbleUpSchedule> = new Map()
	/** The set aside folder */
	private setAsideFolder: MailFolder | null = null

	constructor(
		private readonly mailModel: MailModel,
		private readonly scheduleBubbleUp: (mailId: IdTuple, date: Date, notify: boolean) => Promise<void>,
		private readonly getBubbleUpSchedule: (mailId: IdTuple) => Promise<BubbleUpSchedule | null>,
		private readonly cancelBubbleUp: (mailId: IdTuple) => Promise<void>,
	) {
		this.setAsideMails = Stream([])
		this.selectedMail = Stream(null)
		this.loading = Stream(false)
	}

	/**
	 * Initialize the set aside view with the folder
	 */
	async init(setAsideFolder: MailFolder): Promise<void> {
		this.setAsideFolder = setAsideFolder
		await this.loadSetAsideMails()
	}

	/**
	 * Load emails from set aside folder
	 */
	async loadSetAsideMails(): Promise<void> {
		if (!this.setAsideFolder) {
			console.warn("Set Aside folder not set")
			return
		}

		this.loading(true)
		try {
			// Load mails sorted by date (newest first)
			const mails = await this.mailModel.getMailsInFolder(this.setAsideFolder, {
				limit: 200,
				sortDescending: true,
			})

			this.setAsideMails(mails)

			// Load bubble up schedules for these mails
			await this.loadBubbleUpSchedules(mails)

			// Auto-select first mail if none selected
			if (!this.selectedMail() && mails.length > 0) {
				this.selectedMail(mails[0])
			}
		} catch (error) {
			console.error("Failed to load set aside mails", error)
			this.setAsideMails([])
		} finally {
			this.loading(false)
			m.redraw()
		}
	}

	/**
	 * Load bubble up schedules for given mails
	 */
	private async loadBubbleUpSchedules(mails: ReadonlyArray<Mail>): Promise<void> {
		this.bubbleUpSchedules.clear()

		for (const mail of mails) {
			const schedule = await this.getBubbleUpSchedule(mail._id)
			if (schedule) {
				this.bubbleUpSchedules.set(getElementId(mail), schedule)
			}
		}
	}

	/**
	 * Add a mail to set aside
	 */
	async setAside(mail: Mail): Promise<void> {
		if (!this.setAsideFolder) {
			throw new Error("Set Aside folder not set")
		}

		try {
			await this.mailModel.moveMails([mail], this.setAsideFolder)
			await this.loadSetAsideMails()
		} catch (error) {
			console.error("Failed to set aside mail", error)
			throw error
		}
	}

	/**
	 * Remove a mail from set aside (move back to original folder or archive)
	 */
	async removeFromSetAside(mail: Mail, archive: boolean = false): Promise<void> {
		try {
			// Check if there's a bubble up schedule with original folder
			const schedule = this.bubbleUpSchedules.get(getElementId(mail))
			let targetFolder: MailFolder

			if (schedule?.originalFolder && !archive) {
				// Move back to original folder
				targetFolder = await this.mailModel.getFolder(schedule.originalFolder)
			} else {
				// Archive
				targetFolder = await this.getArchiveFolder()
			}

			await this.mailModel.moveMails([mail], targetFolder)

			// Cancel bubble up schedule if exists
			if (schedule) {
				await this.cancelBubbleUp(mail._id)
			}

			// Remove from list
			this.setAsideMails(mapWithout(this.setAsideMails(), [mail]))

			// Update selection
			if (this.selectedMail() && getElementId(this.selectedMail()!) === getElementId(mail)) {
				const remaining = this.setAsideMails()
				this.selectedMail(remaining.length > 0 ? remaining[0] : null)
			}

			m.redraw()
		} catch (error) {
			console.error("Failed to remove mail from Set Aside", error)
			throw error
		}
	}

	/**
	 * Schedule a mail to bubble up at a specific time
	 */
	async scheduleBubbleUpForMail(mail: Mail, bubbleUpDate: Date, notify: boolean = true): Promise<void> {
		try {
			await this.scheduleBubbleUp(mail._id, bubbleUpDate, notify)

			// Reload schedules
			await this.loadBubbleUpSchedules(this.setAsideMails())

			m.redraw()
		} catch (error) {
			console.error("Failed to schedule bubble up", error)
			throw error
		}
	}

	/**
	 * Cancel bubble up schedule for a mail
	 */
	async cancelBubbleUpForMail(mail: Mail): Promise<void> {
		try {
			await this.cancelBubbleUp(mail._id)

			// Remove from schedule map
			this.bubbleUpSchedules.delete(getElementId(mail))

			m.redraw()
		} catch (error) {
			console.error("Failed to cancel bubble up", error)
			throw error
		}
	}

	/**
	 * Get bubble up schedule for a mail
	 */
	getBubbleUpScheduleForMail(mail: Mail): BubbleUpSchedule | null {
		return this.bubbleUpSchedules.get(getElementId(mail)) || null
	}

	/**
	 * Check if a mail has a bubble up schedule
	 */
	hasBubbleUpSchedule(mail: Mail): boolean {
		return this.bubbleUpSchedules.has(getElementId(mail))
	}

	/**
	 * Select a mail for viewing
	 */
	selectMail(mail: Mail): void {
		this.selectedMail(mail)
		m.redraw()
	}

	/**
	 * Get mails grouped by bubble up status
	 */
	getGroupedMails(): {
		scheduled: ReadonlyArray<Mail>
		unscheduled: ReadonlyArray<Mail>
	} {
		const mails = this.setAsideMails()
		const scheduled: Mail[] = []
		const unscheduled: Mail[] = []

		for (const mail of mails) {
			if (this.hasBubbleUpSchedule(mail)) {
				scheduled.push(mail)
			} else {
				unscheduled.push(mail)
			}
		}

		// Sort scheduled by bubble up time (soonest first)
		scheduled.sort((a, b) => {
			const scheduleA = this.getBubbleUpScheduleForMail(a)
			const scheduleB = this.getBubbleUpScheduleForMail(b)
			if (!scheduleA || !scheduleB) return 0
			return scheduleA.bubbleUpAt.getTime() - scheduleB.bubbleUpAt.getTime()
		})

		return { scheduled, unscheduled }
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
	 * Refresh the set aside list
	 */
	async refresh(): Promise<void> {
		await this.loadSetAsideMails()
	}

	/**
	 * Cleanup when view is destroyed
	 */
	dispose(): void {
		this.setAsideMails([])
		this.selectedMail(null)
		this.bubbleUpSchedules.clear()
	}
}
