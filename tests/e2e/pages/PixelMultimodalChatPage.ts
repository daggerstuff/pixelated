/**
 * Page Object Model for Pixel Multimodal Chat
 * 
 * Encapsulates all interactions with the multimodal chat component
 * following the Page Object pattern for maintainable E2E tests.
 */

import { type Page, type Locator, expect } from '@playwright/test'

export interface EmotionMetrics {
    valence: number
    arousal: number
    dominance: number
    confidence?: number
}

export interface Message {
    role: 'user' | 'assistant'
    content: string
    timestamp?: number
}

export class PixelMultimodalChatPage {
    readonly page: Page

    // Main container
    readonly chatContainer: Locator

    // Input elements
    readonly messageInput: Locator
    readonly sendButton: Locator
    readonly recordButton: Locator
    readonly streamingToggle: Locator

    // Display elements
    readonly messageList: Locator
    readonly emotionDisplay: Locator
    readonly loadingIndicator: Locator
    readonly errorMessage: Locator

    // Recording elements
    readonly recordingIndicator: Locator
    readonly recordingDuration: Locator
    readonly micError: Locator

    // Streaming elements
    readonly streamingStatus: Locator
    readonly streamingEnabledIndicator: Locator

    // Emotion elements
    readonly emotionValence: Locator
    readonly emotionArousal: Locator
    readonly emotionDominance: Locator
    readonly modalityConflict: Locator

    // Crisis elements
    readonly crisisFlag: Locator
    readonly crisisEscalation: Locator
    readonly crisisResources: Locator

    constructor(page: Page) {
        this.page = page

        // Initialize locators
        this.chatContainer = page.locator('[data-testid="pixel-multimodal-chat"]')
        this.messageInput = page.locator('[data-testid="message-input"]')
        this.sendButton = page.locator('[data-testid="send-button"]')
        this.recordButton = page.locator('[data-testid="record-button"]')
        this.streamingToggle = page.locator('[data-testid="streaming-toggle"]')

        this.messageList = page.locator('[data-testid="message-list"]')
        this.emotionDisplay = page.locator('[data-testid="emotion-display"]')
        this.loadingIndicator = page.locator('[data-testid="loading-indicator"]')
        this.errorMessage = page.locator('[data-testid="error-message"]')

        this.recordingIndicator = page.locator('[data-testid="recording-indicator"]')
        this.recordingDuration = page.locator('[data-testid="recording-duration"]')
        this.micError = page.locator('[data-testid="mic-error"]')

        this.streamingStatus = page.locator('[data-testid="streaming-status"]')
        this.streamingEnabledIndicator = page.locator('[data-testid="streaming-enabled"]')

        this.emotionValence = page.locator('[data-testid="emotion-valence"]')
        this.emotionArousal = page.locator('[data-testid="emotion-arousal"]')
        this.emotionDominance = page.locator('[data-testid="emotion-dominance"]')
        this.modalityConflict = page.locator('[data-testid="modality-conflict"]')

        this.crisisFlag = page.locator('[data-testid="crisis-flag"]')
        this.crisisEscalation = page.locator('[data-testid="crisis-escalation"]')
        this.crisisResources = page.locator('[data-testid="crisis-resources"]')
    }

    /**
     * Navigate to the chat page
     */
    async goto(url: string = '/chat') {
        await this.page.goto(url)
        await this.waitForLoad()
    }

    /**
     * Wait for the chat component to load
     */
    async waitForLoad() {
        await this.chatContainer.waitFor({ state: 'visible', timeout: 10000 })
    }

    /**
     * Send a text message
     */
    async sendTextMessage(message: string, options?: { waitForResponse?: boolean }) {
        await this.messageInput.fill(message)
        await this.sendButton.click()

        // Verify message appears in the UI
        const userMessage = this.getUserMessage().last()
        await expect(userMessage).toBeVisible()
        await expect(userMessage).toContainText(message)

        if (options?.waitForResponse !== false) {
            await this.waitForAssistantResponse()
        }
    }

    /**
     * Wait for assistant response
     */
    async waitForAssistantResponse(timeout: number = 5000) {
        const assistantMessage = this.getAssistantMessage().last()
        await assistantMessage.waitFor({ state: 'visible', timeout })
    }

    /**
     * Get user messages
     */
    getUserMessage(): Locator {
        return this.page.locator('[data-testid="message-user"]')
    }

    /**
     * Get assistant messages
     */
    getAssistantMessage(): Locator {
        return this.page.locator('[data-testid="message-assistant"]')
    }

    /**
     * Get all messages
     */
    getAllMessages(): Locator {
        return this.page.locator('[data-testid^="message-"]')
    }

    /**
     * Get the latest message content
     */
    async getLatestMessageContent(): Promise<string> {
        const lastMessage = this.getAllMessages().last()
        return (await lastMessage.textContent()) || ''
    }

    /**
     * Enable streaming mode
     */
    async enableStreaming() {
        const isEnabled = await this.streamingEnabledIndicator.isVisible().catch(() => false)
        if (!isEnabled) {
            await this.streamingToggle.click()
            await expect(this.streamingEnabledIndicator).toBeVisible()
        }
    }

    /**
     * Disable streaming mode
     */
    async disableStreaming() {
        const isEnabled = await this.streamingEnabledIndicator.isVisible().catch(() => false)
        if (isEnabled) {
            await this.streamingToggle.click()
            await expect(this.streamingEnabledIndicator).toBeHidden()
        }
    }

