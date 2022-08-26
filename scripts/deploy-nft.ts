import hre, { ethers } from "hardhat";
import { NFT } from "../typechain/NFT";
import { NFT__factory } from "../typechain/factories/NFT__factory";
import { SignerWithAddress } from "@nomiclabs/hardhat-ethers/signers";
import keccak256 from "keccak256";
import { MerkleTree } from "merkletreejs";
import { create } from 'ipfs-http-client';

async function main() {
  const delay = (ms: any) => new Promise((res) => setTimeout(res, ms));

  let nft: NFT;
  let fundingWallet: SignerWithAddress;
  let addrs: SignerWithAddress[];

  const name = "My NFT";
  const symbol = "MN";
  const baseTokenURI = "ipfs://QmSeARZo5Q4zEUTjJcHsBHdg9CfpniTdyWks24hMA4Qqrv/";
  const cid = "QmWp1eXWmaVXo4aQmWtf2EgTZppBwh1WgecP3PRujQAYez";
  const whitelistedUsersURI = "ipfs://".concat(cid);
  const blockNumBefore = await ethers.provider.getBlockNumber();
  const blockBefore = await ethers.provider.getBlock(blockNumBefore);
  const timestampBefore = blockBefore.timestamp;
  const deadline = timestampBefore + 86400;
  const ipfs = create({ url: "http://localhost:5001/api/v0" });
  const chunks = [];

  for await (const chunk of ipfs.cat(cid)) {
    chunks.push(chunk);
  }

  const raw = chunks.toString();
  const whitelistAddresses = JSON.parse(raw)["addresses"];

  const whiteListLeafNodes = [];

  for await (const whitelistAddress of whitelistAddresses) {
    whiteListLeafNodes.push(keccak256(whitelistAddress));
  }

  const merkleTree = new MerkleTree(whiteListLeafNodes, keccak256, { sortPairs: true });
  const rootHash = merkleTree.getRoot();

  [fundingWallet, ...addrs] = await ethers.getSigners();

  const Nft = (await ethers.getContractFactory('NFT')) as NFT__factory;
  nft = await Nft.deploy(name, symbol, baseTokenURI, whitelistedUsersURI, rootHash, fundingWallet.address, deadline);
  await nft.deployed();

  console.log("NFT deployed to:", nft.address);

  await delay(35000);

  await hre.run("verify:verify", {
    address: nft.address,
    constructorArguments: [name, symbol, baseTokenURI, whitelistedUsersURI, rootHash, fundingWallet.address, deadline],
  });
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
