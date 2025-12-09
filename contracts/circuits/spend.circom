pragma circom 2.1.6;

include "circomlib/circuits/poseidon.circom";
include "./merkletree.circom";

template Spend(levels) {
    // Public inputs
    signal input root;          // Merkle tree root
    signal input nullifierHash; // Prevents double-spend
    signal input recipient;     // Payment recipient
    signal input amount;        // Payment amount

    // Private inputs
    signal input secret;        // Owner's secret
    signal input pathElements[levels]; // Merkle proof
    signal input pathIndices[levels];  // Merkle path

    // 1. Compute commitment
    // Commitment = Poseidon(secret, amount)
    component commitmentHasher = Poseidon(2);
    commitmentHasher.inputs[0] <== secret;
    commitmentHasher.inputs[1] <== amount;
    signal commitment <== commitmentHasher.out;

    // 2. Verify commitment exists in tree
    component tree = MerkleTreeChecker(levels);
    tree.leaf <== commitment;
    tree.root <== root;
    for (var i = 0; i < levels; i++) {
        tree.pathElements[i] <== pathElements[i];
        tree.pathIndices[i] <== pathIndices[i];
    }

    // 3. Compute nullifier
    // Nullifier = Poseidon(commitment, secret)
    // This ties the nullifier to the specific note (via commitment) and owner (via secret)
    // ensuring that:
    // a) The same note cannot be spent twice (nullifier will be same)
    // b) Only someone with the secret can generate the valid nullifier
    component nullifierHasher = Poseidon(2);
    nullifierHasher.inputs[0] <== commitment;
    nullifierHasher.inputs[1] <== secret;
    nullifierHash === nullifierHasher.out;
    
    // Constraint to ensure recipient is part of the proof (to prevent front-running/malleability)
    // We mix recipient into the signal by squaring it and multiplying by 0 (dummy constraint)
    // OR better, we can include it in a public input hash check if needed, 
    // but for this standard design, standard nullifier/commitment check is core.
    // Ideally, we'd sign the transaction key with the secret, but for this simplified version:
    signal recipientSquare;
    recipientSquare <== recipient * recipient;
}

// Tree depth of 20 allows for ~1 million leaves
component main {public [root, nullifierHash, recipient, amount]} = Spend(20);
