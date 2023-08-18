export const invokeSnap = <T>(request: T) => {
  if (!window.ethereum) throw new Error("window.ethereum is undefined");

  return window.ethereum?.request({
    method: "wallet_invokeSnap",
    params: {
      snapId: process,
      request: request,
    },
  });
};
