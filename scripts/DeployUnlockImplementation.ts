import {
    TimeLockNonTransferablePoolUnlocked,
    TimeLockNonTransferablePoolUnlocked__factory
} from "../typechain";
import hre, { ethers } from "hardhat";
import { SignerWithAddress } from "@nomiclabs/hardhat-ethers/signers";

const DEPLOYER_DOUBLE_CHECK = process.env.DEPLOYER_DOUBLE_CHECK;
const DEPLOYER_DERIVATION_NUMBER = process.env.DEPLOYER_DERIVATION_NUMBER;

async function deployImplementation() {
    let deployer: SignerWithAddress;
    const signers = await ethers.getSigners();
    // @ts-ignore
    deployer = signers[parseInt(DEPLOYER_DERIVATION_NUMBER)];
    if (deployer.address != DEPLOYER_DOUBLE_CHECK) {
        console.log("Check DEPLOYER_DERIVATION_NUMBER");
        return;
    }

    let timeLockNonTransferablePoolUnlocked: TimeLockNonTransferablePoolUnlocked;

    console.log("\n", "Deploying new implementation: TimeLockNonTransferablePoolUnlocked");

    timeLockNonTransferablePoolUnlocked = await new TimeLockNonTransferablePoolUnlocked__factory(deployer).deploy();
    await timeLockNonTransferablePoolUnlocked.deployed();
    console.log("Implementation deployed to", timeLockNonTransferablePoolUnlocked.address, "\n");

    // Verify implementation
    try {
        await hre.run("verify:verify", {
            address: timeLockNonTransferablePoolUnlocked.address,
            constructorArguments: []
        });
    } catch (e) {
        console.log(e);
    }
}

deployImplementation().catch((error) => {
    console.error(error);
    process.exitCode = 1;
});