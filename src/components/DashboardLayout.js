'use client';

import { useState } from 'react';
import Navigation from './Navigation';
import Sidebar from './Sidebar';

export default function DashboardLayout({ children, showSidebar = true }) {
  const [selectedSubject, setSelectedSubject] = useState(null);

  return (
    <div className="min-h-screen bg-bg-page">
      <Navigation />
      <div className="flex">
        {showSidebar && (
          <Sidebar
            selectedSubject={selectedSubject}
            onSubjectChange={setSelectedSubject}
          />
        )}
        <main className={`flex-1 ${showSidebar ? '' : 'max-w-container mx-auto'}`}>
          {children}
        </main>
      </div>
    </div>
  );
}
