import React, { useState } from 'react';
import { useTasks } from '../../context/TaskContext';
import TaskForm from './TaskForm';

const TaskItem = ({ task, projectId }) => {
  const [showEditForm, setShowEditForm] = useState(false);
  const { deleteTask, updateTask } = useTasks();
  
  // Safely format date with fallback
  const formatDate = (dateString) => {
    try {
      return new Date(dateString).toLocaleDateString();
    } catch (error) {
      console.error('Invalid date format:', dateString);
      return 'Invalid date';
    }
  };
  
  const handleDelete = async () => {
    if (window.confirm('Are you sure you want to delete this task?')) {
      try {
        await deleteTask(projectId, task._id);
      } catch (error) {
        console.error('Error deleting task:', error);
        alert('Failed to delete task. Please try again.');
      }
    }
  };
  
  const handleStatusChange = async (newStatus) => {
    try {
      console.log(`Changing task status from ${task.status} to ${newStatus}`);
      await updateTask(projectId, task._id, { 
        ...task, 
        status: newStatus,
        ...(newStatus === 'completed' ? { completedAt: new Date() } : {})
      });
    } catch (error) {
      console.error('Error updating task status:', error);
      alert('Failed to update task status. Please try again.');
    }
  };
  
  const getStatusColor = (status) => {
    switch (status) {
      case 'pending':
        return 'bg-accent text-dark border-secondary';
      case 'in-progress':
        return 'bg-secondary text-white border-primary';
      case 'completed':
        return 'bg-primary text-white border-secondary';
      default:
        return 'bg-light text-dark border-accent';
    }
  };
  
  if (!task || !task._id) {
    console.error('Invalid task object:', task);
    return null;
  }
  
  if (showEditForm) {
    return (
      <TaskForm 
        task={task} 
        projectId={projectId} 
        onComplete={() => setShowEditForm(false)} 
      />
    );
  }
  
  return (
    <div className="bg-white border border-accent rounded-md p-3 shadow-sm hover:shadow-md transition-shadow">
      <div className="flex justify-between items-start mb-2">
        <h4 className="font-medium text-dark">{task.title}</h4>
        <div className="flex space-x-2">
          <button
            onClick={() => setShowEditForm(true)}
            className="text-primary hover:text-secondary text-sm"
          >
            Edit
          </button>
          <button
            onClick={handleDelete}
            className="text-primary hover:text-secondary text-sm"
          >
            Delete
          </button>
        </div>
      </div>
      
      <p className="text-sm text-dark mb-3 line-clamp-2">{task.description}</p>
      
      <div className="flex flex-wrap justify-between items-center">
        <span className={`px-2 py-1 rounded-full text-xs ${getStatusColor(task.status)}`}>
          {task.status.charAt(0).toUpperCase() + task.status.slice(1)}
        </span>
        
        <div className="text-xs text-dark">
          {task.completedAt ? 
            `Completed: ${formatDate(task.completedAt)}` : 
            `Created: ${formatDate(task.createdAt)}`}
        </div>
      </div>
      
      {task.status !== 'completed' && (
        <div className="mt-3 pt-3 border-t border-accent flex justify-end">
          {task.status === 'pending' && (
            <button
              onClick={() => handleStatusChange('in-progress')}
              className="bg-secondary hover:bg-primary text-white text-xs py-1 px-2 rounded"
            >
              Start Task
            </button>
          )}
          {task.status === 'in-progress' && (
            <button
              onClick={() => handleStatusChange('completed')}
              className="bg-primary hover:bg-secondary text-white text-xs py-1 px-2 rounded"
            >
              Complete Task
            </button>
          )}
        </div>
      )}
    </div>
  );
};

export default TaskItem; 