export default {
  default: {
    resize: () => { throw new Error("sharp unavailable on Cloudflare Workers"); }
  }
};