    /**
     * Start audio recording
     */
    async startRecording() {
        await this.recordButton.click()
        await expect(this.recordingIndicator).toBeVisible({ timeout: 2000 })
    }

    /**
     * Stop audio recording
     */
    async stopRecording() {
        await this.recordButton.click()
        await expect(this.recordingIndicator).toBeHidden({ timeout: 2000 })
    }

    /**
     * Record audio for a specific duration
     */
    async recordAudio(durationMs: number) {
        await this.startRecording()
        await this.page.waitForTimeout(durationMs)
        await this.stopRecording()
    }

    /**
     * Get current recording duration
     */
    async getRecordingDuration(): Promise<string> {
        return (await this.recordingDuration.textContent()) || '00:00'
    }

    /**
     * Get emotion metrics from the display
     */
    async getEmotionMetrics(): Promise<EmotionMetrics> {
        const valenceText = await this.emotionValence.textContent()
        const arousalText = await this.emotionArousal.textContent()
        const dominanceText = await this.emotionDominance.textContent()

        const parseValue = (text: string | null): number => {
            if (!text) return 0
            const match = text.match(/[\d.]+/)
            return match ? parseFloat(match[0]) : 0
        }

        return {
            valence: parseValue(valenceText),
            arousal: parseValue(arousalText),
            dominance: parseValue(dominanceText)
        }
    }

    /**
     * Check if modality conflict is shown
     */
    async hasModalityConflict(): Promise<boolean> {
        return await this.modalityConflict.isVisible().catch(() => false)
    }

    /**
     * Check if crisis flag is shown
     */
    async hasCrisisFlag(): Promise<boolean> {
        return await this.crisisFlag.isVisible().catch(() => false)
    }

    /**
     * Wait for loading to complete
     */
    async waitForLoadingComplete(timeout: number = 5000) {
        await this.loadingIndicator.waitFor({ state: 'hidden', timeout })
    }

    /**
     * Check if an error message is displayed
     */
    async hasError(): Promise<boolean> {
        return await this.errorMessage.isVisible().catch(() => false)
    }

    /**
     * Get error message text
     */
    async getErrorMessage(): Promise<string> {
        if (await this.hasError()) {
            return (await this.errorMessage.textContent()) || ''
        }
        return ''
    }

    /**
     * Check if send button is enabled
     */
    async isSendButtonEnabled(): Promise<boolean> {
        return await this.sendButton.isEnabled()
    }

    /**
     * Clear the message input
     */
    async clearInput() {
        await this.messageInput.clear()
    }

    /**
     * Type in the message input without sending
     */
    async typeMessage(message: string) {
        await this.messageInput.fill(message)
    }

    /**
     * Press keyboard shortcut
     */
    async pressEnter() {
        await this.messageInput.press('Enter')
    }

    async pressCtrlEnter() {
        await this.messageInput.press('Control+Enter')
    }

    async pressEscape() {
        await this.page.keyboard.press('Escape')
    }

    /**
     * Get count of messages
     */
    async getMessageCount(): Promise<number> {
        return await this.getAllMessages().count()
    }

    /**
     * Verify component is accessible
     */
    async verifyAccessibility() {
        // Verify ARIA labels
        await expect(this.messageInput).toHaveAttribute('aria-label', /.*/)
        await expect(this.sendButton).toHaveAttribute('aria-label', /.*/)
        await expect(this.recordButton).toHaveAttribute('aria-label', /.*/)

        // Verify keyboard navigation
        await this.messageInput.focus()
        const focusedElement = await this.page.evaluate(() => document.activeElement?.tagName)
        expect(['INPUT', 'TEXTAREA']).toContain(focusedElement)
    }

    /**
     * Verify responsive layout
     */
    async verifyMobileLayout() {
        await this.page.setViewportSize({ width: 375, height: 667 })
        await expect(this.chatContainer).toBeVisible()

        const containerClass = await this.chatContainer.getAttribute('class')
        expect(containerClass).toContain('flex-col')
    }

    /**
     * Mock API response
     */
    async mockInferenceResponse(response: {
        text: string
        latency?: number
        emotions?: EmotionMetrics
        crisis?: boolean
    }) {
        await this.page.route('**/api/ai/pixel/infer', route => {
            route.fulfill({
                status: 200,
                contentType: 'application/json',
                body: JSON.stringify({
                    response: response.text,
                    latency: response.latency || 100,
                    emotions: response.emotions || { valence: 0.5, arousal: 0.5, dominance: 0.5 },
                    crisis: response.crisis || false
                })
            })
        })
    }

    /**
     * Mock API error
     */
    async mockInferenceError(status: number = 500, message: string = 'Internal server error') {
        await this.page.route('**/api/ai/pixel/infer', route => {
            route.fulfill({
                status,
                contentType: 'application/json',
                body: JSON.stringify({ error: message })
            })
        })
    }

    /**
     * Mock rate limit error
     */
    async mockRateLimitError() {
        await this.mockInferenceError(429, 'Rate limit exceeded')
    }

    /**
     * Grant microphone permissions
     */
    async grantMicrophonePermission() {
        await this.page.context().grantPermissions(['microphone'])
    }

    /**
     * Deny microphone permissions
     */
    async denyMicrophonePermission() {
        await this.page.context().grantPermissions([])
    }

    /**
     * Take screenshot for debugging
     */
    async screenshot(name: string) {
        await this.page.screenshot({ path: `test-results/${name}.png`, fullPage: true })
    }
}
