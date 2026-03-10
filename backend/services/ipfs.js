import axios from 'axios';

/**
 * Upload data to IPFS via Pinata
 * @param {Object} data - Data to upload
 * @returns {Promise<string>} IPFS hash (CID)
 */
export async function uploadToIPFS(data) {
  try {
    const response = await axios.post(
      'https://api.pinata.cloud/pinning/pinJSONToIPFS',
      data,
      {
        headers: {
          'Content-Type': 'application/json',
          'pinata_api_key': process.env.PINATA_API_KEY,
          'pinata_secret_api_key': process.env.PINATA_SECRET_KEY
        }
      }
    );
    
    return response.data.IpfsHash;
  } catch (error) {
    console.error('IPFS upload error:', error.message);
    throw new Error('Failed to upload to IPFS');
  }
}

/**
 * Fetch data from IPFS
 * @param {string} cid - IPFS CID
 * @returns {Promise<Object>} Data from IPFS
 */
export async function fetchFromIPFS(cid) {
  try {
    const response = await axios.get(`https://gateway.pinata.cloud/ipfs/${cid}`);
    return response.data;
  } catch (error) {
    console.error('IPFS fetch error:', error.message);
    throw new Error('Failed to fetch from IPFS');
  }
}
