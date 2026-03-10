#[starknet::interface]
pub trait IWUPToken<TContractState> {
    fn name(self: @TContractState) -> ByteArray;
    fn symbol(self: @TContractState) -> ByteArray;
    fn decimals(self: @TContractState) -> u8;
    fn totalSupply(self: @TContractState) -> u256;
    fn balanceOf(self: @TContractState, account: starknet::ContractAddress) -> u256;
    fn allowance(self: @TContractState, owner: starknet::ContractAddress, spender: starknet::ContractAddress) -> u256;
    fn transfer(ref self: TContractState, recipient: starknet::ContractAddress, amount: u256) -> bool;
    fn transferFrom(ref self: TContractState, sender: starknet::ContractAddress, recipient: starknet::ContractAddress, amount: u256) -> bool;
    fn approve(ref self: TContractState, spender: starknet::ContractAddress, amount: u256) -> bool;
    fn mint(ref self: TContractState, to: starknet::ContractAddress, amount: u256);
}

#[starknet::contract]
pub mod WUPToken {
    use starknet::{ContractAddress, get_caller_address};
    use starknet::storage::{Map, StoragePointerReadAccess, StoragePointerWriteAccess, StoragePathEntry};

    #[storage]
    struct Storage {
        balances: Map<ContractAddress, u256>,
        allowances: Map<(ContractAddress, ContractAddress), u256>,
        total_supply: u256,
        name: ByteArray,
        symbol: ByteArray,
        owner: ContractAddress,
    }

    #[event]
    #[derive(Drop, starknet::Event)]
    enum Event {
        Transfer: Transfer,
        Approval: Approval,
    }

    #[derive(Drop, starknet::Event)]
    struct Transfer {
        #[key] from: ContractAddress,
        #[key] to: ContractAddress,
        value: u256,
    }

    #[derive(Drop, starknet::Event)]
    struct Approval {
        #[key] owner: ContractAddress,
        #[key] spender: ContractAddress,
        value: u256,
    }

    #[constructor]
    fn constructor(ref self: ContractState, initial_owner: ContractAddress) {
        self.name.write("Wrap-Up Token");
        self.symbol.write("WUP");
        self.owner.write(initial_owner);
        
        // Mint initial supply to owner (1,000,000 tokens)
        let initial_supply = 1000000000000000000000000;
        self.total_supply.write(initial_supply);
        self.balances.entry(initial_owner).write(initial_supply);
        
        self.emit(Transfer { 
            from: 0.try_into().unwrap(), 
            to: initial_owner, 
            value: initial_supply 
        });
    }

    #[abi(embed_v0)]
    impl WUPTokenImpl of super::IWUPToken<ContractState> {
        fn name(self: @ContractState) -> ByteArray { self.name.read() }
        fn symbol(self: @ContractState) -> ByteArray { self.symbol.read() }
        fn decimals(self: @ContractState) -> u8 { 18 }
        fn totalSupply(self: @ContractState) -> u256 { self.total_supply.read() }
        
        fn balanceOf(self: @ContractState, account: ContractAddress) -> u256 {
            self.balances.entry(account).read()
        }

        fn allowance(self: @ContractState, owner: ContractAddress, spender: ContractAddress) -> u256 {
            self.allowances.entry((owner, spender)).read()
        }

        fn transfer(ref self: ContractState, recipient: ContractAddress, amount: u256) -> bool {
            let sender = get_caller_address();
            self._transfer(sender, recipient, amount);
            true
        }

        fn transferFrom(ref self: ContractState, sender: ContractAddress, recipient: ContractAddress, amount: u256) -> bool {
            let caller = get_caller_address();
            let current_allowance = self.allowances.entry((sender, caller)).read();
            assert(current_allowance >= amount, 'Insufficient allowance');
            
            self.allowances.entry((sender, caller)).write(current_allowance - amount);
            self._transfer(sender, recipient, amount);
            true
        }

        fn approve(ref self: ContractState, spender: ContractAddress, amount: u256) -> bool {
            let owner = get_caller_address();
            self.allowances.entry((owner, spender)).write(amount);
            self.emit(Approval { owner, spender, value: amount });
            true
        }

        // Only the owner can call this, mimicking your Solidity 'onlyOwner' modifier
        fn mint(ref self: ContractState, to: ContractAddress, amount: u256) {
            let caller = get_caller_address();
            assert(caller == self.owner.read(), 'Only owner can mint');
            
            let current_supply = self.total_supply.read();
            self.total_supply.write(current_supply + amount);
            
            let current_balance = self.balances.entry(to).read();
            self.balances.entry(to).write(current_balance + amount);
            
            self.emit(Transfer { 
                from: 0.try_into().unwrap(), 
                to, 
                value: amount 
            });
        }
    }

    #[generate_trait]
    impl InternalImpl of InternalTrait {
        fn _transfer(ref self: ContractState, sender: ContractAddress, recipient: ContractAddress, amount: u256) {
            let sender_balance = self.balances.entry(sender).read();
            assert(sender_balance >= amount, 'Insufficient balance');
            self.balances.entry(sender).write(sender_balance - amount);
            
            let recipient_balance = self.balances.entry(recipient).read();
            self.balances.entry(recipient).write(recipient_balance + amount);
            
            self.emit(Transfer { from: sender, to: recipient, value: amount });
        }
    }
}