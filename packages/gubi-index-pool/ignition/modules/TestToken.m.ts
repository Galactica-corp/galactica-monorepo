// This setup uses Hardhat Ignition to manage smart contract deployments.
// Learn more about it at https://hardhat.org/ignition

import { buildModule } from "@nomicfoundation/hardhat-ignition/modules";

const TestTokenModule = buildModule("TestTokenModule", (m) => {
  const owner = m.getParameter("owner", m.getAccount(0));

  const testToken = m.contract("TestToken", [owner]);

  return { testToken };
});

export default TestTokenModule;

