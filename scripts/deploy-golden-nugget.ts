import hre, { ethers } from "hardhat";
import { GoldenNugget } from "../typechain/GoldenNugget";
import { GoldenNugget__factory } from "../typechain/factories/GoldenNugget__factory";
import { SignerWithAddress } from "@nomiclabs/hardhat-ethers/signers";

async function main() {
  const delay = (ms: any) => new Promise((res) => setTimeout(res, ms));

  let goldenNugget: GoldenNugget;
  let owner: SignerWithAddress;
  let addrs: SignerWithAddress[];

  [owner, ...addrs] = await ethers.getSigners();

  const GoldenNugget = (await ethers.getContractFactory('GoldenNugget')) as GoldenNugget__factory;
  goldenNugget = await GoldenNugget.deploy(owner.address);
  await goldenNugget.deployed();

  console.log("GoldenNugget deployed to:", goldenNugget.address);

  await delay(35000);

  await hre.run("verify:verify", {
    address: 'goldenNugget.address',
    constructorArguments: [owner.address],
  });
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
