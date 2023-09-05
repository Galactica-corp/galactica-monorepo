import {
  GenZkKycProofParams,
  genZkKycProofSchema,
  GenZkKycProofError,
} from '@galactica-net/core';
import { SnapsGlobalObject } from '@metamask/rpc-methods';
import { MethodReturnType } from '@metamask/rpc-methods/dist/request';
import { divider, heading, panel, text } from '@metamask/snaps-ui';

import { getState } from '../../stateManagement';
import { RpcArgs } from '../../types';
import { selectZkCert } from '../../zkCertSelector';
import { generateProof } from './generateProof';

export const genZkKycProof = async (
  snap: SnapsGlobalObject,
  { request, origin }: RpcArgs,
) => {
  // parse ZKP inputs
  const requestParams = request.params;

  if (!requestParams) {
    // TODO: handle this error
    return new GenZkKycProofError({
      name: 'MissingInputParams',
      message: 'Parameters are required',
    });
  }
  // check some input validity
  let params: GenZkKycProofParams;
  try {
    params = genZkKycProofSchema.parse(requestParams);
  } catch (error) {
    // TODO: handle this error
    return error;
  }

  // if (genParams.userAddress === undefined) {
  //   return new GenZKPError({
  //     name: 'MissingInputParams',
  //     message: `userAddress missing in request parameters.`,
  //     cause: request,
  //   });
  // }
  // if (genParams.requirements.zkCertStandard === undefined) {
  //   return new GenZKPError({
  //     name: 'MissingInputParams',
  //     message: `ZkCert standard missing in request parameters.`,
  //     cause: request,
  //   });
  // }

  const proofConfirmDialog = [
    heading('Generating zkCertificate Proof'),
    text(
      `With this action you will create a ${params.requirements.zkCertStandard.toUpperCase()} proof for Galactica.com.
       This action tests whether your personal data fulfills the requirements of the proof.`,
    ),
    divider(),
  ];

  // Description of disclosures made by the proof have to be provided by the front-end because the snap can not analyze what the prover will do.
  if (params.disclosureDescription) {
    proofConfirmDialog.push(
      text(`Further description of disclosures:`),
      text(params.disclosureDescription),
      text(
        `(Description provided by ${origin}. The snap can not verify if the prover actually meets those disclosures.)`,
      ),
    );
  } else {
    proofConfirmDialog.push(
      text(`No further description of disclosures provided by ${origin}.`),
    );
  }

  // Generalize disclosure of inputs to any kind of inputs
  proofConfirmDialog.push(
    divider(),
    text(`The following proof parameters will be publicly visible:`),
  );

  Object.entries(params.input).forEach(([parameter, value]) => {
    proofConfirmDialog.push(
      text(`${parameter}: ${JSON.stringify(value, null, 2)}`),
    );
  });

  let confirm: Awaited<MethodReturnType<'snap_dialog'>> = null;
  try {
    confirm = await snap.request({
      method: 'snap_dialog',
      params: {
        type: 'confirmation',
        content: panel(proofConfirmDialog),
      },
    });
  } catch (error) {
    // TODO: handle this error
    console.error(error);
  }

  if (!confirm) {
    throw new GenZkKycProofError({
      name: 'RejectedConfirm',
      message: 'User rejected confirmation.',
    });
  }

  const state = await getState(snap);

  const zkCert = await selectZkCert(
    snap,
    state.zkCerts,
    params.requirements.zkCertStandard,
  );

  const searchedHolder = state.holders.find(
    (candidate) => candidate.holderCommitment === zkCert.holderCommitment,
  );
  if (searchedHolder === undefined) {
    throw new GenZkKycProofError({
      name: 'MissingHolder',
      message: `Holder for commitment ${zkCert.holderCommitment} could not be found. Please use Metamask with the same mnemonic as when you created this holder commitment.`,
      cause: request,
    });
  }

  const searchedZkCert = state.zkCerts.find(
    (cert) => cert.leafHash === zkCert.leafHash,
  );

  if (searchedZkCert === undefined) {
    throw new Error(
      `zkCert with leafHash ${zkCert.leafHash} could not be found.`,
    );
  }

  const proof = await generateProof(
    params,
    zkCert,
    searchedHolder,
    searchedZkCert.merkleProof,
  );

  return proof;
};
