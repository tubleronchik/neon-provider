import { readFileSync } from 'fs';
import PinataHelper from './provider/pinataHelper.js';
import Web3Helper from './provider/web3Helper.js';
import IPFSHelper from './provider/ipfsHelper.js';
import LiabilityManager from './provider/liabilityManager.js';
import MessageHandler from './provider/messageHandler.js';

function initialize() {
    const configPath = 'config/config.json';
    const config = JSON.parse(readFileSync(configPath));

    const ipfsHelper = new IPFSHelper('http://127.0.0.1:5001', config.pinata_endpoint);
    const web3Helper = new Web3Helper(config);
    const pinataHelper = new PinataHelper(config.pinataApiKey, config.pinataSecretApiKey);
    const liabilityManager = new LiabilityManager(config, ipfsHelper, web3Helper, pinataHelper);
    const messageHandler = new MessageHandler(config, ipfsHelper, web3Helper, pinataHelper, liabilityManager);
}

initialize();