// SPDX-License-Identifier: MIT
pragma solidity 0.8.7;

import "@openzeppelin/contracts/token/ERC20/ERC20.sol";

contract TestFaucetToken is ERC20 {

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
     */
    function drip() external {
        // Mint tokens
        _mint(msg.sender, 1000000 ether);
    }
}