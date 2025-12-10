pragma circom 2.1.6;

include "circomlib/circuits/poseidon.circom";
include "./merkletree.circom";

template Spend(levels) {
    // Public inputs
    signal input root;          // Merkle tree root
    signal input nullifierHash; // Prevents double-spend
    signal input recipient;     // Payment recipient
    signal input amount;        // Payment amount
    signal input externalNullifier; // External nullifier for app separation

    // Private inputs
    signal input secret;        // Owner's secret
    signal input randomness;    // Randomness for commitment
    signal input pathElements[levels]; // Merkle proof
    signal input pathIndices[levels];  // Merkle path

    // 1. Compute commitment
    // Commitment = Poseidon(secret, amount, randomness)
    component commitmentHasher = Poseidon(3);
    commitmentHasher.inputs[0] <== secret;
    commitmentHasher.inputs[1] <== amount;
    commitmentHasher.inputs[2] <== randomness;
    signal commitment <== commitmentHasher.out;

    // 2. Verify commitment exists in tree
    component tree = MerkleTreeChecker(levels);
    tree.leaf <== commitment;
    tree.root <== root;
    for (var i = 0; i < levels; i++) {
        tree.pathElements[i] <== pathElements[i];
        tree.pathIndices[i] <== pathIndices[i];
    }

    // 3. Compute nullifier with recipient and external nullifier binding
    // Nullifier = Poseidon(commitment, secret, recipient, externalNullifier)
    // This ensures:
    // a) The same note cannot be spent twice (commitment uniqueness)
    // b) Only someone with the secret can generate valid nullifier
    // c) Nullifier is bound to specific recipient (prevents front-running)
    // d) External nullifier prevents cross-application replay attacks
    component nullifierHasher = Poseidon(4);
    nullifierHasher.inputs[0] <== commitment;
    nullifierHasher.inputs[1] <== secret;
    nullifierHasher.inputs[2] <== recipient;
    nullifierHasher.inputs[3] <== externalNullifier;
    nullifierHash === nullifierHasher.out;
}

// Tree depth of 20 allows for ~1 million leaves
component main {public [root, nullifierHash, recipient, amount, externalNullifier]} = Spend(20);
