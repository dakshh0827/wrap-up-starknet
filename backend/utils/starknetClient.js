// backend/utils/starknetClient.js
import { RpcProvider, Contract } from 'starknet';

// 1. Connect to Local Devnet
export const provider = new RpcProvider({ nodeUrl: "https://api.cartridge.gg/x/starknet/sepolia" });

// 2. Your Deployed Addresses
export const CONTRACT_ADDRESSES = {
  wrapUp: "0x070415efc3e0ca1dd5b166dbc195424aa4c0a5df570958e3e29fe37f74206961",
  wupToken: "0x02416b9f82a5bddb0eb195025d89be373bba3229e6f56456f5662b46eb3cd760",
  wupClaimer: "0x042505f0653fd103e156be41d7056c4b7338c0d18dff9e610b8268ec05a03e79"
};

// 3. Helper to initialize a contract instance for reading data
export const getContract = (abi, address) => {
  return new Contract(abi, address, provider);
};