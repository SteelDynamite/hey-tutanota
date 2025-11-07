import { Mail } from "../../../common/api/entities/tutanota/TypeRefs.js"
import { MailSetKind } from "../../../common/api/common/TutanotaConstants.js"
import { assertMainOrNode } from "../../../common/api/common/Env.js"
import { elementIdPart } from "../../../common/api/common/utils/EntityUtils.js"
import { getMailHeaders } from "./MailUtils.js"

assertMainOrNode()

/**
 * Destination categories for HEY-style mail classification
 */
export enum MailDestination {
	/** New senders awaiting classification */
	SCREENER = "screener",
	/** Important personal emails */
	IMBOX = "imbox",
	/** Newsletters and bulk emails */
	FEED = "feed",
	/** Receipts, confirmations, transactional emails */
	PAPER_TRAIL = "paper_trail",
	/** Blocked senders */
	BLOCKED = "blocked",
}

/**
 * Stored classification for a sender
 */
export interface SenderClassification {
	_id: IdTuple
	senderAddress: string
	destination: MailDestination
	classifiedAt: Date
	autoClassified: boolean
	userId: Id
}

/**
 * Handles classification of incoming emails based on sender and content characteristics.
 * Implements HEY-style email routing (Screener -> Imbox/Feed/Paper Trail).
 */
export class MailClassifier {
	// In-memory cache of sender classifications
	private classificationCache: Map<string, MailDestination> = new Map()

	constructor(
		private readonly userId: Id,
		private readonly getSenderClassification: (senderAddress: string) => Promise<SenderClassification | null>,
		private readonly saveSenderClassification: (
			senderAddress: string,
			destination: MailDestination,
			autoClassified: boolean,
		) => Promise<void>,
	) {}

	/**
	 * Determines where an incoming email should be routed.
	 * Checks sender classification first, then applies heuristics for auto-classification.
	 */
	async classifyMail(mail: Mail): Promise<MailDestination> {
		const sender = mail.sender.address.toLowerCase()

		// Check cache first
		const cachedDestination = this.classificationCache.get(sender)
		if (cachedDestination) {
			return cachedDestination
		}

		// Check persistent storage
		const classification = await this.getSenderClassification(sender)
		if (classification) {
			this.classificationCache.set(sender, classification.destination)
			return classification.destination
		}

		// Try auto-classification based on email characteristics
		const autoDestination = await this.tryAutoClassify(mail)
		if (autoDestination) {
			// Save auto-classification for future emails from this sender
			await this.saveSenderClassification(sender, autoDestination, true)
			this.classificationCache.set(sender, autoDestination)
			return autoDestination
		}

		// Route to screener for manual classification
		return MailDestination.SCREENER
	}

	/**
	 * Manually classify a sender (from Screener UI or settings)
	 */
	async classifySender(senderAddress: string, destination: MailDestination): Promise<void> {
		const normalizedAddress = senderAddress.toLowerCase()
		await this.saveSenderClassification(normalizedAddress, destination, false)
		this.classificationCache.set(normalizedAddress, destination)
	}

	/**
	 * Get the current classification for a sender
	 */
	async getClassificationForSender(senderAddress: string): Promise<MailDestination | null> {
		const normalizedAddress = senderAddress.toLowerCase()

		// Check cache first
		const cachedDestination = this.classificationCache.get(normalizedAddress)
		if (cachedDestination) {
			return cachedDestination
		}

		// Check storage
		const classification = await this.getSenderClassification(normalizedAddress)
		if (classification) {
			this.classificationCache.set(normalizedAddress, classification.destination)
			return classification.destination
		}

		return null
	}

	/**
	 * Clear cached classifications (useful after bulk operations)
	 */
	clearCache(): void {
		this.classificationCache.clear()
	}

	/**
	 * Attempts to auto-classify based on email characteristics.
	 * Returns null if no automatic classification can be determined.
	 */
	private async tryAutoClassify(mail: Mail): Promise<MailDestination | null> {
		// Paper Trail detection (receipts, confirmations, transactional)
		if (this.isPaperTrail(mail)) {
			return MailDestination.PAPER_TRAIL
		}

		// Newsletter detection (bulk, marketing, newsletters)
		if (await this.isNewsletter(mail)) {
			return MailDestination.FEED
		}

		// No automatic classification possible
		return null
	}

