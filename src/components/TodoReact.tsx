import { useState, useEffect } from 'react'

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
        if (!savedTodos) {
          return initialTodos
        }
        const parsed = JSON.parse(savedTodos) as unknown
        if (Array.isArray(parsed)) {
          return parsed as TodoItem[]
        }
        return initialTodos
      } catch (err: unknown) {
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
    } catch (err: unknown) {
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
              >
                {todo.completed ? '↩️' : '✓'}
              </button>
              <button
                className="todo-button delete-button"
                onClick={() => deleteTodo(todo.id)}
              >
                ×
              </button>
            </div>
          </li>
        ))}
      </ul>

      <style>{`
        .todo-component {
          background-color: var(--color-bg-secondary, #f8f9fa);
          border-radius: 8px;
          box-shadow: 0 4px 6px rgba(0, 0, 0, 0.1);
          padding: 1.5rem;
          width: 100%;
        }

        .todo-header {
          margin-bottom: 1.5rem;
          text-align: center;
        }

        .todo-header h2 {
          margin: 0;
          color: var(--color-primary, #333);
          font-size: 1.5rem;
        }

        .todo-form {
          display: flex;
          gap: 0.5rem;
          margin-bottom: 1.5rem;
        }

        .todo-form input {
          flex: 1;
          padding: 0.75rem;
          border: 1px solid var(--color-border, #ddd);
          border-radius: 4px;
          font-size: 1rem;
        }

        .todo-form button {
          background-color: var(--color-accent, #4a7dff);
          color: white;
          border: none;
          border-radius: 4px;
          padding: 0.75rem 1.25rem;
          font-size: 1rem;
          cursor: pointer;
          transition: background-color 0.2s;
        }

        .todo-form button:hover {
          background-color: var(--color-accent-dark, #3a6ae6);
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
          padding: 0.75rem;
          border-bottom: 1px solid var(--color-border, #eee);
          transition: background-color 0.2s;
        }

        .todo-item:hover {
          background-color: var(--color-bg-hover, #f1f3f5);
        }

        .todo-item.completed .todo-text {
          text-decoration: line-through;
          color: var(--color-text-muted, #888);
        }

        .todo-text {
          flex: 1;
          word-break: break-word;
        }

        .todo-actions {
          display: flex;
          gap: 0.5rem;
        }

        .complete-button,
        .delete-button {
          border-radius: 4px;
          padding: 0.4rem 0.6rem;
          font-size: 0.9rem;
          border: none;
          cursor: pointer;
          color: white;
        }

        .complete-button {
          background-color: var(--color-success, #28a745);
        }

        .delete-button {
          background-color: var(--color-danger, #dc3545);
        }
      `}</style>
    </div>
  )
}
