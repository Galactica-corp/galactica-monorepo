import { buildModule } from "@nomicfoundation/hardhat-ignition/modules";

import ZkCertificateRegistryReplicaModule from "./ZkCertificateRegistryReplica.m.ts";

export default buildModule("RegistryStateReceiverModule", (module) => {
  const { replica } = module.useModule(ZkCertificateRegistryReplicaModule);

  const mailbox = module.getParameter("mailbox", module.getAccount(0));
  const originDomain = module.getParameter("originDomain", 1);
  const senderAddress = module.getParameter("senderAddress", module.getAccount(0));

  const receiver = module.contract("RegistryStateReceiver", [mailbox, replica, originDomain, senderAddress]);

  // Set the receiver as the authorized updater
  module.call(replica, "initialize", [receiver]);

  return { replica, receiver };
});
