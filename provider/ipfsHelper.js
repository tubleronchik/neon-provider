import { create } from 'ipfs-http-client';
import all from 'it-all';

class IPFSHelper {
  constructor(ipfsUrl, endpoint) {
    this.ipfs = create(ipfsUrl)
    this.endpoint = endpoint

    this.listFiles = this.listFiles.bind(this);
    this.createMetadata = this.createMetadata.bind(this);
  }

  async subscribe(topic, onMsg) {
    await this.ipfs.pubsub.subscribe(topic, onMsg)
    console.log(`Subscribed to ${topic}`)
  }

  async publish(topic, msg) {
    const jsonMsg = JSON.stringify(msg)
    await this.ipfs.pubsub.publish(topic, jsonMsg)
    console.log(`Message ${jsonMsg} sent to ${topic}`)
  }

  async listFiles(ipfsHash) {
    const output = await all(this.ipfs.ls(ipfsHash))
    return output[0].path
  }

  async createMetadata(resultHash) {
    const fullPath = await this.listFiles(resultHash);
    const img = `${this.endpoint}${fullPath}/AUSTIN.jpg`;
    const description = `${this.endpoint}${fullPath}`;
    const metadata = { description: description, image: img, name: 'SpotNFT' };
    return metadata;
  }
}

export default IPFSHelper;
