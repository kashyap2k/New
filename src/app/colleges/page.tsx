// ✅ Server Component (no 'use client' directive)
// This page is rendered on the server for better SEO and performance

import { Metadata } from 'next';
import { Suspense } from 'react';
import CollegesClient from '@/components/colleges/CollegesClient';
import CollegesLoading from './loading';

// SEO metadata - only works in Server Components
export const metadata: Metadata = {
  title: 'Medical Colleges in India - NEET, MBBS, BDS | NeetLogIQ',
  description: 'Explore 2,400+ medical colleges across India. Find MBBS, BDS, and PG medical colleges with detailed information on courses, seats, cutoffs, and admissions. Filter by state, type, and management.',
  keywords: 'medical colleges India, MBBS colleges, BDS colleges, NEET colleges, government medical colleges, private medical colleges, medical college list, AIIMS, JIPMER, college search',
  openGraph: {
    title: 'Medical Colleges in India - Complete Database | NeetLogIQ',
    description: 'Search and compare 2,400+ medical colleges across India. Find the best MBBS and BDS colleges for your NEET score.',
    type: 'website',
  },
  twitter: {
    card: 'summary_large_image',
    title: 'Medical Colleges in India | NeetLogIQ',
    description: 'Complete database of 2,400+ medical colleges with courses, seats, and cutoff information.',
  },
};

// Server Component - renders CollegesClient with SEO benefits
export default function CollegesPage() {
  // In future, we can fetch initial data here on the server
  // const initialColleges = await getColleges();
  // return <CollegesClient initialColleges={initialColleges} />;

  return (
    <Suspense fallback={<CollegesLoading />}>
      <CollegesClient />
    </Suspense>
  );
}
