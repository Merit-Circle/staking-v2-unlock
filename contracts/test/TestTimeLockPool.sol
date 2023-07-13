// SPDX-License-Identifier: MIT
pragma solidity 0.8.7;

import "../TimeLockPool.sol";

contract TestTimeLockPool is TimeLockPool {

    /**
     * @notice Constructor to set parameters
     * @param _name string name of the token
     * @param _symbol _symbol symbol of the token
     * @param _depositToken address token to be deposited
     * @param _rewardToken address token to be received as a reward
     * @param _escrowPool address pool were rewards are escrowed
     * @param _escrowPortion uint256 percentage of rewards to be escrowed
     * @param _escrowDuration uint256 time the escrow takes
     * @param _maxBonus uint256 max multiplier users can get
     * @param _maxLockDuration uint256 max time users can deposit
     * @param _curve uint256[] points used to calculate multiplier for deposits
     */
    constructor(
        string memory _name,
        string memory _symbol,
        address _depositToken,
        address _rewardToken,
        address _escrowPool,
        uint256 _escrowPortion,
        uint256 _escrowDuration,
        uint256 _maxBonus,
        uint256 _maxLockDuration,
        uint256[] memory _curve
    ) public initializer {
        // Initializes the Test contract
        initializeTest(_name, _symbol, _depositToken, _rewardToken, _escrowPool, _escrowPortion, _escrowDuration, _maxBonus, _maxLockDuration, _curve);
    }

    /**
     * @notice Used to initialize the contract in an upgradeable contracts context
     * @dev Implementation is initialized on first deployment as it cannot have a constructor
     * @param _name string name of the token
     * @param _symbol _symbol symbol of the token
     * @param _depositToken address token to be deposited
     * @param _rewardToken address token to be received as a reward
     * @param _escrowPool address pool were rewards are escrowed
     * @param _escrowPortion uint256 percentage of rewards to be escrowed
     * @param _escrowDuration uint256 time the escrow takes
     * @param _maxBonus uint256 max multiplier users can get
     * @param _maxLockDuration uint256 max time users can deposit
     * @param _curve uint256[] points used to calculate multiplier for deposits
     */
    function initializeTest(
        string memory _name,
        string memory _symbol,
        address _depositToken,
        address _rewardToken,
        address _escrowPool,
        uint256 _escrowPortion,
        uint256 _escrowDuration,
        uint256 _maxBonus,
        uint256 _maxLockDuration,
        uint256[] memory _curve
    ) public initializer {
        // Initializes the TimeLockPool contract
        __TimeLockPool_init(_name, _symbol, _depositToken, _rewardToken, _escrowPool, _escrowPortion, _escrowDuration, _maxBonus, _maxLockDuration, _curve);
    }

}