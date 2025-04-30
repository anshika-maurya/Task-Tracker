import React, { useState } from 'react';
import { useProjects } from '../../context/ProjectContext';

const ProjectForm = ({ project = null, onComplete }) => {
  const [formData, setFormData] = useState({
    title: project?.title || '',
    description: project?.description || ''
  });
  const [error, setError] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  
  const { createProject, updateProject } = useProjects();
  const isEditing = !!project;
  
  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData({ ...formData, [name]: value });
  };
  
  const handleSubmit = async (e) => {
    e.preventDefault();
    
    // Basic form validation
    if (!formData.title.trim()) {
      setError('Project title is required');
      return;
    }
    
    if (!formData.description.trim()) {
      setError('Project description is required');
      return;
    }
    
    setError('');
    setIsSubmitting(true);
    
    try {
      if (isEditing) {
        // Handle editing existing project
        await updateProject(project._id, formData);
      } else {
        // Create a new project (always local)
        await createProject(formData);
      }
      
      // Close the form on success
      onComplete();
    } catch (err) {
      console.error('Error submitting form:', err);
      setError('Failed to save project. Please try again.');
    } finally {
      setIsSubmitting(false);
    }
  };
  
  return (
    <div className="bg-light p-4 rounded-lg mb-6 border border-accent">
      <h3 className="text-lg font-semibold mb-4 text-dark">
        {isEditing ? 'Edit Project' : 'Create New Project'}
      </h3>
      
      {error && (
        <div className="bg-light border border-secondary text-dark px-4 py-3 rounded mb-4">
          {error}
        </div>
      )}
      
      <form onSubmit={handleSubmit}>
        <div className="mb-4">
          <label className="block text-dark text-sm font-bold mb-2" htmlFor="title">
            Project Title
          </label>
          <input
            className="shadow appearance-none border border-accent rounded w-full py-2 px-3 text-dark leading-tight focus:outline-none focus:shadow-outline"
            id="title"
            type="text"
            name="title"
            placeholder="Enter project title"
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
            placeholder="Enter project description"
            value={formData.description}
            onChange={handleChange}
            required
          />
        </div>
        
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
                ? 'Update Project' 
                : 'Create Project'
            }
          </button>
        </div>
      </form>
    </div>
  );
};

export default ProjectForm; 