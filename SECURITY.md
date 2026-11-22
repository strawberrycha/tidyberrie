# Security

Tidyberrie is a private Android APK. The app has no cloud backend or accounts. IndexedDB and bundled assets live in the Android WebView. The APK has no service worker.

- **Local access.** App Lock slows PIN guessing and blocks casual access. It does not encrypt device data against someone with access to the app profile or device storage.
- **Backups.** Plain JSON and CSV contain personal data. Optional encrypted JSON uses AES-256-GCM, random salt and nonce, and PBKDF2-SHA-256 with 600,000 iterations. Passphrases are used in memory only. A forgotten passphrase cannot be recovered.
- **Imports and deletion.** Validate imports with Zod and size limits. Preview changes before applying them transactionally. Keep a safety snapshot when replacing or restoring. Permanent deletion requires typed confirmation.
- **Injection.** Keep scripts and other resources same-origin under CSP. Render user content as text. Quote CSV cells and neutralize formula-leading values. Avoid logging personal data or credentials.
- **Repository.** Keep local configuration, exports, and signing material out of Git. The secret scanner checks tracked files for common patterns and reports file names and line numbers only.

## Dependency audit

The full npm audit and production-only audit both reported zero findings at cleanup.
