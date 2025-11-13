// This setup uses Hardhat Ignition to manage smart contract deployments.
// Learn more about it at https://hardhat.org/ignition

import { buildModule } from "@nomicfoundation/hardhat-ignition/modules";

const GUBIModule = buildModule("GUBIModule", (m) => {
  const owner = m.getParameter("owner", m.getAccount(0));

  const gUBI = m.contract("GUBI", [owner]);

  return { gUBI };
});

export default GUBIModule;

