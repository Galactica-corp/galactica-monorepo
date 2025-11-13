// This setup uses Hardhat Ignition to manage smart contract deployments.
// Learn more about it at https://hardhat.org/ignition

import { buildModule } from "@nomicfoundation/hardhat-ignition/modules";

import { ethers } from "hardhat";


const TransferTimelockOwnershipModule = buildModule("TransferTimelockOwnershipModule", (m) => {
  const newOwner = m.getParameter("newOwner", m.getAccount(0));
  const timelockControllerAddress = m.getParameter("timelockControllerAddress", "0x0000000000000000000000000000000000000000");


  const timelockController = m.contractAt("TimelockController", timelockControllerAddress, { id: "TransferOwnership_timelockController" });

  // Calls to be batched into proposal
  const proposerRole = m.staticCall(timelockController, "PROPOSER_ROLE");
  const grantProposerRoleCall = m.encodeFunctionCall(timelockController, "grantRole", [proposerRole, newOwner], { id: "TransferOwnership_grantProposerRoleCall" });
  const executorRole = m.staticCall(timelockController, "EXECUTOR_ROLE");
  const grantExecutorRoleCall = m.encodeFunctionCall(timelockController, "grantRole", [executorRole, newOwner], { id: "TransferOwnership_grantExecutorRoleCall" });
  const cancellerRole = m.staticCall(timelockController, "CANCELLER_ROLE");
  const grantCancellerRoleCall = m.encodeFunctionCall(timelockController, "grantRole", [cancellerRole, newOwner], { id: "TransferOwnership_grantCancellerRoleCall" });

  // Schedule upgrade call through the timelock controller
  const delay = m.staticCall(timelockController, "getMinDelay");
  const scheduledBatch = m.call(timelockController, "scheduleBatch", [
    [timelockController, timelockController, timelockController,],
    [0, 0, 0],
    [grantProposerRoleCall, grantExecutorRoleCall, grantCancellerRoleCall],
    ethers.ZeroHash,
    ethers.ZeroHash,
    delay,
  ],
    { id: "TransferOwnership_scheduledBatch" }
  );

  // Now we would have to wait for the timelock to pass. 
  // The module can fail here, so that we can resume it after the lock has passed.
  // For the test, we can just set the timelock duration to 0

  // Execute the call after the timelock has passed
  m.call(timelockController, "executeBatch", [
    [timelockController, timelockController, timelockController,],
    [0, 0, 0],
    [grantProposerRoleCall, grantExecutorRoleCall, grantCancellerRoleCall],
    ethers.ZeroHash,
    ethers.ZeroHash,
  ],
    // ensure that the execution is called after the scheduled upgrade. Ignition would batch it together otherwise.
    { after: [scheduledBatch], id: "TransferOwnership_executeBatch" }
  );

  return { timelockController };
});

export default TransferTimelockOwnershipModule;
