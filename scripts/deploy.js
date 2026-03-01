const hre = require("hardhat");

async function main() {
  const Factory = await hre.ethers.getContractFactory("BountyFactory");
  const factory = await Factory.deploy();
  await factory.waitForDeployment();

  const address = await factory.getAddress();
  console.log("BountyFactory deployed to:", address);
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
