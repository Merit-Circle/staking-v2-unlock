// SPDX-License-Identifier: MIT
pragma solidity 0.8.7;

import "../TimeLockNonTransferablePool.sol";

contract TimeLockNonTransferablePoolV2 is TimeLockNonTransferablePool {

    /**
     * @notice Function used to test the upgrade
     * @return uint256 arbitrary number used for testing
     */
    function testingUpgrade() public view returns(uint256) {
        // Returns an arbitraty number
        return 7357;
    }

}