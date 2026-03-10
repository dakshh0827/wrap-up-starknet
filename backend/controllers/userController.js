import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

// Helper to normalize Starknet addresses to prevent DB duplication
// Starknet addresses can vary in casing, so forcing lowercase ensures consistency.
const normalizeAddress = (address) => {
  if (!address) return address;
  return address.toLowerCase();
};

// Set or update display name (database only - no blockchain)
export const setDisplayName = async (req, res, next) => {
  try {
    const { walletAddress, displayName } = req.body;
    
    if (!walletAddress || !displayName) {
      return res.status(400).json({ error: 'Wallet address and display name are required' });
    }

    // Starknet modification: Normalize address
    const normalizedAddress = normalizeAddress(walletAddress);
    
    // Validate display name length
    if (displayName.trim().length < 1 || displayName.trim().length > 32) {
      return res.status(400).json({ error: 'Display name must be 1-32 characters' });
    }
    
    // Upsert user (create if doesn't exist, update if exists)
    const user = await prisma.user.upsert({
      where: { walletAddress: normalizedAddress },
      update: { 
        displayName: displayName.trim(),
        updatedAt: new Date()
      },
      create: { 
        walletAddress: normalizedAddress,
        displayName: displayName.trim()
      }
    });
    
    console.log('✅ Display name saved to database:', normalizedAddress, '→', displayName.trim());
    
    res.json({ 
      success: true,
      message: 'Display name saved successfully',
      user: {
        walletAddress: user.walletAddress,
        displayName: user.displayName
      }
    });
  } catch (error) {
    console.error('Set display name error:', error.message);
    next(error);
  }
};

// Get user by wallet address
export const getUserByWallet = async (req, res, next) => {
  try {
    const { walletAddress } = req.params;
    
    if (!walletAddress) {
      return res.status(400).json({ error: 'Wallet address is required' });
    }

    // Starknet modification: Normalize address
    const normalizedAddress = normalizeAddress(walletAddress);
    
    const user = await prisma.user.findUnique({
      where: { walletAddress: normalizedAddress }
    });
    
    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }
    
    res.json(user);
  } catch (error) {
    console.error('Get user error:', error.message);
    next(error);
  }
};

// Get or create user
export const getOrCreateUser = async (req, res, next) => {
  try {
    const { walletAddress } = req.body;
    
    if (!walletAddress) {
      return res.status(400).json({ error: 'Wallet address is required' });
    }

    // Starknet modification: Normalize address
    const normalizedAddress = normalizeAddress(walletAddress);
    
    // Find or create user
    let user = await prisma.user.findUnique({
      where: { walletAddress: normalizedAddress }
    });
    
    if (!user) {
      user = await prisma.user.create({
        data: { walletAddress: normalizedAddress }
      });
      console.log('✅ New user created:', normalizedAddress);
    } else {
      console.log('✅ Existing user found:', normalizedAddress);
    }
    
    res.json(user);
  } catch (error) {
    console.error('Get or create user error:', error.message);
    next(error);
  }
};