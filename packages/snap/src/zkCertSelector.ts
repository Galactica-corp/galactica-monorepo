// SPDX-License-Identifier: BUSL-1.1
import type {
  ZkCertRegistered,
  ZkCertSelectionParams,
} from '@galactica-net/snap-api';
import { RpcResponseErr } from '@galactica-net/snap-api';
import { ZkCertificate } from '@galactica-net/zk-certificates';
import type { SnapsGlobalObject } from '@metamask/snaps-types';
import { divider, heading, panel, text } from '@metamask/snaps-ui';
import { buildEddsa } from 'circomlibjs';

/**
 * Filters ZkCerts according to selection parameters.
 * @param availableCerts - The available ZkCerts to select from.
 * @param filter - The parameters to filter for (optional).
 * @returns Filtered zkCert.
 */
export function filterZkCerts(
  availableCerts: ZkCertRegistered[],
  filter?: ZkCertSelectionParams,
): ZkCertRegistered[] {
  const filteredCerts = availableCerts.filter((value) => {
    return (
      // same zkCert Standard, if defined as filter
      (filter?.zkCertStandard === undefined ||
        // eslint-disable-next-line @typescript-eslint/no-unsafe-enum-comparison
        value.zkCertStandard === filter.zkCertStandard) &&
      // not expired (if zkCert has expiration date) or same as filtered
      (value.expirationDate === undefined ||
        (value.expirationDate >= Date.now() / 1000 &&
          filter?.expirationDate === undefined) ||
        value.expirationDate === filter?.expirationDate) &&
      // same provider, if defined as filter
      (filter?.providerAx === undefined ||
        value.providerData.ax === filter?.providerAx) &&
      (filter?.registryAddress === undefined ||
        value.registration.address.toLowerCase() ===
          filter?.registryAddress.toLowerCase()) &&
      (filter?.chainID === undefined ||
        value.registration.chainID === filter?.chainID)
    );
  });
  return filteredCerts;
}

/**
 * Selects a ZkCert from the available ones.
 * @param snap - The snap for interaction with Metamask.
 * @param availableCerts - The available ZkCerts to select from.
 * @param filter - The parameters to filter for (optional).
 * @returns Selected zkCert.
 */
export async function selectZkCert(
  snap: SnapsGlobalObject,
  availableCerts: ZkCertRegistered[],
  filter?: ZkCertSelectionParams,
): Promise<ZkCertificate> {
  if (availableCerts.length === 0) {
    throw new Error('No zkCerts available. Please import it first.');
  }

  const filteredCerts = filterZkCerts(availableCerts, filter);

  if (filteredCerts.length === 0) {
    throw new Error(
      `No such zkCerts available. Filter used ${JSON.stringify(
        filter,
      )}. Please import it first.`,
    );
  }

  let selected: ZkCertRegistered;

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
      const certExpirationDate = new Date(
        filteredCerts[i].expirationDate * 1000,
      );
      zkCertDisplay.push(
        text(`Valid until: ${certExpirationDate.toDateString()}`),
      );

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
              `Please enter the number of the zkCertificate you want to select (${1} to ${filteredCerts.length}):`,
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
            message: `Selection failed. Answer not between ${1} and ${filteredCerts.length}.`,
          },
        });
      }
    }
    selected = filteredCerts[indexSelection];
  }

  const eddsa = await buildEddsa();
  const zkCert = new ZkCertificate(
    selected.holderCommitment,
    selected.zkCertStandard,
    eddsa,
    selected.randomSalt,
    selected.expirationDate,
    // The following list of keys assumes that the keys are in the same order as used to generate the contentHash
    // This a bit risky because the order of the keys in the object is not guaranteed.
    // However, we want the snap to be able to handle new zkCert types it does not know the content of.
    // This hotfix should be replaced by a more robust solution in the future.
    Object.keys(selected.content),
    selected.content,
    selected.providerData,
  );

  return zkCert;
}
