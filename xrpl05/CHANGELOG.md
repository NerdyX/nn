# Changelog

## [Modular Architecture Refactor]
This major release overhauls the application's underlying state management and backend handling while preserving the UI. It introduces a fast, secure, and fully modular architecture tailored for production scale.

### Features & Refactors
* **Zustand-Based Stores:** 
  Replaced scattered Qwik contexts with central Zustand stores (\`network\`, \`wallet\`, \`nft\`, \`ledger\`) using a custom \`useZustand\` bridge. 
  *Migration Note:* Developers should now use \`useNetworkContext()\` and \`useWalletContext()\` to access state in components rather than using \`useContextProvider\`.
* **XRPL & Xahau Separation:** 
  100% modularization between networks, allowing easy toggling and dedicated NFT/transaction handling logic for both.
* **IPFS & D1 Caching:** 
  Introduced Cloudflare D1-based caching via a \`stale-while-revalidate\` mechanism to ensure instant rendering of NFTs, avoiding expensive and slow direct node queries. Included robust hex-decoding and secure path caching for IPFS URIs.
* **NFT Type Normalization:** 
  Normalized transaction types and shared endpoints under \`/routes/api\` for consistent querying regardless of the active chain.
* **Reown (WalletConnect) Integration:** 
  Added first-class support for Reown WalletConnect alongside Xaman, Crossmark, Gutte, and Gem, integrated perfectly into the global Wallet store and session persistence flow.

### Migration Guide for Developers
1. **Context Updates:** \`NetworkContext\` and \`WalletContext\` are no longer provided at the layout level. Instead, import \`useNetworkContext()\` from \`~/context/network-context.tsx\` which hydrates from the Zustand store.
2. **State Actions:** Use the exported actions like \`walletActions.setWalletState({ ... })\` or \`networkActions.setActiveNetwork('xrpl')\` to manipulate state rather than signals directly.
3. **Environment:** Reown needs a \`VITE_PROJECT_ID\` set in your \`.env\`.
