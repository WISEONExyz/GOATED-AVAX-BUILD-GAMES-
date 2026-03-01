export const factoryAbi = [
  "function createBounty(string title,string description,uint256 deadline) payable returns(address)",
  "function getBounties() view returns(address[])",
  "event BountyCreated(address indexed bountyAddress,address indexed poster,string title,uint256 reward,uint256 deadline)"
];
