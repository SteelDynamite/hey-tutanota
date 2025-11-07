# HEY-Like Interface Design for Tutanota Mail

**Version:** 1.0
**Date:** November 7, 2025
**Purpose:** Design specification for implementing HEY.com-inspired interface patterns in Tutanota Mail

---

## Table of Contents

1. [Executive Summary](#executive-summary)
2. [HEY Interface Overview](#hey-interface-overview)
3. [Core Feature Specifications](#core-feature-specifications)
4. [Technical Architecture](#technical-architecture)
5. [Implementation Roadmap](#implementation-roadmap)
6. [Desktop Interface Design](#desktop-interface-design)
7. [Mobile Interface Design](#mobile-interface-design)
8. [Database & API Changes](#database--api-changes)
9. [Migration & User Experience](#migration--user-experience)
10. [Privacy & Security Considerations](#privacy--security-considerations)

---

## Executive Summary

This document outlines a comprehensive approach to reimagining Tutanota's email interface by adopting key UX patterns from HEY.com while maintaining Tutanota's core security and privacy principles. The design introduces intelligent email screening, focused inbox management, and purpose-built email categorization to help users achieve "inbox zero" and maintain better email hygiene.

### Key Goals

- **Reduce email overwhelm** through intelligent screening and categorization
- **Improve focus** with purpose-built views (Imbox, Feed, Paper Trail)
- **Maintain privacy** while adding HEY-inspired features
- **Seamless experience** across desktop, mobile web, and native apps
- **Backward compatible** with existing Tutanota workflows

---

## HEY Interface Overview

### Core Philosophy

HEY reimagines email management through three key principles:

1. **Screening First**: Users control who can email them (like call screening)
2. **Purpose-Driven Views**: Different types of emails deserve different interfaces
3. **Intentional Processing**: Batch operations and focused workflows

### HEY's Primary Views

#### 1. **The Screener**
- Gateway for all first-time senders
- User approves/rejects before emails reach main views
- Remembers decisions for future emails
- Protects from spam and unwanted mail

#### 2. **The Imbox** (Important Box)
- Not "inbox" - deliberately focused on important mail
- Only approved senders appear here
- Default destination for person-to-person communication
- Clean, focused, immediate attention required

#### 3. **The Feed**
- Newsletter and bulk email reader
- Presented as a scrollable feed (like social media)
- Emails displayed already opened in chronological order
- Optimized for consumption, not interaction

#### 4. **Paper Trail**
- Receipts, confirmations, transactional emails
- Searchable archive, out of sight by default
- Reference material, not action items

#### 5. **Reply Later**
- Queue of emails marked for later response
- Focused batch processing
- Helps achieve inbox zero

#### 6. **Set Aside**
- Temporary holding area
- Think "read it later" for emails
- Can resurface automatically (Bubble Up)

### Additional HEY Features

- **Focus & Reply**: Distraction-free batch reply mode
- **Workflows**: Multi-step process tracking (e.g., hiring pipeline)
- **Bubble Up**: Schedule emails to resurface later
- **Spy Pixel Blocking**: Privacy protection from tracking pixels
- **Files Section**: All attachments in one unified view
- **Keyboard-first**: Extensive keyboard shortcuts

---

## Core Feature Specifications

### Feature 1: The Screener

#### Behavior

**First Contact:**
```
┌─────────────────────────────────────┐
│  New sender: john@example.com       │
│  Subject: Partnership opportunity   │
├─────────────────────────────────────┤
│  [Email Preview]                    │
│                                     │
│  Do you want to hear from this      │
│  sender again?                      │
│                                     │
│  [Yes, to Imbox]  [Yes, to Feed]   │
│  [Yes, to Paper Trail]  [No]       │
└─────────────────────────────────────┘
```

**Decision Persistence:**
- Store sender → destination mapping in database
- Apply to all future emails from that sender automatically
- Allow users to change routing later in settings

**Implementation Details:**

1. **Sender Classification Table**
   - `sender_email` (PK)
   - `classification` (IMBOX, FEED, PAPER_TRAIL, BLOCKED)
   - `classified_at` (timestamp)
   - `user_id` (FK)

2. **Processing Logic**
   - Check if sender exists in classification table
   - If new: Route to Screener view
   - If classified: Route to designated folder
   - Batch screening: Allow screening multiple emails at once

3. **UI Components**
   - `ScreenerView.ts` - Main screening interface
   - `ScreenerViewModel.ts` - State management
   - `ScreenerCard.ts` - Individual email screening card
   - `SenderClassificationButton.ts` - Quick classification actions

#### Integration with Tutanota

- Extend `InboxRuleHandler` for automatic classification
- Add new system folders: `SCREENER`, `IMBOX`, `FEED`, `PAPER_TRAIL`
- Maintain compatibility with existing inbox and folder system

---

### Feature 2: The Imbox

#### Behavior

**Purpose:** High-signal inbox for important, actionable emails

**Routing:**
- Default destination for screened personal emails
- Person-to-person communication
- Anything requiring immediate attention

**UI Characteristics:**
- Clean, uncluttered interface
- Emphasis on unread count
- Quick actions: Reply, Reply Later, Set Aside, Move to...
- Thread/conversation view by default

**Implementation Details:**

1. **Folder Structure**
   - New system folder: `IMBOX`
   - Separate from existing `INBOX`
   - Cannot be deleted or renamed

2. **Components**
   - Reuse existing `MailListView.ts` with Imbox-specific styling
   - `ImboxView.ts` - Wrapper with Imbox-specific toolbar
   - Updated `MailViewModel` to handle Imbox routing

3. **Visual Design**
   - Cleaner, more spacious than traditional inbox
   - Larger sender names
   - Subtle visual cues for unread vs. read
   - Primary action button: "Reply"

---

### Feature 3: The Feed

#### Behavior

**Purpose:** Newsletter and subscription consumption interface

**Presentation:**
- Chronologically ordered (newest first)
- Emails displayed fully opened by default
- Scroll-through reading experience
- Minimal chrome, maximum content

**Routing:**
- Newsletters, promotional emails
- Bulk communications
- Any read-only, informational content

**Implementation Details:**

1. **UI Components**
   - `FeedView.ts` - Scrollable feed interface
   - `FeedViewModel.ts` - Manages feed state
   - `FeedItem.ts` - Individual email in feed format
   - `FeedToolbar.ts` - Minimal actions (Archive, Move)

2. **Rendering Strategy**
   ```typescript
   // Pseudo-code for feed rendering
   class FeedView {
       view() {
           return m(".feed-container", [
               m("h1", "The Feed"),
               m(".feed-scroll",
                   this.emails.map(email =>
                       m(FeedItem, {
                           email,
                           expanded: true,
                           showImages: this.autoLoadImages
                       })
                   )
               )
           ])
       }
   }
   ```

3. **Performance Considerations**
   - Lazy loading for long feeds
   - Virtual scrolling for 100+ items
   - Image loading on-demand or auto (user preference)
   - Intelligent pre-rendering of next 5 items

4. **Visual Design**
   - Full-width email content
   - Clear visual separation between emails
   - Newsletter-optimized rendering (handle HTML well)
   - "Mark all as seen" batch action

---

### Feature 4: Paper Trail

#### Behavior

**Purpose:** Searchable archive for transactional emails

**Content Types:**
- Order confirmations
- Receipts
- Shipping notifications
- Account updates
- Automated system emails

**Presentation:**
- Simple list view (not feed)
- Optimized for search and retrieval
- Date-based browsing
- Quick filters (e-commerce, travel, finance, etc.)

**Implementation Details:**

1. **Classification Logic**
   - Heuristics for auto-detection:
     - Subject contains: "receipt", "confirmation", "order", "tracking"
     - From: noreply@, no-reply@, automated@
     - Content patterns: order numbers, tracking IDs
   - User can manually reclassify

2. **Components**
   - `PaperTrailView.ts` - Archive-style interface
   - `PaperTrailSearch.ts` - Enhanced search for receipts
   - Reuse existing `MailListView` with different styling

3. **Search Enhancements**
   - Quick filters: "Last 30 days", "E-commerce", "Travel", etc.
   - Full-text search in Paper Trail only
   - Date range picker

---

### Feature 5: Reply Later

#### Behavior

**Purpose:** Queue emails that need responses but not immediately

**Workflow:**
```
Email in Imbox → "Reply Later" action → Moved to Reply Later queue
→ User processes queue in batch → Replies sent → Email archived
```

**UI Features:**
- Dedicated "Reply Later" section in sidebar
- Count badge showing queued items
- Batch reply mode: Open all, reply to each
- Quick actions: "Done" (archive), "Still Later" (keep in queue)

**Implementation Details:**

1. **Storage**
   - New system folder: `REPLY_LATER`
   - Or use labels/tags (depends on architecture choice)

2. **Components**
   - `ReplyLaterView.ts` - Queue interface
   - `ReplyLaterToolbar.ts` - Batch actions
   - `ReplyLaterBadge.ts` - Unread count in sidebar

3. **Workflow Integration**
   - Single click/shortcut to add to Reply Later
   - Compose window opens with original email context
   - Auto-archive after sending reply (user preference)

---

### Feature 6: Set Aside

#### Behavior

**Purpose:** Temporary holding area for emails to review later

**Use Cases:**
- "Need to think about this"
- "Review when I have more time"
- "Waiting for more information"

**Features:**
- Manual addition to Set Aside
- Can optionally "Bubble Up" (resurface) at specified time
- Different from Reply Later (not necessarily needing a response)

**Implementation Details:**

1. **Storage**
   - System folder: `SET_ASIDE`
   - Metadata: `bubble_up_date` (optional)

2. **Bubble Up Functionality**
   ```typescript
   interface BubbleUp {
       mailId: string
       originalFolder: string
       bubbleUpDate: Date
       notificationEnabled: boolean
   }
   ```

3. **Components**
   - `SetAsideView.ts`
   - `BubbleUpDialog.ts` - Date/time picker for resurface
   - `BubbleUpWorker.ts` - Background process to move emails back

---

### Feature 7: Files Section

#### Behavior

**Purpose:** Unified view of all email attachments

**Features:**
- Grid or list view of all attachments
- Filter by type (images, docs, PDFs, etc.)
- Search by filename
- Sort by date, sender, size
- Quick preview and download

**Implementation Details:**

1. **Data Model**
   - Extract attachments from all emails
   - Build searchable index
   - Cache metadata (filename, size, type, sender, date)

2. **Components**
   - `FilesView.ts` - Main files interface
   - `FilesGrid.ts` - Grid layout for visual files
   - `FilesList.ts` - List layout for documents
   - `FilesFilter.ts` - Type and date filters

3. **Performance**
   - Lazy loading
   - Thumbnail generation for images
   - Indexing in worker thread

---

### Feature 8: Focus & Reply Mode

#### Behavior

**Purpose:** Distraction-free batch email processing

**Features:**
- Full-screen mode
- One email at a time
- Quick actions: Reply, Archive, Reply Later, Skip
- Keyboard-driven workflow
- Progress indicator (5/23 emails)

**Implementation:**

```typescript
class FocusReplyView {
    currentIndex: number = 0
    emails: Mail[]

    nextEmail() { /* ... */ }
    reply() { /* Opens minimal composer */ }
    archive() { /* Archives and moves to next */ }
}
```

---

## Technical Architecture

### System Overview

```
┌─────────────────────────────────────────────────────────────┐
│                         UI Layer                            │
│  ┌──────────┬─────────┬─────────┬──────────────┬─────────┐ │
│  │ Screener │  Imbox  │  Feed   │ Paper Trail  │  Reply  │ │
│  │   View   │  View   │  View   │     View     │  Later  │ │
│  └──────────┴─────────┴─────────┴──────────────┴─────────┘ │
└─────────────────────────────────────────────────────────────┘
                            ↓
┌─────────────────────────────────────────────────────────────┐
│                      View Models                            │
│  (State management, business logic, routing)                │
└─────────────────────────────────────────────────────────────┘
                            ↓
┌─────────────────────────────────────────────────────────────┐
│                       Mail Model                            │
│  (Core mail state, folder management, classification)       │
└─────────────────────────────────────────────────────────────┘
                            ↓
┌─────────────────────────────────────────────────────────────┐
│                    Mail Classifier                          │
│  (Sender classification, routing rules, heuristics)         │
└─────────────────────────────────────────────────────────────┘
                            ↓
┌─────────────────────────────────────────────────────────────┐
│                    MailFacade (Worker)                      │
│  (API operations, encryption, persistence)                  │
└─────────────────────────────────────────────────────────────┘
                            ↓
┌─────────────────────────────────────────────────────────────┐
│                     Database Layer                          │
│  - sender_classifications                                   │
│  - system_folders (SCREENER, IMBOX, FEED, etc.)           │
│  - bubble_up_schedule                                       │
└─────────────────────────────────────────────────────────────┘
```

### New Components to Create

#### 1. Mail Classification System

**File:** `/src/mail-app/mail/model/MailClassifier.ts`

```typescript
export enum MailDestination {
    SCREENER = "screener",
    IMBOX = "imbox",
    FEED = "feed",
    PAPER_TRAIL = "paper_trail",
    BLOCKED = "blocked"
}

export interface SenderClassification {
    senderAddress: string
    destination: MailDestination
    classifiedAt: Date
    userId: string
}

export class MailClassifier {
    /**
     * Determines where an incoming email should be routed
     */
    async classifyMail(mail: Mail): Promise<MailDestination> {
        const sender = mail.sender.address

        // Check if sender is already classified
        const classification = await this.getSenderClassification(sender)
        if (classification) {
            return classification.destination
        }

        // Check for auto-classification heuristics
        const autoClassification = this.tryAutoClassify(mail)
        if (autoClassification) {
            await this.saveSenderClassification(sender, autoClassification)
            return autoClassification
        }

        // Route to screener for manual classification
        return MailDestination.SCREENER
    }

    /**
     * Attempts to auto-classify based on email characteristics
     */
    private tryAutoClassify(mail: Mail): MailDestination | null {
        // Paper Trail detection
        if (this.isPaperTrail(mail)) {
            return MailDestination.PAPER_TRAIL
        }

        // Newsletter detection
        if (this.isNewsletter(mail)) {
            return MailDestination.FEED
        }

        return null
    }

    private isPaperTrail(mail: Mail): boolean {
        const subject = mail.subject.toLowerCase()
        const sender = mail.sender.address.toLowerCase()

        const paperTrailKeywords = [
            'receipt', 'confirmation', 'order', 'tracking',
            'invoice', 'payment', 'shipping', 'delivered'
        ]

        const paperTrailSenders = [
            'noreply@', 'no-reply@', 'automated@', 'receipts@'
        ]

        return paperTrailKeywords.some(kw => subject.includes(kw)) ||
               paperTrailSenders.some(s => sender.includes(s))
    }

    private isNewsletter(mail: Mail): boolean {
        // Check for List-Unsubscribe header
        if (mail.headers?.['list-unsubscribe']) {
            return true
        }

        // Check for bulk/marketing indicators
        const precedence = mail.headers?.['precedence']
        if (precedence === 'bulk' || precedence === 'list') {
            return true
        }

        return false
    }
}
```

#### 2. Screener View

**File:** `/src/mail-app/mail/view/ScreenerView.ts`

```typescript
export interface ScreenerViewAttrs {
    model: ScreenerViewModel
}

export class ScreenerView implements Component<ScreenerViewAttrs> {
    view({ attrs }: Vnode<ScreenerViewAttrs>): Children {
        const { model } = attrs

        return m(".screener-container", [
            m(".screener-header", [
                m("h1", "The Screener"),
                m(".screener-count", `${model.unscreenedCount} to review`)
            ]),
            m(".screener-list",
                model.unscreenedMails.map(mail =>
                    m(ScreenerCard, {
                        mail,
                        onClassify: (dest) => model.classifySender(mail, dest)
                    })
                )
            )
        ])
    }
}
```

**File:** `/src/mail-app/mail/view/ScreenerCard.ts`

```typescript
export interface ScreenerCardAttrs {
    mail: Mail
    onClassify: (destination: MailDestination) => Promise<void>
}

export class ScreenerCard implements Component<ScreenerCardAttrs> {
    expanded: boolean = false

    view({ attrs }: Vnode<ScreenerCardAttrs>): Children {
        const { mail, onClassify } = attrs

        return m(".screener-card", [
            m(".screener-card-header", [
                m(".sender", mail.sender.name || mail.sender.address),
                m(".subject", mail.subject),
                m(".date", formatDateWithMonth(mail.receivedDate))
            ]),
            this.expanded && m(".screener-card-preview", [
                m(MailViewer, { mail, limitHeight: true })
            ]),
            m(".screener-card-actions", [
                m(Button, {
                    label: "Imbox",
                    click: () => onClassify(MailDestination.IMBOX)
                }),
                m(Button, {
                    label: "Feed",
                    click: () => onClassify(MailDestination.FEED)
                }),
                m(Button, {
                    label: "Paper Trail",
                    click: () => onClassify(MailDestination.PAPER_TRAIL)
                }),
                m(Button, {
                    label: "No",
                    type: ButtonType.Secondary,
                    click: () => onClassify(MailDestination.BLOCKED)
                })
            ])
        ])
    }
}
```

#### 3. Feed View

**File:** `/src/mail-app/mail/view/FeedView.ts`

```typescript
export interface FeedViewAttrs {
    model: FeedViewModel
}

export class FeedView implements Component<FeedViewAttrs> {
    view({ attrs }: Vnode<FeedViewAttrs>): Children {
        const { model } = attrs

        return m(".feed-container", [
            m(".feed-header", [
                m("h1", "The Feed"),
                m(".feed-actions", [
                    m(Button, {
                        label: "Mark all as seen",
                        click: () => model.markAllAsSeen()
                    })
                ])
            ]),
            m(".feed-scroll", {
                onscroll: (e: Event) => this.handleScroll(e, model)
            },
                model.mails.map((mail, index) =>
                    m(FeedItem, {
                        mail,
                        expanded: true,
                        isLast: index === model.mails.length - 1,
                        onVisible: () => model.markAsSeen(mail)
                    })
                )
            )
        ])
    }

    handleScroll(e: Event, model: FeedViewModel) {
        const element = e.target as HTMLElement
        const scrollPercentage = (element.scrollTop + element.clientHeight) / element.scrollHeight

        // Load more when scrolled 80%
        if (scrollPercentage > 0.8) {
            model.loadMoreMails()
        }
    }
}
```

#### 4. View Models

**File:** `/src/mail-app/mail/view/ScreenerViewModel.ts`

```typescript
export class ScreenerViewModel {
    unscreenedMails: Stream<Mail[]> = stream([])
    unscreenedCount: Stream<number> = stream(0)

    constructor(
        private mailModel: MailModel,
        private classifier: MailClassifier
    ) {
        this.loadUnscreened()
    }

    async loadUnscreened(): Promise<void> {
        const mails = await this.mailModel.getMailsInFolder(
            SystemFolders.SCREENER
        )
        this.unscreenedMails(mails)
        this.unscreenedCount(mails.length)
    }

    async classifySender(
        mail: Mail,
        destination: MailDestination
    ): Promise<void> {
        // Save classification
        await this.classifier.saveSenderClassification(
            mail.sender.address,
            destination
        )

        // Move this email
        await this.moveToDestination(mail, destination)

        // Move all other emails from same sender
        await this.reclassifyExistingEmails(mail.sender.address, destination)

        // Reload screener
        await this.loadUnscreened()
    }

    private async moveToDestination(
        mail: Mail,
        destination: MailDestination
    ): Promise<void> {
        const targetFolder = this.getSystemFolder(destination)
        await this.mailModel.moveMails([mail], targetFolder)
    }

    private getSystemFolder(destination: MailDestination): MailFolderId {
        switch (destination) {
            case MailDestination.IMBOX:
                return SystemFolders.IMBOX
            case MailDestination.FEED:
                return SystemFolders.FEED
            case MailDestination.PAPER_TRAIL:
                return SystemFolders.PAPER_TRAIL
            case MailDestination.BLOCKED:
                return SystemFolders.SPAM
            default:
                return SystemFolders.INBOX
        }
    }
}
```

**File:** `/src/mail-app/mail/view/FeedViewModel.ts`

```typescript
export class FeedViewModel {
    mails: Stream<Mail[]> = stream([])
    loading: Stream<boolean> = stream(false)

    constructor(private mailModel: MailModel) {
        this.loadFeedMails()
    }

    async loadFeedMails(): Promise<void> {
        this.loading(true)
        const mails = await this.mailModel.getMailsInFolder(
            SystemFolders.FEED,
            { limit: 50, sortDescending: true }
        )
        this.mails(mails)
        this.loading(false)
    }

    async loadMoreMails(): Promise<void> {
        if (this.loading()) return

        this.loading(true)
        const currentMails = this.mails()
        const lastMail = currentMails[currentMails.length - 1]

        const moreMails = await this.mailModel.getMailsInFolder(
            SystemFolders.FEED,
            { limit: 20, startAfter: lastMail.id }
        )

        this.mails([...currentMails, ...moreMails])
        this.loading(false)
    }

    async markAsSeen(mail: Mail): Promise<void> {
        if (!mail.unread) return
        await this.mailModel.setUnread([mail], false)
    }

    async markAllAsSeen(): Promise<void> {
        const unreadMails = this.mails().filter(m => m.unread)
        await this.mailModel.setUnread(unreadMails, false)
    }
}
```

---

## Implementation Roadmap

### Phase 1: Foundation (Weeks 1-2)

**Goal:** Set up infrastructure and data models

**Tasks:**
1. Create new system folders
   - Add `SCREENER`, `IMBOX`, `FEED`, `PAPER_TRAIL` to `FolderSystem`
   - Update database schema
   - Migration script for existing users

2. Implement `MailClassifier`
   - Sender classification table
   - Classification logic
   - Heuristics for auto-detection

3. Create base components
   - `ScreenerView` and `ScreenerViewModel`
   - `ScreenerCard`
   - Classification button group

4. Update mail routing
   - Intercept incoming mail
   - Route through classifier
   - Move to appropriate folder

**Deliverables:**
- ✅ New folders appear in sidebar
- ✅ Incoming mail routes to Screener
- ✅ Basic classification works

---

### Phase 2: Core Views (Weeks 3-5)

**Goal:** Implement Imbox, Feed, and Paper Trail

**Tasks:**
1. **Imbox**
   - `ImboxView` component
   - Clean, focused UI
   - Quick actions toolbar
   - Enhanced conversation view

2. **Feed**
   - `FeedView` with scroll-based layout
   - `FeedItem` for expanded email display
   - Auto-marking as seen
   - Performance optimization (virtual scrolling)

3. **Paper Trail**
   - `PaperTrailView`
   - Enhanced search interface
   - Quick filters (date, category)
   - Auto-classification improvements

4. **Sidebar Navigation**
   - Update `MailFoldersView` to feature new sections prominently
   - Unread count badges
   - Visual hierarchy (Screener → Imbox → Feed → Paper Trail)

**Deliverables:**
- ✅ All three main views functional
- ✅ Emails route correctly
- ✅ Clean, intuitive UI

---

### Phase 3: Workflow Features (Weeks 6-7)

**Goal:** Add Reply Later, Set Aside, and supporting features

**Tasks:**
1. **Reply Later**
   - System folder and UI
   - "Reply Later" action in email viewer
   - Batch reply mode
   - Auto-archive on send (optional)

2. **Set Aside**
   - System folder
   - "Set Aside" action
   - Simple list view

3. **Quick Actions**
   - Keyboard shortcuts
   - Context menu updates
   - Toolbar buttons

4. **Focus & Reply Mode**
   - Full-screen distraction-free view
   - One-at-a-time email processing
   - Keyboard navigation

**Deliverables:**
- ✅ Reply Later queue works
- ✅ Set Aside available
- ✅ Keyboard shortcuts functional

---

### Phase 4: Advanced Features (Weeks 8-9)

**Goal:** Bubble Up, Files, and polish

**Tasks:**
1. **Bubble Up**
   - Date/time picker dialog
   - Background worker to move emails
   - Notification support

2. **Files Section**
   - Extract attachments from all emails
   - Build searchable index
   - Grid and list views
   - Type filters

3. **Sender Management**
   - Settings page to view/edit classifications
   - Bulk reclassification
   - Whitelist/blacklist management

4. **Analytics Dashboard** (optional)
   - Email volume by category
   - Response time metrics
   - Inbox zero streak

**Deliverables:**
- ✅ Bubble Up functional
- ✅ Files section available
- ✅ Settings management complete

---

### Phase 5: Mobile Optimization (Weeks 10-12)

**Goal:** Adapt interface for mobile devices

**Tasks:**
1. **Mobile Web**
   - Responsive layouts for all views
   - Touch gestures (swipe actions)
   - Bottom navigation bar
   - Mobile-optimized Feed scrolling

2. **Native Apps (Android/iOS)**
   - Update `ViewSlider` for new views
   - Native-specific optimizations
   - Push notification routing
   - Offline support for classifications

3. **Mobile-Specific Features**
   - Swipe to classify (in Screener)
   - Swipe to archive/reply later
   - Pull-to-refresh
   - Haptic feedback

**Deliverables:**
- ✅ Full mobile web experience
- ✅ Native apps updated
- ✅ Touch interactions polished

---

### Phase 6: Testing & Refinement (Weeks 13-14)

**Goal:** Ensure quality and gather feedback

**Tasks:**
1. Unit tests for classification logic
2. Integration tests for routing
3. E2E tests for complete workflows
4. Performance testing (large mailboxes)
5. Accessibility audit (WCAG compliance)
6. Beta user testing
7. Documentation

**Deliverables:**
- ✅ Test coverage >80%
- ✅ Performance benchmarks met
- ✅ Beta feedback incorporated

---

## Desktop Interface Design

### Layout Structure

```
┌────────────────────────────────────────────────────────────────────────────┐
│  [≡] Tutanota                                    [Search]      [User Menu]  │
├──────────────┬─────────────────────────────────┬──────────────────────────┤
│              │                                 │                          │
│  SCREENS     │        EMAIL LIST               │    EMAIL VIEWER          │
│              │                                 │                          │
│  ◉ Screener  │  ┌─────────────────────────┐   │  From: John Doe          │
│     (5)      │  │ ✉ John Doe              │   │  To: me                  │
│              │  │ Meeting tomorrow         │   │  Date: Nov 7, 2025       │
│  ✦ Imbox     │  │ Hey, can we meet at...  │◄──┼─                         │
│     (12)     │  └─────────────────────────┘   │  [Email content]         │
│              │                                 │                          │
│  ≋ Feed      │  ┌─────────────────────────┐   │                          │
│     (8)      │  │ ✉ Newsletter Weekly      │   │                          │
│              │  │ This week in tech        │   │  [Reply] [Reply Later]   │
│  ⫸ Paper Tr. │  │ Lorem ipsum dolor...     │   │  [Set Aside] [Archive]   │
│              │  └─────────────────────────┘   │                          │
│  ──────────  │                                 │                          │
│              │  ┌─────────────────────────┐   │                          │
│  ↶ Reply Lat.│  │ ✉ Jane Smith            │   │                          │
│     (3)      │  │ Re: Project update       │   │                          │
│              │  │ Thanks for the...        │   │                          │
│  ⊡ Set Aside │  └─────────────────────────┘   │                          │
│     (2)      │                                 │                          │
│              │  [Load More]                    │                          │
│  ──────────  │                                 │                          │
│              │                                 │                          │
│  📎 Files    │                                 │                          │
│              │                                 │                          │
│  ──────────  │                                 │                          │
│              │                                 │                          │
│  📁 Folders  │                                 │                          │
│  • Inbox     │                                 │                          │
│  • Drafts    │                                 │                          │
│  • Sent      │                                 │                          │
│  • Archive   │                                 │                          │
│  • Spam      │                                 │                          │
│              │                                 │                          │
└──────────────┴─────────────────────────────────┴──────────────────────────┘
```

### Sidebar Hierarchy

**Primary Section (HEY-style)**
1. **Screener** (⚡ icon) - Badge with unscreened count
2. **Imbox** (★ icon) - Badge with unread count
3. **Feed** (≋ icon) - Badge with unread count
4. **Paper Trail** (📋 icon) - No badge (reference only)

**Divider**

**Workflow Section**
5. **Reply Later** (↶ icon) - Badge with count
6. **Set Aside** (⊡ icon) - Badge with count

**Divider**

**Utility Section**
7. **Files** (📎 icon) - All attachments
8. **Sent** - Sent emails
9. **Drafts** - Draft emails

**Divider**

**Traditional Section** (collapsible)
10. **Classic Folders** (📁 icon)
    - Inbox (legacy)
    - Archive
    - Spam
    - Custom folders

### Color Coding & Visual Hierarchy

**Screener:** Orange/Yellow accent (attention required)
**Imbox:** Blue accent (important)
**Feed:** Purple accent (consumption)
**Paper Trail:** Gray accent (reference)
**Reply Later:** Green accent (action)
**Set Aside:** Teal accent (temporary)

### Keyboard Shortcuts

**Global:**
- `S` - Go to Screener
- `I` - Go to Imbox
- `F` - Go to Feed
- `P` - Go to Paper Trail
- `R` - Go to Reply Later
- `A` - Go to Set Aside

**In Email Viewer:**
- `Ctrl+R` - Reply
- `Ctrl+L` - Reply Later
- `Ctrl+K` - Set Aside
- `E` - Archive
- `Delete` - Move to Spam

**In Screener:**
- `1` - Classify as Imbox
- `2` - Classify as Feed
- `3` - Classify as Paper Trail
- `0` - Block sender

---

## Mobile Interface Design

### Bottom Navigation Bar

```
┌────────────────────────────────────────┐
│  [← Back]    The Imbox       [Search]  │
├────────────────────────────────────────┤
│                                        │
│  ┌──────────────────────────────────┐ │
│  │ ✉ John Doe            10:30 AM   │ │
│  │ Meeting tomorrow                 │ │
│  │ Hey, can we meet at 3pm?         │ │
│  └──────────────────────────────────┘ │
│                                        │
│  ┌──────────────────────────────────┐ │
│  │ ✉ Jane Smith          Yesterday  │ │
│  │ Re: Project update               │ │
│  │ Thanks for the information...    │ │
│  └──────────────────────────────────┘ │
│                                        │
│  ┌──────────────────────────────────┐ │
│  │ ✉ Newsletter          2 days ago │ │
│  │ Weekly digest                    │ │
│  │ Here's what happened this week   │ │
│  └──────────────────────────────────┘ │
│                                        │
└────────────────────────────────────────┘
┌────────────────────────────────────────┐
│ [Screener] [Imbox] [Feed] [•••]       │
│    (5)      (12)    (8)    More        │
└────────────────────────────────────────┘
```

### Swipe Gestures

**In Email List:**
- **Swipe Right:** Archive
- **Swipe Left:** Reply Later
- **Long Press:** Context menu (Move to, Set Aside, etc.)

**In Screener:**
- **Swipe Right:** Approve to Imbox
- **Swipe Left:** Block
- **Tap email:** Expand with classification buttons

**In Email Viewer:**
- **Swipe Right:** Back to list
- **Swipe Left:** Next email
- **Swipe Down:** Close viewer

### Mobile View: The Feed

```
┌────────────────────────────────────────┐
│  [← Back]     The Feed        [•••]    │
├────────────────────────────────────────┤
│                                        │
│  ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━  │
│                                        │
│  📰 Tech Weekly Newsletter             │
│  Nov 7, 2025                           │
│                                        │
│  [Header Image]                        │
│                                        │
│  This Week in Technology               │
│                                        │
│  Lorem ipsum dolor sit amet,           │
│  consectetur adipiscing elit. Sed do   │
│  eiusmod tempor incididunt ut labore   │
│  et dolore magna aliqua...             │
│                                        │
│  [Read More →]                         │
│                                        │
│  ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━  │
│                                        │
│  📰 Morning Brew                       │
│  Nov 6, 2025                           │
│                                        │
│  [Header Image]                        │
│                                        │
│  (scroll continues...)                 │
│                                        │
└────────────────────────────────────────┘
```

### Mobile-Specific Optimizations

1. **Compact Header:** Minimize top chrome for content focus
2. **Pull-to-Refresh:** Standard gesture for updating
3. **Infinite Scroll:** Load more as user scrolls (especially in Feed)
4. **Haptic Feedback:** Confirm swipe actions
5. **Bottom Sheet Menus:** Quick actions slide up from bottom
6. **FAB (Floating Action Button):** Compose new email
7. **Notification Badges:** System-level unread counts

---

## Database & API Changes

### New Database Tables

#### 1. `sender_classifications`

```sql
CREATE TABLE sender_classifications (
    id VARCHAR(64) PRIMARY KEY,
    user_id VARCHAR(64) NOT NULL,
    sender_email VARCHAR(255) NOT NULL,
    destination VARCHAR(20) NOT NULL, -- IMBOX, FEED, PAPER_TRAIL, BLOCKED
    classified_at TIMESTAMP NOT NULL,
    auto_classified BOOLEAN DEFAULT FALSE,
    UNIQUE(user_id, sender_email)
);

CREATE INDEX idx_sender_class_user ON sender_classifications(user_id);
CREATE INDEX idx_sender_class_email ON sender_classifications(sender_email);
```

#### 2. `bubble_up_schedule`

```sql
CREATE TABLE bubble_up_schedule (
    id VARCHAR(64) PRIMARY KEY,
    user_id VARCHAR(64) NOT NULL,
    mail_id VARCHAR(64) NOT NULL,
    original_folder VARCHAR(64),
    bubble_up_at TIMESTAMP NOT NULL,
    notification_enabled BOOLEAN DEFAULT TRUE,
    processed BOOLEAN DEFAULT FALSE,
    FOREIGN KEY (mail_id) REFERENCES mail(id)
);

CREATE INDEX idx_bubble_up_user ON bubble_up_schedule(user_id);
CREATE INDEX idx_bubble_up_date ON bubble_up_schedule(bubble_up_at);
CREATE INDEX idx_bubble_up_processed ON bubble_up_schedule(processed);
```

#### 3. `attachment_index`

```sql
CREATE TABLE attachment_index (
    id VARCHAR(64) PRIMARY KEY,
    user_id VARCHAR(64) NOT NULL,
    mail_id VARCHAR(64) NOT NULL,
    filename VARCHAR(255) NOT NULL,
    file_type VARCHAR(50),
    file_size INTEGER,
    sender_email VARCHAR(255),
    received_date TIMESTAMP,
    thumbnail_path VARCHAR(512),
    FOREIGN KEY (mail_id) REFERENCES mail(id)
);

CREATE INDEX idx_attach_user ON attachment_index(user_id);
CREATE INDEX idx_attach_type ON attachment_index(file_type);
CREATE INDEX idx_attach_date ON attachment_index(received_date);
CREATE FULLTEXT INDEX idx_attach_filename ON attachment_index(filename);
```

### New System Folders

Update `FolderSystem.ts` to include:

```typescript
export enum SystemFolderType {
    INBOX = "inbox",
    IMBOX = "imbox",         // NEW
    SCREENER = "screener",   // NEW
    FEED = "feed",           // NEW
    PAPER_TRAIL = "paper_trail", // NEW
    REPLY_LATER = "reply_later", // NEW
    SET_ASIDE = "set_aside", // NEW
    SENT = "sent",
    DRAFTS = "drafts",
    SPAM = "spam",
    ARCHIVE = "archive",
}
```

### API Endpoints

#### New REST Endpoints

**Sender Classification:**
```
POST   /rest/tutanota/senderclassification
GET    /rest/tutanota/senderclassification/:id
PUT    /rest/tutanota/senderclassification/:id
DELETE /rest/tutanota/senderclassification/:id
GET    /rest/tutanota/senderclassifications/user/:userId
```

**Bubble Up:**
```
POST   /rest/tutanota/bubbleup
GET    /rest/tutanota/bubbleup/:id
PUT    /rest/tutanota/bubbleup/:id
DELETE /rest/tutanota/bubbleup/:id
GET    /rest/tutanota/bubbleups/user/:userId
```

**Attachment Index:**
```
GET    /rest/tutanota/attachments/user/:userId
GET    /rest/tutanota/attachments/search?q=...&type=...
```

### Worker Thread Updates

**File:** `/src/common/api/worker/facades/MailFacade.ts`

Add methods:
```typescript
async classifySender(
    senderEmail: string,
    destination: MailDestination
): Promise<void>

async getSenderClassification(
    senderEmail: string
): Promise<SenderClassification | null>

async scheduleBubbleUp(
    mailId: IdTuple,
    bubbleUpDate: Date
): Promise<void>

async getAttachmentsForUser(): Promise<AttachmentMetadata[]>
```

---

## Migration & User Experience

### Onboarding Flow

**For New Users:**
1. Show welcome screen explaining HEY-style workflow
2. Offer quick tutorial (skippable)
3. Start fresh with empty Screener

**For Existing Users:**

#### Migration Dialog

```
┌─────────────────────────────────────────────────┐
│  Welcome to the New Tutanota Interface!         │
│                                                 │
│  We've redesigned mail to help you focus on     │
│  what matters most.                             │
│                                                 │
│  Your existing emails are safe. We need to      │
│  organize them into new views:                  │
│                                                 │
│  □ Move existing inbox to "Screener"           │
│    (You'll classify senders as you go)          │
│                                                 │
│  □ Keep existing inbox as "Imbox"              │
│    (Assume all current senders are approved)    │
│                                                 │
│  Your choice won't affect sent mail, drafts,    │
│  or other folders.                              │
│                                                 │
│  [Choose: Screener] [Choose: Imbox]  [Learn More] │
└─────────────────────────────────────────────────┘
```

#### Option 1: Move to Screener
- Moves all unread Inbox emails to Screener
- User classifies senders gradually
- Best for: Users wanting fresh start

#### Option 2: Keep as Imbox
- Renames Inbox → Imbox
- Auto-approves all existing senders to Imbox
- Creates empty Screener for new senders
- Best for: Users wanting continuity

### Settings & Preferences

**New Settings Section:** "Mail Organization"

```
┌─────────────────────────────────────────────────┐
│  Mail Organization Settings                     │
├─────────────────────────────────────────────────┤
│                                                 │
│  □ Enable Screener for new senders              │
│    When disabled, new senders go to Imbox       │
│                                                 │
│  □ Auto-classify newsletters to Feed            │
│    Detect and route newsletters automatically   │
│                                                 │
│  □ Auto-classify receipts to Paper Trail        │
│    Detect and route transactional emails        │
│                                                 │
│  □ Auto-archive after replying from Reply Later │
│                                                 │
│  □ Load images automatically in Feed            │
│                                                 │
│  Manage Sender Classifications                  │
│  [View & Edit Classifications →]                │
│                                                 │
└─────────────────────────────────────────────────┘
```

**Sender Classification Management:**

```
┌─────────────────────────────────────────────────┐
│  Sender Classifications                         │
├─────────────────────────────────────────────────┤
│  Search: [____________]  Filter: [All ▼]        │
│                                                 │
│  ┌─────────────────────────────────────────┐   │
│  │ john@example.com           → Imbox       │   │
│  │ newsletter@tech.com        → Feed        │   │
│  │ receipts@store.com         → Paper Trail │   │
│  │ spam@marketing.com         → Blocked     │   │
│  └─────────────────────────────────────────┘   │
│                                                 │
│  [Export] [Import] [Reset All]                  │
└─────────────────────────────────────────────────┘
```

### Gradual Adoption

**Phase-In Strategy:**

1. **Week 1:** Announce update, share tutorial videos
2. **Week 2:** Beta opt-in for power users
3. **Week 3:** Gradual rollout (10% of users)
4. **Week 4:** 50% rollout, gather feedback
5. **Week 5:** 100% rollout with option to revert

**Feature Flags:**

```typescript
interface FeatureFlags {
    heyStyleInterface: boolean
    screenerEnabled: boolean
    feedViewEnabled: boolean
    bubbleUpEnabled: boolean
    filesViewEnabled: boolean
}
```

Allow users to toggle features individually during transition.

---

## Privacy & Security Considerations

### Sender Classification Privacy

**Question:** Does storing sender classifications leak information?

**Answer:** No, classifications are:
- Encrypted client-side before storage
- Only accessible to the user
- Not used for analytics or profiling
- Can be exported/deleted at any time

### Email Content in Feed

**Question:** Does Feed view compromise end-to-end encryption?

**Answer:** No, Feed is purely a UI layer:
- Emails remain encrypted at rest
- Decryption happens client-side in browser/app
- Feed view simply displays decrypted content differently
- No additional data sent to server

### Auto-Classification Heuristics

**Question:** Do heuristics analyze email content?

**Answer:** Minimal analysis, client-side only:
- Subject line keywords (client-side)
- Sender address patterns (client-side)
- Standard email headers (List-Unsubscribe, etc.)
- No AI/ML that sends data to external services
- User has full override control

### Attachment Indexing

**Question:** Does Files view create security risks?

**Answer:** Same security model as current:
- Attachments encrypted until downloaded
- Index stores only metadata (filename, type, size)
- Thumbnails generated client-side
- No content analysis on server

### Compliance

**HEY-style features maintain:**
- ✅ End-to-end encryption
- ✅ Zero-knowledge architecture
- ✅ GDPR compliance
- ✅ No tracking pixels (already blocked)
- ✅ Open source transparency

---

## Success Metrics

### User Engagement

- **Screener Usage:** % of users actively screening new senders
- **Inbox Zero Rate:** % of users achieving empty Imbox daily
- **Feed Consumption:** Average time spent in Feed view
- **Reply Later Adoption:** % of users using Reply Later queue

### Productivity

- **Response Time:** Average time to reply to Imbox emails
- **Email Processing Speed:** Emails processed per minute
- **Search Reduction:** Less need for search (better organization)

### Satisfaction

- **NPS Score:** Net Promoter Score for new interface
- **Feature Adoption:** % of users engaging with each feature
- **Support Tickets:** Reduction in email-management-related support

---

## Alternative Approaches

### Approach A: Full HEY Clone

**Pros:**
- Familiar to HEY users
- Proven UX patterns
- Clear differentiation

**Cons:**
- May alienate existing users
- Legal concerns (UI patents?)
- Less flexibility for Tutanota-specific features

### Approach B: Optional HEY Mode

**Pros:**
- Users choose their experience
- Maintains backward compatibility
- Lower risk

**Cons:**
- Fragmented UX
- Higher maintenance burden
- Feature discoverability issues

### Approach C: Hybrid Approach (Recommended)

**Pros:**
- Best of both worlds
- Gradual adoption path
- Tutanota brand identity maintained

**Implementation:**
- New views available alongside traditional folders
- Users can use both paradigms
- Smart defaults guide toward HEY-style workflow

---

## Open Questions

### Technical

1. **Conversation Threading:** How does Feed interact with conversation view?
   - **Proposal:** Feed shows individual emails, not threads (newsletter-focused)
   - Imbox maintains conversation threading

2. **Offline Support:** How do classifications sync across devices?
   - **Proposal:** Classification table synced via REST API
   - Offline changes queued and synced on reconnection

3. **Performance:** How to handle 100k+ email mailboxes?
   - **Proposal:** Lazy loading, virtual scrolling, indexed DB caching
   - Background workers for attachment indexing

### UX

1. **Legacy Inbox:** What happens to the old Inbox folder?
   - **Option A:** Hide by default (power users can unhide)
   - **Option B:** Rename to "Classic Inbox" in legacy section
   - **Option C:** Remove entirely (requires migration)

2. **Mobile Navigation:** 5+ main sections - too many for bottom nav?
   - **Proposal:** Bottom nav shows top 4, "More" reveals rest
   - Or: Use drawer navigation on mobile

3. **Notification Routing:** Should push notifications differentiate by category?
   - **Proposal:** Yes - different notification channels/sounds
   - Users configure per-category notification preferences

### Business

1. **Free vs Paid:** Are HEY-style features available to all tiers?
   - **Recommendation:** Core features (Screener, Imbox, Feed) for all
   - Advanced features (Workflows, Bubble Up) for Premium

2. **Branding:** Do we call it "HEY-style" or brand it uniquely?
   - **Recommendation:** Unique Tutanota branding
   - "Smart Inbox", "Newsletter Feed", "Receipt Archive", etc.

---

## Conclusion

Implementing HEY-like interface patterns in Tutanota Mail represents a significant but achievable evolution of the product. By focusing on intelligent email categorization, purpose-built views, and user empowerment, we can dramatically improve email management while maintaining Tutanota's core privacy and security principles.

The phased implementation approach allows for gradual rollout, user feedback integration, and risk mitigation. The hybrid approach (new views alongside traditional folders) ensures existing users aren't disrupted while new patterns are adopted organically.

**Next Steps:**

1. **Stakeholder Review:** Present this document to product, engineering, and design teams
2. **Prototype:** Build clickable prototype for user testing
3. **Technical Spike:** Validate key technical assumptions (performance, encryption compatibility)
4. **User Research:** Test concepts with existing Tutanota users
5. **Roadmap Planning:** Finalize timeline and resource allocation

---

## Appendix

### A. Component File Listing

**New Files to Create:**

```
/src/mail-app/mail/
├── model/
│   ├── MailClassifier.ts
│   ├── SenderClassification.ts
│   └── BubbleUpScheduler.ts
├── view/
│   ├── ScreenerView.ts
│   ├── ScreenerViewModel.ts
│   ├── ScreenerCard.ts
│   ├── ImboxView.ts
│   ├── FeedView.ts
│   ├── FeedViewModel.ts
│   ├── FeedItem.ts
│   ├── PaperTrailView.ts
│   ├── ReplyLaterView.ts
│   ├── ReplyLaterViewModel.ts
│   ├── SetAsideView.ts
│   ├── FilesView.ts
│   ├── FilesViewModel.ts
│   ├── FilesGrid.ts
│   ├── BubbleUpDialog.ts
│   └── FocusReplyMode.ts
└── settings/
    ├── SenderClassificationSettings.ts
    └── MailOrganizationSettings.ts
```

### B. Database Migration Scripts

**Migration: Add HEY-style tables**

```sql
-- Migration: 001_add_hey_style_tables.sql

-- Sender classifications
CREATE TABLE IF NOT EXISTS sender_classifications (
    _id VARCHAR(64) PRIMARY KEY,
    userId VARCHAR(64) NOT NULL,
    senderEmail VARCHAR(255) NOT NULL,
    destination VARCHAR(20) NOT NULL,
    classifiedAt BIGINT NOT NULL,
    autoClassified BOOLEAN DEFAULT FALSE,
    UNIQUE(userId, senderEmail)
);

-- Bubble up schedule
CREATE TABLE IF NOT EXISTS bubble_up_schedule (
    _id VARCHAR(64) PRIMARY KEY,
    userId VARCHAR(64) NOT NULL,
    mailId VARCHAR(64) NOT NULL,
    originalFolder VARCHAR(64),
    bubbleUpAt BIGINT NOT NULL,
    notificationEnabled BOOLEAN DEFAULT TRUE,
    processed BOOLEAN DEFAULT FALSE
);

-- Attachment index
CREATE TABLE IF NOT EXISTS attachment_index (
    _id VARCHAR(64) PRIMARY KEY,
    userId VARCHAR(64) NOT NULL,
    mailId VARCHAR(64) NOT NULL,
    filename VARCHAR(255) NOT NULL,
    fileType VARCHAR(50),
    fileSize INTEGER,
    senderEmail VARCHAR(255),
    receivedDate BIGINT,
    thumbnailPath VARCHAR(512)
);

-- Create system folders for each user
-- (Execute in application code during user login)
```

### C. Feature Comparison Matrix

| Feature | Tutanota Current | HEY | Tutanota + HEY |
|---------|------------------|-----|----------------|
| Email Screening | ❌ | ✅ | ✅ |
| Focused Inbox | ❌ | ✅ (Imbox) | ✅ |
| Newsletter View | ❌ | ✅ (Feed) | ✅ |
| Receipt Archive | ❌ | ✅ (Paper Trail) | ✅ |
| Reply Later Queue | ❌ | ✅ | ✅ |
| Set Aside | ❌ | ✅ | ✅ |
| Bubble Up | ❌ | ✅ | ✅ |
| Files View | ❌ | ✅ | ✅ |
| End-to-End Encryption | ✅ | ❌ | ✅ |
| Open Source | ✅ | ❌ | ✅ |
| Calendar Integration | ✅ | ✅ | ✅ |
| Custom Domain | ✅ | ✅ | ✅ |
| Keyboard Shortcuts | ✅ (Basic) | ✅ (Extensive) | ✅ |
| Mobile Apps | ✅ | ✅ | ✅ |
| Offline Support | ✅ | ✅ | ✅ |

### D. Glossary

- **Imbox:** Important inbox - focused view for priority emails
- **Feed:** Scrollable view for newsletters and bulk email
- **Paper Trail:** Archive for transactional emails (receipts, confirmations)
- **Screener:** Gateway for approving/rejecting first-time senders
- **Reply Later:** Queue for emails requiring responses
- **Set Aside:** Temporary holding area for emails to review later
- **Bubble Up:** Schedule email to resurface at a future time
- **Focus & Reply:** Distraction-free batch reply mode
- **Sender Classification:** User's decision about where emails from a sender should go

### E. References

- [HEY Website](https://hey.com)
- [HEY Features](https://hey.com/features/)
- [HEY How It Works](https://hey.com/how-it-works/)
- [Tutanota GitHub](https://github.com/tutao/tutanota)
- [Mithril.js Documentation](https://mithril.js.org)

---

**Document End**
