// src/hooks/useNetwork.ts (state only)
import { networkStore } from "../stores/networkStore";
import { useSignal, useTask$ } from "@builder.io/qwik";

export const useNetworkState = () => {
  const state = useSignal(networkStore.getState());

  useTask$(() => {
    const unsubscribe = networkStore.subscribe((newState) => {
      state.value = newState;
    });
    return () => unsubscribe();
  });

  return state.value; // { activeNetwork, wsUrl, availableNetworks, ... }
};
