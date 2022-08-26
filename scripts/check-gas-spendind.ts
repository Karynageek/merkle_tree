import hre, { ethers } from "hardhat";
import { NFT } from "../typechain/NFT";
import { NFT__factory } from "../typechain/factories/NFT__factory";
import { SignerWithAddress } from "@nomiclabs/hardhat-ethers/signers";

async function main() {
  let nft: NFT;
  let fundingWallet: SignerWithAddress;
  let addrs: SignerWithAddress[];
  const name = "Wild West NFT";
  const symbol = "WWN";
  const baseTokenURI = "ipfs://bafkreib7rk44lfgqzt6jfvma4khx6sgag6edmp4d2avt67flk5wueqfjc4";
  const deadline = Math.round((new Date().getTime() + 6000) / 1000);

  [fundingWallet, ...addrs] = await ethers.getSigners();

  const whitedlistedUsers = [addrs[0].address];
  const giftedUsers = [addrs[0].address, addrs[1].address, addrs[2].address, addrs[3].address, addrs[4].address];

  const Nft = (await ethers.getContractFactory('NFT')) as NFT__factory;
  nft = await Nft.deploy(name, symbol, baseTokenURI, fundingWallet.address, deadline, whitedlistedUsers, giftedUsers);
  await nft.deployed();

  console.log("NFT deployed to:", nft.address);

  let users = [];

  for (let i = 0; i <= 256; i++) {
    console.log("Count users:", i);

    if (i >= 1) {
      users.push(ethers.Wallet.createRandom().address);
    }

    console.log("Adding");
    let tx = await nft.addWhitelists(users)
    let minedTx = await tx.wait();
    console.log("NFT gasUsed:", minedTx.gasUsed);

    console.log("Removing");
    tx = await nft.removeWhitelists(users)
    minedTx = await tx.wait();
    console.log("NFT gasUsed:", minedTx.gasUsed);
  }
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
