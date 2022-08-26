import hre, { ethers } from "hardhat";
import { Staking } from "../typechain/Staking";
import { Staking__factory } from "../typechain/factories/Staking__factory";
import { SignerWithAddress } from "@nomiclabs/hardhat-ethers/signers";

async function main() {
  const delay = (ms: any) => new Promise((res) => setTimeout(res, ms));

  let staking: Staking;
  let addrs: SignerWithAddress[];

  const goldenNuggetContract = "0x008de4D974EDEE3C5c0044E36B6F015f7086221A";

  [...addrs] = await ethers.getSigners();

  const Staking = (await ethers.getContractFactory('Staking')) as Staking__factory;
  staking = await Staking.deploy(goldenNuggetContract);
  await staking.deployed();

  console.log("Staking deployed to:", staking.address);

  await delay(35000);

  await hre.run("verify:verify", {
    address: staking.address,
    constructorArguments: [goldenNuggetContract],
  });
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
