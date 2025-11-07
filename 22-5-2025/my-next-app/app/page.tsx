// app/page.tsx
'use client'

import Head from 'next/head';
import Link from 'next/link';
import Header from './components/Header';
// import Footer from './components/Footer';
// import MainContent from './components/MainContent';



export default function Home() {
    return (
        <div className="flex flex-col min-h-screen bg-gradient-to-b from-zinc-200 via-white to-white dark:from-zinc-800 dark:via-black dark:to-black">
            <Head>
                <title>Virtual Staging AI</title>
                <link rel="icon" href="/favicon.ico" />
            </Head>



            {/* Header */}
            <Header />

            {/* Main content */}
            {/* <MainContent /> */}

            {/* Footer */}
            {/* <Footer /> */}
        </div>
    );
}