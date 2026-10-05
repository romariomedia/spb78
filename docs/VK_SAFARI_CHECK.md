# VK browser login check

The existing OAuthList uses the SDK's default new-tab flow and postMessage.
A web-only alternate button now uses ConfigAuthMode.Redirect in the same tab.
Its transaction uses random state + PKCE, sessionStorage, a 15-minute expiry,
exact origin/path validation and one-time consumption. OAuth parameters are
removed from the address bar before code exchange. Native App Link flow is unchanged.

VK cabinet (web application 54699979): verify the exact production origin and
redirect URL https://sportbuddy78.pro are allowed. If www is served without a
canonical redirect, its origin/redirect must also be allowed. Cabinet settings
were not accessible during this review. Do not enable third-party cookies or
turn off Safari tracking protection as a prerequisite for users.

After deployment, on a real iPhone Safari:
1. Test existing VK button, with and without VK app installed where possible.
2. Test same-tab button; confirm return logs into the same existing account.
3. Cancel VK authorization and retry; confirm no phantom profile appears.
4. Reload the callback; it must not reuse the transaction.
5. Test private mode and storage restrictions: explain failure, do not loop.
6. Confirm Android existing login remains operational.

If failure persists collect only the displayed error text/code, time, iOS
version, site hostname and whether VK app opened. Do not share callback URLs,
access tokens or sessionStorage contents. Server errors require matching VPS logs.

Local verification: TypeScript, production build, VK identity + redirect tests.
No real Safari/VK account authorization was performed by the assistant.
