// SPDX-License-Identifier: MIT
pragma solidity 0.8.7;

import "../base/BasePool.sol";

contract TestBasePool is BasePool {

    /**
     * @notice Constructor to set parameters
     * @param _name string name of the token
     * @param _symbol _symbol symbol of the token
     * @param _depositToken address token to be deposited
     * @param _rewardToken address token to be received as a reward
     * @param _escrowPool address pool were rewards are escrowed
     * @param _escrowPortion uint256 percentage of rewards to be escrowed
     * @param _escrowDuration uint256 time the escrow takes
     */
    constructor(
        string memory _name,
        string memory _symbol,
        address _depositToken,
        address _rewardToken,
        address _escrowPool,
        uint256 _escrowPortion,
        uint256 _escrowDuration
    ) {
        // Initializes the Test contract
        initializeTest(_name, _symbol, _depositToken, _rewardToken, _escrowPool, _escrowPortion, _escrowDuration);
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
     */
    function initializeTest (
        string memory _name,
        string memory _symbol,
        address _depositToken,
        address _rewardToken,
        address _escrowPool,
        uint256 _escrowPortion,
        uint256 _escrowDuration
    ) public initializer {
        // Initializes the BasePool contract
        __BasePool_init(
            _name,
            _symbol,
            _depositToken,
            _rewardToken,
            _escrowPool,
            _escrowPortion,
            _escrowDuration
        );
    }

    /**
     * @notice Function used to mint tokens
     * @param _receiver address receiver of the tokens
     * @param _amount uint256 amount of tokens received
     */
    function mint(address _receiver, uint256 _amount) external {
        // Mint tokens
        _mint(_receiver, _amount);
    }

    /**
     * @notice Function used to burn tokens
     * @param _from address source of the tokens
     * @param _amount uint256 amount of tokens burned
     */
    function burn(address _from, uint256 _amount) external {
        // Burn tokens
        _burn(_from, _amount);
    }
}