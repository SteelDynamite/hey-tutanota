import m, { Children, Component, Vnode } from "mithril"
import { assertMainOrNode } from "../../../common/api/common/Env.js"
import { Mail } from "../../../common/api/entities/tutanota/TypeRefs.js"
import { Dialog } from "../../../common/gui/base/Dialog.js"
import { Button, ButtonType, ButtonColor } from "../../../common/gui/base/Button.js"
import { TextField } from "../../../common/gui/base/TextField.js"
import { Checkbox } from "../../../common/gui/base/Checkbox.js"
import { px, size } from "../../../common/gui/size.js"
import { theme } from "../../../common/gui/theme.js"

assertMainOrNode()

export interface BubbleUpDialogAttrs {
	mail: Mail
	onSchedule: (date: Date, notify: boolean) => Promise<void>
	onCancel: () => void
}

/**
 * Dialog for scheduling when an email should "bubble up" (resurface).
 * Provides quick presets and custom date/time selection.
 */
export class BubbleUpDialog implements Component<BubbleUpDialogAttrs> {
	private selectedDate: Date | null = null
	private notifyEnabled: boolean = true
	private customMode: boolean = false
	private dateInput: string = ""
	private timeInput: string = ""

	view({ attrs }: Vnode<BubbleUpDialogAttrs>): Children {
		const { mail, onSchedule, onCancel } = attrs

		return m(Dialog, {
			title: () => "Schedule Bubble Up",
			child: () => this.renderContent(mail),
			buttons: () => [
				{
					label: "Cancel",
					type: ButtonType.Secondary,
					click: () => onCancel(),
				},
				{
					label: "Schedule",
					type: ButtonType.Primary,
					click: async () => {
						if (this.selectedDate) {
							await onSchedule(this.selectedDate, this.notifyEnabled)
						}
					},
				},
			],
		})
	}

	private renderContent(mail: Mail): Children {
		return m(
			".bubble-up-dialog-content",
			{
				style: {
					minWidth: "400px",
					padding: px(size.vpad),
				},
			},
			[
				// Email info
				m(
					".email-info.mb",
					{
						style: {
							padding: px(size.hpad_small),
							backgroundColor: theme.list_bg,
							borderRadius: "6px",
							marginBottom: px(size.vpad),
						},
					},
					[
						m(
							".email-subject",
							{
								style: {
									fontWeight: "500",
									fontSize: "14px",
									marginBottom: "4px",
								},
							},
							mail.subject || "(No subject)",
						),
						m(
							".email-sender",
							{
								style: {
									fontSize: "12px",
									opacity: "0.8",
								},
							},
							`From: ${mail.sender.name || mail.sender.address}`,
						),
					],
				),

				// Description
				m(
					"p.description.mb",
					{
						style: {
							fontSize: "14px",
							color: theme.content_fg,
							lineHeight: "1.5",
							marginBottom: px(size.vpad),
						},
					},
					"Choose when this email should reappear in your Imbox:",
				),

				// Quick presets
				!this.customMode && this.renderPresets(),

				// Custom date/time
				this.customMode && this.renderCustomDateTime(),

				// Toggle between preset and custom
				m(
					".mode-toggle.mt",
					{
						style: {
							marginTop: px(size.vpad),
							textAlign: "center",
						},
					},
					m(Button, {
						label: this.customMode ? "Use Quick Presets" : "Choose Custom Date/Time",
						type: ButtonType.Secondary,
						colors: ButtonColor.DrawerNav,
						click: () => {
							this.customMode = !this.customMode
						},
					}),
				),

				// Notification option
				m(
					".notification-option.mt",
					{
						style: {
							marginTop: px(size.vpad),
							paddingTop: px(size.vpad),
							borderTop: `1px solid ${theme.content_border}`,
						},
					},
					m(Checkbox, {
						label: () => "Send me a notification when this bubbles up",
						checked: this.notifyEnabled,
						onChecked: (checked: boolean) => {
							this.notifyEnabled = checked
						},
					}),
				),

				// Selected date preview
				this.selectedDate &&
					m(
						".selected-preview.mt",
						{
							style: {
								marginTop: px(size.vpad),
								padding: px(size.hpad_small),
								backgroundColor: theme.content_accent + "20",
								borderRadius: "6px",
								fontSize: "13px",
								textAlign: "center",
								color: theme.content_accent,
								fontWeight: "500",
							},
						},
						`Will bubble up: ${this.selectedDate.toLocaleString()}`,
					),
			],
		)
	}

