import React, { createContext, useState, useContext, useCallback, useEffect, useRef } from 'react';
import api from '../utils/api';
import { useAuth } from './AuthContext';

const TaskContext = createContext();

export const TaskProvider = ({ children }) => {
  const [tasks, setTasks] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [currentProjectId, setCurrentProjectId] = useState(null);
  const controllerRef = useRef(null);
  const timeoutRef = useRef(null);
  const fetchingRef = useRef(false);
  const tasksCache = useRef({});
  const projectTasksLoadedRef = useRef({});
  const { user } = useAuth();

  const fetchTasks = useCallback(async (projectId, forceRefresh = false) => {
    if (!projectId) {
      setTasks([]);
      return [];
    }
    
    if (!user) {
      setError('User authentication required');
      setTasks([]);
      return [];
    }
    
    // Check if it's a local project (client-side only)
    const isLocalProject = projectId.toString().startsWith('local-') || 
                           projectId.toString().startsWith('perm-');
    
    // For local projects, we get tasks from localStorage
    if (isLocalProject) {
      try {
        setLoading(true);
        
        // Get tasks for this project from localStorage
        const localTasks = JSON.parse(localStorage.getItem(`tasks-${user._id}-${projectId}`) || '[]');
        setTasks(localTasks);
        
        return localTasks;
      } catch (err) {
        console.error('Error loading tasks from localStorage:', err);
        setError('Failed to load tasks');
        return [];
      } finally {
        setLoading(false);
      }
    }
    
    // Don't fetch if we've already loaded tasks for this project (unless force refresh)
    if (!forceRefresh && projectTasksLoadedRef.current[projectId]) {
      console.log(`Tasks already loaded for project ${projectId}, using cached data`);
      if (tasksCache.current[projectId]) {
        setTasks(tasksCache.current[projectId]);
        return tasksCache.current[projectId];
      }
    }
    
    // Prevent concurrent fetches
    if (fetchingRef.current) {
      console.log('Already fetching tasks');
      return tasks;
    }
    
    fetchingRef.current = true;
    
    // Abort any previous requests
    if (controllerRef.current) {
      controllerRef.current.abort();
      controllerRef.current = null;
    }
    
    // Create a new AbortController for this request
    controllerRef.current = new AbortController();
    
    // Set a timeout to prevent hanging requests
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
    }
    
    timeoutRef.current = setTimeout(() => {
      if (controllerRef.current) {
        controllerRef.current.abort();
        console.log('Tasks fetch timed out');
      }
    }, 10000);
    
    try {
      setLoading(true);
      setError(null);
      
      // Use the dedicated tasks endpoint instead of getting project data
      console.log(`Fetching tasks for project ${projectId}`);
      const response = await api.get(`/projects/${projectId}/tasks`, {
        signal: controllerRef.current.signal
      });
      
      clearTimeout(timeoutRef.current);
      timeoutRef.current = null;
      
      const fetchedTasks = response.data.tasks || [];
      console.log(`Retrieved ${fetchedTasks.length} tasks for project ${projectId}`);
      
      // Cache the tasks
      tasksCache.current[projectId] = fetchedTasks;
      projectTasksLoadedRef.current[projectId] = true;
      
      // Set to state
      setTasks(fetchedTasks);
      return fetchedTasks;
    } catch (error) {
      if (error.name === 'AbortError' || error.name === 'CanceledError') {
        console.log('Request was canceled');
      } else {
        console.error('Error fetching tasks:', error);
        setError(error.response?.data?.message || 'Failed to fetch tasks');
      }
      return [];
    } finally {
      setLoading(false);
      fetchingRef.current = false;
    }
  }, [tasks, user]);

  // Set current project ID to track which project's tasks we're viewing
  const setProject = useCallback((projectId) => {
    setCurrentProjectId(projectId);
  }, []);

  // Clear cache when user changes
  useEffect(() => {
    // Clear everything on user change
    tasksCache.current = {};
    projectTasksLoadedRef.current = {};
  }, [user?._id]);

  // Create a new task
  const createTask = async (projectId, taskData) => {
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
      
      // Check if it's a local project
      const isLocalProject = projectId.toString().startsWith('local-') || 
                             projectId.toString().startsWith('perm-');
      
      if (isLocalProject) {
        // For local projects, store in localStorage
        const newTask = {
          _id: `task-${Date.now()}`,
          ...taskData,
          createdAt: new Date().toISOString()
        };
        
        try {
          // Get current tasks for this project
          const currentTasks = JSON.parse(localStorage.getItem(`tasks-${user._id}-${projectId}`) || '[]');
          
          // Add new task
          const updatedTasks = [...currentTasks, newTask];
          
          // Save back to localStorage
          localStorage.setItem(`tasks-${user._id}-${projectId}`, JSON.stringify(updatedTasks));
          
          // Update state
          setTasks(updatedTasks);
          
          // Update cache
          tasksCache.current[projectId] = updatedTasks;
          
          return newTask;
        } catch (err) {
          console.error('Error saving task to localStorage:', err);
          throw new Error('Failed to save task locally');
        }
      }
      
      // For server projects
      console.log(`Creating task for project ${projectId}:`, taskData);
      const response = await api.post(`/projects/${projectId}/tasks`, taskData);
      const createdTask = response.data.task;
      console.log(`Task created with ID ${createdTask._id}`);
      
      // Update tasks state
      setTasks(prevTasks => [...prevTasks, createdTask]);
      
      // Update cache
      if (tasksCache.current[projectId]) {
        tasksCache.current[projectId] = [...tasksCache.current[projectId], createdTask];
      }
      
      return createdTask;
    } catch (error) {
      console.error('Error creating task:', error);
      setError(error.response?.data?.message || 'Failed to create task');
      throw error;
    } finally {
      setLoading(false);
    }
  };

  // Update a task
  const updateTask = async (projectId, taskId, taskData) => {
    if (!projectId || !taskId) {
      setError('Project ID and Task ID are required');
      return null;
    }
    
    if (!user) {
      setError('User authentication required');
      return null;
    }
    
    try {
      setLoading(true);
      setError(null);
      
      // Check if it's a local project
      const isLocalProject = projectId.toString().startsWith('local-') || 
                             projectId.toString().startsWith('perm-');
      
      if (isLocalProject) {
        try {
          // Get current tasks
          const currentTasks = JSON.parse(localStorage.getItem(`tasks-${user._id}-${projectId}`) || '[]');
          
          // Find and update task
          const taskIndex = currentTasks.findIndex(t => t._id === taskId);
          
          if (taskIndex === -1) {
            throw new Error('Task not found');
          }
          
          const updatedTask = {
            ...currentTasks[taskIndex],
            ...taskData
          };
          
          const updatedTasks = [...currentTasks];
          updatedTasks[taskIndex] = updatedTask;
          
          // Save back to localStorage
          localStorage.setItem(`tasks-${user._id}-${projectId}`, JSON.stringify(updatedTasks));
          
          // Update state
          setTasks(updatedTasks);
          
          // Update cache
          tasksCache.current[projectId] = updatedTasks;
          
          return updatedTask;
        } catch (err) {
          console.error('Error updating task in localStorage:', err);
          throw new Error('Failed to update task locally');
        }
      }
      
      // For server projects
      console.log(`Updating task ${taskId} for project ${projectId}`);
      const response = await api.put(`/projects/${projectId}/tasks/${taskId}`, taskData);
      const updatedTask = response.data.task;
      console.log(`Task ${taskId} updated successfully`);
      
      // Update state
      setTasks(prevTasks => prevTasks.map(task => 
        task._id === taskId ? updatedTask : task
      ));
      
      // Update cache
      if (tasksCache.current[projectId]) {
        tasksCache.current[projectId] = tasksCache.current[projectId].map(task => 
          task._id === taskId ? updatedTask : task
        );
      }
      
      return updatedTask;
    } catch (error) {
      console.error('Error updating task:', error);
      setError(error.response?.data?.message || 'Failed to update task');
      throw error;
    } finally {
      setLoading(false);
    }
  };

  // Delete a task
  const deleteTask = async (projectId, taskId) => {
    if (!projectId || !taskId) {
      setError('Project ID and Task ID are required');
      return;
    }
    
    if (!user) {
      setError('User authentication required');
      return;
    }
    
    try {
      setLoading(true);
      setError(null);
      
      // Check if it's a local project
      const isLocalProject = projectId.toString().startsWith('local-') || 
                             projectId.toString().startsWith('perm-');
      
      if (isLocalProject) {
        try {
          // Get current tasks
          const currentTasks = JSON.parse(localStorage.getItem(`tasks-${user._id}-${projectId}`) || '[]');
          
          // Filter out deleted task
          const updatedTasks = currentTasks.filter(task => task._id !== taskId);
          
          // Save back to localStorage
          localStorage.setItem(`tasks-${user._id}-${projectId}`, JSON.stringify(updatedTasks));
          
          // Update state
          setTasks(updatedTasks);
          
          // Update cache
          tasksCache.current[projectId] = updatedTasks;
        } catch (err) {
          console.error('Error deleting task from localStorage:', err);
          throw new Error('Failed to delete task locally');
        }
      } else {
        // For server projects
        console.log(`Deleting task ${taskId} from project ${projectId}`);
        await api.delete(`/projects/${projectId}/tasks/${taskId}`);
        console.log(`Task ${taskId} deleted successfully`);
        
        // Update state
        setTasks(prevTasks => prevTasks.filter(task => task._id !== taskId));
        
        // Update cache
        if (tasksCache.current[projectId]) {
          tasksCache.current[projectId] = tasksCache.current[projectId].filter(task => 
            task._id !== taskId
          );
        }
      }
    } catch (error) {
      console.error('Error deleting task:', error);
      setError(error.response?.data?.message || 'Failed to delete task');
      throw error;
    } finally {
      setLoading(false);
    }
  };

  // Clear tasks cache for a project
  const clearTasksCache = useCallback((projectId = null) => {
    if (projectId) {
      delete tasksCache.current[projectId];
      delete projectTasksLoadedRef.current[projectId];
    } else {
      tasksCache.current = {};
      projectTasksLoadedRef.current = {};
    }
  }, []);

  // Add reloadTasks function to force refresh
  const reloadTasks = useCallback(async (projectId) => {
    if (!projectId) {
      setError('Project ID is required for reloading tasks');
      return [];
    }
    
    // Clear the cache for this project to force a fresh fetch
    delete tasksCache.current[projectId];
    delete projectTasksLoadedRef.current[projectId];
    
    // Call fetchTasks with forceRefresh=true
    return await fetchTasks(projectId, true);
  }, [fetchTasks]);

  return (
    <TaskContext.Provider value={{ 
      tasks, 
      loading, 
      error, 
      currentProjectId,
      fetchTasks,
      reloadTasks,
      setProject, 
      createTask, 
      updateTask,
      deleteTask,
      clearTasksCache
    }}>
      {children}
    </TaskContext.Provider>
  );
};

export const useTasks = () => {
  return useContext(TaskContext);
}; 