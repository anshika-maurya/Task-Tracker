import React, { useEffect, useRef, useState } from 'react';
import { useTasks } from '../../context/TaskContext';
import TaskItem from './TaskItem';
import TaskForm from './TaskForm';

const TaskList = ({ projectId }) => {
  const { tasks, loading, error, fetchTasks, reloadTasks } = useTasks();
  const [showAddForm, setShowAddForm] = useState(false);
  const [localLoading, setLocalLoading] = useState(true);
  const [fetchFailed, setFetchFailed] = useState(false);
  
  // Track if we've initiated the fetch for this project
  const initialFetchRef = useRef(false);
  // Track the current project ID to handle changes
  const currentProjectIdRef = useRef(projectId);
  
  // Handle initial task loading - only fetch tasks once when component mounts
  // or when the project ID changes
  useEffect(() => {
    // Reset the fetch flag when project ID changes
    if (projectId !== currentProjectIdRef.current) {
      initialFetchRef.current = false;
      currentProjectIdRef.current = projectId;
    }
    
    // Skip if no project ID or if we've already initiated a fetch
    if (!projectId || initialFetchRef.current) return;
    
    // Mark that we've started the fetch for this project
    initialFetchRef.current = true;
    
    console.log(`TaskList: Initial fetch for project ${projectId}`);
    setLocalLoading(true);
    
    fetchTasks(projectId)
      .then(() => {
        console.log(`TaskList: Initial fetch completed for project ${projectId}`);
        setFetchFailed(false);
      })
      .catch(err => {
        console.error(`TaskList: Fetch failed for project ${projectId}:`, err);
        setFetchFailed(true);
      })
      .finally(() => {
        setLocalLoading(false);
      });
      
    // Cleanup function
    return () => {
      console.log(`TaskList: Unmounting for project ${projectId}`);
    };
  }, [projectId, fetchTasks]);
  
  // Handle manual retries
  const handleRetry = async () => {
    console.log(`TaskList: Manual retry for project ${projectId}`);
    setLocalLoading(true);
    setFetchFailed(false);
    
    try {
      await reloadTasks(projectId);
      console.log(`TaskList: Retry successful for project ${projectId}`);
    } catch (error) {
      console.error(`TaskList: Retry failed for project ${projectId}:`, error);
      setFetchFailed(true);
    } finally {
      setLocalLoading(false);
    }
  };

  const renderTasksByStatus = (status) => {
    if (!tasks || tasks.length === 0) {
      return <p className="text-dark py-2">No tasks</p>;
    }
    
    const filteredTasks = tasks.filter(task => task.status === status);
    
    if (filteredTasks.length === 0) {
      return <p className="text-dark py-2">No tasks</p>;
    }
    
    return filteredTasks.map(task => (
      <div key={task._id} className="mb-3">
        <TaskItem task={task} projectId={projectId} />
      </div>
    ));
  };
  
  if (loading || localLoading) {
    return (
      <div className="flex justify-center items-center h-32">
        <div className="text-primary">Loading tasks...</div>
      </div>
    );
  }
  
  if (error || fetchFailed) {
    return (
      <div className="mb-6">
        <div className="bg-light border border-secondary text-dark px-4 py-3 rounded mb-4">
          <p>{error || "Failed to load tasks. Please try again."}</p>
          <button 
            onClick={handleRetry}
            className="bg-primary hover:bg-secondary text-white font-bold py-1 px-3 rounded mt-2"
          >
            Try Again
          </button>
        </div>
      </div>
    );
  }
  
  return (
    <div>
      {showAddForm ? (
        <TaskForm 
          projectId={projectId} 
          onComplete={() => setShowAddForm(false)} 
        />
      ) : (
        <div className="bg-white p-6 rounded-lg shadow-md">
          <div className="flex justify-between items-center mb-6">
            <h3 className="text-xl font-bold text-dark">Tasks</h3>
            
            <div className="flex space-x-2">
              <button
                onClick={handleRetry}
                className="bg-light hover:bg-accent text-dark text-sm py-1 px-2 rounded"
                title="Refresh tasks"
              >
                Refresh
              </button>
              <button
                onClick={() => setShowAddForm(true)}
                className="bg-primary hover:bg-secondary text-white font-bold py-2 px-4 rounded"
              >
                Add New Task
              </button>
            </div>
          </div>
          
          {!tasks || tasks.length === 0 ? (
            <div className="text-center py-8">
              <p className="text-dark mb-4">No tasks yet</p>
              <button
                onClick={() => setShowAddForm(true)}
                className="bg-primary hover:bg-secondary text-white font-bold py-2 px-4 rounded"
              >
                Create Your First Task
              </button>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className="bg-light p-4 rounded-lg border border-accent">
                <h4 className="font-semibold text-dark mb-3 flex items-center">
                  <span className="w-3 h-3 bg-accent rounded-full mr-2"></span>
                  Pending
                </h4>
                <div className="space-y-2">
                  {renderTasksByStatus('pending')}
                </div>
              </div>
              
              <div className="bg-light p-4 rounded-lg border border-accent">
                <h4 className="font-semibold text-dark mb-3 flex items-center">
                  <span className="w-3 h-3 bg-secondary rounded-full mr-2"></span>
                  In Progress
                </h4>
                <div className="space-y-2">
                  {renderTasksByStatus('in-progress')}
                </div>
              </div>
              
              <div className="bg-light p-4 rounded-lg border border-accent">
                <h4 className="font-semibold text-dark mb-3 flex items-center">
                  <span className="w-3 h-3 bg-primary rounded-full mr-2"></span>
                  Completed
                </h4>
                <div className="space-y-2">
                  {renderTasksByStatus('completed')}
                </div>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
};

export default TaskList; 