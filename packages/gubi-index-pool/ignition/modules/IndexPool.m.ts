// This setup uses Hardhat Ignition to manage smart contract deployments.
// Learn more about it at https://hardhat.org/ignition

import { buildModule } from "@nomicfoundation/hardhat-ignition/modules";

import GUBI from "./GUBI.m";


const IndexPoolModule = buildModule("IndexPoolModule", (m) => {
  const { gUBI } = m.useModule(GUBI);

  const owner = m.getParameter("owner", m.getAccount(0));

  // Deploying the index pool contract
  const indexPool = m.contract("IndexPool", [gUBI]);

  // In case we want to change the owner of the index pool, the owner still has to accept the ownership transfer by calling acceptOwnership()
  // If the owner is the deployer, this can be skipped
  m.call(indexPool, "transferOwnership", [owner]);

  return { indexPool, gUBI };
});

export default IndexPoolModule;
