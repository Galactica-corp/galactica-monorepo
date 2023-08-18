import { ImportZkCertError, importZkCert } from "./api/import-zk-cert";
import { sdkConfig } from "./config";

const clientExample = async () => {
  try {
    // @ts-ignore
    const response = await importZkCert({ zkCert: { holderCommitment: "" } });
    console.log(response.gip69);
  } catch (error) {
    if (error instanceof ImportZkCertError) {
      if (error.name === "SomethingWentWrongWithImport") {
        console.log("toast.error(...)");
      }

      if (error.name === "SomethingWentWrong2") {
        console.log("toast.error(...2)");
      }
    }

    console.log("unknown error");
  }
};
