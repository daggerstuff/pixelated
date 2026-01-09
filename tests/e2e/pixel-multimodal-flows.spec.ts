/**
 * E2E Integration Tests using Page Object Model
 * 
 * Focused, maintainable tests for the multimodal chat flow
 * using the PixelMultimodalChatPage abstraction.
 */

import { test, expect } from '@playwright/test'
import { PixelMultimodalChatPage } from './pages/PixelMultimodalChatPage'

test.describe('Pixel Multimodal Chat - Core Flows', () => {
    let chatPage: PixelMultimodalChatPage

    test.beforeEach(async ({ page }) => {
        chatPage = new PixelMultimodalChatPage(page)
        await chatPage.goto()
    })

    test.describe('Text-Only Communication', () => {

        test('complete text conversation flow', async () => {
            await chatPage.sendTextMessage('Hello, I need help with anxiety')

            const response = await chatPage.getLatestMessageContent()
            expect(response.length).toBeGreaterThan(20)

            // Verify emotions are displayed
            const emotions = await chatPage.getEmotionMetrics()
            expect(emotions.valence).toBeGreaterThanOrEqual(0)
            expect(emotions.valence).toBeLessThanOrEqual(1)
        })

        test('multi-turn conversation', async () => {
            await chatPage.sendTextMessage('I feel overwhelmed')
            await chatPage.sendTextMessage('It is affecting my work')
            await chatPage.sendTextMessage('What should I do?')

            const messageCount = await chatPage.getMessageCount()
            expect(messageCount).toBeGreaterThanOrEqual(6) // 3 user + 3 assistant
        })

        test('error recovery', async () => {
            await chatPage.mockInferenceError()
            await chatPage.sendTextMessage('Test error', { waitForResponse: false })

            const hasError = await chatPage.hasError()
            expect(hasError).toBe(true)

            const errorMsg = await chatPage.getErrorMessage()
            expect(errorMsg).toContain('error')
        })
    })

    test.describe('Streaming Communication', () => {

        test('enable streaming and send message', async () => {
            await chatPage.enableStreaming()
            await chatPage.sendTextMessage('Explain cognitive behavioral therapy')

            // Streaming response should arrive
            const response = await chatPage.getLatestMessageContent()
            expect(response.length).toBeGreaterThan(0)
        })

        test('toggle between streaming and REST modes', async () => {
            // Start with REST
            await chatPage.sendTextMessage('First message')

            // Switch to streaming
            await chatPage.enableStreaming()
            await chatPage.sendTextMessage('Second message')

            // Switch back to REST
            await chatPage.disableStreaming()
            await chatPage.sendTextMessage('Third message')

            const messageCount = await chatPage.getMessageCount()
            expect(messageCount).toBeGreaterThanOrEqual(6)
        })
    })

    test.describe('Audio Recording', () => {

        test('record audio with permission', async ({ page }) => {
            await chatPage.grantMicrophonePermission()
            await chatPage.recordAudio(2000) // 2 seconds

            const duration = await chatPage.getRecordingDuration()
            expect(duration).toMatch(/00:0[2-9]/) // At least 2 seconds
        })

        test('handle missing microphone permission', async () => {
            await chatPage.denyMicrophonePermission()
            await chatPage.startRecording()

            // Should show error
            const errorMsg = await chatPage.getErrorMessage()
            expect(errorMsg.toLowerCase()).toMatch(/microphone|permission/)
        })
    })

    test.describe('Crisis Detection', () => {

        test('detect suicidal ideation', async () => {
            await chatPage.sendTextMessage('I have been thinking about killing myself')

            const hasCrisis = await chatPage.hasCrisisFlag()
            expect(hasCrisis).toBe(true)
        })

        test('show crisis resources', async () => {
            await chatPage.sendTextMessage('I want to harm myself')

            const { crisisResources } = chatPage
            await expect(crisisResources).toBeVisible({ timeout: 5000 })
        })

        test('do not flag normal therapeutic discussion', async () => {
            await chatPage.sendTextMessage('I am feeling stressed about work')

            const hasCrisis = await chatPage.hasCrisisFlag()
            expect(hasCrisis).toBe(false)
        })
    })

    test.describe('Message Persistence', () => {

        test('persist messages across reload', async ({ page }) => {
            const uniqueMsg = `Test ${Date.now()}`
            await chatPage.sendTextMessage(uniqueMsg)

            await page.reload()
            await chatPage.waitForLoad()

            const messages = chatPage.getUserMessage()
            await expect(messages).toContainText(uniqueMsg)
        })

        test('maintain conversation history order', async ({ page }) => {
            await chatPage.sendTextMessage('First')
            await chatPage.sendTextMessage('Second')
            await chatPage.sendTextMessage('Third')

            await page.reload()
            await chatPage.waitForLoad()

            const userMessages = chatPage.getUserMessage()
            await expect(userMessages.nth(0)).toContainText('First')
            await expect(userMessages.nth(1)).toContainText('Second')
            await expect(userMessages.nth(2)).toContainText('Third')
        })
    })

    test.describe('Keyboard Navigation', () => {

        test('send with Enter key', async () => {
            await chatPage.typeMessage('Test Enter key')
            await chatPage.pressEnter()

            const lastMessage = chatPage.getUserMessage().last()
            await expect(lastMessage).toContainText('Test Enter key')
        })

        test('send streaming with Ctrl+Enter', async () => {
            await chatPage.enableStreaming()
            await chatPage.typeMessage('Test Ctrl+Enter')
            await chatPage.pressCtrlEnter()

            const lastMessage = chatPage.getUserMessage().last()
            await expect(lastMessage).toContainText('Test Ctrl+Enter')
        })

        test('cancel recording with Escape', async () => {
            await chatPage.grantMicrophonePermission()
            await chatPage.startRecording()
            await chatPage.pressEscape()

            const isRecording = await chatPage.recordingIndicator.isVisible()
            expect(isRecording).toBe(false)
        })
    })

    test.describe('Accessibility', () => {

        test('verify ARIA labels and keyboard navigation', async () => {
            await chatPage.verifyAccessibility()
        })

        test('mobile responsive layout', async () => {
            await chatPage.verifyMobileLayout()
        })
    })

    test.describe('Performance', () => {

        test('fast response time', async () => {
            await chatPage.mockInferenceResponse({
                text: 'Quick response',
                latency: 150
            })

            const startTime = Date.now()
            await chatPage.sendTextMessage('Performance test')
            const responseTime = Date.now() - startTime

            expect(responseTime).toBeLessThan(1000) // Including render time
        })

        test('handle large message history', async ({ page }) => {
            // Inject 50 messages
            for (let i = 0; i < 10; i++) {
                await chatPage.sendTextMessage(`Message ${i + 1}`, { waitForResponse: false })
                await page.waitForTimeout(100)
            }

            const count = await chatPage.getMessageCount()
            expect(count).toBeGreaterThan(10)
        })
    })
})
