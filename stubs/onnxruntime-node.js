export const InferenceSession = {
  create: async () => {
    throw new Error("onnxruntime-node should not be used in browser");
  },
};
export default { InferenceSession };