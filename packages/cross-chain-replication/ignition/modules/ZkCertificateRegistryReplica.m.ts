import { buildModule } from "@nomicfoundation/hardhat-ignition/modules";

export default buildModule("ZkCertificateRegistryReplicaModule", (module) => {
  const description = module.getParameter("description", "Test ZkCertificate Registry Replica");
  const treeDepth = module.getParameter("treeDepth", 32);
  const guardianRegistry = module.getParameter("guardianRegistry");

  const replica = module.contract("ZkCertificateRegistryReplica", [description, treeDepth, guardianRegistry]);

  return { replica };
});
