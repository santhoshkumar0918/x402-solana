# ZK Circuit Setup & Solana Usage Guide

## 1. compilation

The circuits have been successfully compiled to R1CS and WASM.

- **R1CS**: Contains the constraint system (used for setup and proving).
- **WASM**: Used to generate the witness (private inputs) on the client side.

Artifacts location: `contracts/circuits/`

## 2. Trusted Setup (Key Generation)

To generate the **Verification Key** required by the Solana program, you must perform a "Trusted Setup".
_Note: Run these commands in `contracts/circuits/`._

### Phase 1: Powers of Tau

This is generic for all circuits.

```bash
npx snarkjs powersoftau new bn128 12 pot12_0000.ptau -v
npx snarkjs powersoftau contribute pot12_0000.ptau pot12_0001.ptau --name="First contribution" -v
npx snarkjs powersoftau prepare phase2 pot12_0001.ptau pot12_final.ptau -v
```

### Phase 2: Circuit-Specific Setup

**For Spend Circuit:**

```bash
# Generate zkey (Proving Key)
npx snarkjs groth16 setup spend.r1cs pot12_final.ptau spend_0000.zkey
npx snarkjs zkey contribute spend_0000.zkey spend_0001.zkey --name="Contributor" -v

# Export Verification Key (for Solana)
npx snarkjs zkey export verificationkey spend_0001.zkey verification_key_spend.json
```

**For Credential Circuit:**

```bash
npx snarkjs groth16 setup credential.r1cs pot12_final.ptau credential_0000.zkey
npx snarkjs zkey contribute credential_0000.zkey credential_0001.zkey --name="Contributor" -v
npx snarkjs zkey export verificationkey credential_0001.zkey verification_key_credential.json
```

## 3. Solana Usage

### Off-Chain (Client/AI Agent)

Use `snarkjs` (or a client-side library) to generate the proof:

```javascript
const { proof, publicSignals } = await snarkjs.groth16.fullProve(
  input,
  "spend.wasm",
  "spend_0001.zkey"
);
```

### On-Chain (Solana Program)

The Solana program needs to verify the proof using the data from `verification_key_*.json`.

1.  **Extract Key Data**: The JSON contains `vk_alpha_1`, `vk_beta_2`, `vk_gamma_2`, `vk_delta_2`, and `IC`.
2.  **Solana Verifier**: Use a Rust crate like `groth16-solana` or implement a verifier using the `alt_bn128_syscall`.
3.  **Instruction**: Create an instruction that accepts the `proof` (A, B, C points) and `publicSignals`.
4.  **Verification**:
    ```rust
    // Pseudo-code for verifier instruction
    pub fn verify_proof(ctx: Context<Verify>, proof: Proof, public_inputs: [u8; 32]) -> Result<()> {
        // Load verification key (hardcoded or from account)
        let vk = load_verification_key();

        // Call alt_bn128 syscalls to verify pairing:
        // e(A, B) == e(alpha, beta) * e(inputs, gamma) * e(C, delta)

        solana_program::alt_bn128::precompile_verify(&proof, &public_inputs, &vk)?;
        Ok(())
    }
    ```
