// This setup uses Hardhat Ignition to manage smart contract deployments.
// Learn more about it at https://hardhat.org/ignition

import { buildModule } from "@nomicfoundation/hardhat-ignition/modules";

import GUBI from "./GUBI.m";
import { defineUpgradableProxy } from "./UpgradableProxy.m";

const IndexPoolModule = buildModule("IndexPoolModule", (m) => {
  const { gUBI } = m.useModule(GUBI);

  const owner = m.getParameter("owner", m.getAccount(0));

  const { upgradableContract: indexPool, proxyContracts } = defineUpgradableProxy(
    m,
    "IndexPool",
    [gUBI, owner],
  );

  return { indexPool, gUBI, ...proxyContracts };
});

export default IndexPoolModule;
