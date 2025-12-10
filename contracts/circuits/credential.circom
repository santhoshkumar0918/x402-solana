pragma circom 2.1.6;

include "circomlib/circuits/eddsaposeidon.circom";
include "circomlib/circuits/poseidon.circom";
include "circomlib/circuits/comparators.circom";

template CredentialVerification() {
    // Public inputs
    signal input issuerPubKey[2]; // Trusted issuer public key (Ax, Ay)
    signal input credentialType;  // Type of credential (e.g., specific ID or hash)
    signal input currentTimestamp; // Current timestamp for expiry check

    // Private inputs
    signal input R8x;            // EdDSA signature R point x-coordinate
    signal input R8y;            // EdDSA signature R point y-coordinate  
    signal input S;              // EdDSA signature S value
    signal input userAttribute;  // User attribute (hidden)
    signal input expiryTime;     // Credential expiry timestamp (hidden)

    // Verify EdDSA signature
    // This proves that `userAttribute` was signed by `issuerPubKey`
    component verifier = EdDSAPoseidonVerifier();
    verifier.enabled <== 1;
    verifier.Ax <== issuerPubKey[0];
    verifier.Ay <== issuerPubKey[1];
    verifier.S <== S;
    verifier.R8x <== R8x;
    verifier.R8y <== R8y;
    verifier.M <== userAttribute;

    // Check credential has not expired
    // Ensure currentTimestamp <= expiryTime
    component lessThan = LessThan(64); // Support timestamps up to 2^64
    lessThan.in[0] <== currentTimestamp;
    lessThan.in[1] <== expiryTime + 1; // +1 to make it <=
    lessThan.out === 1;

    // Prove attribute matches credential type
    // The credential type should be derivable from the user attribute
    // This allows proving "I have a valid signed attribute of this type" 
    // without revealing the actual attribute value
    component typeHasher = Poseidon(1);
    typeHasher.inputs[0] <== userAttribute;
    credentialType === typeHasher.out;
}

component main {public [issuerPubKey, credentialType, currentTimestamp]} = CredentialVerification();
