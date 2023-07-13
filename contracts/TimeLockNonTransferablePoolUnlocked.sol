// SPDX-License-Identifier: MIT
pragma solidity 0.8.7;

import "./TimeLockPoolUnlocked.sol";

contract TimeLockNonTransferablePoolUnlocked is TimeLockPoolUnlocked {

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
    function initialize(
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
        // Initializes the TimeLockPoolUnlocked contract
        __TimeLockPool_init(_name, _symbol, _depositToken, _rewardToken, _escrowPool, _escrowPortion, _escrowDuration, _maxBonus, _maxLockDuration, _curve);
    }

    /**
     * @notice Disables transfers
     * @param _from address source of the tokens
     * @param _to address destination of the tokens
     * @param _amount uint256 amount of tokens transferred
     */
    function _transfer(address _from, address _to, uint256 _amount) internal override {
        // Reverts transaction
        revert("NON_TRANSFERABLE");
    }
}