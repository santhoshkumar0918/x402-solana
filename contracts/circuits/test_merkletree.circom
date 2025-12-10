pragma circom 2.0.0;

include "./merkletree.circom";

// Standalone circuit for testing merkle tree verification
component main {public [root]} = MerkleTreeChecker(20);