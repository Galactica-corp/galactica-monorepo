import { buildEddsa } from 'circomlibjs';
import { panel, text, heading, divider } from '@metamask/snaps-ui';

import { ZKCertificate } from 'zkkyc';
import { ZkCert, ZkCertRequirements } from './types';

/**
 * Selects a ZkCert from the available ones.
 *
 * @param availableCerts - The available ZkCerts to select from.
 * @param req - The requirements for the ZkCert to select.
 */
export async function selectZkCert(
  availableCerts: ZkCert[],
  req: ZkCertRequirements,
): Promise<ZKCertificate> {
  if (availableCerts.length === 0) {
    throw new Error('No zkCerts available. Please import it first.');
  }

  const filteredCerts = availableCerts.filter((value) => {
    return value.zkCertStandard === req.zkCertStandard;
  });
  // TODO: filter out expired certs

  if (filteredCerts.length === 0) {
    throw new Error(
      `No zkCerts of standard ${req.zkCertStandard} available. Please import it first.`,
    );
  }

  let selected: ZkCert;

  if (filteredCerts.length === 1) {
    selected = filteredCerts[0];
  } else {
    // build selection dialog    
    const options = [];
    for (let i = 0; i < filteredCerts.length; i++) {
      const did = filteredCerts[i].did;
      options.push(panel([
        heading(`${i + 1}`),
        text(`${did.slice(0, 14)}...${did.slice(did.length - 4)}`),
      ]));
      options.push(divider());
    }

    const answer = await snap.request({
      method: 'snap_dialog',
      params: {
        type: 'Prompt',
        content: panel([
          ...options,
          text('Please enter the number of the zkCertificate:'),
        ]),
      },
    });
    // TODO: check if answer is a valid number
    // TODO: Handle cancel

    selected = filteredCerts[parseInt(answer as string) - 1];
  }

  const eddsa = await buildEddsa();
  const zkCert = new ZKCertificate(
    selected.holderCommitment,
    selected.zkCertStandard,
    eddsa,
    selected.randomSalt,
    selected.content,
    selected.providerData,
  );

  return zkCert;
}
