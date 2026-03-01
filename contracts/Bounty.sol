// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

/// @title Bounty
/// @notice Single bounty escrow contract deployed by BountyFactory.
contract Bounty {
    struct Submission {
        address contributor;
        string uri;
        uint256 timestamp;
        bool approved;
    }

    address public immutable poster;
    string public title;
    string public description;
    uint256 public immutable reward;
    uint256 public immutable deadline;
    bool public resolved;
    address public winner;

    Submission[] private submissions;

    event SubmissionAdded(uint256 indexed submissionId, address indexed contributor, string uri);
    event WinnerSelected(uint256 indexed submissionId, address indexed winner);
    event FundsReleased(address indexed winner, uint256 amount);
    event BountyCanceled(address indexed poster, uint256 amount);

    modifier onlyPoster() {
        require(msg.sender == poster, "Only poster");
        _;
    }

    modifier notResolved() {
        require(!resolved, "Already resolved");
        _;
    }

    constructor(
        address _poster,
        string memory _title,
        string memory _description,
        uint256 _deadline
    ) payable {
        require(_poster != address(0), "Invalid poster");
        require(msg.value > 0, "Reward must be > 0");
        require(_deadline > block.timestamp, "Deadline must be in future");

        poster = _poster;
        title = _title;
        description = _description;
        reward = msg.value;
        deadline = _deadline;
    }

    /// @notice Submit proof-of-work URI (IPFS, Arweave, etc.)
    function submitWork(string calldata uri) external notResolved {
        require(block.timestamp <= deadline, "Deadline passed");
        require(bytes(uri).length > 0, "URI required");

        submissions.push(
            Submission({
                contributor: msg.sender,
                uri: uri,
                timestamp: block.timestamp,
                approved: false
            })
        );

        emit SubmissionAdded(submissions.length - 1, msg.sender, uri);
    }

    /// @notice Poster selects winner and contract auto-releases escrow.
    function approveSubmission(uint256 submissionId) external onlyPoster notResolved {
        require(block.timestamp <= deadline, "Deadline passed");
        require(submissionId < submissions.length, "Invalid submission");

        Submission storage selected = submissions[submissionId];
        selected.approved = true;
        winner = selected.contributor;
        resolved = true;

        emit WinnerSelected(submissionId, winner);

        (bool sent, ) = winner.call{value: reward}("");
        require(sent, "Transfer failed");

        emit FundsReleased(winner, reward);
    }

    /// @notice Poster can cancel only if nobody has submitted.
    function cancelBounty() external onlyPoster notResolved {
        require(submissions.length == 0, "Cannot cancel after submissions");
        resolved = true;

        (bool sent, ) = poster.call{value: reward}("");
        require(sent, "Cancel transfer failed");

        emit BountyCanceled(poster, reward);
    }

    function getSubmissionCount() external view returns (uint256) {
        return submissions.length;
    }

    function getSubmission(
        uint256 submissionId
    )
        external
        view
        returns (address contributor, string memory uri, uint256 timestamp, bool approved)
    {
        require(submissionId < submissions.length, "Invalid submission");
        Submission memory s = submissions[submissionId];
        return (s.contributor, s.uri, s.timestamp, s.approved);
    }
}
