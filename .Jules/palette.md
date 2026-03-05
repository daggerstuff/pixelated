## 2025-05-14 - Accessible Notification Indicators
**Learning:** Icon-only buttons with dynamic badges (like a notification bell with an unread count) are best made accessible by providing a dynamic \`aria-label\` on the button itself (e.g., "Notifications, 3 unread") while marking the visual badge and icons as \`aria-hidden="true"\`. This prevents redundant or confusing announcements where a screen reader might say "Button, Notifications, 3" without context.
**Action:** Use dynamic \`aria-label\` for buttons with state-dependent badges and hide decorative/redundant child elements.
