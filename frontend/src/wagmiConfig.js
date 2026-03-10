import WRAPUP_ABI_JSON from '../abis/WrapUp.json';
import WUP_TOKEN_ABI_JSON from '../abis/WUPToken.json';
import WUP_CLAIMER_ABI_JSON from '../abis/WUPClaimer.json';

// Your local Devnet addresses from Phase 1
export const CONTRACT_ADDRESSES = {
  devnet: "0x070415efc3e0ca1dd5b166dbc195424aa4c0a5df570958e3e29fe37f74206961", // WrapUp Contract
};

export const WUPToken_ADDRESSES = {
  devnet: "0x02416b9f82a5bddb0eb195025d89be373bba3229e6f56456f5662b46eb3cd760", // WUP Token
};

export const WUPClaimer_ADDRESSES = {
  devnet: "0x042505f0653fd103e156be41d7056c4b7338c0d18dff9e610b8268ec05a03e79", // Claimer
};

// Exporting the ABIs directly from your imported JSON files
export const WRAPUP_ABI = WRAPUP_ABI_JSON.abi || WRAPUP_ABI_JSON;
export const WUP_TOKEN_ABI = WUP_TOKEN_ABI_JSON.abi || WUP_TOKEN_ABI_JSON;
export const WUP_CLAIMER_ABI = WUP_CLAIMER_ABI_JSON.abi || WUP_CLAIMER_ABI_JSON;