import React, { useState, useEffect } from 'react'

interface TodoItem {
  id: string
  text: string
  completed: boolean
}

interface TodoProps {
  title?: string
  initialTodos?: TodoItem[]
}

export function Todo({ title = 'Todo List', initialTodos = [] }: TodoProps) {
  const [todos, setTodos] = useState<TodoItem[]>([])
  const [inputValue, setInputValue] = useState('')

  // Load todos from localStorage on component mount
  useEffect(() => {
    const loadTodos = () => {
      try {
        const savedTodos = localStorage.getItem('todos')
        return savedTodos ? JSON.parse(savedTodos) : initialTodos
      } catch (err) {
        console.error('Error loading todos:', err)
        return initialTodos
      }
    }

    setTodos(loadTodos())
  }, [initialTodos])

  // Save todos to localStorage whenever they change
  useEffect(() => {
    try {
      localStorage.setItem('todos', JSON.stringify(todos))
    } catch (err) {
      console.error('Error saving todos:', err)
    }
  }, [todos])

  // Generate a unique ID for each todo
  const generateId = () => {
    return Date.now().toString(36) + Math.random().toString(36).substring(2)
  }

  // Add a new todo
  const addTodo = () => {
    const text = inputValue.trim()
    if (!text) {
      return
    }

    const newTodo = {
      id: generateId(),
      text,
      completed: false,
    }

    setTodos((prevTodos) => [...prevTodos, newTodo])
    setInputValue('')
  }

  // Toggle todo completion status
  const toggleTodoComplete = (id: string) => {
    setTodos((prevTodos) =>
      prevTodos.map((todo) =>
        todo.id === id ? { ...todo, completed: !todo.completed } : todo,
      ),
    )
  }

  // Delete a todo
  const deleteTodo = (id: string) => {
    setTodos((prevTodos) => prevTodos.filter((todo) => todo.id !== id))
  }

  // Handle input changes
  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setInputValue(e.target.value)
  }

  // Handle key press (Enter to add todo)
  const handleKeyPress = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') {
      addTodo()
    }
  }

  return (
    <div className="todo-component">
      <div className="todo-header">
        <h2>{title}</h2>
      </div>

      <div className="todo-form">
        <input
          type="text"
          id="todo-input"
          placeholder="Add a new task..."
          value={inputValue}
          onChange={handleInputChange}
          onKeyDown={handleKeyPress}
        />

        <button id="add-todo-btn" onClick={addTodo}>
          Add
        </button>
      </div>

      <ul id="todo-list" className="todo-list">
        {todos.map((todo) => (
          <li
            key={todo.id}
            className={`todo-item ${todo.completed ? 'completed' : ''}`}
            data-id={todo.id}
          >
            <span className="todo-text">{todo.text}</span>
            <div className="todo-actions">
              <button
                className="todo-button complete-button"
                onClick={() => toggleTodoComplete(todo.id)}
                aria-label={
                  todo.completed ? 'Mark as incomplete' : 'Mark as complete'
                }
              >
                {todo.completed ? '⟲' : '✓'}
              </button>
              <button
                className="todo-button delete-button"
                onClick={() => deleteTodo(todo.id)}
                aria-label="Delete task"
              >
                ×
              </button>
            </div>
          </li>
        ))}
      </ul>

      <style>{`
        .todo-component {
          background-color: var(--color-card-bg, rgba(20, 20, 20, 0.85));
          border-radius: var(--radius-md, 8px);
          box-shadow: 0 4px 12px rgba(0, 0, 0, 0.2);
          padding: 1.75rem;
          width: 100%;
          max-width: 100%;
          margin: 0 auto;
          border: 1px solid var(--color-border, rgba(50, 50, 50, 0.3));
        }

        .todo-header {
          margin-bottom: 1.75rem;
          text-align: center;
        }

        .todo-header h2 {
          margin: 0;
          color: var(--color-text, #f3f3f3);
          font-size: 1.75rem;
          font-weight: 600;
        }

        .todo-form {
          display: flex;
          gap: 0.75rem;
          margin-bottom: 1.75rem;
        }

        .todo-form input {
          flex: 1;
          padding: 0.875rem 1rem;
          background-color: var(--color-input-bg, rgba(25, 25, 25, 0.6));
          color: var(--color-text, #f3f3f3);
          border: 1px solid var(--color-border, rgba(50, 50, 50, 0.3));
          border-radius: var(--radius-sm, 4px);
          font-size: 1rem;
          transition: border-color 0.2s, box-shadow 0.2s;
        }

        .todo-form input:focus {
          outline: none;
          border-color: var(--color-primary, #4a9a95);
          box-shadow: 0 0 0 2px rgba(74, 154, 149, 0.25);
        }

        .todo-form button {
          background-color: var(--color-primary, #4a9a95);
          color: white;
          border: none;
          border-radius: var(--radius-sm, 4px);
          padding: 0.875rem 1.5rem;
          font-size: 1rem;
          font-weight: 500;
          cursor: pointer;
          transition: background-color 0.2s, transform 0.1s;
        }

        .todo-form button:hover {
          background-color: var(--color-primary-dark, #3e817d);
        }

        .todo-form button:active {
          transform: translateY(1px);
        }

        .todo-list {
          list-style-type: none;
          padding: 0;
          margin: 0;
        }

        .todo-item {
          display: flex;
          justify-content: space-between;
          align-items: center;
          padding: 0.875rem;
          border-bottom: 1px solid var(--color-border, rgba(50, 50, 50, 0.3));
          transition: background-color 0.2s;
        }

        .todo-item:hover {
          background-color: var(--color-hover, rgba(50, 50, 50, 0.3));
        }

        .todo-item.completed .todo-text {
          text-decoration: line-through;
          color: var(--color-text-muted, #a1a1aa);
        }

        .todo-text {
          flex: 1;
          word-break: break-word;
          color: var(--color-text, #f3f3f3);
          padding: 0 0.5rem;
        }

        .todo-actions {
          display: flex;
          gap: 0.5rem;
        }

        .todo-button {
          border-radius: var(--radius-sm, 4px);
          padding: 0.5rem 0.75rem;
          font-size: 1rem;
          border: none;
          cursor: pointer;
          color: white;
          transition: background-color 0.2s, transform 0.1s;
        }

        .todo-button:active {
          transform: translateY(1px);
        }

        .complete-button {
          background-color: var(--color-primary, #4a9a95);
        }

        .complete-button:hover {
          background-color: var(--color-primary-dark, #3e817d);
        }

        .delete-button {
          background-color: rgba(239, 68, 68, 0.8);
        }

        .delete-button:hover {
          background-color: rgba(239, 68, 68, 1);
        }

        @media (max-width: 480px) {
          .todo-form {
            flex-direction: column;
          }
          .todo-form button {
            width: 100%;
          }
        }
      `}</style>
    </div>
  )
}
