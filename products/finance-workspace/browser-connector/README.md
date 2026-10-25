# Optional browser collector

This unpacked Chrome extension requests exports from an already signed-in official Cash App or Fifth Third tab. It does not sign in, bypass MFA, read passwords or transfer money. It depends on those sites' current page layouts; statement downloads may need manual action.

Open Chrome's extension management, enable developer mode, and load this folder as an unpacked extension. In the extension popup choose the provider you want. Use Chrome's normal Downloads folder and allow downloads on that official account site if Chrome asks. You can stop the collector in the popup or remove the extension at any time.

To import downloaded statements, run `node scripts/enable-browser-collector.mjs` from the app folder, then restart the app. Check import status and review transactions. This optional feature is separate from the one-click local app setup.
