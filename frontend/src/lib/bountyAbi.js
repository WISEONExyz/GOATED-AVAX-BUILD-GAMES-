export const bountyAbi = [
  "function poster() view returns(address)",
  "function title() view returns(string)",
  "function description() view returns(string)",
  "function reward() view returns(uint256)",
  "function deadline() view returns(uint256)",
  "function resolved() view returns(bool)",
  "function winner() view returns(address)",
  "function submitWork(string uri)",
  "function approveSubmission(uint256 submissionId)",
  "function cancelBounty()",
  "function getSubmissionCount() view returns(uint256)",
  "function getSubmission(uint256 submissionId) view returns(address contributor,string uri,uint256 timestamp,bool approved)"
];
