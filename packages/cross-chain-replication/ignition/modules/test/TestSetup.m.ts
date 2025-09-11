import { buildModule } from "@nomicfoundation/hardhat-ignition/modules";
import guardianRegistryArtifact from "@galactica-net/zk-certificates/artifacts/contracts/GuardianRegistry.sol/GuardianRegistry.json" with { type: "json" };
import zkCertificateRegistryArtifact from "@galactica-net/zk-certificates/artifacts/contracts/ZkCertificateRegistry.sol/ZkCertificateRegistry.json" with { type: "json" };
import poseidonT3Artifact from "@galactica-net/zk-certificates/artifacts/contracts/helpers/Poseidon.sol/PoseidonT3.json" with { type: "json" };
import mockMailboxArtifact from "../../../artifacts/contracts/test/MockMailbox.sol/MockMailbox.json" with { type: "json" };


export default buildModule("TestSetupModule", (module) => {
  const senderDomain = module.getParameter("senderDomain", 1);
  const receiverDomain = module.getParameter("receiverDomain", 2);
  const merkleDepth = module.getParameter("merkleDepth", 8);

  const guardianRegistry = module.contract('GuardianRegistry', guardianRegistryArtifact, ["Test Guardian Registry"]);
  module.call(guardianRegistry, "grantGuardianRole", [module.getAccount(0), [0, 0], "test"]);

  const poseidon = module.contract('PoseidonT3', poseidonT3Artifact);

  const zkCertificateRegistry = module.contract(
    'ZkCertificateRegistry',
    zkCertificateRegistryArtifact,
    [guardianRegistry, merkleDepth, "Test ZkCertificate Registry"],
    {
      libraries: {
        PoseidonT3: poseidon,
      },
    }
  );

  const senderMailbox = module.contract('MockMailbox', mockMailboxArtifact, [senderDomain], { id: "senderMailbox" });
  const receiverMailbox = module.contract('MockMailbox', mockMailboxArtifact, [receiverDomain], { id: "receiverMailbox" });

  module.call(senderMailbox, "addRemoteMailbox", [receiverDomain, receiverMailbox]);
  module.call(receiverMailbox, "addRemoteMailbox", [senderDomain, senderMailbox]);

  return {
    guardianRegistry,
    zkCertificateRegistry,
    senderMailbox,
    receiverMailbox,
    poseidon,
  };
});
