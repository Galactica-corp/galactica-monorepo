import { buildEddsa } from 'circomlibjs';
import { SnapsGlobalObject } from '@metamask/snaps-types';
import { panel, text, heading, divider } from '@metamask/snaps-ui';


import { ZKCertificate } from 'zkkyc';
import { ZkCert, ZkCertRequirements } from './types';
import { RpcResponseErr } from './rpcEnums';

/**
 * Selects a ZkCert from the available ones.
 *
 * @param snap - The snap for interaction with Metamask.
 * @param availableCerts - The available ZkCerts to select from.
 * @param req - The requirements for the ZkCert to select.
 */
export async function selectZkCert(
  snap: SnapsGlobalObject,
  availableCerts: ZkCert[],
  req: ZkCertRequirements,
): Promise<ZKCertificate> {
  if (availableCerts.length === 0) {
    throw new Error('No zkCerts available. Please import it first.');
  }

  const filteredCerts = availableCerts.filter((value) => {
    return value.zkCertStandard === req.zkCertStandard // same zkCert Standard
      // not expired (if expirationDate is set)
      && (value.content["expirationDate"] === undefined || value.content["expirationDate"] >= Date.now() / 1000);
  });

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

      let zkCertDisplay = [
        text(`**${i + 1}**: ${did.slice(0, 14)}...${did.slice(did.length - 4)}`),
      ];

      // custom information to display depnding on the type of zkCert
      // TODO: use more dynamic approach (e.g. let the request define what information to display)
      if (req.zkCertStandard === 'gip69') {
        const expirationDate = new Date(filteredCerts[i].content['expirationDate'] * 1000);
        zkCertDisplay.push(text(`Valid until: ${expirationDate.toDateString()}`));
      }

      options.push(panel(zkCertDisplay));
      options.push(divider());
    }

    let indexSelection = NaN;
    while (filteredCerts[indexSelection] === undefined) {
      const answer = await snap.request({
        method: 'snap_dialog',
        params: {
          type: 'Prompt',
          content: panel([
            heading(`zkCertificate Selection`),
            ...options,
            text(`Please enter the number of the zkCertificate you want to use (${1} to ${filteredCerts.length}):`),
          ]),
        },
      });

      if (answer === null) {
        throw new Error(RpcResponseErr.RejectedSelect);
      }

      indexSelection = parseInt(answer as string) - 1;

      if (filteredCerts[indexSelection] === undefined) {
        await snap.request({
          method: 'snap_notify',
          params: {
            type: 'native',
            message: `Selection failed. Answer not between ${1} and ${filteredCerts.length}.`,
          },
        });
      }
    }
    selected = filteredCerts[indexSelection];
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
