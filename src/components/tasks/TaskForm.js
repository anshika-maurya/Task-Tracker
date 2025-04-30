import React, { useState } from 'react';
import { useTasks } from '../../context/TaskContext';

const TaskForm = ({ task = null, projectId, onComplete }) => {
  const [formData, setFormData] = useState({
    title: task?.title || '',
    description: task?.description || '',
    status: task?.status || 'pending'
  });
  const [error, setError] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  
  const { createTask, updateTask } = useTasks();
  const isEditing = !!task;
  
  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData({ ...formData, [name]: value });
  };
  
  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    
    if (!formData.title.trim() || !formData.description.trim()) {
      setError('Title and description are required');
      return;
    }
    
    setIsSubmitting(true);
    
    try {
      if (isEditing) {
        await updateTask(projectId, task._id, formData);
        console.log(`Task updated: ${formData.title}`);
      } else {
        await createTask(projectId, formData);
        console.log(`New task created: ${formData.title}`);
      }
      // On successful submission, call onComplete to close form
      onComplete();
    } catch (error) {
      console.error('Task submission error:', error);
      setError(error.response?.data?.message || 'Something went wrong. Please try again.');
    } finally {
      setIsSubmitting(false);
    }
  };
  
  return (
    <div className="bg-light p-4 rounded-lg mb-6 border border-accent">
      <h3 className="text-lg font-semibold mb-4 text-dark">
        {isEditing ? 'Edit Task' : 'Create New Task'}
      </h3>
      
      {error && (
        <div className="bg-light border border-secondary text-dark px-4 py-3 rounded mb-4">
          {error}
        </div>
      )}
      
      <form onSubmit={handleSubmit}>
        <div className="mb-4">
          <label className="block text-dark text-sm font-bold mb-2" htmlFor="title">
            Task Title
          </label>
          <input
            className="shadow appearance-none border border-accent rounded w-full py-2 px-3 text-dark leading-tight focus:outline-none focus:shadow-outline"
            id="title"
            type="text"
            name="title"
            placeholder="Enter task title"
            value={formData.title}
            onChange={handleChange}
            required
          />
        </div>
        
        <div className="mb-4">
          <label className="block text-dark text-sm font-bold mb-2" htmlFor="description">
            Description
          </label>
          <textarea
            className="shadow appearance-none border border-accent rounded w-full py-2 px-3 text-dark leading-tight focus:outline-none focus:shadow-outline h-24"
            id="description"
            name="description"
            placeholder="Enter task description"
            value={formData.description}
            onChange={handleChange}
            required
          />
        </div>
        
        {isEditing && (
          <div className="mb-4">
            <label className="block text-dark text-sm font-bold mb-2" htmlFor="status">
              Status
            </label>
            <select
              className="shadow appearance-none border border-accent rounded w-full py-2 px-3 text-dark leading-tight focus:outline-none focus:shadow-outline"
              id="status"
              name="status"
              value={formData.status}
              onChange={handleChange}
            >
              <option value="pending">Pending</option>
              <option value="in-progress">In Progress</option>
              <option value="completed">Completed</option>
            </select>
          </div>
        )}
        
        <div className="flex justify-end">
          <button
            type="button"
            className="bg-light hover:bg-accent text-dark font-bold py-2 px-4 rounded mr-2"
            onClick={() => onComplete()}
          >
            Cancel
          </button>
          <button
            type="submit"
            className="bg-primary hover:bg-secondary text-white font-bold py-2 px-4 rounded"
            disabled={isSubmitting}
          >
            {isSubmitting 
              ? 'Saving...' 
              : isEditing 
                ? 'Update Task' 
                : 'Create Task'
            }
          </button>
        </div>
      </form>
    </div>
  );
};

export default TaskForm; 