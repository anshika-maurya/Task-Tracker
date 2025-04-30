import React, { useEffect, useState, useRef } from 'react';
import { Link } from 'react-router-dom';
import { useProjects } from '../../context/ProjectContext';
import { useTasks } from '../../context/TaskContext';
import ProjectCard from './ProjectCard';
import api from '../../utils/api';

const ProjectList = () => {
  const { projects, loading, error, fetchProjects } = useProjects();
  const [localLoading, setLocalLoading] = useState(true);
  const [retryCount, setRetryCount] = useState(0);
  const fetchedRef = useRef(false);
  const [visibleProjects, setVisibleProjects] = useState(2);
  const [isRetrying, setIsRetrying] = useState(false);
  const [projectsWithTasks, setProjectsWithTasks] = useState([]);
  
  // Fetch projects and then get tasks for each project
  useEffect(() => {
    const getProjects = async () => {
      // Don't fetch if we're already loading from context
      if (loading) return;
      
      // Prevent multiple calls within the same render cycle
      if (fetchedRef.current && retryCount === 0) return;
      
      setLocalLoading(true);
      
      try {
        const fetchedProjects = await fetchProjects(retryCount > 0); // Force refresh on retry
        fetchedRef.current = true;
        
        // After projects are loaded, fetch tasks for each project
        await loadTasksForProjects(fetchedProjects);
      } catch (err) {
        // Error handling is managed by the context
        // If we get a 431 error, clear localStorage to reduce header size on next request
        if (err?.message?.includes('431') || (typeof err === 'string' && err.includes('431'))) {
          // Clear non-essential data from localStorage
          const userId = JSON.parse(localStorage.getItem('user'))?._id;
          if (userId) {
            localStorage.removeItem(`local-projects-${userId}`);
          }
        }
      } finally {
        setLocalLoading(false);
        setIsRetrying(false); // Reset retry state when fetch completes
      }
    };
    
    getProjects();

    return () => {
      // Cleanup if needed
    };
  }, [fetchProjects, retryCount, loading]);
  
  // Load tasks for each project
  const loadTasksForProjects = async (projects) => {
    if (!projects || projects.length === 0) return;
    
    const enhancedProjects = await Promise.all(
      projects.map(async (project) => {
        try {
          // For local projects, get tasks from localStorage
          if (project._id.toString().startsWith('local-') || project._id.toString().startsWith('perm-')) {
            const userId = JSON.parse(localStorage.getItem('user'))?._id;
            if (userId) {
              const tasks = JSON.parse(localStorage.getItem(`tasks-${userId}-${project._id}`) || '[]');
              return { ...project, tasks };
            }
          } else {
            // For server projects, fetch tasks from API
            try {
              const response = await api.get(`/projects/${project._id}/tasks`);
              return { ...project, tasks: response.data.tasks || [] };
            } catch (error) {
              console.error(`Error fetching tasks for project ${project._id}:`, error);
              return { ...project, tasks: [] };
            }
          }
        } catch (error) {
          console.error(`Error processing tasks for project ${project._id}:`, error);
        }
        
        // Return project with empty tasks array if there was an error
        return { ...project, tasks: [] };
      })
    );
    
    setProjectsWithTasks(enhancedProjects);
  };

  // Update projectsWithTasks when projects change
  useEffect(() => {
    if (projects.length > 0 && !loading) {
      loadTasksForProjects(projects);
    }
  }, [projects]);

  // Update localLoading when context loading changes
  useEffect(() => {
    if (!loading && projects.length > 0) {
      setLocalLoading(false);
    }
  }, [loading, projects]);
  
  const handleRetry = () => {
    // Prevent multiple retries at once
    if (isRetrying || loading) return;
    
    setIsRetrying(true);
    setLocalLoading(true);
    fetchedRef.current = false;
    setRetryCount(prev => prev + 1); // Increment retry count to trigger useEffect
  };

  const loadMoreProjects = () => {
    setVisibleProjects(prev => prev + 2);
  };

  // Show loading indicator when first loading
  if ((localLoading || loading) && projects.length === 0) {
    return (
      <div className="flex justify-center items-center h-40 sm:h-64">
        <div className="text-lg sm:text-xl text-gray-500">Loading projects...</div>
      </div>
    );
  }

  // Handle error case
  if (error) {
    // Ignore project limit errors from the UI and 431 errors
    if (error.includes('project limit') || error.includes('maximum project') || 
        error.includes('431') || error.includes('Header Fields Too Large')) {
      // Just continue rendering the projects instead of showing an error
    } else {
      return (
        <div className="bg-red-100 border border-red-400 text-red-700 px-3 sm:px-4 py-2 sm:py-3 rounded mb-4 border text-sm sm:text-base">
          <p>{error}</p>
          <button 
            onClick={handleRetry}
            disabled={isRetrying || loading}
            className={`${isRetrying ? 'bg-red-300' : 'bg-red-500 hover:bg-red-700'} text-white font-bold text-xs sm:text-sm py-1 px-2 sm:px-3 rounded mt-2`}
          >
            {isRetrying ? 'Retrying...' : 'Try Again'}
          </button>
        </div>
      );
    }
  }

  // Determine which projects to display - either from projectsWithTasks or regular projects
  const displayProjects = projectsWithTasks.length > 0 ? projectsWithTasks : projects;

  return (
    <div className="bg-white p-3 sm:p-4 md:p-6 rounded-lg shadow-md">
      <div className="mb-3 sm:mb-4 md:mb-6">
        <h2 className="text-xl sm:text-2xl font-bold text-gray-800">My Projects</h2>
      </div>

      {/* Only show the empty state when there are truly no projects and we're not loading */}
      {displayProjects.length === 0 && !localLoading && !loading ? (
        <div className="text-center py-4 sm:py-8">
          <p className="text-gray-500 mb-4 text-sm sm:text-base">You don't have any projects yet</p>
        </div>
      ) : (
        <>
          <div className="grid grid-cols-1 gap-3 sm:gap-4 md:gap-6 lg:grid-cols-2">
            {displayProjects.slice(0, visibleProjects).map((project) => (
              <ProjectCard key={project._id} project={project} />
            ))}
          </div>
          
          {visibleProjects < displayProjects.length && (
            <div className="flex justify-center mt-4 sm:mt-6">
              <button
                onClick={loadMoreProjects}
                className="bg-gray-100 hover:bg-gray-200 text-gray-800 font-medium text-sm sm:text-base py-1.5 sm:py-2 px-3 sm:px-4 rounded shadow-sm transition-colors"
              >
                See More
              </button>
            </div>
          )}
        </>
      )}
    </div>
  );
};

export default ProjectList; 