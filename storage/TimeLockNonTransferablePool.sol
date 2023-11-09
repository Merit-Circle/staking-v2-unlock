| Name                             | Type                                                           | Slot | Offset | Bytes | Contract                                                              |
|----------------------------------|----------------------------------------------------------------|------|--------|-------|-----------------------------------------------------------------------|
| _initialized                     | uint8                                                          | 0    | 0      | 1     | contracts/TimeLockNonTransferablePool.sol:TimeLockNonTransferablePool |
| _initializing                    | bool                                                           | 0    | 1      | 1     | contracts/TimeLockNonTransferablePool.sol:TimeLockNonTransferablePool |
| __gap                            | uint256[50]                                                    | 1    | 0      | 1600  | contracts/TimeLockNonTransferablePool.sol:TimeLockNonTransferablePool |
| __gap                            | uint256[50]                                                    | 51   | 0      | 1600  | contracts/TimeLockNonTransferablePool.sol:TimeLockNonTransferablePool |
| _roles                           | mapping(bytes32 => struct AccessControlUpgradeable.RoleData)   | 101  | 0      | 32    | contracts/TimeLockNonTransferablePool.sol:TimeLockNonTransferablePool |
| __gap                            | uint256[49]                                                    | 102  | 0      | 1568  | contracts/TimeLockNonTransferablePool.sol:TimeLockNonTransferablePool |
| _roleMembers                     | mapping(bytes32 => struct EnumerableSetUpgradeable.AddressSet) | 151  | 0      | 32    | contracts/TimeLockNonTransferablePool.sol:TimeLockNonTransferablePool |
| __gap                            | uint256[49]                                                    | 152  | 0      | 1568  | contracts/TimeLockNonTransferablePool.sol:TimeLockNonTransferablePool |
| _balances                        | mapping(address => uint256)                                    | 201  | 0      | 32    | contracts/TimeLockNonTransferablePool.sol:TimeLockNonTransferablePool |
| _allowances                      | mapping(address => mapping(address => uint256))                | 202  | 0      | 32    | contracts/TimeLockNonTransferablePool.sol:TimeLockNonTransferablePool |
| _totalSupply                     | uint256                                                        | 203  | 0      | 32    | contracts/TimeLockNonTransferablePool.sol:TimeLockNonTransferablePool |
| _name                            | string                                                         | 204  | 0      | 32    | contracts/TimeLockNonTransferablePool.sol:TimeLockNonTransferablePool |
| _symbol                          | string                                                         | 205  | 0      | 32    | contracts/TimeLockNonTransferablePool.sol:TimeLockNonTransferablePool |
| __gap                            | uint256[45]                                                    | 206  | 0      | 1440  | contracts/TimeLockNonTransferablePool.sol:TimeLockNonTransferablePool |
| _HASHED_NAME                     | bytes32                                                        | 251  | 0      | 32    | contracts/TimeLockNonTransferablePool.sol:TimeLockNonTransferablePool |
| _HASHED_VERSION                  | bytes32                                                        | 252  | 0      | 32    | contracts/TimeLockNonTransferablePool.sol:TimeLockNonTransferablePool |
| __gap                            | uint256[50]                                                    | 253  | 0      | 1600  | contracts/TimeLockNonTransferablePool.sol:TimeLockNonTransferablePool |
| _nonces                          | mapping(address => struct CountersUpgradeable.Counter)         | 303  | 0      | 32    | contracts/TimeLockNonTransferablePool.sol:TimeLockNonTransferablePool |
| _PERMIT_TYPEHASH_DEPRECATED_SLOT | bytes32                                                        | 304  | 0      | 32    | contracts/TimeLockNonTransferablePool.sol:TimeLockNonTransferablePool |
| __gap                            | uint256[49]                                                    | 305  | 0      | 1568  | contracts/TimeLockNonTransferablePool.sol:TimeLockNonTransferablePool |
| _delegates                       | mapping(address => address)                                    | 354  | 0      | 32    | contracts/TimeLockNonTransferablePool.sol:TimeLockNonTransferablePool |
| _checkpoints                     | mapping(address => struct ERC20VotesUpgradeable.Checkpoint[])  | 355  | 0      | 32    | contracts/TimeLockNonTransferablePool.sol:TimeLockNonTransferablePool |
| _totalSupplyCheckpoints          | struct ERC20VotesUpgradeable.Checkpoint[]                      | 356  | 0      | 32    | contracts/TimeLockNonTransferablePool.sol:TimeLockNonTransferablePool |
| __gap                            | uint256[47]                                                    | 357  | 0      | 1504  | contracts/TimeLockNonTransferablePool.sol:TimeLockNonTransferablePool |
| getSharesOf                      | function (address) view returns (uint256)                      | 404  | 0      | 8     | contracts/TimeLockNonTransferablePool.sol:TimeLockNonTransferablePool |
| getTotalShares                   | function () view returns (uint256)                             | 404  | 8      | 8     | contracts/TimeLockNonTransferablePool.sol:TimeLockNonTransferablePool |
| pointsPerShare                   | uint256                                                        | 405  | 0      | 32    | contracts/TimeLockNonTransferablePool.sol:TimeLockNonTransferablePool |
| pointsCorrection                 | mapping(address => int256)                                     | 406  | 0      | 32    | contracts/TimeLockNonTransferablePool.sol:TimeLockNonTransferablePool |
| withdrawnRewards                 | mapping(address => uint256)                                    | 407  | 0      | 32    | contracts/TimeLockNonTransferablePool.sol:TimeLockNonTransferablePool |
| __gap                            | uint256[50]                                                    | 408  | 0      | 1600  | contracts/TimeLockNonTransferablePool.sol:TimeLockNonTransferablePool |
| depositToken                     | contract IERC20Upgradeable                                     | 458  | 0      | 20    | contracts/TimeLockNonTransferablePool.sol:TimeLockNonTransferablePool |
| rewardToken                      | contract IERC20Upgradeable                                     | 459  | 0      | 20    | contracts/TimeLockNonTransferablePool.sol:TimeLockNonTransferablePool |
| escrowPool                       | contract ITimeLockPool                                         | 460  | 0      | 20    | contracts/TimeLockNonTransferablePool.sol:TimeLockNonTransferablePool |
| escrowPortion                    | uint256                                                        | 461  | 0      | 32    | contracts/TimeLockNonTransferablePool.sol:TimeLockNonTransferablePool |
| escrowDuration                   | uint256                                                        | 462  | 0      | 32    | contracts/TimeLockNonTransferablePool.sol:TimeLockNonTransferablePool |
| maxBonus                         | uint256                                                        | 463  | 0      | 32    | contracts/TimeLockNonTransferablePool.sol:TimeLockNonTransferablePool |
| maxLockDuration                  | uint256                                                        | 464  | 0      | 32    | contracts/TimeLockNonTransferablePool.sol:TimeLockNonTransferablePool |
| curve                            | uint256[]                                                      | 465  | 0      | 32    | contracts/TimeLockNonTransferablePool.sol:TimeLockNonTransferablePool |
| unit                             | uint256                                                        | 466  | 0      | 32    | contracts/TimeLockNonTransferablePool.sol:TimeLockNonTransferablePool |
| depositsOf                       | mapping(address => struct TimeLockPool.Deposit[])              | 467  | 0      | 32    | contracts/TimeLockNonTransferablePool.sol:TimeLockNonTransferablePool |
