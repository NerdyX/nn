//import type { AppKitNetwork } from "@reown/appkit/networks";
import type { CustomCaipNetwork } from "@reown/appkit-common";
import { UniversalConnector } from "@reown/appkit-universal-connector";

// Get projectId from https://dashboard.reown.com
export const projectId =
  import.meta.env.VITE_PROJECT_ID || "841c77e854a0e8a315e3c49690dd0d60"; // this is a public projectId only to use on localhost

if (!projectId) {
  throw new Error("Project ID is not defined");
}

// you can configure your own network
const suiMainnet: CustomCaipNetwork<"sui"> = {
  id: 784,
  chainNamespace: "sui" as const,
  caipNetworkId: "sui:mainnet",
  name: "Sui",
  nativeCurrency: { name: "SUI", symbol: "SUI", decimals: 9 },
  rpcUrls: { default: { http: ["https://fullnode.mainnet.sui.io:443"] } },
};

const xrplMainnet: CustomCaipNetwork<"xrpl"> = {
  id: 1,
  chainNamespace: "xrpl" as const,
  caipNetworkId: "xrpl:mainnet",
  name: "XRP Ledger",
  nativeCurrency: { name: "XRP", symbol: "XRP", decimals: 6 },
  rpcUrls: { default: { http: ["https://s.altnet.rippletest.net:51234"] } },
};

export async function getUniversalConnector() {
  const universalConnector = await UniversalConnector.init({
    projectId,
    metadata: {
      name: "Universal Connector",
      description: "Universal Connector",
      url: "https://appkit.reown.com",
      icons: ["https://appkit.reown.com/icon.png"],
    },
    networks: [
      {
        methods: ["xrpl_signPersonalMessage"],
        chains: [xrplMainnet as CustomCaipNetwork],
        events: [],
        namespace: "xrpl",
      },
      {
        methods: ["sui_signTransaction"],
        chains: [suiMainnet as CustomCaipNetwork],
        events: [],
        namespace: "sui",
      },
    ],
  });

  return universalConnector;
}
