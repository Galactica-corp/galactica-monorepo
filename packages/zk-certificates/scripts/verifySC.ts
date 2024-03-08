const hre = require("hardhat");
const {utils} = require("ethers");


async function main() {

    let SCAddress = "0xb5e4A15F468AC505Bf0D53ceA2144b52135cCEF9";
    let constructorInputs = ["twitter ZkCertificate"];

    console.log(`verifying contract at address ${SCAddress}`);
    console.log(`with constructor ${constructorInputs}`);

    await hre.run("verify:verify", {
        address: SCAddress,
        constructorArguments: constructorInputs,
    })


}

main()
    .then(() => process.exit(0))
    .catch(error => {
    console.error(error);
    process.exit(1);
    });
