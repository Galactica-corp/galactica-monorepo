// SPDX-License-Identifier: BUSL-1.1

import { OnHomePageResponse, SnapsGlobalObject } from "@metamask/snaps-types";
import { panel, heading, text, Panel, Text } from "@metamask/snaps-ui";
import { getState } from "./stateManagement";
import { getZkCertStorageOverview } from "./zkCertHandler";


/**
 * Generates the snap home page shown in the MetaMask UI.
 *
 * @returns A static panel rendered with custom UI.
 */
export async function generateHomePage(snap: SnapsGlobalObject): Promise<OnHomePageResponse> {
  const state = await getState(snap);

  const uiCertList: Text[] = [];
  state.zkCerts.forEach((zkCert) => {
    uiCertList.push(text(zkCert.leafHash));
  });

  return {
    content: panel([
      heading('Galactica ZK Vault'),
      text('Imported zkCertificates:'),
      ...uiCertList,
    ]),
  };
};
