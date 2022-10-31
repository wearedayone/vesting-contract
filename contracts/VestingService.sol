// SPDX-License-Identifier: UNLICENSED
pragma solidity ^0.8.9;

// Uncomment this line to use console.log
// import "hardhat/console.sol";

// import "@openzeppelin/contracts/token/ERC20/ERC20.sol";
import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import "@openzeppelin/contracts/utils/Strings.sol";

contract VestingService {
    using SafeERC20 for IERC20;

    struct VestingSchedule {
        IERC20 token; // token address
        uint256 start; // start time
        uint256 duration; // duration in ms
        uint256 initializedAmount; // token send at start time to each address
        uint256 tokenReceivePerRound; // token amount an address will receive in a round
        uint256 released; // released token
        uint256 total; // total token
    }

    mapping(IERC20 => mapping(address => bool)) vestingScheduleAddreses; 
    mapping(IERC20 => mapping(address => uint256)) vestingScheduleHolders;
    mapping(IERC20 => VestingSchedule) private vestingSchedules;

    event Released(IERC20 token, address receiver, uint256 time);

    constructor() {}

    function createVestingSchedule(address tokenAddress, uint256 start, uint256 numberOfRounds, uint256 duration, uint256 initializedAmount, uint256 total, address[] calldata receiverAddresses) public {
        IERC20 token = IERC20(tokenAddress);
        uint256 balance = token.balanceOf(msg.sender);
        require(balance >= total, "TokenVesting: cannot create vesting schedule because not sufficient tokens");
        require(total > initializedAmount, "TokenVesting: cannot create vesting schedule because total is not greater than initialized amount");

        uint256 currentTime = block.timestamp * 1000;
        require(currentTime < start, "TokenVesting: cannot create vesting schedule because start time is in the past");

        token.transferFrom(msg.sender, address(this), total);

        uint256 tokenReceivePerRound = (total - initializedAmount * receiverAddresses.length) / (numberOfRounds * receiverAddresses.length);
        uint256 released = 0;

        for (uint256 i = 0; i < receiverAddresses.length; i ++) {
            address userAddress = address(receiverAddresses[i]);

            uint256 userAmount = 0;
            if (initializedAmount > 0) {
                SafeERC20.safeTransfer(token, userAddress, initializedAmount);
                userAmount = initializedAmount;
                released += userAmount;
            }

            vestingScheduleAddreses[token][userAddress] = true;
            vestingScheduleHolders[token][userAddress] = userAmount;
        }

        vestingSchedules[token] = VestingSchedule(
            token,
            start,
            duration,
            initializedAmount,
            tokenReceivePerRound,
            released,
            total
        );
    }

    function release(address tokenAddress) public {
        IERC20 token = IERC20(tokenAddress);

        require(vestingScheduleAddreses[token][msg.sender], "Address is not in vesting program");

        uint256 currentTime = block.timestamp * 1000;
        // use this instead of block.timestamp to avoid delaying in block.timestamp
        // maximum time for a block in ethereum is 15s
        uint256 maximumEndedBlockTime = currentTime + 15 * 1000;
        uint256 start = vestingSchedules[token].start;
        require(maximumEndedBlockTime > start, "Vesting program hasnt started yet");

        uint256 duration = vestingSchedules[token].duration;
        uint256 tokenReceivePerRound = vestingSchedules[token].tokenReceivePerRound;
        uint256 initializedAmount = vestingSchedules[token].initializedAmount;

        uint256 passedRounds = (maximumEndedBlockTime - start) / duration;
        uint256 maximumReceived = initializedAmount + tokenReceivePerRound * passedRounds;

        uint256 amountReceived = vestingScheduleHolders[token][msg.sender];
        require(amountReceived < maximumReceived, string(abi.encodePacked("Received this round. Please wait for next round to receive more!", " ", Strings.toString(currentTime), " ", Strings.toString(start)," ", Strings.toString(duration), " ", Strings.toString(passedRounds), " ", Strings.toString(maximumReceived), " ", Strings.toString(amountReceived))));

        SafeERC20.safeTransfer(token, msg.sender, tokenReceivePerRound);
        vestingSchedules[token].released += tokenReceivePerRound;
        vestingScheduleHolders[token][msg.sender] += tokenReceivePerRound;
        emit Released(token, msg.sender, currentTime);
    }

    // dont need this function for the moment
    // will need it when creating UI
    // call this function to enable/disable release button
    
    // function checkIfCanRelease(IERC20 token) public view returns(bool) {
    //     require(vestingScheduleAddreses[token][msg.sender], "Address is not in vesting program");

    //     uint256 start = vestingSchedules[token].start;
    //     uint256 duration = vestingSchedules[token].duration;
    //     uint256 tokenReceivePerRound = vestingSchedules[token].tokenReceivePerRound;

    //     uint currentTime = block.timestamp * 1000;
    //     uint256 passedRound = (currentTime - start) / duration;
    //     uint256 maximumReceived = tokenReceivePerRound * (passedRound + 1);

    //     uint256 amountReceived = vestingScheduleHolders[token][msg.sender];
    //     require(amountReceived < maximumReceived, "Received this round. Please wait for next round to receive more!");

    //     return true;
    // }

    function getVestingScheduleHolderBalance(address tokenAddress) public view returns(uint256) {
        IERC20 token = IERC20(tokenAddress);
        return vestingScheduleHolders[token][msg.sender];
    }

    function getVestingSchedule(address tokenAddress) public view returns(address, uint256, uint256, uint256, uint256, uint256, uint256) {
        IERC20 token = IERC20(tokenAddress);
        return (tokenAddress, vestingSchedules[token].start, vestingSchedules[token].duration, vestingSchedules[token].initializedAmount, vestingSchedules[token].tokenReceivePerRound, vestingSchedules[token].released, vestingSchedules[token].total);
    }
}
