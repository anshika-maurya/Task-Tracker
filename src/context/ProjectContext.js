import React, { createContext, useState, useContext, useEffect, useCallback, useRef } from 'react';
import { useAuth } from './AuthContext';
import api from '../utils/api';

const ProjectContext = createContext();

export const ProjectProvider = ({ children }) => {
  const [projects, setProjects] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [notFound, setNotFound] = useState(false);
  const { user } = useAuth();
  const controllerRef = useRef(null);
  const timeoutRef = useRef(null);
  const fetchingRef = useRef(false);
  const projectsCache = useRef({});
  const projectsFetchedRef = useRef(false);
  const lastFetchTimestamp = useRef(0);
  const pendingFetchPromise = useRef(null);
  
  // Make fetchProjects a useCallback to prevent infinite loops
  const fetchProjects = useCallback(async (forceRefresh = false) => {
    if (!user) {
      setProjects([]);
      // Clear localStorage too when user is logged out
      localStorage.removeItem(`local-projects-${user?._id}`);
      return [];
    }
    
    // Check if there's a recent fetch we can reuse (throttling)
    const now = Date.now();
    const minTimeBetweenFetches = 2000; // 2 seconds
    
    if (pendingFetchPromise.current) {
      console.log('Reusing pending fetch promise');
      return pendingFetchPromise.current;
    }
    
    if (!forceRefresh && 
        now - lastFetchTimestamp.current < minTimeBetweenFetches && 
        projects.length > 0 && 
        projectsFetchedRef.current) {
      console.log('Using recently fetched projects (throttling)');
      return projects;
    }
    
    // Don't refetch if we already have projects and it's not a forced refresh
    if (projects.length > 0 && !forceRefresh && !error && projectsFetchedRef.current) {
      console.log('Using cached projects list');
      return projects;
    }
    
    // Prevent concurrent fetches
    if (fetchingRef.current && !forceRefresh) {
      console.log('Already fetching projects list');
      return projects;
    }
    
    fetchingRef.current = true;
    
    // Create a fetch promise we can reuse for concurrent requests
    pendingFetchPromise.current = (async () => {
      // Only abort previous request if we're making a new one and there's an existing controller
      if (controllerRef.current) {
        controllerRef.current.abort();
        controllerRef.current = null;
        console.log('Aborting previous request');
      }
      
      // Clear any existing timeout
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
        timeoutRef.current = null;
      }
      
      // Create a new controller for this request
      controllerRef.current = new AbortController();
      
      try {
        setLoading(true);
        setError(null);
        setNotFound(false);
        
        // Get locally stored projects first for faster display
        let localProjects = [];
        try {
          // Only load local projects that belong to this user
          const storedProjects = JSON.parse(localStorage.getItem(`local-projects-${user._id}`) || '[]');
          if (storedProjects.length > 0) {
            console.log(`Found ${storedProjects.length} locally stored projects for user ${user._id}`);
            
            // For local projects, load task data from localStorage
            const projectsWithTasks = await Promise.all(storedProjects.map(async (project) => {
              if (project._id.toString().startsWith('local-') || project._id.toString().startsWith('perm-')) {
                try {
                  const tasks = JSON.parse(localStorage.getItem(`tasks-${user._id}-${project._id}`) || '[]');
                  return { ...project, tasks };
                } catch (err) {
                  console.error(`Error getting tasks for project ${project._id}:`, err);
                  return { ...project, tasks: [] };
                }
              }
              return project;
            }));
            
            localProjects = projectsWithTasks;
          }
        } catch (err) {
          console.error('Error parsing local projects:', err);
          // Reset local storage if we have parsing errors
          localStorage.removeItem(`local-projects-${user._id}`);
        }
        
        // Only try API if we're online - this avoids unnecessary API errors
        let apiProjects = [];
        let fetchSuccessful = false;
        
        if (navigator.onLine) {
          try {
            // Add a timeout to prevent hanging
            timeoutRef.current = setTimeout(() => {
              if (controllerRef.current) {
                controllerRef.current.abort();
                console.warn('Projects fetch timed out');
              }
            }, 10000); // Reduced timeout to 10 seconds
            
            console.log('Fetching projects list from API');
            
            // Limit the headers we send to avoid 431 errors
            const headers = {
              'Accept': 'application/json',
              'Content-Type': 'application/json'
            };
            
            // Fetch projects with tasks included by setting include_tasks=true
            const response = await api.get('/projects?include_tasks=true', {
              signal: controllerRef.current.signal,
              headers
            });
            
            if (timeoutRef.current) {
              clearTimeout(timeoutRef.current);
              timeoutRef.current = null;
            }
            
            apiProjects = response.data.projects || [];
            console.log(`Fetched ${apiProjects.length} projects from API for user ${user._id}`);
            fetchSuccessful = true;
            
            // Update timestamp for successful fetch
            lastFetchTimestamp.current = Date.now();
          } catch (error) {
            console.log('API error, continuing with local projects only:', error);
            
            // Handle 431 errors (Request Header Fields Too Large)
            if (error?.response?.status === 431 || 
                (error?.message && error.message.includes('431')) ||
                (typeof error === 'string' && error.includes('431'))) {
              console.warn('Request header too large (431). Clearing localStorage to reduce header size.');
              
              // Clear storage to reduce header size on next request
              localStorage.removeItem(`local-projects-${user._id}`);
              
              // Set specific error message but don't display it to user
              setError('Header size too large. Storage cleared to fix the issue.');
            }
            
            // Continue with just the local projects we loaded
          }
        } else {
          console.log('Offline mode: using only local projects for user', user._id);
        }
        
        // For successful API fetches, replace the localStorage completely with server data
        // This ensures deleted projects don't come back
        let allProjects = [];
        
        if (fetchSuccessful) {
          // On successful fetch, trust the server data as the source of truth
          // But first update local projects with their tasks
          const apiProjectIds = apiProjects.map(p => p._id);
          
          // Keep local-only projects (they won't be in the API response)
          const localOnlyProjects = localProjects.filter(p => 
            (p._id.toString().startsWith('local-') || p._id.toString().startsWith('perm-')) &&
            !apiProjectIds.includes(p._id)
          );
          
          allProjects = [
            ...apiProjects,
            ...localOnlyProjects
          ];
          
          // Replace localStorage completely with the latest data
          // Store only essential data to avoid large headers
          const essentialProjects = allProjects
            .filter(p => !p._id.toString().startsWith('temp-'))
            .map(p => ({
              _id: p._id,
              name: p.name,
              title: p.title,
              description: p.description && p.description.length > 100 ? 
                p.description.substring(0, 100) : p.description, // Limit description size
              createdAt: p.createdAt,
              updatedAt: p.updatedAt
            }));
          
          localStorage.setItem(`local-projects-${user._id}`, JSON.stringify(essentialProjects));
        } else {
          // If API fetch failed, use the local data we have
          allProjects = localProjects;
        }
        
        // Set all projects in state
        setProjects(allProjects);
        projectsFetchedRef.current = true;
        
        return allProjects;
      } catch (error) {
        if (error.name === 'AbortError' || error.name === 'CanceledError') {
          console.log('Request was canceled or aborted');
        } else {
          console.error('Error in fetchProjects:', error);
          // Don't show 431 errors to the user
          if (error?.response?.status === 431 || 
              (error?.message && error.message.includes('431')) ||
              (typeof error === 'string' && error.includes('431'))) {
            setError('Header size too large. Storage cleared to fix the issue.');
          } else {
            setError('Failed to fetch projects');
          }
        }
        return projects; // Return current projects instead of empty array
      } finally {
        setLoading(false);
        fetchingRef.current = false;
        pendingFetchPromise.current = null; // Clear the promise so new fetches can happen
      }
    })();
    
    return pendingFetchPromise.current;
  }, [user, projects, error]);

  // Add getProject function to fetch a single project
  const getProject = useCallback(async (projectId, options = {}) => {
    if (!projectId) {
      setError('Project ID is required');
      return null;
    }
    
    if (!user) {
      setError('User authentication required');
      return null;
    }
    
    try {
      setLoading(true);
      setError(null);
      setNotFound(false);
      
      // Check if this is a local project (client-side only)
      if (projectId.toString().startsWith('local-') || projectId.toString().startsWith('perm-')) {
        console.log(`Looking for local project ${projectId} for user ${user._id}`);
        
        // First check if we already have this project in memory
        const existingProject = projects.find(p => p._id === projectId);
        if (existingProject) {
          console.log(`Found local project ${projectId} in current projects list`);
          return existingProject;
        }
        
        // Otherwise check localStorage
        try {
          const storedProjects = JSON.parse(localStorage.getItem(`local-projects-${user._id}`) || '[]');
          const localProject = storedProjects.find(p => p._id === projectId);
          
          if (localProject) {
            console.log(`Found local project ${projectId} in localStorage`);
            return localProject;
          }
        } catch (err) {
          console.error('Error accessing localStorage:', err);
        }
        
        // If we couldn't find it
        setNotFound(true);
        return null;
      }
      
      // First check if we already have this project in memory or cache
      if (projectsCache.current[projectId]) {
        console.log(`Using cached project ${projectId}`);
        return projectsCache.current[projectId];
      }
      
      const existingProject = projects.find(p => p._id === projectId);
      if (existingProject) {
        console.log(`Found project ${projectId} in current projects list`);
        // Cache it for future reference
        projectsCache.current[projectId] = existingProject;
        return existingProject;
      }
      
      // Otherwise fetch it from the API
      console.log(`Fetching project ${projectId} from API for user ${user._id}`);
      const response = await api.get(`/projects/${projectId}`, {
        signal: options.signal
      });
      
      const fetchedProject = response.data.project;
      
      // Cache the project
      if (fetchedProject) {
        projectsCache.current[projectId] = fetchedProject;
      }
      
      return fetchedProject;
    } catch (error) {
      if (error.name === 'AbortError' || error.name === 'CanceledError') {
        console.log(`Project ${projectId} fetch aborted`);
        throw error; // Let the caller handle abort errors
      }
      
      console.error(`Error fetching project ${projectId}:`, error);
      
      if (error.response?.status === 404) {
        setNotFound(true);
      } else {
        setError(error.response?.data?.message || 'Failed to fetch project details');
      }
      return null;
    } finally {
      setLoading(false);
    }
  }, [projects, user]);

  // Handle initial data loading and cleanup
  useEffect(() => {
    let mounted = true;
    let initialLoadStarted = false;
    
    const loadInitialProjects = async () => {
      if (!user || !mounted || initialLoadStarted) return;
      
      initialLoadStarted = true;
      
      // Don't refetch if we already have projects loaded or a fetch is already in progress
      if ((projects.length > 0 && projectsFetchedRef.current) || pendingFetchPromise.current) {
        initialLoadStarted = false;
        return;
      }
      
      if (fetchingRef.current) {
        initialLoadStarted = false;
        return;
      }
      
      console.log(`Loading initial projects for user ${user._id} on component mount`);
      setLoading(true);
      
      // First try to load local projects from localStorage
      let allProjects = [];
      try {
        const storedProjects = JSON.parse(localStorage.getItem(`local-projects-${user._id}`) || '[]');
        if (storedProjects.length > 0) {
          console.log(`Found ${storedProjects.length} locally stored projects on initial load for user ${user._id}`);
          allProjects = [...storedProjects];
          // Set projects immediately from localStorage for faster UI response
          setProjects(allProjects);
        }
      } catch (err) {
        console.error('Error loading local projects on initial load:', err);
      }
      
      // Then try API fetch if we're online, but only once per 5 seconds
      const now = Date.now();
      if (navigator.onLine && now - lastFetchTimestamp.current > 5000) {
        try {
          // Call the fetchProjects with the forceRefresh flag set to false
          // to prevent unnecessary API calls
          await fetchProjects(false);
        } catch (err) {
          console.error('Error fetching projects from API on initial load:', err);
          
          // If API fetch failed but we have local projects, still mark as fetched
          if (allProjects.length > 0) {
            projectsFetchedRef.current = true;
          }
        }
      } else {
        // If offline but we have local projects, mark as fetched
        if (allProjects.length > 0) {
          projectsFetchedRef.current = true;
        }
      }
      
      setLoading(false);
      initialLoadStarted = false;
    };
    
    loadInitialProjects();
    
    // Cleanup function
    return () => {
      mounted = false;
      if (controllerRef.current) {
        controllerRef.current.abort();
        controllerRef.current = null;
      }
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
        timeoutRef.current = null;
      }
    };
  }, [user, fetchProjects, projects.length]);

  // Clear project cache when user changes
  useEffect(() => {
    // Clear everything if the user changes
    clearProjectCache();
    projectsFetchedRef.current = false;
  }, [user?._id]);

  // Clear project cache function
  const clearProjectCache = useCallback((projectId = null) => {
    if (projectId) {
      console.log(`Clearing cache for project ${projectId}`);
      delete projectsCache.current[projectId];
    } else {
      console.log('Clearing entire projects cache');
      projectsCache.current = {};
      projectsFetchedRef.current = false;
    }
  }, []);

  const createProject = async (projectData) => {
    if (!user) {
      setError('User authentication required');
      return null;
    }
    
    try {
      setLoading(true);
      setError(null);
      
      // First try to create on the server
      if (navigator.onLine) {
        try {
          // For API projects, create through the API
          console.log(`Creating project via API: ${projectData.title}`);
          const response = await api.post('/projects', projectData);
          const newProject = response.data.project;
          
          // Add to our projects state directly - no need to fetch all projects again
          setProjects(prevProjects => {
            // Make sure we don't add duplicates
            const exists = prevProjects.some(p => p._id === newProject._id);
            if (exists) {
              return prevProjects;
            }
            return [...prevProjects, newProject];
          });
          
          // Update the projects cache
          projectsCache.current[newProject._id] = newProject;
          
          // Also add to local storage for offline access - but don't trigger refetch
          try {
            const storedProjects = JSON.parse(localStorage.getItem(`local-projects-${user._id}`) || '[]');
            // Check if project already exists in localStorage
            const exists = storedProjects.some(p => p._id === newProject._id);
            if (!exists) {
              storedProjects.push(newProject);
              localStorage.setItem(`local-projects-${user._id}`, JSON.stringify(storedProjects));
            }
          } catch (err) {
            console.error('Error updating localStorage:', err);
          }
          
          // Update the last fetch timestamp to prevent immediate refetch
          lastFetchTimestamp.current = Date.now();
          
          return newProject;
        } catch (err) {
          // If server creation fails, create locally
          if (err.response?.status === 400 && err.response?.data?.message?.includes('maximum')) {
            // Project limit error
            setError(err.response.data.message);
            throw err;
          }
          
          console.log('API error, creating local project instead:', err);
        }
      }
      
      // Create a local project as fallback
      console.log('Creating local project for user', user._id);
      
      // Create a local project with client-side ID
      const localProject = {
        _id: `local-${Date.now()}`,
        title: projectData.title,
        description: projectData.description,
        userId: user._id,
        createdAt: new Date().toISOString(),
        tasks: [],
        isLocal: true // Flag to indicate this is a local project
      };
      
      // Store in localStorage to persist across refreshes
      try {
        const storedProjects = JSON.parse(localStorage.getItem(`local-projects-${user._id}`) || '[]');
        storedProjects.push(localProject);
        localStorage.setItem(`local-projects-${user._id}`, JSON.stringify(storedProjects));
        console.log(`Project saved to localStorage successfully for user ${user._id}`);
      } catch (err) {
        console.error('Error saving to localStorage:', err);
      }
      
      // Add to our projects state immediately
      setProjects(prevProjects => [...prevProjects, localProject]);
      
      // Update the last fetch timestamp to prevent immediate refetch
      lastFetchTimestamp.current = Date.now();
      
      return localProject;
    } catch (error) {
      console.error('Error creating project:', error);
      setError(error.response?.data?.message || 'Failed to create project');
      throw error;
    } finally {
      setLoading(false);
    }
  };

  const updateProject = async (projectId, projectData) => {
    if (!user) {
      setError('User authentication required');
      return null;
    }
    
    try {
      setLoading(true);
      setError(null);
      
      // Check if this is a local project
      const isLocalProject = projectId.toString().startsWith('local-') || 
                             projectId.toString().startsWith('perm-');
      
      let updatedProject;
      
      if (isLocalProject) {
        // For local projects, update localStorage
        try {
          const storedProjects = JSON.parse(localStorage.getItem(`local-projects-${user._id}`) || '[]');
          const projectIndex = storedProjects.findIndex(project => project._id === projectId);
          
          if (projectIndex !== -1) {
            updatedProject = {
              ...storedProjects[projectIndex],
              ...projectData,
              _id: projectId // Ensure ID doesn't change
            };
            
            storedProjects[projectIndex] = updatedProject;
            localStorage.setItem(`local-projects-${user._id}`, JSON.stringify(storedProjects));
            console.log('Updated local project in localStorage');
          }
        } catch (err) {
          console.error('Error updating localStorage:', err);
          throw new Error('Failed to update local project');
        }
      } else if (navigator.onLine) {
        // For API projects, call the API
        // For API projects, call the server
        console.log(`Updating project ${projectId} via API`);
        const response = await api.put(`/projects/${projectId}`, projectData);
        updatedProject = response.data.project;
      } else {
        throw new Error('Cannot update server project while offline');
      }
      
      // Update the project in state
      if (updatedProject) {
        setProjects(prevProjects => prevProjects.map(project => 
          project._id === projectId ? updatedProject : project
        ));
        
        // Update in cache too
        if (projectsCache.current[projectId]) {
          projectsCache.current[projectId] = updatedProject;
        }
      }
      
      return updatedProject;
    } catch (error) {
      console.error('Error updating project:', error);
      setError(error.response?.data?.message || 'Failed to update project');
      throw error;
    } finally {
      setLoading(false);
    }
  };

  const deleteProject = async (projectId) => {
    if (!user) {
      setError('User authentication required');
      return;
    }
    
    try {
      setLoading(true);
      setError(null);
      
      // Check if this is a locally stored project
      const isLocalProject = projectId.toString().startsWith('local-') || 
                             projectId.toString().startsWith('perm-');
      
      if (isLocalProject) {
        // For local projects, remove from localStorage
        try {
          const storedProjects = JSON.parse(localStorage.getItem(`local-projects-${user._id}`) || '[]');
          const updatedProjects = storedProjects.filter(project => project._id !== projectId);
          localStorage.setItem(`local-projects-${user._id}`, JSON.stringify(updatedProjects));
          console.log('Removed local project from localStorage');
        } catch (err) {
          console.error('Error updating localStorage:', err);
        }
      } else if (navigator.onLine) {
        try {
          // For API projects, call the API
          console.log(`Deleting project ${projectId} via API`);
          const response = await api.delete(`/projects/${projectId}`);
          
          // Check if the deletion was successful or the project was already deleted
          if (response.data.deleted || response.data.alreadyDeleted) {
            console.log(`Project ${projectId} was deleted successfully or was already deleted`);
          } else {
            console.warn(`Unexpected response from server:`, response.data);
          }
        } catch (error) {
          // If the error is 404 (Not Found), the project is already deleted
          if (error.response?.status === 404) {
            console.log(`Project ${projectId} not found - treating as already deleted`);
          } else {
            // Rethrow for other errors
            throw error;
          }
        }
      } else {
        throw new Error('Cannot delete server project while offline');
      }
      
      // Update projects list regardless of API result
      // If we got here, we want to remove it from UI even if the server had issues
      setProjects(prevProjects => prevProjects.filter(project => project._id !== projectId));
      
      // Remove from cache
      if (projectsCache.current[projectId]) {
        delete projectsCache.current[projectId];
      }
      
      // Check if this was the last project
      const remainingProjects = projects.filter(project => project._id !== projectId);
      if (remainingProjects.length === 0) {
        // If this was the last project, clear caches and force a fresh fetch
        clearProjectCache();
        projectsFetchedRef.current = false;
        
        // Wait a short time for the deletion to propagate
        setTimeout(() => {
          // Force fetch from server to ensure we have the latest data
          fetchProjects(true).catch(err => console.error('Error refetching projects after deletion:', err));
        }, 500);
      }
      
      // Update the last fetch timestamp to prevent immediate refetch
      lastFetchTimestamp.current = Date.now();
    } catch (error) {
      console.error('Error deleting project:', error);
      setError(error.response?.data?.message || 'Failed to delete project');
      throw error;
    } finally {
      setLoading(false);
    }
  };

  return (
    <ProjectContext.Provider 
      value={{ 
        projects, 
        loading, 
        error,
        notFound, 
        fetchProjects,
        getProject,
        clearProjectCache,
        createProject, 
        updateProject, 
        deleteProject 
      }}
    >
      {children}
    </ProjectContext.Provider>
  );
};

export const useProjects = () => {
  return useContext(ProjectContext);
};