import {
  useSignal,
  useVisibleTask$,
  useComputed$,
  createContextId,
} from "@builder.io/qwik";
import { walletStore } from "~/lib/store/wallet";
import type { WalletState } from "~/lib/store/wallet";
export * from "~/lib/wallet/gutte";
export * from "~/lib/store/wallet";

// Export a dummy context ID in case any lingering imports expect it
export const WalletContext = createContextId<any>("wallet-context");

export function useWalletContext() {
  // Initialize with the current state (runs on server and client)
  const state = useSignal<WalletState>(walletStore.getState());

  // Subscribe to changes on the client only.
  // By referencing walletStore directly from the module scope instead of passing
  // it through a generic hook argument, Qwik's optimizer can safely import it
  // in the client chunk rather than trying to serialize the un-serializable Zustand store.
  // eslint-disable-next-line qwik/no-use-visible-task
  useVisibleTask$(({ cleanup }) => {
    const unsubscribe = walletStore.subscribe((newState) => {
      state.value = newState;
    });

    cleanup(() => unsubscribe());
  });

  return {
    connected: useComputed$(() => state.value.connected),
    walletType: useComputed$(() => state.value.walletType),
    address: useComputed$(() => state.value.address),
    displayName: useComputed$(() => state.value.displayName),
    gutteNetwork: useComputed$(() => state.value.gutteNetwork),
  };
}
