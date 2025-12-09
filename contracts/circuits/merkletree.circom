pragma circom 2.0.0;

include "circomlib/circuits/poseidon.circom";

// Computes Poseidon([left, right])
template HashLeftRight() {
    signal input left;
    signal input right;
    signal output hash;

    component hasher = Poseidon(2);
    hasher.inputs[0] <== left;
    hasher.inputs[1] <== right;
    hash <== hasher.out;
}

// Check if Merkle proof is valid
template MerkleTreeChecker(levels) {
    signal input leaf;
    signal input root;
    signal input pathElements[levels];
    signal input pathIndices[levels];

    component hashers[levels];
    
    // Intermediate hashes
    signal currentHash[levels + 1];
    currentHash[0] <== leaf;

    signal left[levels];
    signal right[levels];

    for (var i = 0; i < levels; i++) {
        // Enforce pathIndices[i] is 0 or 1
        pathIndices[i] * (1 - pathIndices[i]) === 0;

        // Calculate left/right based on index
        left[i] <== (pathElements[i] - currentHash[i]) * pathIndices[i] + currentHash[i];
        right[i] <== (currentHash[i] - pathElements[i]) * pathIndices[i] + pathElements[i];

        hashers[i] = HashLeftRight();
        hashers[i].left <== left[i];
        hashers[i].right <== right[i];

        currentHash[i + 1] <== hashers[i].hash;
    }

    root === currentHash[levels];
}
