// components/Footer.tsx

import Link from 'next/link';
import React from 'react';
  
const Footer: React.FC = () => {
    return (
        <footer className="bg-slate-50 bg-opacity-90 text-black z-20">
            <div className="max-w-6xl mx-auto py-10 px-4 sm:px-6 lg:px-8 grid grid-cols-1 sm:grid-cols-2 md:grid-cols-6 gap-8">
                <div>
                    <h2 className="text-sm font-semibold text-blue-900">Virtual Staging AI</h2>
                </div>
                <div>
                    <h3 className="text-black font-semibold mb-4 text-sm">Quick Links</h3>
                    <ul className="text-gray-700 text-xs">
                        <li>Home</li>
                        <li>Gallery</li>
                        <li>Prices</li>
                        <li>Login</li>
                        <li>Career</li>
                    </ul>
                </div>
                <div>
                    <h3 className="text-black font-semibold mb-4 text-sm">Terms & Conditions</h3>
                    <ul className="text-gray-700 text-xs">
                        <li>Terms of Use</li>
                        <li>Refund Policy</li>
                        <li>Privacy Policy</li>
                        <li>Cookie Policy</li>
                    </ul>
                </div>
                <div>
                    <h3 className="text-black font-semibold mb-4 text-sm">Blog</h3>
                    <ul className="text-gray-700 text-xs">
                        <li>How to Do Virtual Staging</li>
                        <li>Virtual Staging Pricing</li>
                        <li>Virtual Staging AI</li>
                        <li>Boxbrownie Competitors</li>
                        <li>Interior AI alternative</li>
                    </ul>
                </div>
                <div>
                    <h3 className="text-black font-semibold mb-4 text-sm">Contact</h3>
                    <ul className="text-gray-700 text-xs">
                        <li>info@virtualstagingai.app</li>
                        <li>Work with Us</li>
                        <li>Affiliate Program</li>
                        <li>Whitelabel Program</li>
                        <li>API Access</li>
                    </ul>
                </div>
                <div>
                    <h3 className="text-black font-semibold mb-4 text-sm">Mailing Address</h3>
                    <address className="not-italic text-gray-700 text-xs">
              Virtual Staging AI Inc<br />
              2810 N Church St<br />
              Wilmington, DE 19802
                    </address>
                </div>
            </div>
            <div className="text-center py-4 text-gray-600 text-xs">
          © 2024 Virtual Staging AI™
            </div>
        </footer>
    );
};

export default Footer;