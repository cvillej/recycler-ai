import { Hono } from 'hono'
import { cors } from 'hono/cors'
import yaml from 'js-yaml'
import fs from 'fs/promises'
import path from 'path'
import { fileURLToPath } from 'url'
import { serve } from '@hono/node-server'

const TODO_DIR = path.resolve(process.cwd(), '../todo')
const TODO_FILE = path.join(TODO_DIR, 'todos.yaml')
const CONFIG_FILE = path.join(TODO_DIR, 'todo-config.json')

console.log('📍 Using todo directory:', TODO_DIR)
console.log('📄 Todo file path:', TODO_FILE)
console.log('Current working directory:', process.cwd())

const app = new Hono()

// CORS for frontend
app.use('/*', cors())

// Load config
let config: any = {}
async function loadConfig() {
  try {
    const data = await fs.readFile(CONFIG_FILE, 'utf8')
    config = JSON.parse(data)
  } catch (e) {
    console.warn('Config not found, using defaults')
    config = {
      allowedLabels: ['ui', 'backend', 'devtools'],
      statusOptions: ['unstarted', 'in_progress', 'blocked', 'done']
    }
  }
}

// Load/Save todos
async function loadTodos() {
  try {
    const data = await fs.readFile(TODO_FILE, 'utf8')
    return yaml.load(data) || { lastUpdated: new Date().toISOString(), todos: [] }
  } catch (e) {
    return { lastUpdated: new Date().toISOString(), todos: [] }
  }
}

async function saveTodos(todosData: any) {
  todosData.lastUpdated = new Date().toISOString()
  const yamlStr = yaml.dump(todosData, { indent: 2 })
  await fs.writeFile(TODO_FILE, yamlStr, 'utf8')
  return todosData
}

// API Routes - following development-env.md contract
app.get('/api/todos', async (c) => {
  const todos = await loadTodos()
  return c.json(todos)
})

app.get('/api/todos/:id', async (c) => {
  const id = c.req.param('id')
  const todosData = await loadTodos()
  const todo = todosData.todos?.find((t: any) => t.id === id)
  if (!todo) return c.json({ error: 'Todo not found' }, 404)
  return c.json(todo)
})

app.post('/api/todos', async (c) => {
  const body = await c.req.json()
  const todosData = await loadTodos()
  
  const newTodo = {
    id: `todo-${Date.now()}`,
    ...body,
    status: body.status || 'unstarted',
    subtodos: body.subtodos || []
  }
  
  todosData.todos = todosData.todos || []
  todosData.todos.unshift(newTodo) // Add to top
  await saveTodos(todosData)
  return c.json(newTodo, 201)
})

app.put('/api/todos/:id', async (c) => {
  const id = c.req.param('id')
  const updates = await c.req.json()
  const todosData = await loadTodos()
  
  const index = todosData.todos?.findIndex((t: any) => t.id === id)
  if (index === -1) return c.json({ error: 'Todo not found' }, 404)
  
  todosData.todos[index] = { ...todosData.todos[index], ...updates }
  await saveTodos(todosData)
  return c.json(todosData.todos[index])
})

app.post('/api/todos/:id/subtodos', async (c) => {
  const id = c.req.param('id')
  const subTodoData = await c.req.json()
  const todosData = await loadTodos()
  
  const todo = todosData.todos?.find((t: any) => t.id === id)
  if (!todo) return c.json({ error: 'Todo not found' }, 404)
  
  const newSubtodo = {
    id: `${id}-${Date.now()}`,
    ...subTodoData,
    status: subTodoData.status || 'unstarted'
  }
  
  todo.subtodos = todo.subtodos || []
  todo.subtodos.push(newSubtodo)
  await saveTodos(todosData)
  return c.json(newSubtodo, 201)
})

// Config endpoint
app.get('/api/config', async (c) => {
  await loadConfig()
  return c.json(config)
})

// DELETE endpoint
app.delete('/api/todos/:id', async (c) => {
  const id = c.req.param('id')
  const todosData = await loadTodos()
  const initialLength = todosData.todos?.length || 0
  todosData.todos = todosData.todos?.filter((t: any) => t.id !== id) || []
  
  if (todosData.todos.length === initialLength) {
    return c.json({ error: 'Todo not found' }, 404)
  }
  
  await saveTodos(todosData)
  return c.json({ success: true, message: 'Todo deleted' })
})

// Health check
app.get('/api/health', (c) => c.json({ 
  status: 'ok', 
  todoFile: TODO_FILE.replace(process.cwd(), ''), 
  message: 'Todo API ready. UI available at http://localhost:5174'
}))

// For production, serve static files from dist (using Hono static middleware)
if (process.env.NODE_ENV === 'production') {
  // In production, you would copy dist to public or use proper static serve
  app.get('/*', (c) => c.html(`
    <!DOCTYPE html>
    <html><body><h1>Todo App Production Build</h1><p>Run build and serve static files.</p></body></html>
  `))
}

export default app

// Start server when run directly (e.g. with tsx server.ts or npm run server)
if (import.meta.url === `file://${process.argv[1]}` || process.argv[1]?.includes('server.ts')) {
  const port = parseInt(process.env.PORT || '3001')
  console.log(`🚀 Todo API server starting on http://localhost:${port}`)
  console.log(`📡 UI available at http://localhost:5174 (with auto-refresh on YAML changes)`)
  console.log(`📁 Reading/writing todos from: ${TODO_FILE}`)
  
  serve({
    fetch: app.fetch,
    port,
  }, (info) => {
    console.log(`✅ Hono server listening on http://localhost:${info.port}`)
  })
}
