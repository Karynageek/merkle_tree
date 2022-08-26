//SPDX-License-Identifier: MIT
pragma solidity 0.8.16;

import "./GoldenNugget.sol";
import "./interface/ITokenSupplyData.sol";
import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/token/ERC721/IERC721.sol";
import "@openzeppelin/contracts/token/ERC721/IERC721Receiver.sol";
import "@openzeppelin/contracts/access/AccessControl.sol";

contract Staking is IERC721Receiver, AccessControl {
    GoldenNugget public goldenNugget;

    mapping(address => mapping(uint256 => address)) public tokenOwner;
    mapping(address => Stake) public stakeInfo;
    mapping(address => Nft) public nftInfo;

    enum Status {
        NOT_ACTIVE,
        ACTIVE,
        WAIT
    }

    struct Stake {
        uint128 tokenCount;
        uint128 startDate;
    }

    struct Nft {
        uint8 percentageThreshold;
        uint8 status;
    }

    event NftAdded(address indexed _nftContract);

    event Claim(address indexed _user, uint256 _payoutAmount);

    event ERC721Received(
        uint256 indexed _nftId,
        address indexed _nftContract,
        address _from
    );

    event Withdraw(
        uint256 indexed _nftId,
        address indexed _nftContract,
        address _to
    );

    constructor(GoldenNugget goldenNugget_) {
        goldenNugget = goldenNugget_;
        _grantRole(DEFAULT_ADMIN_ROLE, msg.sender);
    }

    /**
     * @notice Checks if nft is transferred to a contract.
     * @param _from The user address.
     * @param _tokenId The token id of collection.
     * @return Selector to confirm the token transfer.
     */
    function onERC721Received(
        address,
        address _from,
        uint256 _tokenId,
        bytes calldata
    ) external virtual override returns (bytes4) {
        Nft storage nft = nftInfo[msg.sender];

        // Updates the status to active if percentage threshold is reached.
        if (nft.status == uint8(Status.WAIT)) {
            if (isReachedThreshold(msg.sender, nft.percentageThreshold)) {
                nft.status = uint8(Status.ACTIVE);
            }
        }

        require(nft.status == uint8(Status.ACTIVE), "Staking: not started");
        // Payout of tokens for staking.
        _claim(_from);

        Stake storage stake = stakeInfo[_from];
        // Increases the number of staked tokens.
        stake.tokenCount++;
        stake.startDate = uint128(block.timestamp);

        tokenOwner[msg.sender][_tokenId] = _from;

        emit ERC721Received(_tokenId, msg.sender, _from);

        return this.onERC721Received.selector;
    }

    /**
     * @notice Registers NFT contract and sets circulating supply percentage threshold when staking becomes active.
     * @param _nft The nft contract.
     * @param _percentageThreshold The percentage threshold.
     */
    function addNFT(address _nft, uint8 _percentageThreshold)
        external
        onlyRole(DEFAULT_ADMIN_ROLE)
    {
        require(
            nftInfo[_nft].status == uint8(Status.NOT_ACTIVE),
            "Staking: already added"
        );

        // Staking should only start when circulating supply percentage is above percentage threshold.
        nftInfo[_nft].status = isReachedThreshold(_nft, _percentageThreshold)
            ? uint8(Status.ACTIVE)
            : uint8(Status.WAIT);

        nftInfo[_nft].percentageThreshold = _percentageThreshold;

        emit NftAdded(_nft);
    }

    /**
     * @notice Gives the user the ability to earn tokens from staking.
     */
    function claim() external {
        _claim(msg.sender);
    }

    /**
     * @notice Gives the user the ability to earn Golden Nugget tokens from staking.
     * @param _nftId The token id of collection nft.
     * @param _nft The nft contract.
     */
    function withdrawNft(uint256 _nftId, address _nft) external {
        require(
            tokenOwner[_nft][_nftId] == msg.sender,
            "Staking: not owner NFT"
        );

        // Payout of tokens for staking.
        _claim(msg.sender);
        // Decreases the number of staked tokens.
        stakeInfo[msg.sender].tokenCount--;

        delete tokenOwner[_nft][_nftId];

        // Transfers token by id from staking contract to owner nft.
        IERC721(_nft).safeTransferFrom(address(this), msg.sender, _nftId);

        emit Withdraw(_nftId, _nft, msg.sender);
    }

    /**
     * @notice Checks if staking for specified collection is available.
     * @param _nft The nft contract.
     * @return Status if staking is available or not.
     */
    function isActive(address _nft) external view returns (bool) {
        Nft memory nft = nftInfo[_nft];
        uint8 status = nft.status;

        // Percentage threshold is already reached.
        if (status == uint8(Status.ACTIVE)) {
            return true;
        }

        // NFT contract doesn't register.
        if (status == uint8(Status.NOT_ACTIVE)) {
            return false;
        }

        return isReachedThreshold(_nft, nft.percentageThreshold);
    }

    /**
     * @notice Checks if percentage threshold is reached or not.
     * @param _nft The nft contract.
     * @return Status if threshold is reached or not.
     */
    function isReachedThreshold(address _nft, uint8 _percentage)
        private
        view
        returns (bool)
    {
        ITokenSupplyData token = ITokenSupplyData(_nft);

        return
            (token.circulatingSupply() * 100) / token.maxSupply() >=
            _percentage;
    }

    /**
     * @notice Gives the user the ability to earn tokens from staking.
     * @param _to The user address.
     */
    function _claim(address _to) private {
        Stake storage stake = stakeInfo[_to];
        uint128 startDate = stake.startDate;

        if (startDate == 0) {
            return;
        }
        // Returns available amount of Golden Nuggets to claim.
        uint256 payoutAmount = (block.timestamp - startDate) *
            stake.tokenCount *
            1653439153935; /// 10**18/60*60*24*7.

        // Updates the start date for the next payout calculation.
        stake.startDate = uint128(block.timestamp);
        // Payout of tokens for staking.
        goldenNugget.mint(_to, payoutAmount);

        emit Claim(_to, payoutAmount);
    }
}
