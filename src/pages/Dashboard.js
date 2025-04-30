import React, { useState } from 'react';
import { useAuth } from '../context/AuthContext';
import ProjectList from '../components/projects/ProjectList';
import ProjectForm from '../components/projects/ProjectForm';

const Dashboard = () => {
  const [showProjectForm, setShowProjectForm] = useState(false);
  const { user, logout } = useAuth();
  
  const handleLogout = async () => {
    try {
      await logout();
    } catch (error) {
      console.error('Logout error:', error);
    }
  };
  
  return (
    <div className="bg-light min-h-screen">
      <header className="bg-white shadow-sm p-3 sm:p-4 mb-4 sm:mb-6">
        <div className="container mx-auto flex flex-col sm:flex-row flex-wrap justify-between items-center gap-2 sm:gap-0">
          <h1 className="text-2xl sm:text-3xl font-bold text-primary">Dashboard</h1>
          
          <div className="flex items-center gap-4 flex-wrap justify-center sm:justify-end w-full sm:w-auto">
            <p className="text-dark text-sm sm:text-base">Welcome back, {user?.name}</p>
            
            <button 
              onClick={handleLogout}
              className="bg-gradient-to-r from-orange-500 to-amber-600 hover:from-orange-600 hover:to-amber-700 text-white font-medium py-1.5 sm:py-2 px-3 sm:px-4 rounded shadow-sm text-sm sm:text-base transition-colors"
            >
              Logout
            </button>
          </div>
        </div>
      </header>
      
      <main className="container mx-auto px-3 sm:px-4 pb-6">
        {showProjectForm ? (
          <div className="mb-4 sm:mb-6">
            <ProjectForm onComplete={() => setShowProjectForm(false)} />
          </div>
        ) : (
          <div className="mb-4 sm:mb-6 flex justify-center sm:justify-start">
            <button
              onClick={() => setShowProjectForm(true)}
              className="bg-gradient-to-r from-orange-500 to-amber-600 hover:from-orange-600 hover:to-amber-700 text-white font-medium py-1.5 sm:py-2 px-3 sm:px-4 rounded shadow-sm text-sm sm:text-base transition-colors w-full sm:w-auto"
            >
              Create New Project
            </button>
          </div>
        )}
        
        <ProjectList />
      </main>
    </div>
  );
};

export default Dashboard; 