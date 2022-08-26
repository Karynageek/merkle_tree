import * as dotenv from "dotenv";
import { HardhatUserConfig, task } from "hardhat/config";
import "@nomiclabs/hardhat-etherscan";
import "@nomiclabs/hardhat-waffle";
import "@typechain/hardhat";
import "hardhat-gas-reporter";
import "solidity-coverage";
import keccak256 from "keccak256";
import { MerkleTree } from "merkletreejs";
import { create } from 'ipfs-http-client';

dotenv.config();

task("generate-root-hash", "Generating root hash")
  .addOptionalParam("uri", "The greeting to print")
  .addParam("cid", "The greeting to print")
  .setAction(async ({ uri, cid }) => {

    const ipfs = create({ url: uri });

    const chunks = [];

    for await (const chunk of ipfs.cat(cid)) {
      chunks.push(chunk);
    }

    const notWhitelistAddresses = "0x1DD85Fc6D1ea476c9Fd74e2f2346a1A69677F1D6";

    const raw = chunks.toString();
    const whitelistAddresses = JSON.parse(raw)["addresses"];

    console.log("List of not whiteList users: ", notWhitelistAddresses);
    console.log("List of whiteList users: ", whitelistAddresses);

    const notWhiteListLeafNodes = [];
    const whiteListLeafNodes = [];

    notWhiteListLeafNodes.push(Buffer.from(notWhitelistAddresses, "utf-8"));

    for await (const whitelistAddress of whitelistAddresses) {
      whiteListLeafNodes.push(Buffer.from(whitelistAddress, "utf-8"));
    }

    console.log("Not whiteList leaf nodes: ", notWhiteListLeafNodes);
    console.log("WhiteList leaf nodes: ", whiteListLeafNodes);

    const merkleTree = new MerkleTree(whiteListLeafNodes, keccak256, { sortPairs: true });
    const rootHash = merkleTree.getRoot();

    console.log('Whitelist Merkle Tree\n', merkleTree.toString());
    console.log("Root Hash: ", merkleTree.getHexRoot());

    const notWhiteListAddress = notWhiteListLeafNodes[0];
    const whiteListAddress = whiteListLeafNodes[0];

    const notWhiteListhexProof = merkleTree.getHexProof(notWhiteListAddress);
    const whiteListhexProof = merkleTree.getHexProof(whiteListAddress);

    console.log("Not whiteList proof: ", notWhiteListhexProof);
    console.log("WhiteList proof: ", whiteListhexProof);

    console.log("Not whiteList verification: ", merkleTree.verify(notWhiteListhexProof, notWhiteListAddress, rootHash));
    console.log("WhiteList verification: ", merkleTree.verify(whiteListhexProof, whiteListAddress, rootHash));
  });

const config: HardhatUserConfig = {
  solidity: {
    version: "0.8.16",
    settings: {
      optimizer: {
        enabled: true,
        runs: 1000000,
      },
    },
  },
  networks: {
    rinkeby: {
      url: process.env.RINKEBY_URL || "",
      accounts: {
        mnemonic: process.env.MNEMONIC,
      },
    },
    mainnet: {
      url: process.env.MAINNET_URL || "",
      accounts: {
        mnemonic: process.env.MNEMONIC,
      },
    }
  },
  gasReporter: {
    enabled: process.env.REPORT_GAS !== undefined,
    currency: "USD",
  },
  etherscan: {
    apiKey: process.env.ETHERSCAN_API_KEY,
  },
};

export default config;
