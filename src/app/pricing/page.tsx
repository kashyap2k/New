// ✅ Server Component (no 'use client' directive)
// Wrapper for SEO metadata, delegates rendering to Client Component

import { Metadata } from 'next';
import PricingClient from '@/components/pricing/PricingClient';

// SEO metadata - only works in Server Components
export const metadata: Metadata = {
  title: 'Pricing & Plans - NeetLogIQ | Premium Medical Education Counselling',
  description: 'Choose the perfect plan for your medical education journey. Access premium features including AI-powered college predictions, personalized recommendations, and comprehensive counselling data for 2,400+ colleges.',
  keywords: 'NeetLogIQ pricing, medical counselling plans, NEET premium features, college prediction pricing, medical education subscription',
  openGraph: {
    title: 'NeetLogIQ Pricing - Choose Your Plan',
    description: 'Unlock premium features for better college decisions. Plans starting from affordable rates.',
    type: 'website',
  },
};

// Server Component - just renders the Client Component
// All interactivity handled by PricingClient
export default function PricingPage() {
  return <PricingClient />;
}
