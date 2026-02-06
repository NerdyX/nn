// src/context/network-context.tsx
import {
  createContextId,
  useContextProvider,
  useSignal,
  component$,
  $,
} from "@builder.io/qwik";

export type Network = "xrpl" | "xahau";

export const NETWORK_CONFIG = {
  xrpl: {
    label: "XRPL",
    ws: "wss://xrplcluster.com",
    apiSuffix: "xrpl",
  },
  xahau: {
    label: "Xahau",
    ws: "wss://xahau.network",
    apiSuffix: "xahau",
  },
};

export const NetworkContext = createContextId<{
  network: ReturnType<typeof useSignal<Network>>;
  wsUrl: ReturnType<typeof useSignal<string>>;
  toggleNetwork: () => void;
}>("network-context");

export const NetworkProvider = component$((props: { children: any }) => {
  const network = useSignal<Network>("xrpl");
  const wsUrl = useSignal<string>(NETWORK_CONFIG.xrpl.ws);

  const toggleNetwork = $(() => {
    const next = network.value === "xrpl" ? "xahau" : "xrpl";
    network.value = next;
    wsUrl.value = NETWORK_CONFIG[next].ws;
  });

  useContextProvider(NetworkContext, {
    network,
    wsUrl,
    toggleNetwork,
  });

  return <>{props.children}</>;
});
