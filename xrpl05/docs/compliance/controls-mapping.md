# SOC 2 Security Criteria – Preliminary Controls Mapping  
(for {XRPL}OS – early-stage readiness assessment)

**Scope:** Security (CC series) – primary focus for initial compliance preparation  
**Status:** Draft – implemented controls as of February 2025  
**Goal:** Map current practices → Common Criteria so gaps are obvious when pursuing SOC 2 Type 1/2

| CC ID       | Criterion Description                              | Current Implementation / Evidence                                                                 | Owner | Status     | Notes / Gaps to Close |
|-------------|----------------------------------------------------|---------------------------------------------------------------------------------------------------|-------|------------|-----------------------|
| CC1.1       | COSO control environment principles                | Code of conduct implied via open-source ethos; no formal policy yet                               | -     | Partial    | Write basic InfoSec Policy |
| CC1.4       | Management demonstrates commitment to integrity    | Transparent "no custody" messaging on site; secure defaults in architecture                      | Lead  | Implemented| - |
| CC3.1       | Risk assessment process                            | Informal threat model documented (security-model.md)                                              | Lead  | Partial    | Formalize risk register |
| CC3.2       | Identifies and assesses risks                      | See threat model table in security-model.md                                                       | Lead  | Implemented| Expand with likelihood scoring |
| CC6.1       | Logical access security (identification & auth)   | Wallet-based auth only; JWT short-lived for dashboard                                            | -     | Implemented| Add inactivity timeout |
| CC6.2       | Restricts logical access to authorized users       | Dashboard gated by membership NFT check + wallet connection                                      | -     | Implemented| - |
| CC6.3       | Evaluates and communicates asset vulnerabilities   | Dependency scanning (bun audit), Cloudflare WAF                                                    | Dev   | Partial    | Add automated vuln alerts |
| CC6.6 | Implements controls to prevent/detect malicious software | CSP headers, X-Content-Type-Options, etc. in middleware.ts | Implemented | 
| CC7.1       | Detects unauthorized use / anomalies               | Cloudflare Logs for API access patterns; future Sentry error tracking                            | -     | Partial    | Enable anomaly alerts |
| CC7.2       | Monitors system components for anomalies           | Cloudflare analytics + uptime monitoring                                                          | -     | Partial    | Add alerting |
| CC8.1       | Change management processes                        | Git-based version control; Cloudflare Pages previews for PRs                                      | Dev   | Implemented| Document release process |

This is **not** a full SOC 2 report — it's a living map to track progress.  
Update after major releases or when adding features (paywall enforcement, multi-network txs, etc.).

Next steps when revenue supports: engage Vanta/Drata for automated evidence collection.