	/**
	 * Detects if an email is a receipt, confirmation, or transactional email
	 */
	private isPaperTrail(mail: Mail): boolean {
		const subject = mail.subject.toLowerCase()
		const sender = mail.sender.address.toLowerCase()
		const senderName = mail.sender.name?.toLowerCase() || ""

		// Common keywords in receipt/confirmation subjects
		const paperTrailKeywords = [
			"receipt",
			"confirmation",
			"order",
			"tracking",
			"invoice",
			"payment",
			"shipping",
			"delivered",
			"purchase",
			"transaction",
			"ticket",
			"booking",
			"reservation",
			"statement",
			"bill",
			"subscription",
		]

		// Common sender patterns for transactional emails
		const paperTrailSenderPatterns = [
			"noreply@",
			"no-reply@",
			"donotreply@",
			"do-not-reply@",
			"automated@",
			"receipts@",
			"notifications@",
			"orders@",
			"shipping@",
			"billing@",
			"accounts@",
			"support@",
			"help@",
		]

		// Check subject for keywords
		const hasKeyword = paperTrailKeywords.some((keyword) => subject.includes(keyword))

		// Check sender address patterns
		const hasSenderPattern = paperTrailSenderPatterns.some((pattern) => sender.includes(pattern))

		// Check sender name patterns
		const hasNamePattern = senderName.includes("noreply") || senderName.includes("no reply") || senderName.includes("automated")

		return hasKeyword || hasSenderPattern || hasNamePattern
	}

	/**
	 * Detects if an email is a newsletter or bulk/marketing email
	 */
	private async isNewsletter(mail: Mail): boolean {
		// Check for List-Unsubscribe header (standard for newsletters)
		const headers = await getMailHeaders(mail)
		if (headers) {
			const listUnsubscribe = headers["list-unsubscribe"]
			if (listUnsubscribe) {
				return true
			}

			// Check Precedence header
			const precedence = headers["precedence"]?.toLowerCase()
			if (precedence === "bulk" || precedence === "list") {
				return true
			}

			// Check for List-Id header
			const listId = headers["list-id"]
			if (listId) {
				return true
			}
		}

		const subject = mail.subject.toLowerCase()
		const sender = mail.sender.address.toLowerCase()

		// Common newsletter subject patterns
		const newsletterKeywords = ["newsletter", "digest", "weekly", "daily", "monthly", "update", "roundup", "bulletin"]

		// Common newsletter sender patterns
		const newsletterSenderPatterns = ["newsletter@", "news@", "updates@", "marketing@", "info@", "hello@"]

		const hasKeyword = newsletterKeywords.some((keyword) => subject.includes(keyword))
		const hasSenderPattern = newsletterSenderPatterns.some((pattern) => sender.includes(pattern))

		return hasKeyword || hasSenderPattern
	}

	/**
	 * Converts MailDestination to corresponding MailSetKind folder type
	 */
	static destinationToFolderType(destination: MailDestination): MailSetKind {
		switch (destination) {
			case MailDestination.SCREENER:
				// Note: SCREENER would be a new MailSetKind to be added
				// For now, we'll use CUSTOM as a placeholder
				return MailSetKind.CUSTOM
			case MailDestination.IMBOX:
				// Note: IMBOX would be a new MailSetKind to be added
				// For now, use INBOX as fallback
				return MailSetKind.INBOX
			case MailDestination.FEED:
				// Note: FEED would be a new MailSetKind to be added
				return MailSetKind.CUSTOM
			case MailDestination.PAPER_TRAIL:
				// Note: PAPER_TRAIL would be a new MailSetKind to be added
				return MailSetKind.CUSTOM
			case MailDestination.BLOCKED:
				return MailSetKind.SPAM
			default:
				return MailSetKind.INBOX
		}
	}

	/**
	 * Determines if a folder is a HEY-style special folder
	 */
	static isHeyStyleFolder(folderType: MailSetKind): boolean {
		// This will need to be updated once we add the new MailSetKind values
		return false
	}
}

/**
 * Helper function to normalize email addresses for consistent classification
 */
export function normalizeEmailAddress(address: string): string {
	return address.toLowerCase().trim()
}

/**
 * Helper to determine if an email is likely person-to-person communication
 */
export function isPersonalEmail(mail: Mail): boolean {
	// Heuristics for detecting personal emails:
	// - Not from common automated addresses
	// - Has a sender name
	// - Not in CC or BCC (direct communication)
	// - Subject doesn't contain automated patterns

	const sender = mail.sender.address.toLowerCase()
	const hasSenderName = mail.sender.name && mail.sender.name.length > 0

	const automatedPatterns = ["noreply", "no-reply", "donotreply", "automated", "bot@", "system@"]
	const isAutomated = automatedPatterns.some((pattern) => sender.includes(pattern))

	return hasSenderName && !isAutomated
}
