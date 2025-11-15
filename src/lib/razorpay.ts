/**
 * Razorpay Configuration
 * Test credentials for development
 */

import Razorpay from 'razorpay';
import crypto from 'crypto';

// Lazily initialize Razorpay instance to avoid build-time errors
let razorpayInstance: Razorpay | null = null;

export function getRazorpay(): Razorpay {
  if (!razorpayInstance) {
    const keyId = process.env.RAZORPAY_KEY_ID;
    const keySecret = process.env.RAZORPAY_KEY_SECRET;

    if (!keyId || !keySecret) {
      throw new Error('Razorpay credentials not configured');
    }

    razorpayInstance = new Razorpay({
      key_id: keyId,
      key_secret: keySecret,
    });
  }
  return razorpayInstance;
}

// Legacy export for backwards compatibility
export const razorpay = getRazorpay;

/**
 * Verify Razorpay payment signature
 */
export function verifyPaymentSignature(
  orderId: string,
  paymentId: string,
  signature: string
): boolean {
  const text = `${orderId}|${paymentId}`;
  const expectedSignature = crypto
    .createHmac('sha256', process.env.RAZORPAY_KEY_SECRET!)
    .update(text)
    .digest('hex');

  return expectedSignature === signature;
}

/**
 * Verify Razorpay webhook signature
 */
export function verifyWebhookSignature(
  body: string,
  signature: string,
  secret: string
): boolean {
  const expectedSignature = crypto
    .createHmac('sha256', secret)
    .update(body)
    .digest('hex');

  return expectedSignature === signature;
}

/**
 * Convert rupees to paise (Razorpay uses paise)
 */
export function rupeesToPaise(rupees: number): number {
  return Math.round(rupees * 100);
}

/**
 * Convert paise to rupees
 */
export function paiseToRupees(paise: number): number {
  return paise / 100;
}

/**
 * Calculate subscription end date
 */
export function calculateSubscriptionEndDate(
  plan: 'counseling' | 'premium',
  startDate: Date = new Date()
): Date {
  const endDate = new Date(startDate);

  if (plan === 'counseling') {
    // 3 months
    endDate.setMonth(endDate.getMonth() + 3);
  } else if (plan === 'premium') {
    // 12 months
    endDate.setFullYear(endDate.getFullYear() + 1);
  }

  return endDate;
}

/**
 * Generate receipt ID
 */
export function generateReceiptId(userId: string, plan: string): string {
  const timestamp = Date.now();
  return `rcpt_${userId.substring(0, 8)}_${plan}_${timestamp}`;
}
