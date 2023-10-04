import pinataSDK from '@pinata/sdk';

class PinataHelper {
  constructor(apiKey, secretApiKey) {
    this.pinata = new pinataSDK(apiKey, secretApiKey);
  }

  async pinJSON2IPFS(json) {
    return this.pinata.pinJSONToIPFS(json);
  }
}

export default PinataHelper;