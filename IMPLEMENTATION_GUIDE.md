# HEY-Style Interface Implementation Guide

**Quick Start Guide for Developers**

This document provides step-by-step instructions for integrating the HEY-style interface components into Tutanota Mail.

---

## Overview

We've implemented the core components for a HEY.com-inspired email interface:

### Components Created

1. **MailClassifier** (`/src/mail-app/mail/model/MailClassifier.ts`)
   - Core classification logic
   - Auto-detection heuristics for Paper Trail and Feed
   - Sender management

2. **Screener View** (3 files)
   - `ScreenerViewModel.ts` - State management
   - `ScreenerView.ts` - Main UI component
   - `ScreenerCard.ts` - Individual email card

3. **Feed View** (3 files)
   - `FeedViewModel.ts` - State management with pagination
   - `FeedView.ts` - Scrollable feed UI
   - `FeedItem.ts` - Individual email in feed format

4. **Type Definitions** (`HeyStyleTypes.ts`)
   - Entity types for SenderClassification, BubbleUpSchedule, AttachmentMetadata
   - Extended MailSetKind values
   - Database schema definitions

---

## Phase 1: Database Setup

### Step 1: Add New MailSetKind Values

**File:** `/src/common/api/common/TutanotaConstants.ts`

```typescript
export enum MailSetKind {
	CUSTOM = "0",
	INBOX = "1",
	SENT = "2",
	TRASH = "3",
	ARCHIVE = "4",
	SPAM = "5",
	DRAFT = "6",
	ALL = "7",
	LABEL = "8",
	Imported = "9",
	SCREENER = "10",      // NEW
	IMBOX = "11",         // NEW
	FEED = "12",          // NEW
	PAPER_TRAIL = "13",   // NEW
	REPLY_LATER = "14",   // NEW
	SET_ASIDE = "15",     // NEW
}
```

### Step 2: Update Folder Sorting

**File:** `/src/common/api/common/mail/FolderSystem.ts`

Update the `folderTypeToOrder` object:

```typescript
const folderTypeToOrder: Record<SystemMailFolderTypes, number> = {
	[MailSetKind.SCREENER]: 0,      // NEW - First priority
	[MailSetKind.IMBOX]: 1,         // NEW
	[MailSetKind.FEED]: 2,          // NEW
	[MailSetKind.PAPER_TRAIL]: 3,   // NEW
	[MailSetKind.INBOX]: 4,         // Moved down
	[MailSetKind.DRAFT]: 5,
	[MailSetKind.SENT]: 6,
	[MailSetKind.REPLY_LATER]: 7,   // NEW
	[MailSetKind.SET_ASIDE]: 8,     // NEW
	[MailSetKind.TRASH]: 9,
	[MailSetKind.ARCHIVE]: 10,
	[MailSetKind.SPAM]: 11,
	[MailSetKind.ALL]: 12,
}
```

### Step 3: Create Database Migration

**File:** `/src/common/api/worker/migrations/migration-hey-style-folders.ts`

