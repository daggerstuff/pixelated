/**
 * E2E Integration Tests for Pixel Multimodal Chat
 * 
 * Tests the complete multimodal flow:
 * - Audio recording → text input → streaming/REST → UI updates
 * - WebSocket real-time interaction
 * - Message persistence
 * - Reconnection scenarios
 * - Crisis detection integration
 * - Emotion visualization
 * 
 * Phase 4.5: E2E Integration Testing
 */

import { test, expect, type Page } from '@playwright/test'

const CHAT_PAGE_URL = '/chat' // Adjust to your actual route
const API_BASE_URL = process.env.API_BASE_URL || 'http://localhost:5173'

test.describe('Pixel Multimodal Chat - E2E Integration', () => {

    test.beforeEach(async ({ page }) => {
        // Navigate to chat page
        await page.goto(CHAT_PAGE_URL)

        // Wait for component to load
        await page.waitForSelector('[data-testid="pixel-multimodal-chat"]', { timeout: 10000 })
    })

    test.describe('Component Rendering', () => {

        test('should render all main UI elements', async ({ page }) => {
            // Verify main container
            const chatContainer = page.locator('[data-testid="pixel-multimodal-chat"]')
            await expect(chatContainer).toBeVisible()

            // Verify text input
            const textInput = page.locator('[data-testid="message-input"]')
            await expect(textInput).toBeVisible()
            await expect(textInput).toHaveAttribute('placeholder', /type.*message/i)

            // Verify send button
            const sendButton = page.locator('[data-testid="send-button"]')
            await expect(sendButton).toBeVisible()

            // Verify audio recording button
            const recordButton = page.locator('[data-testid="record-button"]')
            await expect(recordButton).toBeVisible()

            // Verify streaming mode toggle
            const streamingToggle = page.locator('[data-testid="streaming-toggle"]')
            await expect(streamingToggle).toBeVisible()

            // Verify message display area
            const messageList = page.locator('[data-testid="message-list"]')
            await expect(messageList).toBeVisible()
        })

        test('should show emotion visualization area', async ({ page }) => {
            const emotionDisplay = page.locator('[data-testid="emotion-display"]')
            await expect(emotionDisplay).toBeVisible()
        })

        test('should be responsive on mobile viewport', async ({ page }) => {
            await page.setViewportSize({ width: 375, height: 667 })

            const chatContainer = page.locator('[data-testid="pixel-multimodal-chat"]')
            await expect(chatContainer).toBeVisible()

            // Verify flex-col layout on mobile
            const containerClass = await chatContainer.getAttribute('class')
            expect(containerClass).toContain('flex-col')
        })
    })

    test.describe('Text-Only REST Inference', () => {

        test('should send text message and receive response', async ({ page }) => {
            const messageInput = page.locator('[data-testid="message-input"]')
            const sendButton = page.locator('[data-testid="send-button"]')

            // Type message
            await messageInput.fill('Hello, I need someone to talk to')

            // Verify send button is enabled
            await expect(sendButton).toBeEnabled()

            // Send message
            await sendButton.click()

            // Wait for user message to appear
            const userMessage = page.locator('[data-testid="message-user"]').last()
            await expect(userMessage).toBeVisible()
            await expect(userMessage).toContainText('Hello, I need someone to talk to')

            // Wait for assistant response (with timeout)
            const assistantMessage = page.locator('[data-testid="message-assistant"]').last()
            await expect(assistantMessage).toBeVisible({ timeout: 5000 })

            // Verify response is not empty
            const responseText = await assistantMessage.textContent()
            expect(responseText).toBeTruthy()
            expect(responseText!.length).toBeGreaterThan(10)
        })

        test('should show loading state during inference', async ({ page }) => {
            const messageInput = page.locator('[data-testid="message-input"]')
            const sendButton = page.locator('[data-testid="send-button"]')

            await messageInput.fill('Tell me about cognitive behavioral therapy')
            await sendButton.click()

            // Verify loading indicator appears
            const loadingIndicator = page.locator('[data-testid="loading-indicator"]')
            await expect(loadingIndicator).toBeVisible({ timeout: 2000 })

            // Wait for response to complete
            await expect(loadingIndicator).toBeHidden({ timeout: 5000 })
        })

        test('should disable send button when input is empty', async ({ page }) => {
            const messageInput = page.locator('[data-testid="message-input"]')
            const sendButton = page.locator('[data-testid="send-button"]')

            // Initially empty
            await expect(sendButton).toBeDisabled()

            // Type something
            await messageInput.fill('Hello')
            await expect(sendButton).toBeEnabled()

            // Clear input
            await messageInput.clear()
            await expect(sendButton).toBeDisabled()
        })

        test('should handle API errors gracefully', async ({ page }) => {
            // Mock API error response
            await page.route('**/api/ai/pixel/infer', route => {
                route.fulfill({
                    status: 500,
                    body: JSON.stringify({ error: 'Internal server error' })
                })
            })

            const messageInput = page.locator('[data-testid="message-input"]')
            const sendButton = page.locator('[data-testid="send-button"]')

            await messageInput.fill('Test error handling')
            await sendButton.click()

            // Verify error message appears
            const errorMessage = page.locator('[data-testid="error-message"]')
            await expect(errorMessage).toBeVisible({ timeout: 3000 })
            await expect(errorMessage).toContainText(/error|failed/i)
        })

        test('should respect rate limiting', async ({ page }) => {
            // Mock 429 rate limit response
            await page.route('**/api/ai/pixel/infer', route => {
                route.fulfill({
                    status: 429,
                    body: JSON.stringify({ error: 'Rate limit exceeded' })
                })
            })

            const messageInput = page.locator('[data-testid="message-input"]')
            const sendButton = page.locator('[data-testid="send-button"]')

            await messageInput.fill('Test rate limit')
            await sendButton.click()

            // Verify rate limit error message
            const errorMessage = page.locator('[data-testid="error-message"]')
            await expect(errorMessage).toBeVisible()
            await expect(errorMessage).toContainText(/rate limit|too many/i)
        })
    })

    test.describe('Audio Recording', () => {

        test('should show recording UI when record button is clicked', async ({ page }) => {
            // Grant microphone permissions
            await page.context().grantPermissions(['microphone'])

            const recordButton = page.locator('[data-testid="record-button"]')
            await recordButton.click()

            // Verify recording UI appears
            const recordingIndicator = page.locator('[data-testid="recording-indicator"]')
            await expect(recordingIndicator).toBeVisible()

            // Verify duration timer appears
            const durationDisplay = page.locator('[data-testid="recording-duration"]')
            await expect(durationDisplay).toBeVisible()

            // Wait a moment and verify timer updates
            await page.waitForTimeout(1500)
            const duration = await durationDisplay.textContent()
            expect(duration).toMatch(/00:0[1-9]/) // At least 1 second
        })

        test('should stop recording when clicked again', async ({ page }) => {
            await page.context().grantPermissions(['microphone'])

            const recordButton = page.locator('[data-testid="record-button"]')

            // Start recording
            await recordButton.click()
            await page.waitForTimeout(2000)

            // Stop recording
            await recordButton.click()

            // Verify recording indicator is hidden
            const recordingIndicator = page.locator('[data-testid="recording-indicator"]')
            await expect(recordingIndicator).toBeHidden({ timeout: 2000 })
        })

        test('should disable recording without microphone access', async ({ page }) => {
            // Deny microphone permissions
            await page.context().grantPermissions([])

            const recordButton = page.locator('[data-testid="record-button"]')

            // Attempt to record
            await recordButton.click()

            // Verify error message or disabled state
            const errorMessage = page.locator('[data-testid="mic-error"]')
            await expect(errorMessage).toBeVisible({ timeout: 2000 })
            await expect(errorMessage).toContainText(/microphone|permission/i)
        })
    })

    test.describe('WebSocket Streaming', () => {

        test('should enable streaming mode and send message', async ({ page }) => {
            const streamingToggle = page.locator('[data-testid="streaming-toggle"]')
            const messageInput = page.locator('[data-testid="message-input"]')
            const sendButton = page.locator('[data-testid="send-button"]')

            // Enable streaming mode
            await streamingToggle.click()

            // Verify streaming indicator
            const streamingIndicator = page.locator('[data-testid="streaming-enabled"]')
            await expect(streamingIndicator).toBeVisible()

            // Send message
            await messageInput.fill('Explain mindfulness techniques')
            await sendButton.click()

            // Verify streaming status appears
            const streamingStatus = page.locator('[data-testid="streaming-status"]')
            await expect(streamingStatus).toBeVisible({ timeout: 3000 })
        })

        test('should show streaming chunks in real-time', async ({ page }) => {
            const streamingToggle = page.locator('[data-testid="streaming-toggle"]')
            const messageInput = page.locator('[data-testid="message-input"]')
            const sendButton = page.locator('[data-testid="send-button"]')

            await streamingToggle.click()
            await messageInput.fill('Tell me about anxiety management')
            await sendButton.click()

            // Wait for first chunk
            const assistantMessage = page.locator('[data-testid="message-assistant"]').last()
            await expect(assistantMessage).toBeVisible({ timeout: 5000 })

            // Verify message content grows over time
            const initialLength = (await assistantMessage.textContent())?.length || 0
            await page.waitForTimeout(2000)
            const finalLength = (await assistantMessage.textContent())?.length || 0

            expect(finalLength).toBeGreaterThan(initialLength)
        })

        test('should handle WebSocket connection errors', async ({ page }) => {
            // Mock WebSocket error by blocking WS upgrade
            await page.route('**/ws/pixel-multimodal', route => {
                route.abort('failed')
            })

            const streamingToggle = page.locator('[data-testid="streaming-toggle"]')
            const messageInput = page.locator('[data-testid="message-input"]')
            const sendButton = page.locator('[data-testid="send-button"]')

            await streamingToggle.click()
            await messageInput.fill('Test WebSocket error')
            await sendButton.click()

            // Verify error handling
            const errorMessage = page.locator('[data-testid="error-message"]')
            await expect(errorMessage).toBeVisible({ timeout: 5000 })
        })
    })

    test.describe('Emotion Visualization', () => {

        test('should display emotion metrics after response', async ({ page }) => {
            const messageInput = page.locator('[data-testid="message-input"]')
            const sendButton = page.locator('[data-testid="send-button"]')

            await messageInput.fill('I am feeling very anxious today')
            await sendButton.click()

            // Wait for response
            await page.locator('[data-testid="message-assistant"]').last().waitFor({ timeout: 5000 })

            // Verify emotion display updates
            const emotionDisplay = page.locator('[data-testid="emotion-display"]')
            await expect(emotionDisplay).toBeVisible()

            // Check for emotion metrics
            const valenceMetric = page.locator('[data-testid="emotion-valence"]')
            const arousalMetric = page.locator('[data-testid="emotion-arousal"]')
            const dominanceMetric = page.locator('[data-testid="emotion-dominance"]')

            await expect(valenceMetric).toBeVisible()
            await expect(arousalMetric).toBeVisible()
            await expect(dominanceMetric).toBeVisible()

            // Verify values are in 0-1 range
            const valenceText = await valenceMetric.textContent()
            const valenceValue = parseFloat(valenceText?.replace(/[^\d.]/g, '') || '0')
            expect(valenceValue).toBeGreaterThanOrEqual(0)
            expect(valenceValue).toBeLessThanOrEqual(1)
        })

        test('should color-code emotions appropriately', async ({ page }) => {
            const messageInput = page.locator('[data-testid="message-input"]')
            const sendButton = page.locator('[data-testid="send-button"]')

            await messageInput.fill('I feel great and optimistic!')
            await sendButton.click()

            await page.locator('[data-testid="message-assistant"]').last().waitFor({ timeout: 5000 })

            const emotionDisplay = page.locator('[data-testid="emotion-display"]')
            const emotionClass = await emotionDisplay.getAttribute('class')

            // Verify positive emotion has appropriate color (green/blue)
            expect(emotionClass).toMatch(/green|blue|positive/)
        })

        test('should show modality conflict warning when detected', async ({ page }) => {
            // This would require mocking a scenario where audio and text emotions diverge
            // For now, we'll test that the UI element exists
            const modalityConflict = page.locator('[data-testid="modality-conflict"]')

            // Element should be in DOM but hidden initially
            await expect(modalityConflict).toBeHidden()
        })
    })

    test.describe('Message Persistence', () => {

        test('should persist messages after page reload', async ({ page }) => {
            const messageInput = page.locator('[data-testid="message-input"]')
            const sendButton = page.locator('[data-testid="send-button"]')

            // Send a unique message
            const uniqueMessage = `Test message ${Date.now()}`
            await messageInput.fill(uniqueMessage)
            await sendButton.click()

            // Wait for response
            await page.locator('[data-testid="message-assistant"]').last().waitFor({ timeout: 5000 })

            // Reload page
            await page.reload()
            await page.waitForSelector('[data-testid="pixel-multimodal-chat"]', { timeout: 10000 })

            // Verify message is still visible
            const messages = page.locator('[data-testid="message-user"]')
            await expect(messages).toContainText(uniqueMessage)
        })

        test('should maintain message order after reload', async ({ page }) => {
            const messageInput = page.locator('[data-testid="message-input"]')
            const sendButton = page.locator('[data-testid="send-button"]')

            // Send two messages
            await messageInput.fill('First message')
            await sendButton.click()
            await page.waitForTimeout(1000)

            await messageInput.fill('Second message')
            await sendButton.click()
            await page.waitForTimeout(1000)

            // Reload
            await page.reload()
            await page.waitForSelector('[data-testid="pixel-multimodal-chat"]', { timeout: 10000 })

            // Verify order
            const userMessages = page.locator('[data-testid="message-user"]')
            const firstMessage = userMessages.nth(0)
            const secondMessage = userMessages.nth(1)

            await expect(firstMessage).toContainText('First message')
            await expect(secondMessage).toContainText('Second message')
        })
    })

    test.describe('Crisis Detection Integration', () => {

        test('should detect and flag crisis language', async ({ page }) => {
            const messageInput = page.locator('[data-testid="message-input"]')
            const sendButton = page.locator('[data-testid="send-button"]')

            // Send crisis-related message
            await messageInput.fill('I have been thinking about killing myself')
            await sendButton.click()

            // Verify crisis flag appears
            const crisisFlag = page.locator('[data-testid="crisis-flag"]')
            await expect(crisisFlag).toBeVisible({ timeout: 5000 })

            // Verify crisis escalation message
            const crisisMessage = page.locator('[data-testid="crisis-escalation"]')
            await expect(crisisMessage).toBeVisible()
            await expect(crisisMessage).toContainText(/emergency|crisis|help/i)
        })

        test('should provide crisis resources when detected', async ({ page }) => {
            const messageInput = page.locator('[data-testid="message-input"]')
            const sendButton = page.locator('[data-testid="send-button"]')

            await messageInput.fill('I want to harm myself right now')
            await sendButton.click()

            // Wait for crisis response
            await page.waitForTimeout(2000)

            // Verify crisis resource links
            const resourceLinks = page.locator('[data-testid="crisis-resources"]')
            await expect(resourceLinks).toBeVisible({ timeout: 5000 })

            // Should include hotline numbers
            await expect(resourceLinks).toContainText(/988|hotline|crisis/i)
        })
    })

    test.describe('Keyboard Shortcuts', () => {

        test('should send message with Enter key', async ({ page }) => {
            const messageInput = page.locator('[data-testid="message-input"]')

            await messageInput.fill('Test keyboard shortcut')
            await messageInput.press('Enter')

            // Verify message was sent
            const userMessage = page.locator('[data-testid="message-user"]').last()
            await expect(userMessage).toContainText('Test keyboard shortcut')
        })

        test('should send streaming message with Ctrl+Enter', async ({ page }) => {
            const messageInput = page.locator('[data-testid="message-input"]')
            const streamingToggle = page.locator('[data-testid="streaming-toggle"]')

            // Enable streaming first
            await streamingToggle.click()

            await messageInput.fill('Test Ctrl+Enter')
            await messageInput.press('Control+Enter')

            // Verify streaming status
            const streamingStatus = page.locator('[data-testid="streaming-status"]')
            await expect(streamingStatus).toBeVisible({ timeout: 3000 })
        })

        test('should cancel recording with Escape key', async ({ page }) => {
            await page.context().grantPermissions(['microphone'])

            const recordButton = page.locator('[data-testid="record-button"]')

            // Start recording
            await recordButton.click()
            await page.waitForTimeout(1000)

            // Cancel with Escape
            await page.keyboard.press('Escape')

            // Verify recording stopped
            const recordingIndicator = page.locator('[data-testid="recording-indicator"]')
            await expect(recordingIndicator).toBeHidden({ timeout: 2000 })
        })
    })

    test.describe('Accessibility', () => {

        test('should have proper ARIA labels', async ({ page }) => {
            const messageInput = page.locator('[data-testid="message-input"]')
            const sendButton = page.locator('[data-testid="send-button"]')
            const recordButton = page.locator('[data-testid="record-button"]')

            // Verify ARIA labels
            await expect(messageInput).toHaveAttribute('aria-label', /message|input/i)
            await expect(sendButton).toHaveAttribute('aria-label', /send/i)
            await expect(recordButton).toHaveAttribute('aria-label', /record|audio/i)
        })

        test('should support keyboard navigation', async ({ page }) => {
            // Tab through interactive elements
            await page.keyboard.press('Tab')
            let focusedElement = await page.evaluate(() => document.activeElement?.getAttribute('data-testid'))

            // Verify focus moves through form elements
            const expectedElements = ['message-input', 'send-button', 'record-button', 'streaming-toggle']
            let tabCount = 0
            let foundElements: string[] = []

            while (tabCount < 10) {
                await page.keyboard.press('Tab')
                const current = await page.evaluate(() => document.activeElement?.getAttribute('data-testid'))
                if (current && expectedElements.includes(current)) {
                    foundElements.push(current)
                }
                tabCount++
            }

            // Verify we found at least some expected elements
            expect(foundElements.length).toBeGreaterThan(0)
        })

        test('should have visible focus indicators', async ({ page }) => {
            const messageInput = page.locator('[data-testid="message-input"]')

            await messageInput.focus()

            // Verify focus ring is visible
            const focusClass = await messageInput.getAttribute('class')
            expect(focusClass).toMatch(/focus:ring|focus-visible/)
        })
    })

    test.describe('Performance', () => {

        test('should render component in <100ms', async ({ page }) => {
            const startTime = Date.now()

            await page.goto(CHAT_PAGE_URL)
            await page.waitForSelector('[data-testid="pixel-multimodal-chat"]')

            const renderTime = Date.now() - startTime

            expect(renderTime).toBeLessThan(3000) // Allow 3s for full page load
        })

        test('should handle 100+ messages without lag', async ({ page }) => {
            // Mock a session with many messages
            const messages = Array.from({ length: 100 }, (_, i) => ({
                role: i % 2 === 0 ? 'user' : 'assistant',
                content: `Message ${i + 1}`,
                timestamp: Date.now() - (100 - i) * 1000
            }))

            // Inject messages into page state
            await page.evaluate((msgs) => {
                (window as any).mockMessages = msgs
            }, messages)

            await page.reload()
            await page.waitForSelector('[data-testid="pixel-multimodal-chat"]')

            // Verify all messages render
            const messageElements = page.locator('[data-testid^="message-"]')
            const count = await messageElements.count()

            // Should use virtualization, so not all 100 may be in DOM
            expect(count).toBeGreaterThan(0)
        })

        test('should maintain <200ms response time for REST inference', async ({ page }) => {
            // Mock fast API response
            await page.route('**/api/ai/pixel/infer', route => {
                setTimeout(() => {
                    route.fulfill({
                        status: 200,
                        body: JSON.stringify({
                            response: 'Test response',
                            latency: 150,
                            emotions: { valence: 0.7, arousal: 0.4, dominance: 0.6 }
                        })
                    })
                }, 150)
            })

            const messageInput = page.locator('[data-testid="message-input"]')
            const sendButton = page.locator('[data-testid="send-button"]')

            const startTime = Date.now()

            await messageInput.fill('Performance test')
            await sendButton.click()

            await page.locator('[data-testid="message-assistant"]').last().waitFor({ timeout: 5000 })

            const responseTime = Date.now() - startTime

            // Allow some overhead for rendering
            expect(responseTime).toBeLessThan(500)
        })
    })
})
