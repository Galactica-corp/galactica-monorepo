// SPDX-License-Identifier: BUSL-1.1
import { ZKCertificate } from '@galactica-net/zkkyc';
import { SnapsGlobalObject } from '@metamask/snaps-types';
import { panel, text, heading, divider } from '@metamask/snaps-ui';
import { buildEddsa } from 'circomlibjs';

import { RpcResponseErr } from '@galactica-net/snap-api';
import { ZkCert } from './types';

/**
 * Selects a ZkCert from the available ones.
 *
 * @param snap - The snap for interaction with Metamask.
 * @param availableCerts - The available ZkCerts to select from.
 * @param zkCertStandard - The zkCertStandard of the ZkCert to select (optional).
 * @param expirationDate - The expiration date to filter for (optional).
 * @param providerAx - The provider pubkey to filter for (optional).
 */
export async function selectZkCert(
  snap: SnapsGlobalObject,
  availableCerts: ZkCert[],
  zkCertStandard?: string,
  expirationDate?: number,
  providerAx?: string,
): Promise<ZKCertificate> {
  if (availableCerts.length === 0) {
    throw new Error('No zkCerts available. Please import it first.');
  }

  const filteredCerts = availableCerts.filter((value) => {
    return (
      // same zkCert Standard, if defined as filter
      (value.zkCertStandard === zkCertStandard ||
        zkCertStandard === undefined) &&
      // not expired (if zkCert has expiration date) or same as filtered
      (value.content.expirationDate === undefined ||
        (value.content.expirationDate >= Date.now() / 1000 &&
          expirationDate === undefined) ||
        value.content.expirationDate === expirationDate) &&
      // same provider, if defined as filter
      (providerAx === undefined || value.providerData.Ax === providerAx)
    );
  });

  if (filteredCerts.length === 0) {
    throw new Error(
      `No such zkCerts available. Filter used ${JSON.stringify({
        zkCertStandard,
        expirationDate,
        providerAx,
      })}. Please import it first.`,
    );
  }

  let selected: ZkCert;

  if (filteredCerts.length === 1) {
    selected = filteredCerts[0];
  } else {
    // build selection dialog
    const options = [];
    for (let i = 0; i < filteredCerts.length; i++) {
      const { did } = filteredCerts[i];

      const zkCertDisplay = [
        text(
          `**${i + 1}**: ${did.slice(0, 14)}...${did.slice(did.length - 4)}`,
        ),
      ];

      // custom information to display depending on the type of zkCert
      if (zkCertStandard === 'gip69') {
        const certExpirationDate = new Date(
          filteredCerts[i].content.expirationDate * 1000,
        );
        zkCertDisplay.push(
          text(`Valid until: ${certExpirationDate.toDateString()}`),
        );
      }

      options.push(panel(zkCertDisplay));
      options.push(divider());
    }

    let indexSelection = NaN;
    while (filteredCerts[indexSelection] === undefined) {
      const answer = await snap.request({
        method: 'snap_dialog',
        params: {
          type: 'prompt',
          content: panel([
            heading(`zkCertificate Selection`),
            ...options,
            text(
              `Please enter the number of the zkCertificate you want to select (${1} to ${filteredCerts.length
              }):`,
            ),
          ]),
        },
      });

      if (answer === null) {
        throw new Error(RpcResponseErr.RejectedSelect);
      }

      indexSelection = parseInt(answer as string, 10) - 1;

      if (filteredCerts[indexSelection] === undefined) {
        await snap.request({
          method: 'snap_notify',
          params: {
            type: 'native',
            message: `Selection failed. Answer not between ${1} and ${filteredCerts.length
              }.`,
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
