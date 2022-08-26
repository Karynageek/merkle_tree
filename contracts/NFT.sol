// SPDX-License-Identifier: MIT
pragma solidity 0.8.16;

import "./interface/ITokenSupplyData.sol";
import "@openzeppelin/contracts/token/ERC721/extensions/ERC721Royalty.sol";
import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/utils/cryptography/MerkleProof.sol";

contract NFT is ERC721Royalty, Ownable, ITokenSupplyData {
    using Address for address payable;
    using MerkleProof for bytes32[];

    uint64 public constant DISCOUNT_PRICE = 60000000000000000;
    uint64 public constant BASE_PRICE = 80000000000000000;
    uint16 private constant MAX_SUPPLY = 10005;

    address public fundingWallet;
    uint32 public deadline;
    uint16 private totalSupply = 0;
    string public baseTokenURI;
    string public whitelistedUsersURI;
    bytes32 public merkleRoot;

    event PermanentURI(string _value, uint256 indexed _id);
    event AddedToWhitelist(address[] _users);
    event RemovedFromWhitelist(address[] _users);
    event Bought(
        uint16 indexed _tokenId,
        address indexed _buyer,
        uint64 _price
    );

    constructor(
        string memory name_,
        string memory symbol_,
        string memory baseTokenURI_,
        string memory whitelistedUsersURI_,
        bytes32 _root,
        address fundingWallet_,
        uint32 deadline_
    ) ERC721(name_, symbol_) {
        baseTokenURI = baseTokenURI_;
        whitelistedUsersURI = whitelistedUsersURI_;
        merkleRoot = _root;
        fundingWallet = fundingWallet_;
        deadline = deadline_;

        _setDefaultRoyalty(fundingWallet_, 500);

        for (uint16 i = 10001; i <= 10005; i++) {
            // Mints token id of collection nft.
            _safeMint(msg.sender, i);

            emit Bought(i, msg.sender, 0);
            emit PermanentURI(tokenURI(i), i);
        }
        // Increase the total supply of purchases.
        totalSupply = 5;
    }

    /**
     * @notice Sets merkle root and ipfs uri for whitelisted users.
     * @param _root The merkle root.
     * @param _whitelistedUsersURI The ipfs uri for whitelisted users.
     */
    function setMerkleRoot(bytes32 _root, string memory _whitelistedUsersURI)
        external
        onlyOwner
    {
        merkleRoot = _root;
        whitelistedUsersURI = _whitelistedUsersURI;
    }

    /**
     * @notice Returns the purchase price for the user.
     * @param _proof The proof for checking address in merkle tree.
     * @param _user The user address.
     * @return Price for the user.
     */
    function priceFor(bytes32[] calldata _proof, address _user)
        public
        view
        returns (uint64)
    {
        // Before deadline any user should be able to buy NFT at a discount.
        // After deadline any whitelisted user should able to buy NFT at a
        // discount, no matter what time it is. But any non-whitelisted user
        // should be able to buy NFT at the base price.
        if (block.timestamp < deadline || _isWhitelisted(_proof, _user)) {
            return DISCOUNT_PRICE;
        }

        return BASE_PRICE;
    }

    /**
     * @notice Buys NFT by the token id.
     * @param _proof The proof for checking address in merkle tree.
     * @param _tokenId The token id of collection nft.
     */
    function buy(bytes32[] calldata _proof, uint16 _tokenId) external payable {
        // Limits of collection nft.
        require(_tokenId >= 1 && _tokenId <= MAX_SUPPLY, "NFT: token !exists");

        uint64 price = priceFor(_proof, msg.sender);
        require(msg.value == price, "NFT: invalid value");
        // Transfers a payment from a user to a funding wallet.
        payable(fundingWallet).sendValue(msg.value);
        // Mints token id of collection nft by user.
        _safeMint(msg.sender, _tokenId);
        // Increases the total supply of purchases.
        totalSupply++;

        emit Bought(_tokenId, msg.sender, price);
        emit PermanentURI(tokenURI(_tokenId), _tokenId);
    }

    /**
     * @notice Buys NFT by the token ids.
     * @param _proof The proof for checking address in merkle tree.
     * @param _tokenIds The array of token ids of collection nft.
     */
    function buyBulk(bytes32[] calldata _proof, uint16[] calldata _tokenIds)
        external
        payable
    {
        uint64 price = priceFor(_proof, msg.sender);
        uint16 length = uint16(_tokenIds.length);
        require(msg.value == price * length, "NFT: invalid value");
        payable(fundingWallet).sendValue(msg.value);

        for (uint16 i = 0; i < length; i++) {
            uint16 _tokenId = _tokenIds[i];
            require(
                _tokenId >= 1 && _tokenId <= MAX_SUPPLY,
                "NFT: token !exists"
            );

            // Mints token id of collection nft by user.
            _safeMint(msg.sender, _tokenId);

            emit Bought(_tokenId, msg.sender, price);
            emit PermanentURI(tokenURI(_tokenId), _tokenId);
        }
        // Increases the total supply of purchases.
        totalSupply += length;
    }

    /**
     * @notice Sets a funding wallet to receive payments from users' purchases.
     * @param _fundingWallet The user address.
     */
    function setFundingWallet(address _fundingWallet) external onlyOwner {
        require(_fundingWallet != address(0), "NFT: wallet is zero address");
        fundingWallet = _fundingWallet;
    }

    /**
     * @notice Returns the token uri by id.
     * @param _tokenId The token id of collection.
     * @return tokenURI.
     */
    function tokenURI(uint256 _tokenId)
        public
        view
        override
        returns (string memory)
    {
        require(_exists(_tokenId), "ERC721Metadata: token !exists");

        return
            string(
                abi.encodePacked(
                    baseTokenURI,
                    Strings.toString(_tokenId),
                    ".json"
                )
            );
    }

    /**
     * @notice Checks token id on existence.
     * @param _tokenId The token id of collection nft.
     * @return Status if token id is exist or not.
     */
    function exists(uint256 _tokenId) external view returns (bool) {
        return _exists(_tokenId);
    }

    /**
     * @notice Checks the user's address for the fact that it is whitelisted or not.
     * @param _proof The proof for checking address in merkle tree.
     * @param _user The user address.
     * @return Status if user's address is whitelisted or not.
     */
    function isWhitelisted(bytes32[] calldata _proof, address _user)
        external
        view
        returns (bool)
    {
        return _isWhitelisted(_proof, _user);
    }

    function _isWhitelisted(bytes32[] calldata _proof, address _user)
        internal
        view
        returns (bool)
    {
        return
            MerkleProof.verifyCalldata(
                _proof,
                merkleRoot,
                keccak256(abi.encodePacked(_user))
            );
    }

    /**
     * @notice Returns maximum amount of tokens available to buy on this contract.
     * @return Max supply of tokens.
     */
    function maxSupply() external pure override returns (uint256) {
        return MAX_SUPPLY;
    }

    /**
     * @notice Returns amount of tokens that are minted and sold.
     * @return Circulating supply of tokens.
     */
    function circulatingSupply() external view override returns (uint256) {
        return totalSupply;
    }
}
