// ✅ Server Component (no 'use client' directive)
// This page is rendered on the server for better SEO and performance

import { Metadata } from 'next';
import Layout from '@/components/layout/Layout';
import AboutClient from '@/components/about/AboutClient';

// SEO metadata - only works in Server Components
export const metadata: Metadata = {
  title: 'About Us - NeetLogIQ | Professional Medical Education Counselling',
  description: 'Learn about NeetLogIQ, your trusted partner for medical education guidance. We provide comprehensive data on 2,400+ medical colleges across India to help students make informed decisions.',
  keywords: 'about NeetLogIQ, medical education counselling, NEET guidance, medical college data, about us',
  openGraph: {
    title: 'About NeetLogIQ - Your Medical Education Guide',
    description: 'Empowering medical aspirants with comprehensive data, intelligent insights, and personalized guidance.',
    type: 'website',
  },
};

// This is a Server Component - data preparation happens on the server
export default function AboutPage() {
  // Prepare data on the server (could fetch from database/API in the future)
  // Note: Icon components moved to Client Component to avoid React 19 serialization issues
  const teamMembers = [
    {
      name: 'Dr. Anonymous',
      role: 'Founder & Creator',
      expertise: 'Clinical Medicine & Medical Education Technology',
      experience: '2+ Years in Medical Practice & 4+ Years in Research',
      description: 'A dedicated physician and medical education innovator who founded NeetLogIQ to bridge the gap between medical aspirants and comprehensive career guidance. Combining clinical experience with research expertise, Dr. Anonymous created this platform to provide data-driven insights and personalized recommendations for students pursuing medical careers.'
    }
  ];

  const stats = [
    { number: '2,400+', label: 'Colleges Covered', iconName: 'GraduationCap' },
    { number: '28', label: 'States Covered', iconName: 'MapPin' },
    { number: 'Growing', label: 'Database', iconName: 'Shield' },
    { number: '24/7', label: 'Support Available', iconName: 'Shield' }
  ];

  const values = [
    {
      title: 'Excellence',
      description: 'We strive for excellence in everything we do, from data accuracy to user experience.',
      iconName: 'Star',
      color: 'text-yellow-400'
    },
    {
      title: 'Innovation',
      description: 'Continuously innovating with AI-powered recommendations and cutting-edge technology.',
      iconName: 'Zap',
      color: 'text-blue-400'
    },
    {
      title: 'Integrity',
      description: 'Maintaining the highest standards of integrity and transparency in all our services.',
      iconName: 'Shield',
      color: 'text-green-400'
    },
    {
      title: 'Empowerment',
      description: 'Empowering students with knowledge and tools to make informed decisions.',
      iconName: 'Target',
      color: 'text-purple-400'
    }
  ];

  // Pass server-prepared data to Client Component
  return (
    <Layout>
      <AboutClient
        teamMembers={teamMembers}
        stats={stats}
        values={values}
      />
    </Layout>
  );
}
