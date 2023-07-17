import { create } from 'ipfs-http-client';
import all from 'it-all';
import { readFileSync } from 'fs';

class IPFSHelper {
  constructor(ipfsUrl) {
    this.ipfs = create(ipfsUrl);
  }

  async subscribe(topic, onMsg) {
    await this.ipfs.pubsub.subscribe(topic, onMsg);
    console.log(`Subscribed to ${topic}`);
  }

  async publish(topic, msg) {
    const jsonMsg = JSON.stringify(msg);
    await this.ipfs.pubsub.publish(topic, jsonMsg);
  }

  async downloadFile(path) {
    const file = readFileSync(path, 'utf-8');
    return JSON.parse(file);
  }

  async listFiles(ipfsHash) {
    const output = await all(this.ipfs.ls(ipfsHash));
    return output.map((entry) => entry.path);
  }
}

export default IPFSHelper;
