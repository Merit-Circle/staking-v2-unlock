import { parseEther, formatEther } from "@ethersproject/units";
import { SignerWithAddress } from "@nomiclabs/hardhat-ethers/signers";
import { expect } from "chai";
import { BigNumber, constants, Contract  } from "ethers";
import hre, { network, ethers } from "hardhat";

import {
    TestToken__factory,
    TestTimeLockPool__factory,
    TimeLockNonTransferablePool__factory,
    ProxyAdmin__factory,
    TransparentUpgradeableProxy__factory,
    TimeLockNonTransferablePoolUnlocked__factory
} from "../typechain";
import {
    TestToken,
    TestTimeLockPool,
    TimeLockNonTransferablePool,
    ProxyAdmin,
    TransparentUpgradeableProxy,
    TimeLockNonTransferablePoolUnlocked
} from "../typechain";

import TimeTraveler from "../utils/TimeTraveler";
import * as TimeLockNonTransferablePoolJSON from "../artifacts/contracts/TimeLockNonTransferablePool.sol/TimeLockNonTransferablePool.json";

const ESCROW_DURATION = 60 * 60 * 24 * 365;
const ESCROW_PORTION = parseEther("0.77");
const MAX_BONUS = parseEther("10"); // Same as max value in the curve
const MAX_BONUS_ESCROW = parseEther("1");
const MAX_LOCK_DURATION = 60 * 60 * 24 * 365 * 4;
const INITIAL_MINT = parseEther("1000000");
const FLAT_CURVE = [(1e18).toString(), (1e18).toString()];
const CURVE = [
    (0*1e18).toString(),
    (0.65*1e18).toString(),
    (1.5*1e18).toString(),
    (3*1e18).toString(),
    (5*1e18).toString()
]

function theoreticalMultiplier(
    _duration: any,
    curve: any
) {
    
    const unit = Math.floor(MAX_LOCK_DURATION / (curve.length - 1))
    const duration = Math.min(Math.max(Number(_duration), 600), MAX_LOCK_DURATION)
    const n = Math.floor(duration / unit)

    if (n == curve.length - 1) {
        const mcn = hre.ethers.BigNumber.from(curve[n])
        let result
        if(mcn.lt(MAX_BONUS)) {
            result = mcn.add(parseEther("1"))
        } else {
            result = MAX_BONUS.add(parseEther("1"))
        }

        return result.toString()
    }

    const mcn = hre.ethers.BigNumber.from(curve[n])
    const mcn1 = hre.ethers.BigNumber.from(curve[n + 1])
    const BNunit = hre.ethers.BigNumber.from(unit)
    const BNn = hre.ethers.BigNumber.from(n)
    const BNduration = hre.ethers.BigNumber.from(_duration)

    const res = mcn.add(BNduration.sub(BNn.mul(BNunit)).mul(mcn1.sub(mcn)).div(BNunit))
    let result
    if(res.lt(MAX_BONUS)) {
        result = res.add(parseEther("1"))
    } else {
        result = MAX_BONUS.add(parseEther("1"))
    }

    return result.toString()
}

