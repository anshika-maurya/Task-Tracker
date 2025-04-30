import React, { useState, useEffect, useRef } from 'react';
import { useParams, Link, useNavigate } from 'react-router-dom';
import { useProjects } from '../context/ProjectContext';
import { TaskProvider } from '../context/TaskContext';
import TaskList from '../components/tasks/TaskList';

const ProjectDetail = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const { getProject, loading, error, notFound } = useProjects();
  const [project, setProject] = useState(null);
  const [fetchError, setFetchError] = useState(null);
  const [isLoading, setIsLoading] = useState(true);
  
  // Track if we've already loaded this project
  const projectFetchedRef = useRef(false);
  // Track the current project ID to detect changes
  const currentProjectIdRef = useRef(id);
  // Store the AbortController for cleanup
  const controllerRef = useRef(null);
  // Track if component is mounted
  const isMountedRef = useRef(true);
  
  // Only fetch project data once when component mounts or when project ID changes
  useEffect(() => {
    // Set mounted flag
    isMountedRef.current = true;
    
    // Reset fetch state if project ID changes
    if (id !== currentProjectIdRef.current) {
      projectFetchedRef.current = false;
      currentProjectIdRef.current = id;
    }
    
    // Skip if we've already loaded this project
    if (projectFetchedRef.current && project) return;
    
    // Create new AbortController for this request
    if (controllerRef.current) {
      controllerRef.current.abort();
    }
    controllerRef.current = new AbortController();
    
    const fetchProject = async () => {
      if (!id) {
        if (isMountedRef.current) {
          setFetchError("No project ID provided");
          setIsLoading(false);
        }
        return;
      }
      
      if (isMountedRef.current) {
        setIsLoading(true);
        setFetchError(null);
      }
      
      try {
        console.log(`ProjectDetail: Fetching project ${id}`);
        const projectData = await getProject(id, { signal: controllerRef.current.signal });
        
        // Only update state if component is still mounted
        if (!isMountedRef.current) return;
        
        if (!projectData) {
          console.error(`ProjectDetail: No data received for project ${id}`);
          setFetchError("Project not found or could not be loaded");
        } else {
          console.log(`ProjectDetail: Loaded project "${projectData.title}"`);
          setProject(projectData);
          projectFetchedRef.current = true;
        }
      } catch (err) {
        // Skip state updates if component unmounted or request was canceled
        if (!isMountedRef.current || err.name === 'AbortError' || err.name === 'CanceledError') {
          console.log(`ProjectDetail: Fetch aborted for project ${id}`);
          return;
        }
        
        console.error(`ProjectDetail: Error fetching project ${id}:`, err);
        setFetchError(err.message || "Failed to load project");
      } finally {
        // Only update loading state if still mounted
        if (isMountedRef.current) {
          setIsLoading(false);
        }
      }
    };
    
    fetchProject();
    
    // Clean up AbortController when component unmounts or ID changes
    return () => {
      console.log(`ProjectDetail: Cleaning up fetch for project ${id}`);
      isMountedRef.current = false;
      if (controllerRef.current) {
        controllerRef.current.abort();
        controllerRef.current = null;
      }
    };
  }, [id, getProject]);
  
  // Handle project not found or loading state
  if (isLoading || loading) {
    return (
      <div className="flex justify-center items-center h-screen">
        <div className="text-xl text-primary">Loading project...</div>
      </div>
    );
  }
  
  // Handle errors
  if (error || fetchError) {
    return (
      <div className="container mx-auto p-8">
        <div className="bg-light border border-secondary text-dark px-4 py-3 rounded">
          <p>Error: {error || fetchError}</p>
          <Link to="/dashboard" className="text-primary hover:text-secondary underline mt-2 inline-block">
            Return to Dashboard
          </Link>
        </div>
      </div>
    );
  }
  
  // Handle project not found
  if (notFound) {
    return (
      <div className="container mx-auto p-8">
        <div className="bg-light border border-secondary text-dark px-4 py-3 rounded">
          <p>Project not found. It may have been deleted or you don't have access.</p>
          <Link to="/dashboard" className="text-primary hover:text-secondary underline mt-2 inline-block">
            Return to Dashboard
          </Link>
        </div>
      </div>
    );
  }
  
  // Protection against rendering with null project
  if (!project) {
    return (
      <div className="container mx-auto p-8">
        <div className="bg-light border border-secondary text-dark px-4 py-3 rounded">
          <p>Could not load project details. Please try again.</p>
          <div className="mt-4 flex space-x-4">
            <button 
              onClick={() => {
                projectFetchedRef.current = false;
                window.location.reload();
              }}
              className="bg-primary hover:bg-secondary text-white font-bold py-2 px-4 rounded"
            >
              Reload Page
            </button>
            <Link 
              to="/dashboard" 
              className="bg-light hover:bg-accent text-dark font-bold py-2 px-4 rounded border border-accent"
            >
              Return to Dashboard
            </Link>
          </div>
        </div>
      </div>
    );
  }
  
  return (
    <div className="bg-light min-h-screen">
      <div className="container mx-auto py-8 px-4">
        <div className="mb-6">
          <Link to="/dashboard" 
            className="text-primary hover:text-secondary mr-2"
          >
            ← Back to Dashboard
          </Link>
        </div>
        
        <div className="bg-white p-6 rounded-lg shadow-md mb-8">
          <div className="flex justify-between items-start flex-wrap">
            <h1 className="text-3xl font-bold text-dark mb-2">{project.title}</h1>
            <p className="text-dark mb-4">{project.description}</p>
            <p className="text-sm text-dark">
              Created: {new Date(project.createdAt).toLocaleDateString()}
            </p>
          </div>
        </div>
        
        {/* Use a stable key to prevent TaskProvider re-renders */}
        <TaskProvider key={`tasks-${id}`}>
          <TaskList projectId={id} />
        </TaskProvider>
      </div>
    </div>
  );
};

export default ProjectDetail; 