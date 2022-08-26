const { MerkleTree } = require('merkletreejs');
const keccak256 = require('keccak256');
const ipfsClient = require('ipfs-http-client')

async function generateRoot() {
  const uri = process.argv[2];
  const cid = process.argv[3];

  const ipfs = ipfsClient.create(uri)

  const chunks = [];

  for await (const chunk of ipfs.cat(cid, { pin: true, })) {
    chunks.push(chunk);
  }

  const notWhitelistAddresses = ["0x1DD85Fc6D1ea476c9Fd74e2f2346a1A69677F1D6"];

  const raw = chunks.toString();
  const whitelistAddresses = JSON.parse(raw)["addresses"];

  console.log("List of not whiteList users: ", notWhitelistAddresses);
  console.log("List of whiteList users: ", whitelistAddresses);

  const notWhiteListLeafNodes = notWhitelistAddresses.map(addr => keccak256(addr));
  const whiteListLeafNodes = whitelistAddresses.map(addr => keccak256(addr));

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

}

async function run() {
  generateRoot()
}

run()

//node scripts\generate-root-hash.js http://localhost:5001/api/v0 Qmc98BNhdMSJNRSYQittfx5pr5PdRi31yhrNGfYgD87wBP
//node [path to script] <host URL> <CID>

//npx hardhat generate-root-hash --uri http://localhost:5001/api/v0 --cid Qmc98BNhdMSJNRSYQittfx5pr5PdRi31yhrNGfYgD87wBP
