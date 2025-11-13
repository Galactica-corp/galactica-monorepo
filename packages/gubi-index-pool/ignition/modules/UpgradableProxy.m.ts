// This setup uses Hardhat Ignition to manage smart contract deployments.
// Learn more about it at https://hardhat.org/ignition

import TimelockController from "./TimelockController.m";

/*
 * Using the Transparent Proxy pattern from OpenZeppelin: https://docs.openzeppelin.com/contracts/5.x/api/proxy#TransparentUpgradeableProxy
 * Documentation how to use it with Hardhat Ignition: https://hardhat.org/ignition/docs/guides/upgradeable-proxies
 * 
 * To apply a time lock to upgrades, we use OpenZeppelin's TimelockController: https://docs.openzeppelin.com/contracts/5.x/api/governance#TimelockController
 * 
 * @param m - The IgnitionModuleBuilder instance.
 * @param contractName - The name of the contract to deploy.
 * @param initCallArgs - The arguments to pass to the initialize function of the contract.
 * @returns The upgradable contract and the proxy contracts.
 */
export function defineUpgradableProxy(m: any /*IgnitionModuleBuilder*/, contractName: string, initCallArgs: any[], useTimelock: boolean = true) {
  const { timelockController } = m.useModule(TimelockController);

  // Deploying the staking logic contract
  const implementation = m.contract(contractName, [], { id: `ProxyImplementation${contractName}` });

  // Call to initialize the staking contract when the proxy is deployed
  const encodedInitCall = m.encodeFunctionCall(implementation, "initialize", initCallArgs);

  // Proxy infrastructure
  const proxyAdminOwner = useTimelock ? timelockController : m.getAccount(0);

  const proxy = m.contract("TransparentUpgradeableProxy", [
    implementation,
    proxyAdminOwner,
    encodedInitCall,
  ],
    { id: `TransparentUpgradeableProxy${contractName}` }
  );

  const proxyAdminAddress = m.readEventArgument(
    proxy,
    "AdminChanged",
    "newAdmin"
  );

  const proxyAdmin = m.contractAt("ProxyAdmin", proxyAdminAddress, { id: `ProxyAdmin${contractName}` });

  // contract using the proxy
  const upgradableContract = m.contractAt(contractName, proxy, { id: `UpgradableContract${contractName}` });

  return { upgradableContract, proxyContracts: { proxyAdmin, proxy, timelockController } };
}