	private renderPresets(): Children {
		const presets = [
			{ label: "Later Today", hours: 4 },
			{ label: "This Evening", time: this.getTimeToday(18, 0) },
			{ label: "Tomorrow Morning", time: this.getTimeTomorrow(9, 0) },
			{ label: "Tomorrow Evening", time: this.getTimeTomorrow(18, 0) },
			{ label: "In 3 Days", days: 3 },
			{ label: "Next Week", days: 7 },
			{ label: "In 2 Weeks", days: 14 },
			{ label: "In 1 Month", days: 30 },
		]

		return m(
			".presets-grid",
			{
				style: {
					display: "grid",
					gridTemplateColumns: "repeat(2, 1fr)",
					gap: px(size.hpad_small),
					marginBottom: px(size.vpad),
				},
			},
			presets.map((preset) =>
				m(
					".preset-button",
					{
						style: {
							padding: px(size.hpad_small),
							backgroundColor: this.isPresetSelected(preset) ? theme.content_accent : theme.elevated_bg,
							color: this.isPresetSelected(preset) ? theme.content_button_selected : theme.content_fg,
							border: `1px solid ${this.isPresetSelected(preset) ? theme.content_accent : theme.content_border}`,
							borderRadius: "6px",
							cursor: "pointer",
							textAlign: "center",
							fontSize: "13px",
							fontWeight: "500",
							transition: "all 0.2s ease",
						},
						onclick: () => this.selectPreset(preset),
					},
					preset.label,
				),
			),
		)
	}

	private renderCustomDateTime(): Children {
		const now = new Date()
		const tomorrow = new Date(now)
		tomorrow.setDate(tomorrow.getDate() + 1)

		// Default to tomorrow
		if (!this.dateInput) {
			this.dateInput = tomorrow.toISOString().split("T")[0]
		}
		if (!this.timeInput) {
			this.timeInput = "09:00"
		}

		return m(
			".custom-datetime",
			{
				style: {
					marginBottom: px(size.vpad),
				},
			},
			[
				m(
					".date-input.mb-s",
					{
						style: {
							marginBottom: px(size.vpad_small),
						},
					},
					m(TextField, {
						label: "date_label",
						value: this.dateInput,
						type: "date",
						oninput: (value: string) => {
							this.dateInput = value
							this.updateCustomDate()
						},
					}),
				),
				m(
					".time-input",
					m(TextField, {
						label: "time_label",
						value: this.timeInput,
						type: "time",
						oninput: (value: string) => {
							this.timeInput = value
							this.updateCustomDate()
						},
					}),
				),
			],
		)
	}

	private selectPreset(preset: { label: string; hours?: number; days?: number; time?: Date }): void {
		if (preset.time) {
			this.selectedDate = preset.time
		} else if (preset.hours) {
			const date = new Date()
			date.setHours(date.getHours() + preset.hours)
			this.selectedDate = date
		} else if (preset.days) {
			const date = new Date()
			date.setDate(date.getDate() + preset.days)
			date.setHours(9, 0, 0, 0) // Default to 9 AM
			this.selectedDate = date
		}
		m.redraw()
	}

	private isPresetSelected(preset: { label: string; hours?: number; days?: number; time?: Date }): boolean {
		if (!this.selectedDate) return false

		let presetDate: Date
		if (preset.time) {
			presetDate = preset.time
		} else if (preset.hours) {
			presetDate = new Date()
			presetDate.setHours(presetDate.getHours() + preset.hours)
		} else if (preset.days) {
			presetDate = new Date()
			presetDate.setDate(presetDate.getDate() + preset.days)
			presetDate.setHours(9, 0, 0, 0)
		} else {
			return false
		}

		// Compare within 1 minute
		return Math.abs(this.selectedDate.getTime() - presetDate.getTime()) < 60000
	}

	private updateCustomDate(): void {
		if (this.dateInput && this.timeInput) {
			const dateTimeStr = `${this.dateInput}T${this.timeInput}`
			this.selectedDate = new Date(dateTimeStr)
		}
	}

	private getTimeToday(hours: number, minutes: number): Date {
		const date = new Date()
		date.setHours(hours, minutes, 0, 0)

		// If time has passed, set to tomorrow
		if (date < new Date()) {
			date.setDate(date.getDate() + 1)
		}

		return date
	}

	private getTimeTomorrow(hours: number, minutes: number): Date {
		const date = new Date()
		date.setDate(date.getDate() + 1)
		date.setHours(hours, minutes, 0, 0)
		return date
	}
}
