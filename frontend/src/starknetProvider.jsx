import React from 'react';
import { sepolia } from '@starknet-react/chains';
import {
  StarknetConfig,
  argent,
  braavos,
  useInjectedConnectors,
  voyager,
  jsonRpcProvider
} from '@starknet-react/core';

export function StarknetProvider({ children }) {
  const { connectors } = useInjectedConnectors({
    recommended: [argent(), braavos()],
    includeRecommended: "always",
    order: "random"
  });

  const rpcProvider = jsonRpcProvider({
    rpc: (chain) => {
      if (chain.network === 'sepolia') {
        return { nodeUrl: 'https://api.cartridge.gg/x/starknet/sepolia' };
      }
      return null;
    }
  });

  return (
    <StarknetConfig
      chains={[sepolia]}
      provider={rpcProvider}
      connectors={connectors}
      explorer={voyager}
      autoConnect={false}  // ✅ FIX: Never silently reconnect — always show modal
    >
      {children}
    </StarknetConfig>
  );
}