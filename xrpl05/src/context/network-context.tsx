import {
  useSignal,
  useVisibleTask$,
  useComputed$,
  createContextId,
} from "@builder.io/qwik";
import { networkStore } from "~/lib/store/network";
import type { NetworkState } from "~/lib/store/network";
export * from "~/lib/network";

// Export a dummy context ID in case any lingering imports expect it
export const NetworkContext = createContextId<any>("network-context");

export function useNetworkContext() {
  // Initialize with the current state (runs on server and client)
  const state = useSignal<NetworkState>(networkStore.getState());

  // Subscribe to changes on the client only.
  // By referencing networkStore directly from the module scope instead of passing
  // it through a generic hook argument, Qwik's optimizer can safely import it
  // in the client chunk rather than trying to serialize the un-serializable Zustand store.
  // eslint-disable-next-line qwik/no-use-visible-task
  useVisibleTask$(({ cleanup }) => {
    const unsubscribe = networkStore.subscribe((newState) => {
      state.value = newState;
    });

    cleanup(() => unsubscribe());
  });

  return {
    activeNetwork: useComputed$(() => state.value.activeNetwork),
    wsUrl: useComputed$(() => state.value.wsUrl),
  };
}
