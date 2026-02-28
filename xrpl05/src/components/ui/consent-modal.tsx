import { component$, useSignal, useVisibleTask$, $ } from "@builder.io/qwik";

export const ConsentModal = component$(() => {
  const isVisible = useSignal(false);
  const activeTab = useSignal<"consent" | "terms" | "privacy">("consent");

  // eslint-disable-next-line qwik/no-use-visible-task
  useVisibleTask$(() => {
    if (typeof localStorage !== "undefined") {
      const hasConsented = localStorage.getItem("app_consent_accepted");
      if (!hasConsented) {
        isVisible.value = true;
      }
    }
  });

  const handleAccept$ = $(() => {
    if (typeof localStorage !== "undefined") {
      localStorage.setItem("app_consent_accepted", "true");
      localStorage.setItem("app_consent_date", new Date().toISOString());
    }
    isVisible.value = false;
  });

  const handleDecline$ = $(() => {
    if (typeof localStorage !== "undefined") {
      localStorage.setItem("app_consent_declined", "true");
      localStorage.setItem("app_consent_date", new Date().toISOString());
    }
    isVisible.value = false;
  });

  if (!isVisible.value) {
    return null;
  }

  return (
    <>
      <div class="modal-backdrop"></div>
      <div class="modal max-w-2xl w-full mx-4 bg-white rounded-2xl shadow-xl">
        <div class="max-h-[80vh] overflow-y-auto">
          {/* Tabs */}
          <div class="border-b border-gray-200 p-6">
            <div class="flex gap-2 flex-wrap">
              <button
                class={`px-4 py-2 rounded-lg font-medium transition ${
                  activeTab.value === "consent"
                    ? "bg-blue-100 text-blue-600"
                    : "text-gray-600 hover:bg-gray-100"
                }`}
                onClick$={() => (activeTab.value = "consent")}
              >
                Cookie Consent
              </button>
              <button
                class={`px-4 py-2 rounded-lg font-medium transition ${
                  activeTab.value === "terms"
                    ? "bg-blue-100 text-blue-600"
                    : "text-gray-600 hover:bg-gray-100"
                }`}
                onClick$={() => (activeTab.value = "terms")}
              >
                Terms of Service
              </button>
              <button
                class={`px-4 py-2 rounded-lg font-medium transition ${
                  activeTab.value === "privacy"
                    ? "bg-blue-100 text-blue-600"
                    : "text-gray-600 hover:bg-gray-100"
                }`}
                onClick$={() => (activeTab.value = "privacy")}
              >
                Privacy Policy
              </button>
              <button
                class={`px-4 py-2 rounded-lg font-medium transition ${
                  activeTab.value === "terms"
                    ? "bg-blue-100 text-blue-600"
                    : "text-gray-600 hover:bg-gray-100"
                }`}
                onClick$={() => (activeTab.value = "terms")}
              >
                User Agreement
              </button>
            </div>
          </div>

          {/* Content */}
          <div class="p-6 space-y-4 scrollbar-thin">
            {activeTab.value === "consent" && (
              <div class="space-y-4">
                <h2 class="text-2xl font-bold text-gray-900">
                  Cookie & Analytics Consent
                </h2>
                <p class="text-gray-600">
                  We use cookies and analytics to improve your experience on our
                  platform. By accepting, you allow us to:
                </p>
                <ul class="space-y-2 text-gray-600">
                  <li class="flex gap-3">
                    <span class="text-blue-600 font-bold">✓</span>
                    <span>
                      Store authentication tokens securely in your browser
                    </span>
                  </li>
                  <li class="flex gap-3">
                    <span class="text-blue-600 font-bold">✓</span>
                    <span>Analyze usage patterns to optimize performance</span>
                  </li>
                  <li class="flex gap-3">
                    <span class="text-blue-600 font-bold">✓</span>
                    <span>Remember your preferences and settings</span>
                  </li>
                  <li class="flex gap-3">
                    <span class="text-blue-600 font-bold">✓</span>
                    <span>Provide security and fraud prevention</span>
                  </li>
                </ul>
                <p class="text-sm text-gray-500">
                  Essential cookies are always enabled. You can manage these
                  preferences in your account settings at any time.
                </p>
              </div>
            )}

            {activeTab.value === "terms" && (
              <div class="space-y-4">
                <h2 class="text-2xl font-bold text-gray-900">
                  Terms of Service
                </h2>
                <div class="space-y-3 text-gray-600 text-sm">
                  <div>
                    <h3 class="font-semibold text-gray-900 mb-1">
                      1. Acceptance of Terms
                    </h3>
                    <p>
                      By accessing and using this platform, you accept and agree
                      to be bound by the terms and provision of this agreement.
                    </p>
                    <p>
                      {"{XRPL}"}OS is a blockchain platform and terminal
                      interface for the XRP Ledger, Xahau Network, and any
                      future supported networks.
                    </p>
                  </div>
                  <div>
                    <h3 class="font-semibold text-gray-900 mb-1">
                      2. Use License
                    </h3>
                    <p>
                      Permission is granted to temporarily download one copy of
                      the materials for personal, non-commercial transitory
                      viewing only. This is the grant of a license, not a
                      transfer of title, and under this license you may not:
                    </p>
                  </div>
                  <div>
                    <ul class="mt-2 ml-4 space-y-1 list-disc">
                      <li>
                        {"{XRPL}"}OS is a blockchain platform and terminal
                        interface for the XRP Ledger, Xahau Network, and any
                        future supported networks.
                      </li>
                      <li>
                        ou must connect to the Platform via your self-custody
                        wallet. {"{XRPL}"}OS has no access to your private keys,
                        funds, transactions, trades, gains, or losses
                      </li>
                      <li>
                        The Platform functions as a gateway and terminal only.
                        Any blockchain or financial activity you perform is
                        entirely your responsibility
                      </li>
                      <li>
                        Any debit cards provided through the Platform are issued
                        via a third-party provider, whitelabeled by {"{XRPL}"}
                        OS. {"{XRPL}"}OS is not responsible for card issuance,
                        transactions, or disputes.
                      </li>
                      <li>
                        {"{XRPL}"}OS caches ledger data in a database for
                        performance; caching does not grant access to user funds
                        or private keys
                      </li>
                      <li>
                        {"{XRPL}"}OS reserves the right to update these Terms at
                        any time. Continued use constitutes acceptance of
                        updated terms.
                      </li>
                    </ul>
                  </div>
                  <div>
                    <h3 class="font-semibold text-gray-900 mb-1">
                      3. Disclaimer
                    </h3>
                    <p>
                      The materials on our platform are provided on an 'as is'
                      basis. We make no warranties, expressed or implied, and
                      hereby disclaim and negate all other warranties including,
                      without limitation, implied warranties or conditions of
                      merchantability, fitness for a particular purpose, or
                      non-infringement of intellectual property.
                    </p>
                  </div>
                  <div>
                    <h3 class="font-semibold text-gray-900 mb-1">
                      Blockchain & Wallet Responsibility Agreement
                    </h3>
                    <p>
                      You acknowledge that:
                      <ul>
                        <li>
                          - You are solely responsible for all transactions
                          executed through your self-custody wallet.
                        </li>
                        <li>
                          - {"{XRPL}"}OS has no access to your wallet, private
                          keys, funds, or credentials.
                        </li>
                        <li>
                          - {"{XRPL}"}OS is not responsible for financial gains,
                          losses, or any outcomes of your blockchain activity.
                        </li>
                        <li>
                          - Any wallet recovery provided by {"{XRPL}"}OS is
                          conducted without access to your private keys, using
                          zero-knowledge proof processes during verification
                          stages.
                        </li>
                      </ul>
                      <p class="font-semibold text-black">
                        You agree to indemnify and hold harmless {"{XRPL}"}OS
                        and its affiliates, officers, employees, and agents from
                        any claims, damages, liabilities, or expenses arising
                        from your use of the service, including any breach of
                        this agreement.
                      </p>
                    </p>
                  </div>
                  <div>
                    <h3 class="font-semibold text-gray-900 mb-1">
                      4. Limitations
                    </h3>
                    <p>
                      In no event shall our company or its suppliers be liable
                      for any damages (including, without limitation, damages
                      for loss of data or profit, or due to business
                      interruption) arising out of the use or inability to use
                      the materials on our platform.
                    </p>
                  </div>
                  <div>
                    <h3 class="font-semibold text-gray-900 mb-1">
                      5. Accuracy of Materials
                    </h3>
                    <p>
                      The materials appearing on our platform could include
                      technical, typographical, or photographic errors. We do
                      not warrant that any of the materials on our platform are
                      accurate, complete, or current.
                    </p>
                  </div>
                  <div>
                    <h3 class="font-semibold text-gray-900 mb-1">
                      6. Sovereign Social Media Consent
                    </h3>
                    <ul>
                      By joining {"{XRPL}"}OS Social:
                      <li>
                        You retain full ownership of your identity and account.
                      </li>
                      <li>
                        Your account cannot be shadow banned, removed, or
                        deleted by {"{XRPL}"}OS.
                      </li>
                      <li>
                        You may create private paid groups. Content posted is
                        entirely your responsibility. <br />
                        {"{XRPL}"}OS assumes no liability for user-generated
                        content.
                      </li>
                      <li>
                        All messages sent through the private messenger are
                        end-to-end encrypted. {"{XRPL}"}OS has no access to the
                        content at any time, from any angle.
                      </li>
                      <li>
                        By using the social platform, you agree to respect
                        applicable laws and understand that {"{XRPL}"}OS does
                        not moderate private content.
                      </li>
                    </ul>
                  </div>
                  <div>
                    <h3 class="font-semibold text-gray-900 mb-1">
                      7. Indemnification
                    </h3>
                    <p>
                      You agree to indemnify and hold us harmless from any
                      liability arising out of your use of our platform.
                    </p>
                  </div>
                  <div>
                    <h3 class="font-semibold text-gray-900 mb-1">
                      8. Termination
                    </h3>
                    <p>
                      We reserve the right to terminate your access to our
                      platform at any time, without notice or liability.
                    </p>
                  </div>
                  <div>
                    <h3 class="font-semibold text-gray-900 mb-1">
                      9. Governing Law
                    </h3>
                    <p>
                      This agreement shall be governed by and construed in
                      accordance with the laws of the State of California,
                      without regard to its conflict of law provisions.
                    </p>
                  </div>
                  <div>
                    <h3 class="font-semibold text-gray-900 mb-1">
                      10. Changes to this Agreement
                    </h3>
                    <p>
                      We reserve the right to modify this agreement at any time,
                      without notice or liability. Your continued use of our
                      platform after any such modification constitutes your
                      acceptance of the modified terms.
                    </p>
                  </div>
                  <div>
                    <h3 class="font-semibold text-gray-900 mb-1">
                      11. Dispute Resolution
                    </h3>
                    <p>
                      Any disputes arising out of or relating to this agreement
                      shall be resolved through binding arbitration in
                      accordance with the rules of the American Arbitration
                      Association.
                    </p>
                  </div>
                </div>
              </div>
            )}

            {activeTab.value === "privacy" && (
              <div class="space-y-4">
                <h2 class="text-2xl font-bold text-gray-900">Privacy Policy</h2>
                <div class="space-y-3 text-gray-600 text-sm">
                  <div>
                    <h3 class="font-semibold text-gray-900 mb-1">
                      Information We Collect
                    </h3>
                    <p>
                      We collect information you provide directly, such as
                      wallet addresses, transaction history, and account
                      preferences. We also collect information about your device
                      and how you interact with our platform.
                    </p>
                  </div>
                  <div>
                    <h3 class="font-semibold text-gray-900 mb-1">
                      How We Use Your Information
                    </h3>
                    <p>
                      We use the information we collect to provide, maintain,
                      and improve our services, process transactions,
                      communicate with you, and comply with legal obligations.
                    </p>
                    <ul>
                      <li>
                        {"{XRPL}"}OS provides a wallet recovery service for your
                        self-custody wallet.
                      </li>
                      <li>
                        Recovery uses multi-stage verification and
                        zero-knowledge proof processes.
                      </li>
                      <li>
                        {"{XRPL}"}OS does not access or store your private keys.
                      </li>
                      <li>
                        Wallet recovery is performed solely at your request and
                        according to verification procedures you authorize.
                      </li>
                    </ul>
                  </div>
                  <div>
                    <h3 class="font-semibold text-gray-900 mb-1">
                      Data Protection
                    </h3>
                    <p>
                      Your wallet private keys are never transmitted to or
                      stored on our servers. All signing operations occur
                      locally on your device. We use industry-standard
                      encryption to protect data in transit.
                    </p>
                  </div>
                  <div>
                    <h3 class="font-semibold text-gray-900 mb-1">
                      Third-Party Services
                    </h3>
                    <p>
                      We may integrate with blockchain networks, wallet
                      providers, and analytics services. Their privacy policies
                      govern their data practices, and we recommend reviewing
                      them.
                    </p>
                  </div>
                  <div>
                    <h3 class="font-semibold text-gray-900 mb-1">
                      Your Rights
                    </h3>
                    <p>
                      You have the right to access, modify, or delete your
                      personal data at any time through your account settings.
                      You can also opt-out of non-essential cookies at any time.
                    </p>
                  </div>
                  <div>
                    <h3 class="font-semibold text-gray-900 mb-1">Contact Us</h3>
                    <p>
                      If you have any questions about this privacy policy or our
                      practices, please contact us through our website's contact
                      form.
                    </p>
                  </div>
                </div>
                <div>
                  <h3 class="font-semibold text-gray-900 mb-1">
                    Data &amp; Caching Consent
                  </h3>
                  <p>
                    {"{XRPL}"}OS may store cached data from supported ledgers to
                    provide low-latency queries and improve performance.
                  </p>
                  <ul>
                    <li>
                      <strong>Cache Duration:</strong> Cached data does not
                      grant {"{XRPL}"}OS access to your private keys, funds, or
                      transactions..
                    </li>
                    <li>
                      <strong>Cache Reason:</strong> The cache exists for
                      read-only performance optimization.
                    </li>
                    <li>
                      <strong>Cache Limitations:</strong> All interactions
                      remain ledger-native and deterministic.
                    </li>
                  </ul>
                </div>
              </div>
            )}
          </div>

          {/* Actions */}
          <div class="border-t border-gray-200 p-6 flex gap-3 justify-end bg-gray-50">
            <button class="btn btn-secondary" onClick$={handleDecline$}>
              Decline
            </button>
            <button class="btn btn-primary" onClick$={handleAccept$}>
              Accept All
            </button>
          </div>
        </div>
      </div>
    </>
  );
});
