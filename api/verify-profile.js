// api/verify-profile.js
// Vercel Serverless Function: server-side profile verification + 30-day trial.
// Replaces the Firebase Cloud Function `verifyMyProfile` (Blaze-free backend).
//
// Reads the user's persisted avatar + portfolio from Firestore, validates them,
// sets the trusted `isVerified` flag, and grants the 30-day welcome Premium
// only when no paid/active premium exists. Uses Firebase Admin SDK, so it
// bypasses Security Rules by design.

import { initializeApp, getApps, cert } from 'firebase-admin/app';
import { getFirestore, Timestamp } from 'firebase-admin/firestore';

if (!getApps().length) {
  initializeApp({
    credential: cert(JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT_KEY || '{}'))
  });
}

const PLACEHOLDER_PATTERN = /ui-avatars|placeholder|dicebear|gravatar\.com\/avatar\/00000/i;

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { userId } = req.body || {};
  if (!userId) {
    return res.status(400).json({ error: 'Missing userId' });
  }

  try {
    const db = getFirestore();
    const userRef = db.collection('users').doc(userId);
    const userSnap = await userRef.get();

    if (!userSnap.exists) {
      return res.status(404).json({ error: 'User not found' });
    }

    const user = userSnap.data();

    // --- anti-fraud: personal avatar + at least one portfolio photo ---
    const avatar = String(user.avatar || '').trim();
    const portfolio = Array.isArray(user.photoPortfolio)
      ? user.photoPortfolio.filter((item) => typeof item === 'string' && item.trim().length > 0)
      : [];

    const validAvatar = Boolean(avatar) && !PLACEHOLDER_PATTERN.test(avatar);
    const validPortfolio = portfolio.length > 0;

    if (!validAvatar || !validPortfolio) {
      return res.status(412).json({
        ok: false,
        error: 'Personal avatar and at least one portfolio photo are required.'
      });
    }

    const verifiedAt = new Date().toISOString();

    // --- grant the 30-day welcome trial only when no premium is active ---
    const now = new Date();
    
    // Check both Timestamp (Firestore native) and ISO string representations
    let hasValidPremium = false;
    if (user.premiumUntil) {
      let premiumTime = 0;
      if (typeof user.premiumUntil.toDate === 'function') {
        premiumTime = user.premiumUntil.toDate().getTime();
      } else {
        premiumTime = new Date(user.premiumUntil).getTime();
      }
      if (!isNaN(premiumTime) && premiumTime > now.getTime()) {
        hasValidPremium = true;
      }
    }
    
    const premiumActive = hasValidPremium || user.subscriptionPlan === 'premium';
    const trialEnd = new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000);

    const update = {
      hasRealPhoto: true,
      isVerified: true,
      verifiedAt
    };
    if (!premiumActive) {
      update.subscriptionPlan = 'premium';
      update.premiumUntil = Timestamp.fromDate(trialEnd);
      update.trialPremiumEndsAt = trialEnd.toISOString();
      update.rewardPremiumEndsAt = trialEnd.toISOString();
    }

    await userRef.set(update, { merge: true });

    return res.status(200).json({
      ok: true,
      verifiedAt,
      premiumGranted: !premiumActive,
      premiumUntil: premiumActive
        ? (user.premiumUntil && typeof user.premiumUntil.toDate === 'function' ? user.premiumUntil.toDate().toISOString() : String(user.premiumUntil || ''))
        : trialEnd.toISOString()
    });
  } catch (error) {
    console.error('Ошибка верификации профиля:', error);
    return res.status(500).json({ error: 'Internal server error' });
  }
}
