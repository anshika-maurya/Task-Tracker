import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import { useProjects } from '../../context/ProjectContext';

const ProjectCard = ({ project }) => {
  const { deleteProject } = useProjects();
  const [showDetails, setShowDetails] = useState(false);
  
  const handleDelete = async () => {
    if (window.confirm('Are you sure you want to delete this project?')) {
      try {
        await deleteProject(project._id);
      } catch (error) {
        console.error('Error deleting project:', error);
      }
    }
  };
  
  // Calculate task statistics
  const calculateTaskStats = () => {
    const tasks = project.tasks || [];
    const totalTasks = tasks.length;
    
    if (totalTasks === 0) {
      return { completed: 0, inProgress: 0, todo: 0, completionPercentage: 0 };
    }
    
    const completed = tasks.filter(task => task.status === 'completed').length;
    const inProgress = tasks.filter(task => task.status === 'in-progress').length;
    const todo = tasks.filter(task => task.status === 'todo').length;
    const completionPercentage = Math.round((completed / totalTasks) * 100);
    
    return { completed, inProgress, todo, totalTasks, completionPercentage };
  };
  
  const taskStats = calculateTaskStats();
  
  // Handle local projects the same as API projects for user experience
  return (
    <div className="bg-white border border-accent p-4 sm:p-5 rounded-lg shadow-sm hover:shadow-md transition-shadow">
      <div className="flex flex-col sm:flex-row sm:justify-between sm:items-start gap-2">
        <div className="flex-1">
          <h3 className="text-lg sm:text-xl font-semibold text-dark mb-1 sm:mb-2">{project.title}</h3>
          <p className="text-sm text-dark mb-3 sm:mb-4 line-clamp-2">{project.description}</p>
        </div>
        
        <div className="flex sm:flex-col sm:space-y-2">
          <button
            onClick={handleDelete}
            className="text-primary hover:text-secondary text-sm"
          >
            Delete
          </button>
        </div>
      </div>
      
      <div className="mt-3">
        <p className="text-xs sm:text-sm text-gray-600 mb-2">
          Created: {new Date(project.createdAt).toLocaleDateString()}
        </p>
        
        {/* Task count summary and dropdown toggle */}
        <div 
          onClick={() => setShowDetails(!showDetails)}
          className="bg-gradient-to-r from-indigo-50 to-purple-50 hover:from-indigo-100 hover:to-purple-100 p-2 sm:p-3 rounded-lg cursor-pointer transition-all mb-2 border border-indigo-100"
        >
          <div className="flex flex-col sm:flex-row sm:justify-between sm:items-center gap-2 sm:gap-0">
            {/* Task count - Mobile: stacked, Desktop: inline */}
            <div className="flex flex-col sm:flex-row sm:items-center gap-2 sm:gap-0">
              <span className="text-indigo-700 font-medium text-sm sm:text-base">
                Tasks: {taskStats.totalTasks}
              </span>
              <div className="flex flex-wrap gap-1 sm:ml-4 sm:flex-nowrap sm:space-x-1">
                <span className="px-2 py-0.5 text-xs bg-green-100 text-green-800 rounded-full">
                  {taskStats.completed} Done
                </span>
                <span className="px-2 py-0.5 text-xs bg-yellow-100 text-yellow-800 rounded-full">
                  {taskStats.inProgress} In Progress
                </span>
              </div>
            </div>
            
            {/* Progress bar and dropdown icon */}
            <div className="flex items-center justify-between sm:justify-end w-full sm:w-auto mt-1 sm:mt-0">
              <div className="flex items-center">
                <div className="w-16 sm:w-20 bg-gray-200 rounded-full h-2 mr-2">
                  <div 
                    className={`h-2 rounded-full ${
                      taskStats.completionPercentage >= 80 ? 'bg-green-500' : 
                      taskStats.completionPercentage >= 50 ? 'bg-blue-500' : 
                      taskStats.completionPercentage >= 20 ? 'bg-yellow-500' : 'bg-red-500'
                    }`}
                    style={{ width: `${taskStats.completionPercentage}%` }}
                  ></div>
                </div>
                <span className="text-xs sm:text-sm font-medium text-gray-700">{taskStats.completionPercentage}%</span>
              </div>
              <svg 
                className={`ml-2 w-5 h-5 text-gray-500 transition-transform ${showDetails ? 'transform rotate-180' : ''}`} 
                fill="none" 
                stroke="currentColor" 
                viewBox="0 0 24 24" 
                xmlns="http://www.w3.org/2000/svg"
              >
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 9l-7 7-7-7"></path>
              </svg>
            </div>
          </div>
        </div>
        
        {/* Dropdown content */}
        {showDetails && (
          <div className="bg-white border border-indigo-100 rounded-lg p-3 sm:p-4 mb-3 sm:mb-4 transform transition-all duration-200 ease-in-out">
            <h4 className="text-xs sm:text-sm font-medium text-gray-700 mb-2 sm:mb-3">Task Details</h4>
            
            {/* Progress bar */}
            <div className="mb-3 sm:mb-4">
              <div className="flex justify-between text-xs sm:text-sm text-gray-600 mb-1">
                <span>Overall Completion</span>
                <span className="font-medium">{taskStats.completionPercentage}%</span>
              </div>
              <div className="w-full bg-gray-100 rounded-full h-2.5 sm:h-3">
                <div 
                  className={`h-full rounded-full ${
                    taskStats.completionPercentage >= 80 ? 'bg-gradient-to-r from-green-400 to-green-500' : 
                    taskStats.completionPercentage >= 50 ? 'bg-gradient-to-r from-blue-400 to-blue-500' : 
                    taskStats.completionPercentage >= 20 ? 'bg-gradient-to-r from-yellow-400 to-yellow-500' : 
                    'bg-gradient-to-r from-red-400 to-red-500'
                  }`}
                  style={{ width: `${taskStats.completionPercentage}%` }}
                ></div>
              </div>
            </div>
            
            {/* Task statistics - Grid for all screen sizes */}
            <div className="grid grid-cols-3 gap-2 sm:gap-3">
              <div className="bg-gradient-to-br from-green-50 to-green-100 p-2 sm:p-3 rounded-lg border border-green-200">
                <div className="text-center">
                  <span className="block text-xl sm:text-2xl font-bold text-green-700">{taskStats.completed}</span>
                  <span className="block text-xs font-medium text-green-600">Completed</span>
                </div>
              </div>
              <div className="bg-gradient-to-br from-yellow-50 to-yellow-100 p-2 sm:p-3 rounded-lg border border-yellow-200">
                <div className="text-center">
                  <span className="block text-xl sm:text-2xl font-bold text-yellow-700">{taskStats.inProgress}</span>
                  <span className="block text-xs font-medium text-yellow-600">In Progress</span>
                </div>
              </div>
              <div className="bg-gradient-to-br from-blue-50 to-blue-100 p-2 sm:p-3 rounded-lg border border-blue-200">
                <div className="text-center">
                  <span className="block text-xl sm:text-2xl font-bold text-blue-700">{taskStats.todo}</span>
                  <span className="block text-xs font-medium text-blue-600">Todo</span>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
      
      <Link
        to={`/projects/${project._id}`}
        className="bg-gradient-to-r from-orange-500 to-amber-600 hover:from-orange-600 hover:to-amber-700 text-white text-center py-1.5 sm:py-2 px-4 rounded-lg block w-full transition-colors shadow-sm font-medium text-sm sm:text-base"
      >
        View Project
      </Link>
    </div>
  );
};

export default ProjectCard; 