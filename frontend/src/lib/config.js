export const FUJI_PARAMS = {
  chainId: "0xA869",
  chainName: "Avalanche Fuji C-Chain",
  nativeCurrency: { name: "Avalanche", symbol: "AVAX", decimals: 18 },
  rpcUrls: ["https://api.avax-test.network/ext/bc/C/rpc"],
  blockExplorerUrls: ["https://testnet.snowtrace.io/"]
};

const ENV_FACTORY_ADDRESS = (import.meta.env.VITE_FACTORY_ADDRESS || "").trim();
export const DEFAULT_FACTORY_ADDRESS = "0x453cE750Ed0D135c3D53179f0D49F4a7480868f1";
export const FACTORY_ADDRESS = ENV_FACTORY_ADDRESS || DEFAULT_FACTORY_ADDRESS;
export const WALLETCONNECT_PROJECT_ID = (import.meta.env.VITE_WALLETCONNECT_PROJECT_ID || "").trim();
