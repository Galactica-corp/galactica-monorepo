import { TASK_CIRCOM_TEMPLATE } from "hardhat-circom";
import { subtask } from "hardhat/config";
import { HardhatRuntimeEnvironment } from "hardhat/types";

subtask(TASK_CIRCOM_TEMPLATE, "generate Verifier template shipped by SnarkjS").setAction(circomTemplate);

/**
 * Overwrite the default circomTemplate task to change the destination path of Verifier contracts.
 * 
 * @param args - Task arguments.
 * @param hre - Hardhat runtime environment.
 * @param runSuper - Super function provided by snarkjs.
 */
async function circomTemplate(args: any, hre: HardhatRuntimeEnvironment, runSuper: any) {
  const previousPath = hre.config.paths.sources;
  hre.config.paths.sources = hre.config.paths.sources + "/zkpVerifiers";
  await runSuper(args);
  hre.config.paths.sources = previousPath;
}