describe("UnlockedUpgradeable", function () {

    let deployer: SignerWithAddress;
    let governance: SignerWithAddress;
    let account1: SignerWithAddress;
    let account2: SignerWithAddress;
    let account3: SignerWithAddress;
    let signers: SignerWithAddress[];

    
    let depositToken: TestToken;
    let rewardToken: TestToken;
    let timeLockNonTransferablePool: Contract;
    let timeLockNonTransferablePoolImplementation: TimeLockNonTransferablePool;
    let timeLockNonTransferablePoolUnlocked: TimeLockNonTransferablePoolUnlocked;
    let escrowPool: TestTimeLockPool;
    let proxyAdmin: ProxyAdmin;
    let proxy: TransparentUpgradeableProxy;
    
    const timeTraveler = new TimeTraveler(hre.network.provider);

    before(async() => {
        [
            deployer,
            governance,
            account1,
            account2,
            account3,
            ...signers
        ] = await hre.ethers.getSigners();

        const testTokenFactory = new TestToken__factory(deployer);

        depositToken = await testTokenFactory.deploy("DPST", "Deposit Token");
        rewardToken = await testTokenFactory.deploy("RWRD", "Reward Token");

        await depositToken.mint(account1.address, INITIAL_MINT);
        await rewardToken.mint(account1.address, INITIAL_MINT);

        // Deploy ProxyAdmin
        const ProxyAdmin = new ProxyAdmin__factory(deployer);
        proxyAdmin = await ProxyAdmin.deploy();

        // Deploy to use its address as input in the initializer parameters of the implementation
        const TestTimeLockPoolFactory = new TestTimeLockPool__factory(deployer);
        escrowPool = await TestTimeLockPoolFactory.deploy(
            "ESCROW",
            "ESCRW",
            rewardToken.address,
            constants.AddressZero,
            constants.AddressZero,
            0,
            0,
            MAX_BONUS_ESCROW,
            ESCROW_DURATION,
            FLAT_CURVE
        );

        const timeLockNonTransferablePoolFactory = new TimeLockNonTransferablePool__factory(deployer);
        // Deploy the TimeLockPool implementation
        timeLockNonTransferablePoolImplementation = await timeLockNonTransferablePoolFactory.deploy();

        const initializeParameters = [
            "Staking Pool",
            "STK",
            depositToken.address,
            rewardToken.address,
            escrowPool.address,
            ESCROW_PORTION.div(2),
            ESCROW_DURATION * 2,
            MAX_BONUS.mul(10),
            MAX_LOCK_DURATION,
            CURVE
        ]

        const TimeLockNonTransferablePoolInterface = new hre.ethers.utils.Interface(JSON.stringify(TimeLockNonTransferablePoolJSON.abi))
        // Encode data to call the initialize function in the implementation
        const encoded_data = TimeLockNonTransferablePoolInterface.encodeFunctionData("initialize", initializeParameters);

        // Deploy the proxy linking it to the timeLockNonTransferablePoolImplementation and proxyAdmin
        const Proxy = new TransparentUpgradeableProxy__factory(deployer);
        proxy = await Proxy.deploy(timeLockNonTransferablePoolImplementation.address, proxyAdmin.address, encoded_data);
        
        // Create an interface of the implementation on the proxy so we can send the methods of the implementation
        timeLockNonTransferablePool = new ethers.Contract(proxy.address, JSON.stringify(TimeLockNonTransferablePoolJSON.abi), deployer);

        // Sets GOV_ROLE to governance address
        const GOV_ROLE = await timeLockNonTransferablePool.GOV_ROLE();
        await timeLockNonTransferablePool.grantRole(GOV_ROLE, governance.address);
        await proxyAdmin.transferOwnership(governance.address);

        // connect account1 to all contracts
        timeLockNonTransferablePool = timeLockNonTransferablePool.connect(account1);
        escrowPool = escrowPool.connect(account1);
        depositToken = depositToken.connect(account1);
        rewardToken = rewardToken.connect(account1);
        
        await depositToken.approve(timeLockNonTransferablePool.address, constants.MaxUint256);

        await timeTraveler.snapshot();
    })

    beforeEach(async() => {
        await timeTraveler.revertSnapshot();
    })

    describe("upgradeable", async() => {

        describe("proxyAdmin", async() => {
            it("Should set correctly the proxy admin", async() => {
                const getProxyAdmin = await proxyAdmin.getProxyAdmin(proxy.address);
                expect(getProxyAdmin).to.be.eq(proxyAdmin.address)
            });

            it("Should set correctly the implementation", async() => {
                const getProxyImplementation = await proxyAdmin.getProxyImplementation(proxy.address);
                expect(getProxyImplementation).to.be.eq(timeLockNonTransferablePoolImplementation.address)
            });

            it("Should have governance as owner", async() => {
                const owner = await proxyAdmin.owner();
                expect(owner).to.be.eq(governance.address)
            });
        });

        describe("upgrade", async() => {
            it("Should emit event and change implementation address after upgrade", async() => {
                // Storage slot where OpenZeppelin Upgradeable contracts stores implementations:
                // bytes32(uint256(keccak256("eip1967.proxy.implementation")) - 1) = 0x360894a13ba1a3210667c828492db98dca3e2076cc3735a920a3ca505d382bbc
                const initialImplementation = await hre.ethers.provider.getStorageAt(proxy.address, "0x360894a13ba1a3210667c828492db98dca3e2076cc3735a920a3ca505d382bbc");
                const initialImplementationAddress = "0x"+initialImplementation.slice(-40);

                // Upgrade
                let timeLockNonTransferablePoolUnlockedImplementation: TimeLockNonTransferablePoolUnlocked;
                const TimeLockNonTransferablePoolUnlockedFactory = new TimeLockNonTransferablePoolUnlocked__factory(deployer);
                timeLockNonTransferablePoolUnlockedImplementation = await TimeLockNonTransferablePoolUnlockedFactory.deploy();
                // Should emit the event with the correct address
                await expect(proxyAdmin.connect(governance).upgrade(proxy.address, timeLockNonTransferablePoolUnlockedImplementation.address))
                .to.emit(proxy, "Upgraded")
                .withArgs(timeLockNonTransferablePoolUnlockedImplementation.address);

                const TimeLockNonTransferablePoolUnlocked = await ethers.getContractFactory("TimeLockNonTransferablePoolUnlocked");
                let timeLockNonTransferablePoolUnlocked = await TimeLockNonTransferablePoolUnlocked.attach(proxy.address);
                timeLockNonTransferablePoolUnlocked = timeLockNonTransferablePoolUnlocked.connect(account1);

                const finalImplementation = await hre.ethers.provider.getStorageAt(proxy.address, "0x360894a13ba1a3210667c828492db98dca3e2076cc3735a920a3ca505d382bbc");
                const finalImplementationAddress = "0x"+finalImplementation.slice(-40);

                // Initial deposit should exist. Final deposit shouldn't exist. Token balance shouldn't change after all
                expect(initialImplementationAddress).to.be.eq(timeLockNonTransferablePoolImplementation.address.toLowerCase());
                expect(finalImplementationAddress).to.be.eq(timeLockNonTransferablePoolUnlockedImplementation.address.toLowerCase());
                expect(initialImplementation).to.be.not.eq(finalImplementation);
            });

            it("Should be able to withdraw after the upgrade", async() => {
                const DEPOSIT_AMOUNT = parseEther("10");

                const preDepositBalance = await depositToken.balanceOf(account1.address);

                // Deposit
                await timeLockNonTransferablePool.deposit(DEPOSIT_AMOUNT, constants.MaxUint256, account1.address);

                const initialDeposits = await timeLockNonTransferablePool.getDepositsOf(account1.address);

                // Withdraw should fail
                await expect(timeLockNonTransferablePool.withdraw(0, account1.address)).to.be.revertedWith("TooSoonError()");

                // Upgrade
                let timeLockNonTransferablePoolUnlockedImplementation: TimeLockNonTransferablePoolUnlocked;
                const TimeLockNonTransferablePoolUnlockedFactory = new TimeLockNonTransferablePoolUnlocked__factory(deployer);
                timeLockNonTransferablePoolUnlockedImplementation = await TimeLockNonTransferablePoolUnlockedFactory.deploy();
                await proxyAdmin.connect(governance).upgrade(proxy.address, timeLockNonTransferablePoolUnlockedImplementation.address);

                const TimeLockNonTransferablePoolUnlocked = await ethers.getContractFactory("TimeLockNonTransferablePoolUnlocked");
                let timeLockNonTransferablePoolUnlocked = await TimeLockNonTransferablePoolUnlocked.attach(proxy.address);
                timeLockNonTransferablePoolUnlocked = timeLockNonTransferablePoolUnlocked.connect(account1);

                // Withdraw should be successful
                await timeLockNonTransferablePool.withdraw(0, account1.address);

                const finalDeposits = await timeLockNonTransferablePoolUnlocked.getDepositsOf(account1.address);
                const postWithdrawBalance = await depositToken.balanceOf(account1.address);

                // Initial deposit should exist. Final deposit shouldn't exist. Token balance shouldn't change after all
                expect(initialDeposits[0].amount).to.be.eq(DEPOSIT_AMOUNT);
                expect(finalDeposits.length).to.be.eq(0);
                expect(preDepositBalance).to.be.eq(postWithdrawBalance);
            });
            
            it("Should fail on deposit, lock extension and lock increase after the upgrade", async() => {
                const DEPOSIT_AMOUNT = parseEther("10");

                // Deposit
                await timeLockNonTransferablePool.deposit(DEPOSIT_AMOUNT, constants.MaxUint256, account1.address);

                // Upgrade
                let timeLockNonTransferablePoolUnlockedImplementation: TimeLockNonTransferablePoolUnlocked;
                const TimeLockNonTransferablePoolUnlockedFactory = new TimeLockNonTransferablePoolUnlocked__factory(deployer);
                timeLockNonTransferablePoolUnlockedImplementation = await TimeLockNonTransferablePoolUnlockedFactory.deploy();
                await proxyAdmin.connect(governance).upgrade(proxy.address, timeLockNonTransferablePoolUnlockedImplementation.address);

                const TimeLockNonTransferablePoolUnlocked = await ethers.getContractFactory("TimeLockNonTransferablePoolUnlocked");
                let timeLockNonTransferablePoolUnlocked = await TimeLockNonTransferablePoolUnlocked.attach(proxy.address);
                timeLockNonTransferablePoolUnlocked = timeLockNonTransferablePoolUnlocked.connect(account1);

                // All three txs should revert with error
                await expect(timeLockNonTransferablePoolUnlocked.deposit(DEPOSIT_AMOUNT, constants.MaxUint256, account1.address)).to.be.revertedWith("ConcludeDepositError()");
                await expect(timeLockNonTransferablePoolUnlocked.extendLock(0, 0)).to.be.revertedWith("ConcludeDepositError()");
                await expect(timeLockNonTransferablePoolUnlocked.increaseLock(0, account1.address, 0)).to.be.revertedWith("ConcludeDepositError()");
            });

            it("Should preserve the deposits in the same slot after upgrade", async() => {
                const DEPOSIT_AMOUNT = parseEther("10");
                
                // Deposit
                await timeLockNonTransferablePool.deposit(DEPOSIT_AMOUNT, constants.MaxUint256, account3.address);
                await timeLockNonTransferablePool.deposit(DEPOSIT_AMOUNT, constants.MaxUint256, account3.address);
                
                // Get pre-upgrade storage slots deposits
                let initialDepositStorage = [];
                // mapping(address => Deposit[]) public depositsOf is in slot 467
                const SLOT = 467;
                // Loop six times as there are 2 deposits, and the struct of each deposit ocuppies 3 storage slots (uint256, uint256, uint64, uint64)
                for(let i = 0; i < 6; i++) {
                    // A mapping storage slot is determined by doing keccak256(key, mapping slot)
                    const mappingSlot = ethers.utils.keccak256(ethers.utils.defaultAbiCoder.encode(["address", "uint256"], [account3.address, SLOT]));
                    // An array storage slot is determined by doing keccak256(array slot), which is this case is the result of the mapping storage slot
                    const arraySlot = ethers.utils.keccak256(mappingSlot);
                    // Storage slots from arrays are determined by the array storage slot plus the index (arraySlot + 0, +1, +2 ...)
                    const storageSlot = BigNumber.from(arraySlot).add(i).toHexString();
                    const value = await hre.ethers.provider.getStorageAt(proxy.address, storageSlot);
                    const obj = { storageSlot, value };
                    initialDepositStorage.push(obj);
                }

                // Get deposits before upgrade
                const depositTokenBalanceBefore = await depositToken.balanceOf(account1.address);
                const depositsBefore = await timeLockNonTransferablePool.getDepositsOf(account3.address);
                const totalDepositBefore = await timeLockNonTransferablePool.getTotalDeposit(account3.address);
                const timeLockNonTransferablePoolBalanceBefore = await timeLockNonTransferablePool.balanceOf(account3.address);

                // Upgrade
                const timeLockNonTransferablePoolUnlockedFactory = new TimeLockNonTransferablePoolUnlocked__factory(deployer);
                let timeLockNonTransferablePoolUnlockedImplementation: TimeLockNonTransferablePoolUnlocked;
                timeLockNonTransferablePoolUnlockedImplementation = await timeLockNonTransferablePoolUnlockedFactory.deploy();
    
                await proxyAdmin.connect(governance).upgrade(proxy.address, timeLockNonTransferablePoolUnlockedImplementation.address);

                const TimeLockNonTransferablePoolUnlocked = await ethers.getContractFactory("TimeLockNonTransferablePoolUnlocked");
                const timeLockNonTransferablePoolUnlocked = await TimeLockNonTransferablePoolUnlocked.attach(proxy.address);

                // Get deposits after upgrade
                const depositTokenBalanceAfter = await depositToken.balanceOf(account1.address);
                const depositsAfter = await timeLockNonTransferablePoolUnlocked.getDepositsOf(account3.address);
                const totalDepositAfter = await timeLockNonTransferablePoolUnlocked.getTotalDeposit(account3.address);
                const timeLockNonTransferablePoolBalanceAfter = await timeLockNonTransferablePoolUnlocked.balanceOf(account3.address);
    
                // Get pre-upgrade storage slots deposits
                // @ts-ignore
                let finalDepositStorage = [];
                for(let i = 0; i < 6; i++) {
                    const mappingSlot = ethers.utils.keccak256(ethers.utils.defaultAbiCoder.encode(["address", "uint256"], [account3.address, SLOT]));
                    const arraySlot = ethers.utils.keccak256(mappingSlot);
                    const storageSlot = BigNumber.from(arraySlot).add(i).toHexString();
                    const value = await hre.ethers.provider.getStorageAt(proxy.address, storageSlot);
                    const obj = { storageSlot, value };
                    finalDepositStorage.push(obj);
                }

                const equalArrays = initialDepositStorage.length === finalDepositStorage.length && initialDepositStorage.every((obj, index) =>
                    // @ts-ignore
                    obj.storageSlot === finalDepositStorage[index].storageSlot && obj.value === finalDepositStorage[index].value
                );

                // Storage slots should have the same values and deposit balances shouldn't change
                expect(equalArrays).to.be.eq(true);
                expect(depositTokenBalanceAfter).to.be.eq(depositTokenBalanceBefore);
                expect(depositsAfter[0].amount).to.be.eq(depositsBefore[0].amount);
                expect(depositsAfter[1].amount).to.be.eq(depositsBefore[1].amount);
                expect(depositsAfter[0].start).to.be.eq(depositsBefore[0].start);
                expect(depositsAfter[1].start).to.be.eq(depositsBefore[1].start);
                expect(depositsAfter[0].end).to.be.eq(depositsBefore[0].end);
                expect(depositsAfter[1].end).to.be.eq(depositsBefore[1].end);
                expect(totalDepositAfter).to.be.eq(totalDepositBefore);
                expect(timeLockNonTransferablePoolBalanceAfter).to.be.eq(timeLockNonTransferablePoolBalanceBefore);
            });
        });

        describe("mainnet fork upgrade", async() => {
            it("Should upgrade correctly on mainnet fork", async() => {
                const MAINNET_IMPLEMENTATION = "0x6411c8b68ce74e2907110e522c67d400fcd3cf4b";
                const MAINNET_MULTISIG = "0x7e9e4c0876b2102f33a1d82117cc73b7fddd0032";
                const MAINNET_PROXY_ADMIN = "0x56234f99393c2af40a3fe901dceef0b03d61a219";
                const MAINNET_MC_POOL = "0x74adae862adcccf7a7dbf2f7b139ab56e6b0e79d";

                // Intantiate mainnet upgradeable proxy
                let mainnetProxyMC: TransparentUpgradeableProxy;
                const MainnetProxyMC = await ethers.getContractFactory("TransparentUpgradeableProxy");
                mainnetProxyMC = MainnetProxyMC.attach(MAINNET_MC_POOL);

                // Get initial implementation address from storage slot
                const initialImplementation = await hre.ethers.provider.getStorageAt(mainnetProxyMC.address, "0x360894a13ba1a3210667c828492db98dca3e2076cc3735a920a3ca505d382bbc");
                const initialImplementationAddress = "0x"+initialImplementation.slice(-40);

                // Get multisig as signer
                await network.provider.request({
                    method: "hardhat_impersonateAccount",
                    params: [MAINNET_MULTISIG],
                });
                const multisig: SignerWithAddress = await ethers.getSigner(MAINNET_MULTISIG);

                // Deploy the new unlocked implementation
                let timeLockNonTransferablePoolUnlockedImplementation: TimeLockNonTransferablePoolUnlocked;
                const TimeLockNonTransferablePoolUnlockedFactory = new TimeLockNonTransferablePoolUnlocked__factory(multisig);
                timeLockNonTransferablePoolUnlockedImplementation = await TimeLockNonTransferablePoolUnlockedFactory.deploy();

                // Instantiate mainnet proxy admin
                let mainnetProxyAdmin: ProxyAdmin;
                const MainnetProxyAdmin = await ethers.getContractFactory("ProxyAdmin");
                mainnetProxyAdmin = MainnetProxyAdmin.attach(MAINNET_PROXY_ADMIN);
     
                // Upgrade and check for correct event
                await expect(mainnetProxyAdmin.connect(multisig).upgrade(MAINNET_MC_POOL, timeLockNonTransferablePoolUnlockedImplementation.address))
                .to.emit(mainnetProxyMC, "Upgraded")
                .withArgs(timeLockNonTransferablePoolUnlockedImplementation.address);

                // Get final implementation address from storage slot
                const finalImplementation = await hre.ethers.provider.getStorageAt(mainnetProxyMC.address, "0x360894a13ba1a3210667c828492db98dca3e2076cc3735a920a3ca505d382bbc");
                const finalImplementationAddress = "0x"+finalImplementation.slice(-40);

                // Initial deposit should exist. Final deposit shouldn't exist. Token balance shouldn't change after all
                expect(initialImplementationAddress).to.be.eq(MAINNET_IMPLEMENTATION);
                expect(finalImplementationAddress).to.be.eq(timeLockNonTransferablePoolUnlockedImplementation.address.toLowerCase());
                expect(initialImplementation).to.be.not.eq(finalImplementation);
            });

            it("Should be able to withdraw after the upgrade on mainnet fork", async() => {
                const MAINNET_MULTISIG = "0x7e9e4c0876b2102f33a1d82117cc73b7fddd0032";
                const MAINNET_PROXY_ADMIN = "0x56234f99393c2af40a3fe901dceef0b03d61a219";
                const MAINNET_MC_POOL = "0x74adae862adcccf7a7dbf2f7b139ab56e6b0e79d";
                const MAINNET_DEPOSITOR = "0xf4fbcb5cc96fecd9b2b1af1347fefc294bf762ef";
                const MAINNET_MC_TOKEN = "0x949d48eca67b17269629c7194f4b727d4ef9e5d6";

                // Instantiate mainnet token
                let mainnetDepositToken: TestToken;
                const MainnetDepositToken = await ethers.getContractFactory("TestToken");
                mainnetDepositToken = MainnetDepositToken.attach(MAINNET_MC_TOKEN);

                // Instatiate mainnet proxy
                let mainnetTimeLockNonTransferablePool: TimeLockNonTransferablePool;
                const MainnetTimeLockNonTransferablePool = await ethers.getContractFactory("TimeLockNonTransferablePool");
                mainnetTimeLockNonTransferablePool = MainnetTimeLockNonTransferablePool.attach(MAINNET_MC_POOL);

                // Get depositor as signer
                await network.provider.request({
                    method: "hardhat_impersonateAccount",
                    params: [MAINNET_DEPOSITOR],
                });
                const depositor: SignerWithAddress = await ethers.getSigner(MAINNET_DEPOSITOR);

                // Get initial deposits and balances
                const initialDeposits = await mainnetTimeLockNonTransferablePool.getDepositsOf(MAINNET_DEPOSITOR);
                const initialBalance = await mainnetDepositToken.balanceOf(MAINNET_DEPOSITOR);

                // Withdraw should fail
                await expect(mainnetTimeLockNonTransferablePool.connect(depositor).withdraw(0, MAINNET_DEPOSITOR)).to.be.revertedWith("TooSoonError()");

                // Get multisig as signer
                await network.provider.request({
                    method: "hardhat_impersonateAccount",
                    params: [MAINNET_MULTISIG],
                });
                const multisig: SignerWithAddress = await ethers.getSigner(MAINNET_MULTISIG);

                // Deploy the new unlocked implementation
                let timeLockNonTransferablePoolUnlockedImplementation: TimeLockNonTransferablePoolUnlocked;
                const TimeLockNonTransferablePoolUnlockedFactory = new TimeLockNonTransferablePoolUnlocked__factory(multisig);
                timeLockNonTransferablePoolUnlockedImplementation = await TimeLockNonTransferablePoolUnlockedFactory.deploy();

                // Instantiate mainnet proxy admin
                let mainnetProxyAdmin: ProxyAdmin;
                const MainnetProxyAdmin = await ethers.getContractFactory("ProxyAdmin");
                mainnetProxyAdmin = MainnetProxyAdmin.attach(MAINNET_PROXY_ADMIN);
                
                // Upgrade
                mainnetProxyAdmin.connect(multisig).upgrade(MAINNET_MC_POOL, timeLockNonTransferablePoolUnlockedImplementation.address);

                // Instantiate mainnet upgraded proxy with implementation interface
                let mainnetTimeLockNonTransferablePoolUnlocked: TimeLockNonTransferablePoolUnlocked;
                const MainnetTimeLockNonTransferablePoolUnlocked = await ethers.getContractFactory("TimeLockNonTransferablePoolUnlocked");
                mainnetTimeLockNonTransferablePoolUnlocked = MainnetTimeLockNonTransferablePoolUnlocked.attach(MAINNET_MC_POOL);

                // Withdraw should be successful
                await mainnetTimeLockNonTransferablePoolUnlocked.connect(depositor).withdraw(0, MAINNET_DEPOSITOR);

                // Get final deposits and balances
                const finalDeposits = await mainnetTimeLockNonTransferablePoolUnlocked.getDepositsOf(MAINNET_DEPOSITOR);
                const finalBalance = await mainnetDepositToken.balanceOf(MAINNET_DEPOSITOR);

                // Difference in balance should be equal to the first deposit amount
                expect(initialDeposits[0].amount).to.be.eq(finalBalance.sub(initialBalance));
                expect(finalDeposits.length).to.be.eq(initialDeposits.length - 1);
            });

            it("Should fail on deposit, lock extension and lock increase after the upgrade on mainnet fork", async() => {
                const MAINNET_MULTISIG = "0x7e9e4c0876b2102f33a1d82117cc73b7fddd0032";
                const MAINNET_PROXY_ADMIN = "0x56234f99393c2af40a3fe901dceef0b03d61a219";
                const MAINNET_MC_POOL = "0x74adae862adcccf7a7dbf2f7b139ab56e6b0e79d";
                const MAINNET_DEPOSITOR = "0xf4fbcb5cc96fecd9b2b1af1347fefc294bf762ef";
            
                // Get depositor as signer
                await network.provider.request({
                    method: "hardhat_impersonateAccount",
                    params: [MAINNET_DEPOSITOR],
                });
                const depositor: SignerWithAddress = await ethers.getSigner(MAINNET_DEPOSITOR);

                // Get multisig as signer
                await network.provider.request({
                    method: "hardhat_impersonateAccount",
                    params: [MAINNET_MULTISIG],
                });
                const multisig: SignerWithAddress = await ethers.getSigner(MAINNET_MULTISIG);

               // Instatiate mainnet proxy
               let mainnetTimeLockNonTransferablePool: TimeLockNonTransferablePool;
               const MainnetTimeLockNonTransferablePool = await ethers.getContractFactory("TimeLockNonTransferablePool");
               mainnetTimeLockNonTransferablePool = MainnetTimeLockNonTransferablePool.attach(MAINNET_MC_POOL);

                // Get initial deposits and balances
                const initialDeposits = await mainnetTimeLockNonTransferablePool.getDepositsOf(MAINNET_DEPOSITOR);

                // Deploy the new unlocked implementation
                let timeLockNonTransferablePoolUnlockedImplementation: TimeLockNonTransferablePoolUnlocked;
                const TimeLockNonTransferablePoolUnlockedFactory = new TimeLockNonTransferablePoolUnlocked__factory(multisig);
                timeLockNonTransferablePoolUnlockedImplementation = await TimeLockNonTransferablePoolUnlockedFactory.deploy();

                // Instantiate mainnet proxy admin
                let mainnetProxyAdmin: ProxyAdmin;
                const MainnetProxyAdmin = await ethers.getContractFactory("ProxyAdmin");
                mainnetProxyAdmin = MainnetProxyAdmin.attach(MAINNET_PROXY_ADMIN);

                // Upgrade
                mainnetProxyAdmin.connect(multisig).upgrade(MAINNET_MC_POOL, timeLockNonTransferablePoolUnlockedImplementation.address);

                // Instantiate mainnet upgraded proxy with implementation interface
                let mainnetTimeLockNonTransferablePoolUnlocked: TimeLockNonTransferablePoolUnlocked;
                const MainnetTimeLockNonTransferablePoolUnlocked = await ethers.getContractFactory("TimeLockNonTransferablePoolUnlocked");
                mainnetTimeLockNonTransferablePoolUnlocked = MainnetTimeLockNonTransferablePoolUnlocked.attach(MAINNET_MC_POOL);

                // All three txs should revert with error
                await expect(mainnetTimeLockNonTransferablePoolUnlocked.connect(depositor).deposit(initialDeposits[0].amount.toString(), constants.MaxUint256, MAINNET_DEPOSITOR)).to.be.revertedWith("ConcludeDepositError()");
                await expect(mainnetTimeLockNonTransferablePoolUnlocked.connect(depositor).extendLock(0, 0)).to.be.revertedWith("ConcludeDepositError()");
                await expect(mainnetTimeLockNonTransferablePoolUnlocked.connect(depositor).increaseLock(0, MAINNET_DEPOSITOR, 0)).to.be.revertedWith("ConcludeDepositError()");
            });

            it("Should preserve the deposits in the same slot after upgrade on mainnnet fork", async() => {
                const MAINNET_MULTISIG = "0x7e9e4c0876b2102f33a1d82117cc73b7fddd0032";
                const MAINNET_PROXY_ADMIN = "0x56234f99393c2af40a3fe901dceef0b03d61a219";
                const MAINNET_MC_POOL = "0x74adae862adcccf7a7dbf2f7b139ab56e6b0e79d";
                const MAINNET_DEPOSITOR = "0xf4fbcb5cc96fecd9b2b1af1347fefc294bf762ef";
                const MAINNET_MC_TOKEN = "0x949d48eca67b17269629c7194f4b727d4ef9e5d6";

                // Instantiate mainnet token
                let mainnetDepositToken: TestToken;
                const MainnetDepositToken = await ethers.getContractFactory("TestToken");
                mainnetDepositToken = MainnetDepositToken.attach(MAINNET_MC_TOKEN);
                
                // Instatiate mainnet proxy
                let mainnetTimeLockNonTransferablePool: TimeLockNonTransferablePool;
                const MainnetTimeLockNonTransferablePool = await ethers.getContractFactory("TimeLockNonTransferablePool");
                mainnetTimeLockNonTransferablePool = MainnetTimeLockNonTransferablePool.attach(MAINNET_MC_POOL);

                // Get multisig as signer
                await network.provider.request({
                    method: "hardhat_impersonateAccount",
                    params: [MAINNET_MULTISIG],
                });
                const multisig: SignerWithAddress = await ethers.getSigner(MAINNET_MULTISIG);

                // Get initial deposits and balances
                const initialDeposits = await mainnetTimeLockNonTransferablePool.getDepositsOf(MAINNET_DEPOSITOR);
                expect(initialDeposits.length).to.be.greaterThan(0);

                // Get pre-upgrade storage slots deposits
                let initialDepositStorage = [];
                // mapping(address => Deposit[]) public depositsOf is in slot 467
                const SLOT = 467;
                // Loop six times as there are 2 deposits, and the struct of each deposit ocuppies 3 storage slots (uint256, uint256, uint64, uint64)
                for(let i = 0; i < initialDeposits.length * 3; i++) {
                    // A mapping storage slot is determined by doing keccak256(key, mapping slot)
                    const mappingSlot = ethers.utils.keccak256(ethers.utils.defaultAbiCoder.encode(["address", "uint256"], [MAINNET_DEPOSITOR, SLOT]));
                    // An array storage slot is determined by doing keccak256(array slot), which is this case is the result of the mapping storage slot
                    const arraySlot = ethers.utils.keccak256(mappingSlot);
                    // Storage slots from arrays are determined by the array storage slot plus the index (arraySlot + 0, +1, +2 ...)
                    const storageSlot = BigNumber.from(arraySlot).add(i).toHexString();
                    const value = await hre.ethers.provider.getStorageAt(MAINNET_MC_POOL, storageSlot);
                    const obj = { storageSlot, value };
                    initialDepositStorage.push(obj);
                }

                // Get deposits before upgrade
                const depositTokenBalanceBefore = await mainnetDepositToken.balanceOf(MAINNET_DEPOSITOR);
                const depositsBefore = await mainnetTimeLockNonTransferablePool.getDepositsOf(MAINNET_DEPOSITOR);
                const totalDepositBefore = await mainnetTimeLockNonTransferablePool.getTotalDeposit(MAINNET_DEPOSITOR);
                const timeLockNonTransferablePoolBalanceBefore = await mainnetTimeLockNonTransferablePool.balanceOf(MAINNET_DEPOSITOR);

                // Deploy the new unlocked implementation
                let timeLockNonTransferablePoolUnlockedImplementation: TimeLockNonTransferablePoolUnlocked;
                const TimeLockNonTransferablePoolUnlockedFactory = new TimeLockNonTransferablePoolUnlocked__factory(multisig);
                timeLockNonTransferablePoolUnlockedImplementation = await TimeLockNonTransferablePoolUnlockedFactory.deploy();

                // Instantiate mainnet proxy admin
                let mainnetProxyAdmin: ProxyAdmin;
                const MainnetProxyAdmin = await ethers.getContractFactory("ProxyAdmin");
                mainnetProxyAdmin = MainnetProxyAdmin.attach(MAINNET_PROXY_ADMIN);

                // Upgrade
                mainnetProxyAdmin.connect(multisig).upgrade(MAINNET_MC_POOL, timeLockNonTransferablePoolUnlockedImplementation.address);

                // Instantiate mainnet upgraded proxy with implementation interface
                let mainnetTimeLockNonTransferablePoolUnlocked: TimeLockNonTransferablePoolUnlocked;
                const MainnetTimeLockNonTransferablePoolUnlocked = await ethers.getContractFactory("TimeLockNonTransferablePoolUnlocked");
                mainnetTimeLockNonTransferablePoolUnlocked = MainnetTimeLockNonTransferablePoolUnlocked.attach(MAINNET_MC_POOL);

                // Get deposits after upgrade
                const depositTokenBalanceAfter = await mainnetDepositToken.balanceOf(MAINNET_DEPOSITOR);
                const depositsAfter = await mainnetTimeLockNonTransferablePoolUnlocked.getDepositsOf(MAINNET_DEPOSITOR);
                const totalDepositAfter = await mainnetTimeLockNonTransferablePoolUnlocked.getTotalDeposit(MAINNET_DEPOSITOR);
                const timeLockNonTransferablePoolBalanceAfter = await mainnetTimeLockNonTransferablePoolUnlocked.balanceOf(MAINNET_DEPOSITOR);
    
                // Get pre-upgrade storage slots deposits
                // @ts-ignore
                let finalDepositStorage = [];
                for(let i = 0; i < initialDeposits.length * 3; i++) {
                    const mappingSlot = ethers.utils.keccak256(ethers.utils.defaultAbiCoder.encode(["address", "uint256"], [MAINNET_DEPOSITOR, SLOT]));
                    const arraySlot = ethers.utils.keccak256(mappingSlot);
                    const storageSlot = BigNumber.from(arraySlot).add(i).toHexString();
                    const value = await hre.ethers.provider.getStorageAt(MAINNET_MC_POOL, storageSlot);
                    const obj = { storageSlot, value };
                    finalDepositStorage.push(obj);
                }

                const equalArrays = initialDepositStorage.length === finalDepositStorage.length && initialDepositStorage.every((obj, index) =>
                    // @ts-ignore
                    obj.storageSlot === finalDepositStorage[index].storageSlot && obj.value === finalDepositStorage[index].value
                );

                // Storage slots should have the same values and deposit balances shouldn't change
                expect(equalArrays).to.be.eq(true);
                expect(depositTokenBalanceAfter).to.be.eq(depositTokenBalanceBefore);
                expect(depositsAfter[0].amount).to.be.eq(depositsBefore[0].amount);
                expect(depositsAfter[1].amount).to.be.eq(depositsBefore[1].amount);
                expect(depositsAfter[0].start).to.be.eq(depositsBefore[0].start);
                expect(depositsAfter[1].start).to.be.eq(depositsBefore[1].start);
                expect(depositsAfter[0].end).to.be.eq(depositsBefore[0].end);
                expect(depositsAfter[1].end).to.be.eq(depositsBefore[1].end);
                expect(totalDepositAfter).to.be.eq(totalDepositBefore);
                expect(timeLockNonTransferablePoolBalanceAfter).to.be.eq(timeLockNonTransferablePoolBalanceBefore);
            });
        });

        describe("unchanged functions", async() => {
            describe("setCurve and setCurvePoint", async() => {
                beforeEach(async() => {
                    await timeTraveler.revertSnapshot();
    
                    // Upgrade
                    let timeLockNonTransferablePoolUnlockedImplementation: TimeLockNonTransferablePoolUnlocked;
                    const TimeLockNonTransferablePoolUnlockedFactory = new TimeLockNonTransferablePoolUnlocked__factory(deployer);
                    timeLockNonTransferablePoolUnlockedImplementation = await TimeLockNonTransferablePoolUnlockedFactory.deploy();
                    await proxyAdmin.connect(governance).upgrade(proxy.address, timeLockNonTransferablePoolUnlockedImplementation.address);
    
                    const TimeLockNonTransferablePoolUnlocked = await ethers.getContractFactory("TimeLockNonTransferablePoolUnlocked");
                    timeLockNonTransferablePoolUnlocked = await TimeLockNonTransferablePoolUnlocked.attach(proxy.address);
                    timeLockNonTransferablePoolUnlocked = timeLockNonTransferablePoolUnlocked.connect(account1);
                });

                it("Replacing a curve with a non gov role account should fail", async() => {
                    // Mapping a new curve for replacing the old one
                    const NEW_CURVE = CURVE.map(function(x) {
                        return (hre.ethers.BigNumber.from(x).mul(2).toString())
                    })
                    await expect(timeLockNonTransferablePoolUnlocked.setCurve(NEW_CURVE)).to.be.revertedWith("NotGovError()");
                });
        
                it("Replacing a curve should emit an event", async() => {
                    // Mapping a new curve for replacing the old one
                    const NEW_CURVE = CURVE.map(function(x) {
                        return (hre.ethers.BigNumber.from(x).mul(2).toString())
                    })
                    await expect(timeLockNonTransferablePoolUnlocked.connect(governance).setCurve(NEW_CURVE))            
                        .to.emit(timeLockNonTransferablePoolUnlocked, "CurveChanged")
                        .withArgs(governance.address);
                })
        
                it("Replacing with a same length curve should do it correctly", async() => {
                    // Mapping a new curve for replacing the old one
                    const NEW_CURVE = CURVE.map(function(x) {
                        return (hre.ethers.BigNumber.from(x).mul(2).toString())
                    })
                    await timeLockNonTransferablePoolUnlocked.connect(governance).setCurve(NEW_CURVE);
        
                    for(let i=0; i< NEW_CURVE.length; i++){
                        const curvePoint = await timeLockNonTransferablePoolUnlocked.curve(i);
                        expect(curvePoint).to.be.eq(NEW_CURVE[i])
                    }
                    await expect(timeLockNonTransferablePoolUnlocked.curve(NEW_CURVE.length + 1)).to.be.reverted;
                })
        
                it("Replacing with a shorter curve should do it correctly", async() => {
                    // Setting a two point element curve
                    const NEW_CURVE = [(1e18).toString(), (2*1e18).toString()]
                    await timeLockNonTransferablePoolUnlocked.connect(governance).setCurve(NEW_CURVE);
        
                    for(let i=0; i< NEW_CURVE.length; i++){
                        const curvePoint = await timeLockNonTransferablePoolUnlocked.curve(i);
                        expect(curvePoint).to.be.eq(NEW_CURVE[i])
                    }
                    await expect(timeLockNonTransferablePoolUnlocked.curve(NEW_CURVE.length + 1)).to.be.reverted;
                })
        
                it("Replacing with a longer curve should do it correctly", async() => {
                    const NEW_RAW_CURVE = [
                        0,
                        0.113450636781733,
                        0.23559102796425,
                        0.367086765506204,
                        0.508654422399196,
                        0.661065457561288,
                        0.825150419825931,
                        1.00180347393553,
                        1.19198727320361,
                        1.39673820539865,
                        1.61717204043653,
                        1.85449001065813,
                        2.10998535682594,
                        2.38505037551144,
                        2.6811840062773,
                        3,
                        3.34323571284532,
                        3.71276157381861,
                        4.11059127748229,
                        4.53889275738489,
                        5
                    ]
                
                    const NEW_CURVE = NEW_RAW_CURVE.map(function(x) {
                        return (x*1e18).toString();
                    })
                    await timeLockNonTransferablePoolUnlocked.connect(governance).setCurve(NEW_CURVE);
        
                    for(let i=0; i< NEW_CURVE.length; i++){
                        const curvePoint = await timeLockNonTransferablePoolUnlocked.curve(i);
                        expect(curvePoint).to.be.eq(NEW_CURVE[i])
                    }
                    await expect(timeLockNonTransferablePoolUnlocked.curve(NEW_CURVE.length + 1)).to.be.reverted;
                })
        
                it("Replacing with a curve that is not monotonic increasing should fail", async() => {
                    const NEW_RAW_CURVE = [
                        0,
                        1,
                        2,
                        100,
                        4,
                        5
                    ]
        
                    const NEW_CURVE = NEW_RAW_CURVE.map(function(x) {
                        return (x*1e18).toString();
                    })
                    await expect(timeLockNonTransferablePoolUnlocked.connect(governance).setCurve(NEW_CURVE)).to.be.revertedWith("CurveIncreaseError");
                })
        
                it("Replacing a point with a non gov role account should fail", async() => {
                    await expect(timeLockNonTransferablePoolUnlocked.setCurvePoint((4*1e18).toString(), 3)).to.be.revertedWith("NotGovError()");
                });
        
                it("Replacing a point should emit an event", async() => {
                    await expect(timeLockNonTransferablePoolUnlocked.connect(governance).setCurvePoint((4*1e18).toString(), 3))            
                        .to.emit(timeLockNonTransferablePoolUnlocked, "CurveChanged")
                        .withArgs(governance.address);
                })
        
                it("Replacing a point should do it correctly", async() => {
                    const curvePoint = await timeLockNonTransferablePoolUnlocked.connect(governance).curve(3);
                    
                    const newPoint = (4*1e18).toString();
                    await timeLockNonTransferablePoolUnlocked.connect(governance).setCurvePoint(newPoint, 3);
        
                    const changedCurvePoint = await timeLockNonTransferablePoolUnlocked.curve(3);
                    expect(curvePoint).not.to.be.eq(changedCurvePoint)
                    expect(changedCurvePoint).to.be.eq(newPoint)
                })
        
                it("Adding a point should do it correctly", async() => {
                    await expect(timeLockNonTransferablePoolUnlocked.connect(governance).curve(5)).to.be.reverted;
                    const newPoint = (6*1e18).toString();
                    await timeLockNonTransferablePoolUnlocked.connect(governance).setCurvePoint(newPoint, 5);
                    
                    const addedCurvePoint = await timeLockNonTransferablePoolUnlocked.curve(5);
                    expect(addedCurvePoint).to.be.eq(newPoint)
                })
        
                it("Removing a point should do it correctly", async() => {
                    const newPoint = (4*1e18).toString();
                    await timeLockNonTransferablePoolUnlocked.connect(governance).setCurvePoint(newPoint, 6);
                    
                    await expect(timeLockNonTransferablePoolUnlocked.curve(4)).to.be.reverted;
                })
        
                it("Removing a point from a curve with length two should revert", async() => {
                    
                    const NEW_CURVE = [(1e18).toString(), (2*1e18).toString()]
                    await timeLockNonTransferablePoolUnlocked.connect(governance).setCurve(NEW_CURVE);
        
                    const newPoint = (4*1e18).toString();
                    // A curve cannot have less than two elements, thus it must fail
                    await expect(timeLockNonTransferablePoolUnlocked.connect(governance).setCurvePoint(newPoint, 9)).to.be.revertedWith("ShortCurveError()");            
                })
        
                it("Adding a point so that curve is not monotonic increasing should fail", async() => {
                    await expect(timeLockNonTransferablePoolUnlocked.connect(governance).curve(5)).to.be.reverted;
                    const newPoint = (4*1e18).toString();
                    await expect(timeLockNonTransferablePoolUnlocked.connect(governance).setCurvePoint(newPoint, 5)).to.be.revertedWith("CurveIncreaseError");
                })
            });    
        
            describe("Curve changes", async() => {
                beforeEach(async() => {
                    await timeTraveler.revertSnapshot();
    
                    // Upgrade
                    let timeLockNonTransferablePoolUnlockedImplementation: TimeLockNonTransferablePoolUnlocked;
                    const TimeLockNonTransferablePoolUnlockedFactory = new TimeLockNonTransferablePoolUnlocked__factory(deployer);
                    timeLockNonTransferablePoolUnlockedImplementation = await TimeLockNonTransferablePoolUnlockedFactory.deploy();
                    await proxyAdmin.connect(governance).upgrade(proxy.address, timeLockNonTransferablePoolUnlockedImplementation.address);
    
                    const TimeLockNonTransferablePoolUnlocked = await ethers.getContractFactory("TimeLockNonTransferablePoolUnlocked");
                    timeLockNonTransferablePoolUnlocked = await TimeLockNonTransferablePoolUnlocked.attach(proxy.address);
                    timeLockNonTransferablePoolUnlocked = timeLockNonTransferablePoolUnlocked.connect(account1);
                });

                it("Curve should multiply correctly", async() => {
                    const MIN_LOCK_DURATION = await timeLockNonTransferablePoolUnlocked.MIN_LOCK_DURATION();
                    const minMultiplier = await timeLockNonTransferablePoolUnlocked.getMultiplier(MIN_LOCK_DURATION);
                    const expectedResult1 = theoreticalMultiplier(MIN_LOCK_DURATION, CURVE)
        
                    const oneYearDuration = MAX_LOCK_DURATION / 4;
                    const oneYearMultiplier = await timeLockNonTransferablePoolUnlocked.getMultiplier(oneYearDuration);
                    const expectedResult2 = theoreticalMultiplier(oneYearDuration, CURVE)
        
                    const twoYearDuration = MAX_LOCK_DURATION / 2;
                    const twoYearMultiplier = await timeLockNonTransferablePoolUnlocked.getMultiplier(twoYearDuration);
                    const expectedResult3 = theoreticalMultiplier(twoYearDuration, CURVE)
        
                    const threeYearDuration = MAX_LOCK_DURATION * 3 / 4;
                    const threeYearMultiplier = await timeLockNonTransferablePoolUnlocked.getMultiplier(threeYearDuration);
                    const expectedResult4 = theoreticalMultiplier(threeYearDuration, CURVE)
        
                    const maxLockDuration = MAX_LOCK_DURATION;
                    const maxMultiplier = await timeLockNonTransferablePoolUnlocked.getMultiplier(maxLockDuration);
                    const expectedResult5 = theoreticalMultiplier(maxLockDuration, CURVE)
        
                    const randomDuration = Math.floor(Math.random() * (MAX_LOCK_DURATION - 1)) + 1;
                    const randomMultiplier = await timeLockNonTransferablePoolUnlocked.getMultiplier(randomDuration);
                    const expectedResult6 = theoreticalMultiplier(randomDuration, CURVE)
        
                    expect(expectedResult1).to.be.eq(minMultiplier)
                    expect(expectedResult2).to.be.eq(oneYearMultiplier)
                    expect(expectedResult3).to.be.eq(twoYearMultiplier)
                    expect(expectedResult4).to.be.eq(threeYearMultiplier)
                    expect(expectedResult5).to.be.eq(maxMultiplier)
                    expect(expectedResult6).to.be.eq(randomMultiplier)
                });
        
                it("Change curve and multiply correctly", async() => {
                    // Setting a new curve should still work while getting the multiplier
                    const NEW_CURVE = CURVE.map(function(x) {
                        return (hre.ethers.BigNumber.from(x).mul(2).toString())
                    })
                    await timeLockNonTransferablePoolUnlocked.connect(governance).setCurve(NEW_CURVE);
        
                    const MIN_LOCK_DURATION = await timeLockNonTransferablePoolUnlocked.MIN_LOCK_DURATION();
                    const minMultiplier = await timeLockNonTransferablePoolUnlocked.getMultiplier(MIN_LOCK_DURATION);
                    const expectedResult1 = theoreticalMultiplier(MIN_LOCK_DURATION, NEW_CURVE)
        
                    const oneYearDuration = MAX_LOCK_DURATION / 4;
                    const oneYearMultiplier = await timeLockNonTransferablePoolUnlocked.getMultiplier(oneYearDuration);
                    const expectedResult2 = theoreticalMultiplier(oneYearDuration, NEW_CURVE)
        
                    const twoYearDuration = MAX_LOCK_DURATION / 2;
                    const twoYearMultiplier = await timeLockNonTransferablePoolUnlocked.getMultiplier(twoYearDuration);
                    const expectedResult3 = theoreticalMultiplier(twoYearDuration, NEW_CURVE)
        
                    const threeYearDuration = MAX_LOCK_DURATION * 3 / 4;
                    const threeYearMultiplier = await timeLockNonTransferablePoolUnlocked.getMultiplier(threeYearDuration);
                    const expectedResult4 = theoreticalMultiplier(threeYearDuration, NEW_CURVE)
        
                    const maxLockDuration = await timeLockNonTransferablePoolUnlocked.maxLockDuration();
                    const maxMultiplier = await timeLockNonTransferablePoolUnlocked.getMultiplier(maxLockDuration);
                    const expectedResult5 = theoreticalMultiplier(maxLockDuration, NEW_CURVE)
        
                    const randomDuration = Math.floor(Math.random() * (MAX_LOCK_DURATION - 1)) + 1;
                    const randomMultiplier = await timeLockNonTransferablePoolUnlocked.getMultiplier(randomDuration);
                    const expectedResult6 = theoreticalMultiplier(randomDuration, NEW_CURVE)
        
                    expect(expectedResult1).to.be.eq(minMultiplier)
                    expect(expectedResult2).to.be.eq(oneYearMultiplier)
                    expect(expectedResult3).to.be.eq(twoYearMultiplier)
                    expect(expectedResult4).to.be.eq(threeYearMultiplier)
                    expect(expectedResult5).to.be.eq(maxMultiplier)
                    expect(expectedResult6).to.be.eq(randomMultiplier)
                });
        
                it("Change curve by extending it", async() => {
                    const NEW_RAW_CURVE = [
                        0,
                        0.113450636781733,
                        0.23559102796425,
                        0.367086765506204,
                        0.508654422399196,
                        0.661065457561288,
                        0.825150419825931,
                        1.00180347393553,
                        1.19198727320361,
                        1.39673820539865,
                        1.61717204043653,
                        1.85449001065813,
                        2.10998535682594,
                        2.38505037551144,
                        2.6811840062773,
                        3,
                        3.34323571284532,
                        3.71276157381861,
                        4.11059127748229,
                        4.53889275738489,
                        5
                    ]
                    // Setting a new curve should still work while getting the multiplier
                    const NEW_CURVE = NEW_RAW_CURVE.map(function(x) {
                        return (x*1e18).toString();
                    })
                    await timeLockNonTransferablePoolUnlocked.connect(governance).setCurve(NEW_CURVE);
        
                    const MIN_LOCK_DURATION = await timeLockNonTransferablePoolUnlocked.MIN_LOCK_DURATION();
                    const minMultiplier = await timeLockNonTransferablePoolUnlocked.getMultiplier(MIN_LOCK_DURATION);
                    const expectedResult1 = theoreticalMultiplier(MIN_LOCK_DURATION, NEW_CURVE)
        
                    const oneYearDuration = MAX_LOCK_DURATION / 4;
                    const oneYearMultiplier = await timeLockNonTransferablePoolUnlocked.getMultiplier(oneYearDuration);
                    const expectedResult2 = theoreticalMultiplier(oneYearDuration, NEW_CURVE)
        
                    const twoYearDuration = MAX_LOCK_DURATION / 2;
                    const twoYearMultiplier = await timeLockNonTransferablePoolUnlocked.getMultiplier(twoYearDuration);
                    const expectedResult3 = theoreticalMultiplier(twoYearDuration, NEW_CURVE)
        
                    const threeYearDuration = MAX_LOCK_DURATION * 3 / 4;
                    const threeYearMultiplier = await timeLockNonTransferablePoolUnlocked.getMultiplier(threeYearDuration);
                    const expectedResult4 = theoreticalMultiplier(threeYearDuration, NEW_CURVE)
        
                    const maxLockDuration = await timeLockNonTransferablePoolUnlocked.maxLockDuration();
                    const maxMultiplier = await timeLockNonTransferablePoolUnlocked.getMultiplier(maxLockDuration);
                    const expectedResult5 = theoreticalMultiplier(maxLockDuration, NEW_CURVE)
        
                    const randomDuration = Math.floor(Math.random() * (MAX_LOCK_DURATION - 1)) + 1;
                    const randomMultiplier = await timeLockNonTransferablePoolUnlocked.getMultiplier(randomDuration);
                    const expectedResult6 = theoreticalMultiplier(randomDuration, NEW_CURVE)
        
                    expect(expectedResult1).to.be.eq(minMultiplier)
                    expect(expectedResult2).to.be.eq(oneYearMultiplier)
                    expect(expectedResult3).to.be.eq(twoYearMultiplier)
                    expect(expectedResult4).to.be.eq(threeYearMultiplier)
                    expect(expectedResult5).to.be.eq(maxMultiplier)
                    expect(expectedResult6).to.be.eq(randomMultiplier)
                });
        
                it("Change curve by reducing it", async() => {
                    // Setting a new curve should still work while getting the multiplier
                    const NEW_CURVE = [
                        (0*1e18).toString(),
                        (5*1e18).toString()
                    ]
                    await timeLockNonTransferablePoolUnlocked.connect(governance).setCurve(NEW_CURVE);
        
                    const MIN_LOCK_DURATION = await timeLockNonTransferablePoolUnlocked.MIN_LOCK_DURATION();
                    const minMultiplier = await timeLockNonTransferablePoolUnlocked.getMultiplier(MIN_LOCK_DURATION);
                    const expectedResult1 = theoreticalMultiplier(MIN_LOCK_DURATION, NEW_CURVE)
        
                    const oneYearDuration = MAX_LOCK_DURATION / 4;
                    const oneYearMultiplier = await timeLockNonTransferablePoolUnlocked.getMultiplier(oneYearDuration);
                    const expectedResult2 = theoreticalMultiplier(oneYearDuration, NEW_CURVE)
        
                    const twoYearDuration = MAX_LOCK_DURATION / 2;
                    const twoYearMultiplier = await timeLockNonTransferablePoolUnlocked.getMultiplier(twoYearDuration);
                    const expectedResult3 = theoreticalMultiplier(twoYearDuration, NEW_CURVE)
        
                    const threeYearDuration = MAX_LOCK_DURATION * 3 / 4;
                    const threeYearMultiplier = await timeLockNonTransferablePoolUnlocked.getMultiplier(threeYearDuration);
                    const expectedResult4 = theoreticalMultiplier(threeYearDuration, NEW_CURVE)
        
                    const maxLockDuration = await timeLockNonTransferablePoolUnlocked.maxLockDuration();
                    const maxMultiplier = await timeLockNonTransferablePoolUnlocked.getMultiplier(maxLockDuration);
                    const expectedResult5 = theoreticalMultiplier(maxLockDuration, NEW_CURVE)
        
                    const randomDuration = Math.floor(Math.random() * (MAX_LOCK_DURATION - 1)) + 1;
                    const randomMultiplier = await timeLockNonTransferablePoolUnlocked.getMultiplier(randomDuration);
                    const expectedResult6 = theoreticalMultiplier(randomDuration, NEW_CURVE)
        
                    expect(expectedResult1).to.be.eq(minMultiplier)
                    expect(expectedResult2).to.be.eq(oneYearMultiplier)
                    expect(expectedResult3).to.be.eq(twoYearMultiplier)
                    expect(expectedResult4).to.be.eq(threeYearMultiplier)
                    expect(expectedResult5).to.be.eq(maxMultiplier)
                    expect(expectedResult6).to.be.eq(randomMultiplier)
                });
            });

            describe("Kick", async() => {
                const DEPOSIT_AMOUNT = parseEther("176.378");
                const THREE_MONTHS = MAX_LOCK_DURATION / 12;

                beforeEach(async() => {
                    await timeTraveler.revertSnapshot();
                    
                    await timeLockNonTransferablePool.deposit(DEPOSIT_AMOUNT, THREE_MONTHS, account1.address);

                    // Upgrade
                    let timeLockNonTransferablePoolUnlockedImplementation: TimeLockNonTransferablePoolUnlocked;
                    const TimeLockNonTransferablePoolUnlockedFactory = new TimeLockNonTransferablePoolUnlocked__factory(deployer);
                    timeLockNonTransferablePoolUnlockedImplementation = await TimeLockNonTransferablePoolUnlockedFactory.deploy();
                    await proxyAdmin.connect(governance).upgrade(proxy.address, timeLockNonTransferablePoolUnlockedImplementation.address);
    
                    const TimeLockNonTransferablePoolUnlocked = await ethers.getContractFactory("TimeLockNonTransferablePoolUnlocked");
                    timeLockNonTransferablePoolUnlocked = await TimeLockNonTransferablePoolUnlocked.attach(proxy.address);
                    timeLockNonTransferablePoolUnlocked = timeLockNonTransferablePoolUnlocked.connect(account1);
                });
        
                it("Trying to kick a non existing deposit should revert", async() => {
                    await expect(timeLockNonTransferablePoolUnlocked.kick(1, account1.address)).to.be.revertedWith("NonExistingDepositError()");
                });
        
                it("Trying to kick before deposit ends should revert", async() => {
                    await expect(timeLockNonTransferablePoolUnlocked.kick(0, account1.address)).to.be.revertedWith("TooSoonError()");
                });
        
                it("Trying to kick after end should succeed", async() => {
                    await timeTraveler.increaseTime(THREE_MONTHS * 2);
                    const balanceBeforeKick = await timeLockNonTransferablePoolUnlocked.balanceOf(account1.address);
                    const depositBeforeKick = await timeLockNonTransferablePoolUnlocked.depositsOf(account1.address, 0);
                    await timeLockNonTransferablePoolUnlocked.kick(0, account1.address);
                    const balanceAfterKick = await timeLockNonTransferablePoolUnlocked.balanceOf(account1.address);
                    const depositAfterKick = await timeLockNonTransferablePoolUnlocked.depositsOf(account1.address, 0);
        
                    expect(balanceBeforeKick).to.be.eq(depositBeforeKick.shareAmount)
                    expect(balanceAfterKick).to.be.eq(depositAfterKick.shareAmount).to.be.eq(depositBeforeKick.amount).to.be.eq(depositAfterKick.amount)
                });
            });
        });    
    });
});