```typescript
import { OfflineStorage } from "../offline/OfflineStorage.js"
import { HEY_STYLE_SCHEMA } from "../../../mail-app/mail/model/HeyStyleTypes.js"

export async function migrateToHeyStyleFolders(storage: OfflineStorage): Promise<void> {
	const db = storage.getDatabase()

	// Create sender_classifications table
	await db.run(`
		CREATE TABLE IF NOT EXISTS sender_classifications (
			_id VARCHAR(64) PRIMARY KEY,
			_ownerGroup VARCHAR(64),
			_permissions VARCHAR(64),
			senderAddress VARCHAR(255) NOT NULL,
			destination VARCHAR(20) NOT NULL,
			classifiedAt BIGINT NOT NULL,
			autoClassified BOOLEAN DEFAULT FALSE,
			userId VARCHAR(64) NOT NULL
		)
	`)

	await db.run(
		"CREATE INDEX IF NOT EXISTS idx_sender_address ON sender_classifications(senderAddress)"
	)

	await db.run(
		"CREATE UNIQUE INDEX IF NOT EXISTS idx_user_sender ON sender_classifications(userId, senderAddress)"
	)

	// Create bubble_up_schedule table
	await db.run(`
		CREATE TABLE IF NOT EXISTS bubble_up_schedule (
			_id VARCHAR(64) PRIMARY KEY,
			_ownerGroup VARCHAR(64),
			_permissions VARCHAR(64),
			mail VARCHAR(128) NOT NULL,
			originalFolder VARCHAR(128),
			bubbleUpAt BIGINT NOT NULL,
			notificationEnabled BOOLEAN DEFAULT TRUE,
			processed BOOLEAN DEFAULT FALSE,
			userId VARCHAR(64) NOT NULL
		)
	`)

	await db.run(
		"CREATE INDEX IF NOT EXISTS idx_bubble_up_at ON bubble_up_schedule(bubbleUpAt)"
	)

	// Create attachment_metadata table
	await db.run(`
		CREATE TABLE IF NOT EXISTS attachment_metadata (
			_id VARCHAR(64) PRIMARY KEY,
			_ownerGroup VARCHAR(64),
			_permissions VARCHAR(64),
			mail VARCHAR(128) NOT NULL,
			fileId VARCHAR(128) NOT NULL,
			filename VARCHAR(255) NOT NULL,
			mimeType VARCHAR(100),
			size INTEGER,
			senderAddress VARCHAR(255),
			receivedDate BIGINT,
			userId VARCHAR(64) NOT NULL
		)
	`)

	await db.run(
		"CREATE INDEX IF NOT EXISTS idx_user_date ON attachment_metadata(userId, receivedDate DESC)"
	)
}
```

---

## Phase 2: MailFacade Integration

### Step 4: Extend MailFacade

**File:** `/src/common/api/worker/facades/lazy/MailFacade.ts`

Add these methods to MailFacade:

```typescript
/**
 * Get sender classification for a given email address
 */
async getSenderClassification(senderAddress: string): Promise<SenderClassification | null> {
	const userId = this.loginFacade.getUserId()
	const normalized = senderAddress.toLowerCase()

	// Query from database
	const result = await this.db.getSenderClassification(userId, normalized)
	return result
}

/**
 * Save a sender classification
 */
async saveSenderClassification(
	senderAddress: string,
	destination: MailDestination,
	autoClassified: boolean
): Promise<void> {
	const userId = this.loginFacade.getUserId()
	const normalized = senderAddress.toLowerCase()

	const classification: SenderClassification = {
		_type: "SenderClassification",
		_id: generateId(),
		_ownerGroup: null,
		_permissions: generateId(),
		senderAddress: normalized,
		destination,
		classifiedAt: new Date(),
		autoClassified,
		userId,
	}

	await this.db.saveSenderClassification(classification)

	// Also send to server for sync across devices
	await this.serviceExecutor.post(SenderClassificationService, classification)
}

/**
 * Get all sender classifications for the current user
 */
async getAllSenderClassifications(): Promise<SenderClassification[]> {
	const userId = this.loginFacade.getUserId()
	return this.db.getAllSenderClassifications(userId)
}

/**
 * Delete a sender classification
 */
async deleteSenderClassification(senderAddress: string): Promise<void> {
	const userId = this.loginFacade.getUserId()
	const normalized = senderAddress.toLowerCase()
	await this.db.deleteSenderClassification(userId, normalized)
}
```

---

## Phase 3: Mail Routing Integration

### Step 5: Integrate with InboxRuleHandler

**File:** `/src/mail-app/mail/model/InboxRuleHandler.ts`

Add classification check before existing inbox rules:

```typescript
import { MailClassifier, MailDestination } from "./MailClassifier.js"

export class InboxRuleHandler {
	private classifier: MailClassifier | null = null

	async init(mailFacade: MailFacade, userId: Id): Promise<void> {
		// Initialize classifier
		this.classifier = new MailClassifier(
			userId,
			(sender) => mailFacade.getSenderClassification(sender),
			(sender, dest, auto) => mailFacade.saveSenderClassification(sender, dest, auto)
		)
	}

	async processIncomingMail(mail: Mail): Promise<void> {
		if (!this.classifier) {
			console.warn("MailClassifier not initialized")
			return
		}

		// Step 1: Check HEY-style classification first
		const destination = await this.classifier.classifyMail(mail)

		if (destination !== MailDestination.SCREENER) {
			// Move to classified folder
			const targetFolder = this.getHeyStyleFolder(destination)
			if (targetFolder) {
				await this.moveMail(mail, targetFolder)
				return
			}
		}

		// Step 2: If routed to screener or classification failed,
		// apply traditional inbox rules
		await this.applyInboxRules(mail)
	}

	private getHeyStyleFolder(destination: MailDestination): MailFolder | null {
		const folderSystem = this.mailModel.getFolderSystem()

		switch (destination) {
			case MailDestination.SCREENER:
				return folderSystem.getSystemFolderByType(MailSetKind.SCREENER)
			case MailDestination.IMBOX:
				return folderSystem.getSystemFolderByType(MailSetKind.IMBOX)
			case MailDestination.FEED:
				return folderSystem.getSystemFolderByType(MailSetKind.FEED)
			case MailDestination.PAPER_TRAIL:
				return folderSystem.getSystemFolderByType(MailSetKind.PAPER_TRAIL)
			case MailDestination.BLOCKED:
				return folderSystem.getSystemFolderByType(MailSetKind.SPAM)
			default:
				return null
		}
	}
}
```

---

## Phase 4: UI Integration

### Step 6: Add to MailView Router

**File:** `/src/mail-app/mail/view/MailView.ts`

Add routes for new views:

```typescript
import { ScreenerView } from "./ScreenerView.js"
import { ScreenerViewModel } from "./ScreenerViewModel.js"
import { FeedView } from "./FeedView.js"
import { FeedViewModel } from "./FeedViewModel.js"

export class MailView {
	private screenerViewModel: ScreenerViewModel | null = null
	private feedViewModel: FeedViewModel | null = null

	async init(): Promise<void> {
		// Initialize view models
		this.screenerViewModel = new ScreenerViewModel(
			this.mailModel,
			this.getMailClassifier()
		)

		this.feedViewModel = new FeedViewModel(this.mailModel)
	}

	private getMailClassifier(): MailClassifier {
		// Initialize classifier with proper dependencies
		return new MailClassifier(
			this.logins.getUserId(),
			(sender) => this.mailFacade.getSenderClassification(sender),
			(sender, dest, auto) => this.mailFacade.saveSenderClassification(sender, dest, auto)
		)
	}

	// Add view rendering
	renderView(folder: MailFolder): Children {
		const folderType = folder.folderType

		switch (folderType) {
			case MailSetKind.SCREENER:
				return m(ScreenerView, { viewModel: this.screenerViewModel! })

			case MailSetKind.FEED:
				return m(FeedView, { viewModel: this.feedViewModel! })

			// Other HEY-style folders would go here...

			default:
				// Standard mail list view
				return this.renderStandardMailList(folder)
		}
	}
}
```

### Step 7: Update Folder Sidebar

**File:** `/src/mail-app/mail/view/MailFoldersView.ts`

Add HEY-style folders to sidebar:

```typescript
import { HeyStyleMailSetKind, getHeyStyleFolderName } from "../model/HeyStyleTypes.js"

private renderFolderList(): Children {
	const folderSystem = this.mailModel.getFolderSystem()

	return m(".folder-list", [
		// HEY-style section
		this.renderHeyStyleSection(folderSystem),

		// Divider
		m(".folder-divider"),

		// Traditional folders section
		this.renderTraditionalSection(folderSystem),
	])
}

private renderHeyStyleSection(folderSystem: FolderSystem): Children {
	return m(".hey-style-folders", [
		m(".section-header", "Mail"),
		this.renderFolderRow(folderSystem.getSystemFolderByType(MailSetKind.SCREENER)),
		this.renderFolderRow(folderSystem.getSystemFolderByType(MailSetKind.IMBOX)),
		this.renderFolderRow(folderSystem.getSystemFolderByType(MailSetKind.FEED)),
		this.renderFolderRow(folderSystem.getSystemFolderByType(MailSetKind.PAPER_TRAIL)),

		m(".section-header.mt", "Workflow"),
		this.renderFolderRow(folderSystem.getSystemFolderByType(MailSetKind.REPLY_LATER)),
		this.renderFolderRow(folderSystem.getSystemFolderByType(MailSetKind.SET_ASIDE)),
	])
}
```

---

## Phase 5: Mailbox Initialization

### Step 8: Create HEY-Style Folders on Mailbox Setup

**File:** `/src/common/api/worker/facades/lazy/MailFacade.ts`

Add folder creation logic:

```typescript
async initializeHeyStyleFolders(mailbox: MailBox): Promise<void> {
	const foldersToCreate = [
		{ name: "The Screener", type: MailSetKind.SCREENER },
		{ name: "The Imbox", type: MailSetKind.IMBOX },
		{ name: "The Feed", type: MailSetKind.FEED },
		{ name: "Paper Trail", type: MailSetKind.PAPER_TRAIL },
		{ name: "Reply Later", type: MailSetKind.REPLY_LATER },
		{ name: "Set Aside", type: MailSetKind.SET_ASIDE },
	]

	for (const folderDef of foldersToCreate) {
		const exists = mailbox.folders?.getSystemFolderByType(folderDef.type)
		if (!exists) {
			await this.createFolder(folderDef.name, folderDef.type, mailbox)
		}
	}
}
```

Call this during mailbox initialization or user opt-in.

---

## Phase 6: Settings UI

### Step 9: Add HEY-Style Settings

**File:** `/src/mail-app/settings/HeyStyleSettings.ts` (new file)

```typescript
import m, { Children, Component } from "mithril"
import { TextField } from "../../common/gui/base/TextField.js"
import { Button } from "../../common/gui/base/Button.js"

export class HeyStyleSettings implements Component {
	private enableScreener: boolean = true
	private autoClassifyNewsletters: boolean = true
	private autoClassifyReceipts: boolean = true

	view(): Children {
		return m(".hey-style-settings", [
			m("h2", "Mail Organization"),

			m(Checkbox, {
				label: "Enable Screener for new senders",
				checked: this.enableScreener,
				onChecked: (checked) => {
					this.enableScreener = checked
					this.save()
				},
			}),

			m(Checkbox, {
				label: "Auto-classify newsletters to Feed",
				checked: this.autoClassifyNewsletters,
				onChecked: (checked) => {
					this.autoClassifyNewsletters = checked
					this.save()
				},
			}),

			m(Checkbox, {
				label: "Auto-classify receipts to Paper Trail",
				checked: this.autoClassifyReceipts,
				onChecked: (checked) => {
					this.autoClassifyReceipts = checked
					this.save()
				},
			}),

			m(".mt", [
				m(Button, {
					label: "Manage Sender Classifications",
					click: () => this.showSenderManagement(),
				}),
			]),
		])
	}

	private async save(): Promise<void> {
		// Save settings to user preferences
	}

	private showSenderManagement(): void {
		// Open sender classification management dialog
	}
}
```

---

## Phase 7: Testing

### Step 10: Unit Tests

Create test files:

1. **MailClassifier Tests** (`test/tests/mail/model/MailClassifierTest.ts`)
2. **ScreenerViewModel Tests** (`test/tests/mail/view/ScreenerViewModelTest.ts`)
3. **FeedViewModel Tests** (`test/tests/mail/view/FeedViewModelTest.ts`)

Example test:

```typescript
import { MailClassifier, MailDestination } from "../../../../src/mail-app/mail/model/MailClassifier.js"
import o from "ospec"

o.spec("MailClassifier", function () {
	o("classifies receipts as Paper Trail", async function () {
		const classifier = new MailClassifier(
			"userId123",
			async () => null,
			async () => {}
		)

		const mail = createTestMail({
			subject: "Your order confirmation #12345",
			sender: { address: "noreply@amazon.com", name: "Amazon" },
		})

		const destination = await classifier.classifyMail(mail)
		o(destination).equals(MailDestination.PAPER_TRAIL)
	})

	o("classifies newsletters as Feed", async function () {
		const classifier = new MailClassifier(
			"userId123",
			async () => null,
			async () => {}
		)

		const mail = createTestMail({
			subject: "Weekly Newsletter - Tech Updates",
			sender: { address: "newsletter@techcrunch.com", name: "TechCrunch" },
			headers: { "list-unsubscribe": "<mailto:unsub@example.com>" },
		})

		const destination = await classifier.classifyMail(mail)
		o(destination).equals(MailDestination.FEED)
	})
})
```

---

## Phase 8: Rollout Strategy

### Option A: Feature Flag

Add a feature flag to enable HEY-style interface:

```typescript
// In user settings or device config
interface UserPreferences {
	useHeyStyleInterface: boolean
}

// Check flag before rendering
if (userPrefs.useHeyStyleInterface) {
	return this.renderHeyStyleView(folder)
} else {
	return this.renderTraditionalView(folder)
}
```

### Option B: Gradual Migration

1. Create HEY-style folders but keep hidden
2. Show opt-in banner to users
3. On opt-in:
   - Show welcome tutorial
   - Initialize HEY-style folders
   - Migrate existing inbox or start fresh
4. Allow users to revert if desired

---

## Common Issues & Solutions

### Issue 1: Existing Emails in Inbox

**Problem:** Users have thousands of emails in their current inbox.

**Solution:** Offer two migration paths:
1. **Fresh Start:** Leave existing inbox as-is, new emails go to Screener
2. **Full Migration:** Batch-classify existing senders based on heuristics

### Issue 2: Performance with Large Mailboxes

**Problem:** Classification checking slows down mail loading.

**Solution:**
- Cache classifications in memory
- Use database indexes on sender_address
- Batch classification operations
- Run classification in worker thread

### Issue 3: Sync Across Devices

**Problem:** Classifications made on one device don't sync to others.

**Solution:**
- Store classifications on server, not just locally
- Use entity sync mechanism
- Push updates via WebSocket

---

## Next Steps

1. ✅ Review this implementation guide
2. ⬜ Set up database migrations
3. ⬜ Integrate MailClassifier with InboxRuleHandler
4. ⬜ Create system folders on mailbox init
5. ⬜ Add routing logic to MailView
6. ⬜ Update sidebar with HEY-style folders
7. ⬜ Implement settings UI
8. ⬜ Write unit tests
9. ⬜ Internal testing
10. ⬜ Beta rollout

---

## Resources

- **Design Document:** `HEY_INTERFACE_DESIGN.md` - Comprehensive design specification
- **Source Files:**
  - `/src/mail-app/mail/model/MailClassifier.ts`
  - `/src/mail-app/mail/view/Screener*.ts`
  - `/src/mail-app/mail/view/Feed*.ts`
  - `/src/mail-app/mail/model/HeyStyleTypes.ts`

- **Reference:** HEY.com features documentation

---

## Support

For questions or issues with this implementation:
1. Review the design document
2. Check existing Tutanota patterns in similar components
3. Test incrementally with feature flags
4. Gather user feedback early and often

**Happy coding!** 🚀
