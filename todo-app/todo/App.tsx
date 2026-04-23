import React, { useState, useEffect, useCallback } from 'react'
import { Plus, Edit2, Trash2, CheckCircle, Circle, AlertCircle, Clock, Tag } from 'lucide-react'

interface SubTodo {
  id: string
  title: string
  status: string
  description?: string
}

interface Todo {
  id: string
  title: string
  status: string
  priority?: string
  labels?: string[]
  description?: string
  subtodos?: SubTodo[]
}

interface Config {
  allowedLabels: string[]
  statusOptions: string[]
}

const API_BASE = '/api'

function TodoApp() {
  const [todos, setTodos] = useState<Todo[]>([])
  const [config, setConfig] = useState<Config>({ allowedLabels: [], statusOptions: [] })
  const [newTodoTitle, setNewTodoTitle] = useState('')
  const [newTodoDesc, setNewTodoDesc] = useState('')
  const [editingTodo, setEditingTodo] = useState<Todo | null>(null)
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [lastUpdated, setLastUpdated] = useState<string>('')

  // Load config and todos
  const loadData = useCallback(async () => {
    try {
      setIsLoading(true)
      const [configRes, todosRes] = await Promise.all([
        fetch(`${API_BASE}/config`),
        fetch(`${API_BASE}/todos`)
      ])
      
      if (configRes.ok) {
        const cfg = await configRes.json()
        setConfig(cfg)
      }
      
      if (todosRes.ok) {
        const data = await todosRes.json()
        setTodos(data.todos || [])
        setLastUpdated(data.lastUpdated || '')
      }
    } catch (err) {
      setError('Failed to load data. Is the API server running?')
      console.error(err)
    } finally {
      setIsLoading(false)
    }
  }, [])

  // Poll for changes every 3s to support manual YAML edits on disk
  useEffect(() => {
    loadData()
    const interval = setInterval(loadData, 3000)
    return () => clearInterval(interval)
  }, [loadData])

  const saveTodo = async (todoData: Partial<Todo> & { id?: string }) => {
    try {
      const method = todoData.id ? 'PUT' : 'POST'
      const url = todoData.id 
        ? `${API_BASE}/todos/${todoData.id}` 
        : `${API_BASE}/todos`
      
      const response = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(todoData)
      })
      
      if (!response.ok) throw new Error('Failed to save')
      await loadData() // Refresh
      setNewTodoTitle('')
      setNewTodoDesc('')
      setEditingTodo(null)
      setError(null)
    } catch (err) {
      setError('Failed to save todo')
      console.error(err)
    }
  }

  const updateTodoStatus = async (id: string, status: string) => {
    await saveTodo({ id, status })
  }

  const deleteTodo = async (id: string) => {
    if (!confirm('Delete this todo?')) return
    try {
      await fetch(`${API_BASE}/todos/${id}`, { method: 'DELETE' })
      await loadData()
    } catch (err) {
      setError('Failed to delete')
    }
  }

  const addSubtodo = async (todoId: string, title: string) => {
    if (!title.trim()) return
    try {
      await fetch(`${API_BASE}/todos/${todoId}/subtodos`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ title, status: 'unstarted' })
      })
      await loadData()
    } catch (err) {
      setError('Failed to add subtodo')
    }
  }

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'done': return 'text-green-600 bg-green-100'
      case 'in_progress': return 'text-blue-600 bg-blue-100'
      case 'blocked': return 'text-red-600 bg-red-100'
      default: return 'text-gray-600 bg-gray-100'
    }
  }

  const getPriorityColor = (priority?: string) => {
    switch (priority) {
      case 'high': return 'text-red-500'
      case 'medium': return 'text-yellow-500'
      default: return 'text-gray-400'
    }
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-4xl mx-auto p-6">
        {/* Header */}
        <div className="flex items-center justify-between mb-8">
          <div>
            <h1 className="text-4xl font-bold text-gray-900 flex items-center gap-3">
              <CheckCircle className="w-10 h-10 text-emerald-600" />
              Todo Manager
            </h1>
            <p className="text-gray-600 mt-1">Isolated development workflow tool • Auto-refreshes on YAML changes</p>
            {lastUpdated && (
              <p className="text-xs text-gray-500 mt-1">
                Last updated: {new Date(lastUpdated).toLocaleTimeString()}
              </p>
            )}
          </div>
          <div className="flex items-center gap-4">
            <div className={`px-3 py-1 rounded-full text-xs font-medium ${isLoading ? 'bg-amber-100 text-amber-700' : 'bg-emerald-100 text-emerald-700'}`}>
              {isLoading ? 'Syncing...' : 'Connected'}
            </div>
            <button
              onClick={loadData}
              className="px-4 py-2 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 text-sm flex items-center gap-2"
            >
              <Clock className="w-4 h-4" />
              Refresh
            </button>
          </div>
        </div>

        {error && (
          <div className="mb-6 p-4 bg-red-50 border border-red-200 text-red-700 rounded-xl flex items-start gap-3">
            <AlertCircle className="w-5 h-5 mt-0.5 flex-shrink-0" />
            <div>
              <p className="font-medium">{error}</p>
              <p className="text-sm mt-1">Make sure both the API server (port 3001) and Vite dev server are running.</p>
            </div>
          </div>
        )}

        {/* Add New Todo */}
        <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6 mb-8">
          <h2 className="text-lg font-semibold mb-4 flex items-center gap-2">
            <Plus className="w-5 h-5" /> Add New Todo
          </h2>
          <div className="flex gap-3">
            <input
              type="text"
              value={newTodoTitle}
              onChange={(e) => setNewTodoTitle(e.target.value)}
              placeholder="What needs to be done?"
              className="flex-1 px-4 py-3 border border-gray-200 rounded-xl focus:outline-none focus:border-blue-500 text-lg"
              onKeyDown={(e) => e.key === 'Enter' && saveTodo({ title: newTodoTitle, description: newTodoDesc })}
            />
            <button
              onClick={() => saveTodo({ title: newTodoTitle, description: newTodoDesc })}
              disabled={!newTodoTitle.trim()}
              className="px-8 py-3 bg-blue-600 hover:bg-blue-700 disabled:bg-gray-300 text-white font-medium rounded-xl transition-colors flex items-center gap-2"
            >
              <Plus className="w-4 h-4" /> Add
            </button>
          </div>
          <textarea
            value={newTodoDesc}
            onChange={(e) => setNewTodoDesc(e.target.value)}
            placeholder="Description (optional)"
            className="mt-3 w-full px-4 py-3 border border-gray-200 rounded-xl focus:outline-none focus:border-blue-500 h-20 resize-y"
          />
        </div>

        {/* Todos List */}
        <div className="space-y-4">
          {todos.length === 0 && !isLoading && (
            <div className="bg-white rounded-2xl p-12 text-center border border-dashed border-gray-200">
              <CheckCircle className="w-12 h-12 mx-auto text-gray-300 mb-4" />
              <p className="text-gray-500">No todos yet. Add one above to get started.</p>
            </div>
          )}

          {todos.map((todo) => (
            <div key={todo.id} className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6 group">
              <div className="flex items-start gap-4">
                <button
                  onClick={() => updateTodoStatus(todo.id, todo.status === 'done' ? 'in_progress' : 'done')}
                  className="mt-1 flex-shrink-0"
                >
                  {todo.status === 'done' ? (
                    <CheckCircle className="w-6 h-6 text-emerald-500" />
                  ) : (
                    <Circle className="w-6 h-6 text-gray-400 hover:text-blue-500" />
                  )}
                </button>

                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-3">
                    <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${getStatusColor(todo.status)}`}>
                      {todo.status.replace('_', ' ')}
                    </span>
                    
                    {todo.priority && (
                      <span className={`text-xs flex items-center gap-1 ${getPriorityColor(todo.priority)}`}>
                        <AlertCircle className="w-3 h-3" /> {todo.priority}
                      </span>
                    )}
                    
                    {todo.labels && todo.labels.length > 0 && (
                      <div className="flex gap-1">
                        {todo.labels.map(label => (
                          <span key={label} className="inline-flex items-center px-2 py-0.5 rounded bg-gray-100 text-[10px] text-gray-600">
                            <Tag className="w-3 h-3 mr-1" />{label}
                          </span>
                        ))}
                      </div>
                    )}
                  </div>

                  <div className={`mt-2 text-xl font-medium ${todo.status === 'done' ? 'line-through text-gray-400' : 'text-gray-900'}`}>
                    {todo.title}
                  </div>
                  
                  {todo.description && (
                    <p className="mt-2 text-gray-600 text-[15px]">{todo.description}</p>
                  )}

                  {/* Subtodos */}
                  {todo.subtodos && todo.subtodos.length > 0 && (
                    <div className="mt-6">
                      <div className="text-xs uppercase tracking-widest text-gray-500 mb-3">SUBTASKS</div>
                      <div className="space-y-2">
                        {todo.subtodos.map((sub) => (
                          <div key={sub.id} className="flex items-center gap-3 pl-6 border-l-2 border-gray-100 text-sm">
                            <div className={sub.status === 'done' ? 'line-through text-gray-400' : ''}>
                              {sub.title}
                            </div>
                            <span className={`text-[10px] px-2 py-px rounded ${getStatusColor(sub.status)}`}>
                              {sub.status}
                            </span>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>

                <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-all">
                  <button
                    onClick={() => setEditingTodo(todo)}
                    className="p-2 text-gray-400 hover:text-blue-600 hover:bg-blue-50 rounded-lg"
                  >
                    <Edit2 className="w-4 h-4" />
                  </button>
                  <button
                    onClick={() => deleteTodo(todo.id)}
                    className="p-2 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded-lg"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              </div>

              {/* Quick Add Subtodo */}
              <div className="mt-6 pl-10 flex gap-2">
                <input
                  type="text"
                  id={`sub-${todo.id}`}
                  placeholder="Add subtodo..."
                  className="flex-1 text-sm border border-transparent focus:border-gray-300 bg-gray-50 focus:bg-white px-4 py-2 rounded-xl outline-none"
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') {
                      const input = e.currentTarget
                      addSubtodo(todo.id, input.value)
                      input.value = ''
                    }
                  }}
                />
                <button
                  onClick={() => {
                    const input = document.getElementById(`sub-${todo.id}`) as HTMLInputElement
                    if (input?.value) {
                      addSubtodo(todo.id, input.value)
                      input.value = ''
                    }
                  }}
                  className="px-5 text-sm bg-gray-900 hover:bg-black text-white rounded-xl"
                >
                  Add
                </button>
              </div>
            </div>
          ))}
        </div>

        <div className="mt-12 text-center text-xs text-gray-400">
          Todo App • Self-contained in todo-app/ • UI refreshes every 3s on YAML changes • 
          Uses Hono API + Vite + React + Tailwind • Follows development-env.md contract
        </div>
      </div>
    </div>
  )
}

export default TodoApp
