# Verifier Wrappers

This folder contains mid level zero-knowledge proof verifiers.

They wrap the [low level circom verifiers](../zkpVerifiers/README.md) and extend them with consistency checks between the public proof inputs and disclosures against the on-chain state, such as Merkle roots and the current timestamp.

These verifier wrappers can then be included in the DApp.
