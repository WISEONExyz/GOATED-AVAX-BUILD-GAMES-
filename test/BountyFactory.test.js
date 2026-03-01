const { expect } = require("chai");
const { ethers } = require("hardhat");

describe("BountyFactory", function () {
  it("creates a bounty and stores it", async function () {
    const [poster] = await ethers.getSigners();
    const Factory = await ethers.getContractFactory("BountyFactory");
    const factory = await Factory.deploy();
    await factory.waitForDeployment();

    const latest = await ethers.provider.getBlock("latest");
    const deadline = latest.timestamp + 3600;

    await factory.connect(poster).createBounty("Test", "Desc", deadline, {
      value: ethers.parseEther("1")
    });

    const bounties = await factory.getBounties();
    expect(bounties.length).to.equal(1);
  });
});
