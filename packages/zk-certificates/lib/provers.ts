/*
 * Copyright (C) 2025 Galactica Network. This file is part of zkKYC. zkKYC is free software: you can redistribute it and/or modify it under the terms of the GNU General Public License as published by the Free Software Foundation, either version 3 of the License, or (at your option) any later version. zkKYC is distributed in the hope that it will be useful, but WITHOUT ANY WARRANTY; without even the implied warranty of MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE. See the GNU General Public License for more details. You should have received a copy of the GNU General Public License along with this program. If not, see <https://www.gnu.org/licenses/>.
 */

import type {
  FieldElement,
  EddsaPrivateKey,
  MerkleProof,
} from '@galactica-net/galactica-types';
import { groth16 } from 'snarkjs';

import type {
  GenZkProofParams,
  ProverData,
  ProverLink,
  ZkCertProof,
} from './proofs';
import {
  fetchProverData,
  prepareZkCertProofInputs,
  preprocessProver,
} from './proofs';
import type { ZkCertificate } from './zkCertificate';

/**
 * Prover is a lightweight wrapper around preprocessed proving artifacts for zk‑certificates.
 *
 * It encapsulates the prover data (WASM + proving key) and exposes a typed API to
 * generate a zk proof for a given zk certificate and set of parameters.
 *
 * @template Params - Shape of inputs expected by the prover.
 * @template Content - Shape of the zk certificate content.
 */
export class Prover<
  Params extends Record<string, FieldElement | FieldElement[]>,
  Content extends Record<string, unknown>,
> {
  /**
   * Represents the data structure for the prover.
   * It is used to store and manage the information related to proof generation and verification processes.
   */
  readonly #data: ProverData;

  /**
   * Constructs a Prover with already preprocessed prover data.
   * Use {@link Prover.new} to create an instance from either raw data or a link.
   *
   * @param data Preprocessed prover artifacts ready for proof generation.
   */
  constructor(data: ProverData) {
    this.#data = data;
  }

  /**
   * Factory that creates and preprocesses a Prover instance from either
   * in-memory artifacts (ProverData) or a remote link (ProverLink).
   *
   * When a ProverLink is provided, the artifacts are fetched and validated,
   * then preprocessed for efficient proof generation.
   *
   * @template Params - Shape of inputs expected by the prover.
   * @template Content - Shape of the zk certificate content.
   * @param proverOrLink Either the prover artifacts or a link containing a URL to them.
   * @returns A ready-to-use Prover instance with preprocessed artifacts.
   * @throws Error if a ProverLink without a URL is provided.
   */
  static async new<
    Params extends Record<string, FieldElement | FieldElement[] | FieldElement[][]>,
    Content extends Record<string, unknown>,
  >(proverOrLink: ProverData | ProverLink) {
    let prover: ProverData;
    if ('wasm' in proverOrLink) {
      prover = proverOrLink;
    } else {
      if (!('url' in proverOrLink)) {
        throw new Error('ProverLink does not contain a URL.');
      }

      prover = await fetchProverData(proverOrLink);
    }

    return new Prover<Params, Content>(await preprocessProver(prover));
  }

  /**
   * Generates a zk certificate proof using the provided parameters, certificate,
   * holder's EdDSA key, and Merkle proof.
   *
   * Internally, this prepares the circuit inputs via prepareZkCertProofInputs
   * and then invokes generateProof with the preprocessed prover.
   *
   * @param params Parameters driving proof generation, including the prover reference.
   * @param zkCert The zk certificate instance containing the statement content.
   * @param holderEddsaKey The holder's EdDSA private key used for signing within the circuit.
   * @param merkleProof The membership proof for the certificate commitment.
   * @returns A ZkCertProof ready for on-chain/off-chain verification.
   */
  async generateProof(
    params: GenZkProofParams<Params>,
    zkCert: ZkCertificate<Content>,
    holderEddsaKey: EddsaPrivateKey,
    merkleProof: MerkleProof,
  ): Promise<ZkCertProof> {
    const inputs = await prepareZkCertProofInputs(
      params,
      zkCert,
      holderEddsaKey,
      merkleProof,
    );

    const { proof, publicSignals } = await groth16.fullProveMemory(
      inputs,
      this.#data.wasm,
      this.#data.zkeyHeader,
      this.#data.zkeySections,
    );

    return { proof, publicSignals };
  }
}
