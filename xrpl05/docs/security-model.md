# {XRPL}OS Security & Privacy Model

**Version:** 1.0  
**Last Updated:** February 2025  
**Project:** {XRPL}OS – Multi-network XRPL/Xahau explorer, marketplace & dashboard

## Core Principles

1. **No custody of funds or keys**  
   - The application never receives, stores, or transmits private keys, seed phrases, or signing secrets.  
   - All transaction signing occurs exclusively in the user's wallet (Xaman, GemWallet, Crossmark, Ledger, etc.).

2. **Client-side only for sensitive operations**  
   - Transaction payloads are constructed client-side and sent directly to the wallet for user confirmation and signing.  
   - Signed transactions are submitted to public RPC endpoints (xrplcluster.com, xahau.network, etc.) without proxying through our servers unless explicitly for rate-limiting/security.

3. **Zero persistent user data storage**  
   - No accounts, emails, passwords, or personal identifiable information (PII) are stored.  
   - Only transient data: connected wallet address (in-memory/session), JWT for dashboard access (short-lived, cleared on disconnect).

4. **Pseudonymous by design**  
   - Users interact via wallet address only. No linking to real-world identity unless voluntarily provided (future features).

5. **Data in transit**  
   - All communication uses HTTPS (enforced via Cloudflare Pages).  
   - Security headers: Strict-Transport-Security, X-Content-Type-Options, X-Frame-Options, CSP (Content-Security-Policy).

6. **Infrastructure**  
   - Hosted on Cloudflare Pages (edge network, DDoS protection, WAF).  
   - Read-heavy caching via Cloudflare D1 (NFT metadata, IPFS images) – no sensitive data cached.  
   - RPC endpoints: public & decentralized where possible; no long-lived connections.

## High-Level Threat Model

| Threat                          | Likelihood | Impact | Mitigation |
|---------------------------------|------------|--------|------------|
| Phishing / fake connect prompt  | High       | High   | Wallet confirmation screens (Xaman preview), clear UI warnings |
| Malicious transaction payload   | Medium     | High   | Client-side validation before send; user must approve in wallet |
| RPC man-in-the-middle           | Low        | High   | HTTPS + known public endpoints; future fallback rotation |
| XSS via user input (search/forms) | Medium   | Medium | Input sanitization, CSP, React/Qwik escaping |
| Supply-chain attack (deps)      | Medium     | High   | Dependency pinning, regular `bun audit`, Snyk monitoring |
| Session hijacking (JWT)         | Low        | Medium | Short-lived tokens, HttpOnly cookies (future), disconnect clears |
| Denial of service (API abuse)   | Medium     | Low    | Cloudflare rate limiting + WAF rules |

## Future Controls (Post-Revenue)

- Formal incident response plan
- Annual penetration testing
- SOC 2 Type 2 + ISO 27001 certification process

This model is reviewed quarterly or after major releases.
