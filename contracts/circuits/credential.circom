pragma circom 2.1.6;

include "circomlib/circuits/eddsaposeidon.circom";
include "circomlib/circuits/poseidon.circom";

template CredentialVerification() {
    // Public inputs
    signal input issuerPubKey[2]; // Trusted issuer public key (Ax, Ay)
    signal input credentialType;  // Type of credential (e.g., specific ID or hash)

    // Private inputs
    signal input signatureRP; // Signature R.x 
    signal input signatureR8; // Signature R.y
    signal input signatureS;  // Signature S
    signal input userAttribute;   // User attribute (hidden)

    // Verify EdDSA signature
    // This proves that `userAttribute` was signed by `issuerPubKey`
    component verifier = EdDSAPoseidonVerifier();
    verifier.enabled <== 1;
    verifier.Ax <== issuerPubKey[0];
    verifier.Ay <== issuerPubKey[1];
    verifier.S <== signatureS;
    verifier.R8x <== signatureRP;
    verifier.R8y <== signatureR8;
    verifier.M <== userAttribute;

    // Prove attribute matches credential type
    // In a real scenario, this might involve a range check or set membership.
    // Here we prove that the attribute hashes to the required type ID 
    // OR we can just check if the attribute *is* the type (simplified).
    // Let's assume userAttribute is a hash of the raw data, and credentialType 
    // is a category identifier derived from it.
    
    // For this implementation, we'll verify the attribute hashes to the credentialType 
    // (This allows revealing the "Type" without revealing the "Attribute" if they are linked this way, 
    // or simply ensuring the attribute IS of a certain expected class if the signature covers (type, attribute)).
    
    // Simplified logic: Check if userAttribute (private) hashes to credentialType (public)
    // This allows the user to prove "I have a valid signed attribute that corresponds to this public type"
    component typeHasher = Poseidon(1);
    typeHasher.inputs[0] <== userAttribute;
    credentialType === typeHasher.out;
}

component main {public [issuerPubKey, credentialType]} = CredentialVerification();
