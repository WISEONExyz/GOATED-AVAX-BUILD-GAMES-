// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "./Bounty.sol";

/// @title BountyFactory
/// @notice Deploys and indexes Bounty contracts.
contract BountyFactory {
    address[] public bounties;

    event BountyCreated(
        address indexed bountyAddress,
        address indexed poster,
        string title,
        uint256 reward,
        uint256 deadline
    );

    function createBounty(
        string calldata title,
        string calldata description,
        uint256 deadline
    ) external payable returns (address bountyAddress) {
        require(msg.value > 0, "Reward must be > 0");
        require(deadline > block.timestamp, "Invalid deadline");

        Bounty bounty = new Bounty{value: msg.value}(msg.sender, title, description, deadline);
        bountyAddress = address(bounty);
        bounties.push(bountyAddress);

        emit BountyCreated(bountyAddress, msg.sender, title, msg.value, deadline);
    }

    function getBounties() external view returns (address[] memory) {
        return bounties;
    }

    function bountyCount() external view returns (uint256) {
        return bounties.length;
    }
}
