// SPDX-License-Identifier: MIT
pragma solidity 0.8.7;

import "@openzeppelin/contracts/token/ERC20/ERC20.sol";

contract TestToken is ERC20 {

    /**
     * @notice Function used to set parameters
     * @param _name string name of the token
     * @param _symbol _symbol symbol of the token
     */
    constructor(string memory _name, string memory _symbol) ERC20(_name, _symbol) {
        //silence
    }

    /**
     * @notice Function used to mint tokens
     * @param _receiver address receiver of the tokens
     * @param _amount uint256 amount of tokens received
     */
    function mint(address _receiver, uint256 _amount) external {
        // Mints tokens
        _mint(_receiver, _amount);
    }

    /**
     * @notice Function used to burn tokens
     * @param _from address source of the tokens
     * @param _amount uint256 amount of tokens burned
     */
    function burn(address _from, uint256 _amount) external {
        // Burns tokens
        _burn(_from, _amount);
    }
}