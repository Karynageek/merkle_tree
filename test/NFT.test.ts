import { expect } from "chai";
import { ethers } from "hardhat";
import { parseUnits } from "@ethersproject/units";
import { NFT__factory } from "../typechain/factories/NFT__factory";
import { NFT } from "../typechain/NFT";
import { SignerWithAddress } from "@nomiclabs/hardhat-ethers/signers";
import keccak256 from "keccak256";
import { MerkleTree } from "merkletreejs";
import { create } from 'ipfs-http-client';
import { Bytes } from "ethers";

async function incrementNextBlockTimestamp(amount: number): Promise<void> {
  return ethers.provider.send("evm_increaseTime", [amount]);
}

describe('NFT contract', () => {
  let nft: NFT;
  let owner: SignerWithAddress;
  let addr1: SignerWithAddress;
  let addr2: SignerWithAddress;
  let addr3: SignerWithAddress;
  let fundingWallet: SignerWithAddress;
  let addrs: SignerWithAddress[];
  let deployTx: any;
  let merkleTree: MerkleTree;
  let rootHash: Bytes;
  let notWhiteListhexProof: string[];
  let whiteListhexProof: string[];

  const name = "My NFT";
  const symbol = "MN";
  const baseTokenURI = "ipfs://bafkreib7rk44lfgqzt6jfvma4khx6sgag6edmp4d2avt67flk5wueqfjc4/";
  const cid = "QmWp1eXWmaVXo4aQmWtf2EgTZppBwh1WgecP3PRujQAYez";
  const whitelistedUsersURI = "ipfs://".concat(cid);
  const zeroAddress = '0x0000000000000000000000000000000000000000';
  const maxSupply = 10005;
  const royaltyFee = 500;
  const feeDenominator = 10000;
  const ipfs = create({ url: "http://localhost:5001/api/v0" });

  beforeEach(async () => {
    [owner, addr1, addr2, addr3, fundingWallet, ...addrs] = await ethers.getSigners();

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

    merkleTree = new MerkleTree(whiteListLeafNodes, keccak256, { sortPairs: true });
    rootHash = merkleTree.getRoot();

    notWhiteListhexProof = merkleTree.getHexProof(keccak256(addr3.address));
    whiteListhexProof = merkleTree.getHexProof(keccak256(addr1.address));

    const blockNumBefore = await ethers.provider.getBlockNumber();
    const blockBefore = await ethers.provider.getBlock(blockNumBefore);
    const timestampBefore = blockBefore.timestamp;
    const deadline = timestampBefore + 86400;

    const Nft = (await ethers.getContractFactory('NFT')) as NFT__factory;
    nft = await Nft.deploy(name, symbol, baseTokenURI, whitelistedUsersURI, rootHash, fundingWallet.address, deadline);
    deployTx = await nft.deployed();
  });

  describe('initial values', async () => {
    it('should set token name', async () => {
      expect(name).to.be.equal(await nft.name());
    });

    it('should set token symbol', async () => {
      expect(symbol).to.be.equal(await nft.symbol());
    });

    it('should set base token URI', async () => {
      expect(symbol).to.be.equal(await nft.symbol());
    })

    it('should set funding wallet', async () => {
      expect(fundingWallet.address).to.equal(await nft.fundingWallet());
    })

    it('should set merkle root', async () => {
      expect(merkleTree.getHexRoot()).to.equal(await nft.merkleRoot());
    })

    it('should set circulating supply', async () => {
      expect(await nft.circulatingSupply()).to.equal(5);
    })

    it('should set circulating supply', async () => {
      for (let i = 10001; i <= 10005; i++) {
        const uri = await nft.tokenURI(i);

        expect(deployTx).to.emit(nft, "Bought").withArgs(i, owner.address, 0)
          .and.to.emit(nft, "PermanentURI").withArgs(uri, i);
      }
    })
  });

  describe('royalty', async () => {
    it('supports royalty', async () => {
      const eip2981Interface = "0x2a55205a";
      expect(await nft.supportsInterface(eip2981Interface)).to.be.true;
    })

    it('gets royalty info', async () => {
      const tokenId = 1;
      const tokenPrice = parseUnits("0.08", 18);
      const [receiver, royaltyAmount] = await nft.royaltyInfo(tokenId, tokenPrice);

      const expectedRoyalty = tokenPrice.mul(royaltyFee).div(feeDenominator);

      expect(receiver).to.equal(fundingWallet.address);
      expect(royaltyAmount).to.equal(expectedRoyalty);
    })
  })

  describe('sets merkle root', async () => {
    it('sets merkle root successfuly', async () => {
      const oldMerkleRoot = merkleTree.getHexRoot();
      const newCid = "Qmc98BNhdMSJNRSYQittfx5pr5PdRi31yhrNGfYgD87wBP";
      const newWhitelistedUsersURI = "ipfs://".concat(newCid);

      const chunks = [];

      for await (const chunk of ipfs.cat(newCid)) {
        chunks.push(chunk);
      }

      const raw = chunks.toString();
      const whitelistAddresses = JSON.parse(raw)["addresses"];

      const whiteListLeafNodes = [];

      for await (const whitelistAddress of whitelistAddresses) {
        whiteListLeafNodes.push(keccak256(whitelistAddress));
      }

      merkleTree = new MerkleTree(whiteListLeafNodes, keccak256, { sortPairs: true });

      await nft.setMerkleRoot(merkleTree.getRoot(), newWhitelistedUsersURI);

      expect(oldMerkleRoot).to.not.equal(await nft.merkleRoot());
      expect(merkleTree.getHexRoot()).to.equal(await nft.merkleRoot());
    })
  })

  describe('gets price', async () => {
    it('gets price for whitelisted user and deadline not finish', async () => {
      expect(await nft.priceFor(whiteListhexProof, addr1.address)).to.equal(parseUnits("0.06", 18));
    })

    it('gets price for !whitelisted user and deadline not finish', async () => {
      expect(await nft.priceFor(notWhiteListhexProof, addr3.address)).to.equal(parseUnits("0.06", 18));
    })

    it('gets price for whitelisted user and deadline finished', async () => {
      await incrementNextBlockTimestamp(86401);
      await ethers.provider.send("evm_mine", []);

      expect(await nft.priceFor(whiteListhexProof, addr1.address)).to.equal(parseUnits("0.06", 18));
    })

    it('gets price for !whitelisted user and deadline finished', async () => {
      await incrementNextBlockTimestamp(86401);
      await ethers.provider.send("evm_mine", []);

      expect(await nft.priceFor(notWhiteListhexProof, addr3.address)).to.equal(parseUnits("0.08", 18));
    })
  })

  describe('sets funding wallet', async () => {
    it('sets funding wallet successfully', async () => {

      const fundingWalletBefore = await nft.fundingWallet();

      await nft.setFundingWallet(addr3.address);

      const fundingWalletAfter = await nft.fundingWallet();

      expect(fundingWalletAfter).to.not.equal(fundingWalletBefore);
      expect(fundingWalletAfter).to.equal(addr3.address);
    })

    it('rejects setting while zero address', async () => {
      await expect(nft.setFundingWallet(zeroAddress)).to.be.revertedWith('NFT: wallet is zero address');
    })
  })

  describe('buys NFT by the token id', async () => {
    const tokenId = 1;

    it('buys NFT successfully', async () => {
      const addr1BalanceBefore = await ethers.provider.getBalance(addr1.address);
      const fundingWalletBalanceBefore = await ethers.provider.getBalance(fundingWallet.address);
      const circulatingSupplyBefore = await nft.circulatingSupply();

      const price = await nft.priceFor(whiteListhexProof, addr1.address);

      const tx = await nft.connect(addr1).buy(whiteListhexProof, tokenId, { value: price });

      const minedTx = await tx.wait();
      const fee = minedTx.gasUsed.mul(minedTx.effectiveGasPrice);
      const uri = await nft.tokenURI(tokenId);

      const addr1BalanceAfter = await ethers.provider.getBalance(addr1.address);
      const fundingWalletBalanceAfter = await ethers.provider.getBalance(fundingWallet.address);
      const circulatingSupplyAfter = await nft.circulatingSupply();

      expect(circulatingSupplyAfter).to.equal(circulatingSupplyBefore.add(1));
      expect(addr1BalanceAfter).to.equal(addr1BalanceBefore.sub(price).sub(fee));
      expect(fundingWalletBalanceAfter).to.equal(fundingWalletBalanceBefore.add(price));
      expect(tx).to.emit(nft, "Bought").withArgs(tokenId, addr1.address, price);
      expect(tx).to.emit(nft, "PermanentURI").withArgs(uri, tokenId);
    })

    it('rejects buying NFT while invalid value', async () => {
      await expect(nft.connect(addr1).buy(whiteListhexProof, tokenId, { value: parseUnits("0.2", 18) })).to.be.revertedWith('NFT: invalid value')
    })

    it('rejects buying NFT while token id less than 1', async () => {
      await expect(nft.connect(addr1).buy(whiteListhexProof, 0, { value: parseUnits("0.2", 18) })).to.be.revertedWith('NFT: token !exists')
    })

    it('rejects buying NFT while token id more than 10005', async () => {
      await expect(nft.connect(addr1).buy(whiteListhexProof, 10006, { value: parseUnits("0.2", 18) })).to.be.revertedWith('NFT: token !exists')
    })
  })

  describe('buys NFT by the token ids', async () => {
    it('buys NFT successfully', async () => {
      let tokenIds = [];

      for (let i = 0; i <= 1; i++) {
        tokenIds[i] = i + 1
      }

      const addr1BalanceBefore = await ethers.provider.getBalance(addr1.address);
      const fundingWalletBalanceBefore = await ethers.provider.getBalance(fundingWallet.address);
      const circulatingSupplyBefore = await nft.circulatingSupply();

      const price = (await nft.priceFor(whiteListhexProof, addr1.address)).mul((String(tokenIds.length)));

      const tx = await nft.connect(addr1).buyBulk(whiteListhexProof, tokenIds, { value: price });

      const minedTx = await tx.wait();
      const fee = minedTx.gasUsed.mul(minedTx.effectiveGasPrice);

      const addr1BalanceAfter = await ethers.provider.getBalance(addr1.address);
      const fundingWalletBalanceAfter = await ethers.provider.getBalance(fundingWallet.address);
      const circulatingSupplyAfter = await nft.circulatingSupply();

      expect(circulatingSupplyAfter).to.equal(circulatingSupplyBefore.add((String(tokenIds.length))));
      expect(addr1BalanceAfter).to.equal(addr1BalanceBefore.sub(price).sub(fee));
      expect(fundingWalletBalanceAfter).to.equal(fundingWalletBalanceBefore.add(price));

      for (let i = 0; i <= tokenIds.length - 1; i++) {
        const uri = await nft.tokenURI(tokenIds[i]);

        expect(tx).to.emit(nft, "Bought").withArgs(tokenIds[i], addr1.address, price);
        expect(tx).to.emit(nft, "PermanentURI").withArgs(uri, tokenIds[i]);
      }
    })

    it('rejects buying NFT while invalid value', async () => {
      let tokenIds = [];

      for (let i = 0; i <= 1; i++) {
        tokenIds[i] = i + 1
      }

      const price = (await nft.priceFor(whiteListhexProof, addr1.address));

      await expect(nft.connect(addr1).buyBulk(whiteListhexProof, tokenIds, { value: price })).to.be.revertedWith('NFT: invalid value')
    })

    it('rejects buying NFT while token id less than 1', async () => {
      const price = (await nft.priceFor(whiteListhexProof, addr1.address));

      await expect(nft.connect(addr1).buyBulk(whiteListhexProof, [parseUnits("0", 18)], { value: price })).to.be.revertedWith('NFT: token !exists')
    })

    it('rejects buying NFT while token id more than 10005', async () => {
      const price = (await nft.priceFor(whiteListhexProof, addr1.address));

      await expect(nft.connect(addr1).buyBulk(whiteListhexProof, [10006], { value: price })).to.be.revertedWith('NFT: token !exists')
    })
  })

  describe('gets token URI', async () => {
    it('gets token URI successfully', async () => {
      const tokenId = 1;

      const price = await nft.priceFor(whiteListhexProof, addr1.address);

      await nft.connect(addr1).buy(whiteListhexProof, tokenId, { value: price });

      expect(baseTokenURI + tokenId + ".json").to.equal(await nft.tokenURI(tokenId));
    })

    it('rejects nonexistent token', async () => {
      await expect(nft.tokenURI(parseUnits("1000", 18))).to.be.revertedWith('ERC721Metadata: token !exists');
    })
  })

  describe('checks token id on existence', async () => {
    const tokenId = 1;

    it('checks token id on existence if it is true', async () => {
      const price = await nft.priceFor(whiteListhexProof, addr1.address);

      await nft.connect(addr1).buy(whiteListhexProof, tokenId, { value: price });
      expect(await nft.exists(tokenId)).to.be.equal(true);
    })

    it('checks token id on existence if it is false', async () => {
      expect(await nft.exists(tokenId)).to.be.equal(false);
    })
  })

  describe('white lists', async () => {
    it('user not whitelisted', async () => {
      expect(await nft.isWhitelisted(whiteListhexProof, addr3.address)).to.equal(false);
    })

    it('user whitelisted', async () => {
      expect(await nft.isWhitelisted(whiteListhexProof, addr1.address)).to.equal(true);
    })
  })

  describe('gets token supply data', async () => {
    it('gets max supply', async () => {
      expect(await nft.maxSupply()).to.equal(maxSupply);
    })
  })
});
