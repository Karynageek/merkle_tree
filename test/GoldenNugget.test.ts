import { expect } from "chai";
import { ethers } from "hardhat";
import { parseUnits } from "@ethersproject/units";
import { GoldenNugget__factory } from "../typechain/factories/GoldenNugget__factory";
import { GoldenNugget } from "../typechain/GoldenNugget";
import { SignerWithAddress } from "@nomiclabs/hardhat-ethers/signers";

describe('Golden Nugget ERC-20 contract', () => {
  let GoldenNugget: GoldenNugget__factory;
  let goldenNugget: GoldenNugget;
  let owner: SignerWithAddress;
  let addr1: SignerWithAddress;
  let addr2: SignerWithAddress;
  let addrs: SignerWithAddress[];
  const zeroAddress = '0x0000000000000000000000000000000000000000';

  beforeEach(async () => {
    [owner, addr1, addr2, ...addrs] = await ethers.getSigners();

    GoldenNugget = (await ethers.getContractFactory('GoldenNugget')) as GoldenNugget__factory;
  });

  describe('initial values', async () => {
    it('should set roles (minter is set)', async () => {
      goldenNugget = await GoldenNugget.deploy(addr1.address);
      await goldenNugget.deployed();

      expect(await goldenNugget.hasRole(await goldenNugget.DEFAULT_ADMIN_ROLE(), owner.address)).to.equal(true);
      expect(await goldenNugget.hasRole(await goldenNugget.MINTER_ROLE(), addr1.address)).to.equal(true);
    })

    it('should set roles (minter is zero address)', async () => {
      goldenNugget = await GoldenNugget.deploy(zeroAddress);
      await goldenNugget.deployed();

      expect(await goldenNugget.hasRole(await goldenNugget.DEFAULT_ADMIN_ROLE(), owner.address)).to.equal(true);
      expect(await goldenNugget.hasRole(await goldenNugget.MINTER_ROLE(), zeroAddress)).to.equal(false);
    })
  });

  describe('mints', async () => {
    it('mints successfully', async () => {
      goldenNugget = await GoldenNugget.deploy(addr1.address);
      await goldenNugget.deployed();

      const addr2BalanceBefore = await goldenNugget.balanceOf(addr2.address);
      const totalSupplyeBefore = await goldenNugget.totalSupply();

      const amount = parseUnits("100", await goldenNugget.decimals());

      const result = await goldenNugget.connect(addr1).mint(addr2.address, amount);

      const addr2BalanceAfter = await goldenNugget.balanceOf(addr2.address);
      const totalSupplyeAfter = await goldenNugget.totalSupply();

      expect(addr2BalanceAfter).to.equal(addr2BalanceBefore.add(amount));
      expect(totalSupplyeAfter).to.equal(totalSupplyeBefore.add(amount));

      await expect(result).to.emit(goldenNugget, "Transfer")
        .withArgs(zeroAddress, addr2.address, amount);
    })

    it('rejects while not set minter', async () => {
      goldenNugget = await GoldenNugget.deploy(zeroAddress);
      await goldenNugget.deployed();

      const amount = parseUnits("100", await goldenNugget.decimals());

      await expect(goldenNugget.mint(addr1.address, amount)).to.be.reverted;
    })
  })
});
