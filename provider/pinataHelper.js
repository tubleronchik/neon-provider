import pinataSDK from '@pinata/sdk';

class PinataHelper {
  constructor(apiKey, secretApiKey) {
    this.pinata = pinataSDK(apiKey, secretApiKey);
  }

  async pinJSONToIPFS(json) {
    return this.pinata.pinJSONToIPFS(json);
  }
}

export default PinataHelper;