#[starknet::interface]
pub trait IWUPToken<TContractState> {
    fn transfer(ref self: TContractState, recipient: starknet::ContractAddress, amount: u256) -> bool;
}

#[starknet::interface]
pub trait IWUPClaimer<TContractState> {
    fn claimReward(ref self: TContractState);
}

#[starknet::contract]
pub mod WUPClaimer {
    use super::{IWUPTokenDispatcher, IWUPTokenDispatcherTrait};
    use crate::wrap_up::{IWrapUpDispatcher, IWrapUpDispatcherTrait};
    use starknet::{ContractAddress, get_caller_address};
    use starknet::storage::{Map, StoragePointerReadAccess, StoragePointerWriteAccess, StoragePathEntry};

    #[storage]
    struct Storage {
        wrap_up_address: ContractAddress,
        wup_token_address: ContractAddress,
        claimed_points: Map<ContractAddress, u256>,
    }

    const POINTS_TO_TOKEN_RATE: u256 = 10000000000000000000; // 10 * 10^18

    #[constructor]
    fn constructor(ref self: ContractState, wrap_up_addr: ContractAddress, token_addr: ContractAddress) {
        self.wrap_up_address.write(wrap_up_addr);
        self.wup_token_address.write(token_addr);
    }

    #[abi(embed_v0)]
    impl ClaimerImpl of super::IWUPClaimer<ContractState> {
        fn claimReward(ref self: ContractState) {
            let user = get_caller_address();

            let wrap_up = IWrapUpDispatcher { contract_address: self.wrap_up_address.read() };
            let total_points = wrap_up.getUserPoints(user);

            let already_claimed = self.claimed_points.entry(user).read();
            let claimable = total_points - already_claimed;

            assert(claimable > 0, 'No points to claim');
            
            self.claimed_points.entry(user).write(total_points);

            let wup_token = IWUPTokenDispatcher { contract_address: self.wup_token_address.read() };
            wup_token.transfer(user, claimable * POINTS_TO_TOKEN_RATE);
        }
    }
}