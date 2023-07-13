// SPDX-License-Identifier: MIT
pragma solidity 0.8.7;

import "./TimeLockPool.sol";
import "hardhat/console.sol";

/// @dev reader contract to easily fetch all relevant info for an account
contract View {

    // Deposit struct
    // amount: deposited tokens
    // shareAmount: deposit tokens * multiplier
    // start: beggining of deposit
    // end: ending of deposit 
    struct Deposit {
        uint256 amount;
        uint256 shareAmount;
        uint64 start;
        uint64 end;
    }

    // Pool struct
    // poolAddress: address of the pool
    // Deposit[]: array of deposits
    struct Pool {
        address poolAddress;
        Deposit[] deposits;
    }

    // Deposit struct of Staking V1
    // amount: deposited tokens
    // start: beggining of deposit
    // end: ending of deposit 
    // multiplier: multiplier to get the share amount
    struct OldDeposit {
        uint256 amount;
        uint64 start;
        uint64 end;
        uint256 multiplier;
    }

    // Pool struct of Staking V1
    // poolAddress: address of the pool
    // OldDeposit[]: array of deposits
    struct OldPool {
        address poolAddress;
        OldDeposit[] deposits;
    }

    function fetchData(address _account, address[] calldata _pools) external view returns (Pool[] memory) {
        // Instatiate an array of pools
        Pool[] memory list = new Pool[](_pools.length);

        // Fetch the array of pools
        for(uint256 i = 0; i < _pools.length; i ++) {
            // Fetch a specific pool
            TimeLockPool poolContract = TimeLockPool(_pools[i]);
            list[i] = Pool({
                poolAddress: _pools[i],
                deposits: new Deposit[](poolContract.getDepositsOfLength(_account))
            });

            // Fetch deposit
            TimeLockPool.Deposit[] memory deposits = poolContract.getDepositsOf(_account);

            // Get all deposits from a pool
            for(uint256 j = 0; j < list[i].deposits.length; j ++) {
                TimeLockPool.Deposit memory deposit = deposits[j];
                list[i].deposits[j] = Deposit({
                    amount: deposit.amount,
                    shareAmount: deposit.shareAmount,
                    start: deposit.start,
                    end: deposit.end
                });
            }
        }
        return list;
    }

    function fetchOldData(address _account, address[] calldata _pools) external view returns (OldPool[] memory) {
        // Instatiate an array of pools
        OldPool[] memory list = new OldPool[](_pools.length);
        
        // Fetch the array of pools
        for(uint256 i = 0; i < _pools.length; i ++) {
            // Fetch a specific pool
            TimeLockPool poolContract = TimeLockPool(_pools[i]);
            list[i] = OldPool({
                poolAddress: _pools[i],
                deposits: new OldDeposit[](poolContract.getDepositsOfLength(_account))
            });

            // Fetch deposit
            TimeLockPool.Deposit[] memory deposits = poolContract.getDepositsOf(_account);

            // Get all deposits from a pool
            for(uint256 j = 0; j < list[i].deposits.length; j ++) {
                TimeLockPool.Deposit memory deposit = deposits[j];
                list[i].deposits[j] = OldDeposit({
                    amount: deposit.amount,
                    start: deposit.start,
                    end: deposit.end,
                    multiplier: poolContract.getMultiplier(deposit.end - deposit.start)
                });
            }
        }
        return list;
    }

}