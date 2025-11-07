/**
 * Type definitions for HEY-style email classification features.
 * These types would eventually be code-generated from model definitions.
 */

import { assertMainOrNode } from "../../../common/api/common/Env.js"

assertMainOrNode()

/**
 * SenderClassification entity
 * Stores user's classification decision for email senders
 */
export interface SenderClassification {
	_type: "SenderClassification"
	_id: IdTuple
	_ownerGroup: Id | null
	_permissions: Id

	/** Email address of the sender (normalized to lowercase) */
	senderAddress: string

	/** Where emails from this sender should be routed */
	destination: string // MailDestination enum as string

	/** Timestamp when classification was made */
	classifiedAt: Date

	/** Whether this was auto-classified by heuristics */
	autoClassified: boolean

	/** User who made the classification */
	userId: Id
}

/**
 * BubbleUpSchedule entity
 * Stores scheduled times for emails to "bubble up" (resurface)
 */
export interface BubbleUpSchedule {
	_type: "BubbleUpSchedule"
	_id: IdTuple
	_ownerGroup: Id | null
	_permissions: Id

	/** The mail that should bubble up */
	mail: IdTuple

	/** Original folder before being set aside */
	originalFolder: IdTuple | null

	/** When the email should resurface */
	bubbleUpAt: Date

	/** Whether to send a notification when bubbling up */
	notificationEnabled: boolean

	/** Whether this bubble-up has been processed */
	processed: boolean

	/** User who scheduled this */
	userId: Id
}

/**
 * AttachmentMetadata entity
 * Indexed metadata for all email attachments for the Files view
 */
export interface AttachmentMetadata {
	_type: "AttachmentMetadata"
	_id: IdTuple
	_ownerGroup: Id | null
	_permissions: Id

	/** The mail this attachment belongs to */
	mail: IdTuple

	/** File ID reference */
	fileId: IdTuple

	/** Original filename */
	filename: string

	/** MIME type */
	mimeType: string

	/** File size in bytes */
	size: number

	/** Sender of the email containing this attachment */
	senderAddress: string

	/** When the email was received */
	receivedDate: Date

	/** User who owns this attachment */
	userId: Id
}

/**
 * Extended MailSetKind values for HEY-style folders
 * These would be added to the existing MailSetKind enum
 */
export const HeyStyleMailSetKind = {
	/** Screener folder - for unclassified new senders */
	SCREENER: "10",

	/** Imbox folder - for important personal emails */
	IMBOX: "11",

	/** Feed folder - for newsletters and bulk emails */
	FEED: "12",

	/** Paper Trail folder - for receipts and transactional emails */
	PAPER_TRAIL: "13",

	/** Reply Later folder - queue for emails needing responses */
	REPLY_LATER: "14",

	/** Set Aside folder - temporary holding area */
	SET_ASIDE: "15",
} as const

/**
 * Type guard to check if a folder is a HEY-style folder
 */
export function isHeyStyleFolder(folderType: string): boolean {
	return Object.values(HeyStyleMailSetKind).includes(folderType)
}

/**
 * Get the display name for a HEY-style folder
 */
export function getHeyStyleFolderName(folderType: string): string {
	switch (folderType) {
		case HeyStyleMailSetKind.SCREENER:
			return "The Screener"
		case HeyStyleMailSetKind.IMBOX:
			return "The Imbox"
		case HeyStyleMailSetKind.FEED:
			return "The Feed"
		case HeyStyleMailSetKind.PAPER_TRAIL:
			return "Paper Trail"
		case HeyStyleMailSetKind.REPLY_LATER:
			return "Reply Later"
		case HeyStyleMailSetKind.SET_ASIDE:
			return "Set Aside"
		default:
			return "Unknown"
	}
}

/**
 * Type guard to check if a folder should use conversation view
 */
export function shouldUseConversationView(folderType: string): boolean {
	// Feed and Paper Trail should not use conversation view
	return folderType !== HeyStyleMailSetKind.FEED && folderType !== HeyStyleMailSetKind.PAPER_TRAIL
}

/**
 * Get icon for HEY-style folder
 */
export function getHeyStyleFolderIcon(folderType: string): string {
	switch (folderType) {
		case HeyStyleMailSetKind.SCREENER:
			return "shield" // or custom icon
		case HeyStyleMailSetKind.IMBOX:
			return "star" // or custom icon
		case HeyStyleMailSetKind.FEED:
			return "rss" // or custom icon
		case HeyStyleMailSetKind.PAPER_TRAIL:
			return "receipt" // or custom icon
		case HeyStyleMailSetKind.REPLY_LATER:
			return "schedule" // or custom icon
		case HeyStyleMailSetKind.SET_ASIDE:
			return "bookmark" // or custom icon
		default:
			return "folder"
	}
}

/**
 * Database schema definitions for migration
 */
export const HEY_STYLE_SCHEMA = {
	senderClassifications: {
		tableName: "sender_classifications",
		columns: {
			_id: "VARCHAR(64) PRIMARY KEY",
			_ownerGroup: "VARCHAR(64)",
			_permissions: "VARCHAR(64)",
			senderAddress: "VARCHAR(255) NOT NULL",
			destination: "VARCHAR(20) NOT NULL",
			classifiedAt: "BIGINT NOT NULL",
			autoClassified: "BOOLEAN DEFAULT FALSE",
			userId: "VARCHAR(64) NOT NULL",
		},
		indexes: {
			idx_sender_address: "CREATE INDEX idx_sender_address ON sender_classifications(senderAddress)",
			idx_user_sender: "CREATE UNIQUE INDEX idx_user_sender ON sender_classifications(userId, senderAddress)",
		},
	},
	bubbleUpSchedule: {
		tableName: "bubble_up_schedule",
		columns: {
			_id: "VARCHAR(64) PRIMARY KEY",
			_ownerGroup: "VARCHAR(64)",
			_permissions: "VARCHAR(64)",
			mail: "VARCHAR(128) NOT NULL",
			originalFolder: "VARCHAR(128)",
			bubbleUpAt: "BIGINT NOT NULL",
			notificationEnabled: "BOOLEAN DEFAULT TRUE",
			processed: "BOOLEAN DEFAULT FALSE",
			userId: "VARCHAR(64) NOT NULL",
		},
		indexes: {
			idx_bubble_up_at: "CREATE INDEX idx_bubble_up_at ON bubble_up_schedule(bubbleUpAt)",
			idx_user_processed: "CREATE INDEX idx_user_processed ON bubble_up_schedule(userId, processed)",
		},
	},
	attachmentMetadata: {
		tableName: "attachment_metadata",
		columns: {
			_id: "VARCHAR(64) PRIMARY KEY",
			_ownerGroup: "VARCHAR(64)",
			_permissions: "VARCHAR(64)",
			mail: "VARCHAR(128) NOT NULL",
			fileId: "VARCHAR(128) NOT NULL",
			filename: "VARCHAR(255) NOT NULL",
			mimeType: "VARCHAR(100)",
			size: "INTEGER",
			senderAddress: "VARCHAR(255)",
			receivedDate: "BIGINT",
			userId: "VARCHAR(64) NOT NULL",
		},
		indexes: {
			idx_user_date: "CREATE INDEX idx_user_date ON attachment_metadata(userId, receivedDate DESC)",
			idx_filename: "CREATE INDEX idx_filename ON attachment_metadata(filename)",
			idx_mime_type: "CREATE INDEX idx_mime_type ON attachment_metadata(mimeType)",
		},
	},
}
