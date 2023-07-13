// SPDX-License-Identifier: MIT
pragma solidity 0.8.7;

import { IERC20Upgradeable as IERC20 } from "@openzeppelin/contracts-upgradeable/token/ERC20/IERC20Upgradeable.sol";
import { MathUpgradeable as Math } from "@openzeppelin/contracts-upgradeable/utils/math/MathUpgradeable.sol";
import { SafeERC20Upgradeable as SafeERC20 } from "@openzeppelin/contracts-upgradeable/token/ERC20/utils/SafeERC20Upgradeable.sol";

import "./base/BasePool.sol";
import "./interfaces/ITimeLockPool.sol";

contract TimeLockPoolUnlocked is BasePool, ITimeLockPool {
    using Math for uint256;
    using SafeERC20 for IERC20;

    // Conclude new deposits, lock extension and lock increase
    error ConcludeDepositError();
    
    // Min duration cannot be bigger than max duration
    error SmallMaxLockDuration();
    // Deposit must exist
    error NonExistingDepositError();
    // Deposit must have expired
    error TooSoonError();
    // Point should be lower than maxBonus
    error MaxBonusError();
    // Points in the curve must increase
    error CurveIncreaseError();
    // Shares should not burn
    error ShareBurningError();

    // Max multiplier a user can get
    uint256 public maxBonus;
    // Max duration of a deposit
    uint256 public maxLockDuration;
    // Min duration of a deposit
    uint256 public constant MIN_LOCK_DURATION = 1 days;
    
    // Curve points
    uint256[] public curve;
    // Distance between two points of the curve, used to interpolate
    uint256 public unit;

    // user => array of deposits
    mapping(address => Deposit[]) public depositsOf;

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
    function __TimeLockPool_init(
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
    ) internal onlyInitializing {
        // Initializes the BasePool contract
        __BasePool_init(_name, _symbol, _depositToken, _rewardToken, _escrowPool, _escrowPortion, _escrowDuration);
        
        // Min duration can't be bigger than max duration
        if (_maxLockDuration < MIN_LOCK_DURATION) {
            revert SmallMaxLockDuration();
        }
        // Sanity check and setting of curve values
        checkCurve(_curve);
        for (uint i=0; i < _curve.length; i++) {
            if (_curve[i] > _maxBonus) {
                revert MaxBonusError();
            }
            curve.push(_curve[i]);
        }
        // Set variables
        maxBonus = _maxBonus;
        maxLockDuration = _maxLockDuration;

        // Calculate unit
        unit = _maxLockDuration / (curve.length - 1);
    }

    // Deposit has already expired
    error DepositExpiredError();
    // Duration must not be zero
    error ZeroDurationError();
    // Address must not be zero
    error ZeroAddressError();
    // Amount must not be zero
    error ZeroAmountError();
    // Length of the curve is too short
    error ShortCurveError();

    /**
     * @notice Events for when a deposit is created
     * @param amount uint256 amount of tokens deposited
     * @param duration uint256 duration of the deposit
     * @param receiver address user who owns the deposit
     * @param from address sender of the transaction
     */
    event Deposited(uint256 amount, uint256 duration, address indexed receiver, address indexed from);

    /**
     * @notice Events for when a deposit is withdrawn
     * @param depositId uint256 identifier of the deposit
     * @param receiver address user who owns the deposit
     * @param from address sender of the transaction
     * @param amount address amount of tokens withdrawn
     */
    event Withdrawn(uint256 indexed depositId, address indexed receiver, address indexed from, uint256 amount);

    /**
     * @notice Events for when a deposit is extended
     * @param depositId uint256 identifier of the deposit
     * @param duration uint256 amount of time to be extended
     * @param from address sender of the transaction
     */
    event LockExtended(uint256 indexed depositId, uint256 duration, address indexed from);

    /**
     * @notice Events for when a deposit is increased
     * @param depositId uint256 identifier of the deposit
     * @param receiver address user who owns the deposit
     * @param from address sender of the transaction
     * @param amount address amount of extra tokens deposited
     */
    event LockIncreased(uint256 indexed depositId, address indexed receiver, address indexed from, uint256 amount);

    /**
     * @notice Events for when the curve is modify
     * @param sender address the user that modifies the curve
     */
    event CurveChanged(address indexed sender);

    /**
     * @notice Creates a lock with an amount of tokens and mint the corresponding shares.
     * @dev The duration is has a lower and an upper bound which are enforced in case its
     * value is outside those bounds. Uses the multiplier function to get the amount of shares to mint.
     * @param _amount uint256 amount of tokens to be deposited
     * @param _duration uint256 time that the deposit will be locked.
     * @param _receiver address owner of the lock
     */
    function deposit(uint256 _amount, uint256 _duration, address _receiver) external override {
        // no new deposits after upgrading the implementation
        revert ConcludeDepositError();
    }

    /**
     * @notice Withdraws all the tokens from the lock
     * @dev The lock has to be expired to withdraw the tokens. When the withdrawal happens
     * the shares minted on the deposit are burnt.
     * @param _depositId uint256 id of the deposit to be withdrawn from.
     * @param _receiver address receiver of the withdrawn funds
     */
    function withdraw(uint256 _depositId, address _receiver) external {
        // User must withdraw to a non-zero address
        if (_receiver == address(0)) {
            revert ZeroAddressError();
        }
        // Deposit must exist
        if (_depositId >= depositsOf[_msgSender()].length) {
            revert NonExistingDepositError();
        }
        // Fetch deposit struct
        Deposit memory userDeposit = depositsOf[_msgSender()][_depositId];
        // unlock deposits by removing time check
        // if (block.timestamp < userDeposit.end) {
        //     revert TooSoonError();
        // }

        // remove Deposit
        depositsOf[_msgSender()][_depositId] = depositsOf[_msgSender()][depositsOf[_msgSender()].length - 1];
        depositsOf[_msgSender()].pop();

        // burn pool shares
        _burn(_msgSender(), userDeposit.shareAmount);
        
        // return tokens
        depositToken.safeTransfer(_receiver, userDeposit.amount);

        // Emits Withdrawn even
        emit Withdrawn(_depositId, _receiver, _msgSender(), userDeposit.amount);
    }

    /**
     * @notice Adds more time to current lock.
     * @dev This function extends the duration of a specific lock -deposit- of the sender.
     * While doing so, it uses the timestamp of the current block and calculates the remaining
     * time to the end of the lock, and adds the increased duration. This results in a new
     * duration that can be different to the original duration from the lock one (>, = or <), 
     * and gets multiplied by the corresponding multiplier. The final result can be more, same,
     * or less shares, which will be minted/burned accordingly.
     * @param _depositId uint256 id of the deposit to be increased.
     * @param _increaseDuration uint256 time to be added to the lock measured from the end of the lock
     */
    function extendLock(uint256 _depositId, uint256 _increaseDuration) external {
        // no new lock extensions after upgrading the implementation
        revert ConcludeDepositError();
    }

    /**
     * @notice Adds more deposits to current lock.
     * @dev This function increases the deposit amount of a specific lock -deposit- of the sender.
     * While doing so, it uses the timestamp of the current block and calculates the remaining
     * time to the end of the lock. Then it uses this time duration to mint the shares that correspond
     * to the multiplier of that time and the increase amount being deposited. The result is an increase
     * both in deposit amount and share amount of the deposit.
     * @param _depositId uint256 id of the deposit to be increased.
     * @param _receiver address owner of the lock
     * @param _increaseAmount uint256 amount of tokens to add to the lock.
     */
    function increaseLock(uint256 _depositId, address _receiver, uint256 _increaseAmount) external {
        // no new lock increases after upgrading the implementation
        revert ConcludeDepositError();
    }

    /**
     * @notice Gets the multiplier from the curve given a duration.
     * @dev This function calculates a multiplier by fetching the points in the curve given a duration.
     * It can achieve this by linearly interpolating between the points of the curve to get a much more
     * precise result. The unit parameter is related to the maximum possible duration of the deposits 
     * and the amount of points in the curve.
     * @param _lockDuration uint256 time that the deposit will be locked.
     * @return uint256 number used to multiply and get amount of shares.
     */
    function getMultiplier(uint256 _lockDuration) public view returns(uint256) {
        // There is no need to check _lockDuration amount, it is always checked before
        // in the functions that call this function

        // n is the time unit where the lockDuration stands
        uint n = _lockDuration / unit;
        // if last point no need to interpolate
        if (n == curve.length - 1) {
            return ONE + curve[n];
        }
        // linear interpolation between points
        return ONE + curve[n] + (_lockDuration - n * unit) * (curve[n + 1] - curve[n]) / unit;
    }

    /**
     * @notice Gets the total amount of deposits of a user
     * @dev This function loops through an array of deposits of a user to add all amounts
     * @param _account address account to query deposits
     * @return uint256 number of tokens deposited in total
     */
    function getTotalDeposit(address _account) public view returns(uint256) {
        uint256 total;
        for(uint256 i = 0; i < depositsOf[_account].length; i++) {
            total += depositsOf[_account][i].amount;
        }

        return total;
    }

    /**
     * @notice Gets all deposits of a user
     * @dev It gets the array of structs of deposits of a user
     * @param _account address account to query deposits
     * @return Deposit[] array of structs of deposits
     */
    function getDepositsOf(address _account) public view returns(Deposit[] memory) {
        return depositsOf[_account];
    }

    /**
     * @notice Gets the amount of deposits of a user
     * @param _account address account to query length deposit
     * @return uint256 number of deposits
     */
    function getDepositsOfLength(address _account) public view returns(uint256) {
        return depositsOf[_account].length;
    }

    /**
     * @notice Returns an error in case the point exceedes maxBonus
     * @dev Used to check that points of the curve are set correctly, caps them to the maxBonus
     * @param _point uint256 value of the point
     * @return uint256 final number of the point capped by the maxBonus
     */
    function maxBonusError(uint256 _point) internal returns(uint256) {
        // Point cannot be bigger than maxBonus
        if (_point > maxBonus) {
            revert MaxBonusError();
        } else {
            return _point;
        }
    }

    /**
     * @notice Can set an entire new curve.
     * @dev This function can change current curve by a completely new one. By doing so, it does not
     * matter if the new curve's length is larger, equal, or shorter because the function manages
     * all of those cases.
     * @param _curve uint256 array of the points that compose the curve.
     */
    function setCurve(uint256[] calldata _curve) external onlyGov {
        // same length curves
        if (curve.length == _curve.length) {
            for (uint i=0; i < curve.length; i++) {
                curve[i] = maxBonusError(_curve[i]);
            }
        // replacing with a shorter curve
        } else if (curve.length > _curve.length) {
            for (uint i=0; i < _curve.length; i++) {
                curve[i] = maxBonusError(_curve[i]);
            }
            uint initialLength = curve.length;
            for (uint j=0; j < initialLength - _curve.length; j++) {
                curve.pop();
            }
            unit = maxLockDuration / (curve.length - 1);
        // replacing with a longer curve
        } else {
            for (uint i=0; i < curve.length; i++) {
                curve[i] = maxBonusError(_curve[i]);
            }
            uint initialLength = curve.length;
            for (uint j=0; j < _curve.length - initialLength; j++) {
                curve.push(maxBonusError(_curve[initialLength + j]));
            }
            unit = maxLockDuration / (curve.length - 1);
        }
        checkCurve(curve);
        emit CurveChanged(_msgSender());
    }

    /**
     * @notice Can set a point of the curve.
     * @dev This function can replace any point in the curve by inputing the existing index,
     * add a point to the curve by using the index that equals the amount of points of the curve,
     * and remove the last point of the curve if an index greater than the length is used. The first
     * point of the curve index is zero.
     * @param _newPoint uint256 point to be set.
     * @param _position uint256 position of the array to be set (zero-based indexing convention).
     */
    function setCurvePoint(uint256 _newPoint, uint256 _position) external onlyGov {
        // Point must be lower than maxBonus
        if (_newPoint > maxBonus) {
            revert MaxBonusError();
        }

        // Replace a point 
        if (_position < curve.length) {
            curve[_position] = _newPoint;
        // Add a point
        } else if (_position == curve.length) {
            curve.push(_newPoint);
            unit = maxLockDuration / (curve.length - 1);
        // Remove a point
        } else {
            if (curve.length - 1 < 2) {
                revert ShortCurveError();
            }
            curve.pop();
            unit = maxLockDuration / (curve.length - 1);
        }

        // Sanity check of the curve
        checkCurve(curve);

        // Emit CurveChanged error
        emit CurveChanged(_msgSender());
    }

    /**
     * @notice Sanity check for the curves
     * @dev This function checks that the curve is set correctly
     * @param _curve uint256[] curve to be checked
     */
    function checkCurve(uint256[] memory _curve) internal {
        // Must have at least two points
        if (_curve.length < 2) {
            revert ShortCurveError();
        }

        // Points must increase
        for (uint256 i; i < _curve.length - 1; ++i) {
            if (_curve[i + 1] < _curve[i]) {
                revert CurveIncreaseError();
            }
        }
    }

    /**
     * @notice Used to terminate already expired deposits
     * @dev This function can be called by anyone if a deposit has already expired
     * @param _depositId uint256 identifier of the deposit
     * @param _user address user that owns that deposit
     */
    function kick(uint256 _depositId, address _user) external {
        // Deposit must exist
        if (_depositId >= depositsOf[_user].length) {
            revert NonExistingDepositError();
        }

        // Fetch deposit
        Deposit memory userDeposit = depositsOf[_user][_depositId];

        // Deposit must have expired
        if (block.timestamp < userDeposit.end) {
            revert TooSoonError();
        }

        // burn pool shares so that resulting are equal to deposit amount
        _burn(_user, userDeposit.shareAmount - userDeposit.amount);
        depositsOf[_user][_depositId].shareAmount =  userDeposit.amount;
    }
}