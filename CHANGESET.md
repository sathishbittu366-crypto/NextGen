# Notification Toggle 0.0.2

Changed:
- `frontend/src/components/NotificationCenter.tsx`

Behavior:
- Determines browser push state from both backend subscription state and the current browser subscription.
- After a successful Enable, the action changes to **Disable**.
- Shows a **Test** action only while push is enabled on the current browser.
- After Disable, the action returns to **Enable**.
- Avoids displaying an enabled state if the server says enabled but this browser no longer has a subscription.
