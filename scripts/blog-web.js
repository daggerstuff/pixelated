#!/usr/bin/env node

/**
 * 🌟 Pixelated Blog Web Interface 🌟
 * A simple web-based UI for blog management
 */

import { execSync } from 'child_process'
import http from 'http'
import fs from 'fs'
import path from 'path'
import { URL } from 'url'
import { fileURLToPath } from 'url'

// Get current directory
const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

// Run blog publisher command
function runBlogCommand(command) {
  try {
    const result = execSync(`pnpm run blog-publisher -- ${command}`, {
      encoding: 'utf8',
    })
    return { success: true, output: result }
  } catch (err) {
    return {
      success: false,
      error: err.message,
      output: err.stdout || '',
    }
  }
}

// Generate HTML interface
function generateHTML(content = '', message = '') {
  return `
<!DOCTYPE html>
<html>
<head>
  <title>Blog Management Interface</title>
  <style>
    body {
      font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif;
      max-width: 800px;
      margin: 0 auto;
      padding: 20px;
      background-color: #f5f5f5;
      color: #333;
    }
    header {
      background: linear-gradient(135deg, #6e48aa, #9d50bb);
      color: white;
      padding: 20px;
      border-radius: 8px;
      margin-bottom: 20px;
      text-align: center;
    }
    h1 {
      margin: 0;
      font-size: 24px;
    }
    .card {
      background-color: white;
      border-radius: 8px;
      box-shadow: 0 2px 4px rgba(0,0,0,0.1);
      padding: 20px;
      margin-bottom: 20px;
    }
    .actions {
      display: grid;
      grid-template-columns: repeat(auto-fill, minmax(150px, 1fr));
      grid-gap: 15px;
      margin-bottom: 20px;
    }
    .action-btn {
      display: block;
      padding: 15px;
      text-align: center;
      background-color: #f0f0f0;
      border-radius: 8px;
      text-decoration: none;
      color: #333;
      font-weight: bold;
      transition: background-color 0.2s, transform 0.2s;
    }
    .action-btn:hover {
      background-color: #e0e0e0;
      transform: translateY(-2px);
    }
    .content {
      white-space: pre-wrap;
      background-color: #f8f8f8;
      padding: 15px;
      border-radius: 8px;
      border: 1px solid #ddd;
      max-height: 500px;
      overflow-y: auto;
    }
    .message {
      padding: 10px 15px;
      margin-bottom: 20px;
      border-radius: 4px;
    }
    .message.success {
      background-color: #d4edda;
      color: #155724;
    }
    .message.error {
      background-color: #f8d7da;
      color: #721c24;
    }
    form {
      margin-bottom: 20px;
    }
    input, textarea, select {
      width: 100%;
      padding: 8px;
      margin-bottom: 15px;
      border: 1px solid #ddd;
      border-radius: 4px;
      box-sizing: border-box;
    }
    label {
      display: block;
      margin-bottom: 5px;
      font-weight: bold;
    }
    button {
      background-color: #6e48aa;
      color: white;
      border: none;
      padding: 10px 15px;
      border-radius: 4px;
      cursor: pointer;
    }
    button:hover {
      background-color: #5a3b8c;
    }
    .emoji {
      font-size: 1.2em;
    }
  </style>
</head>
<body>
  <header>
    <h1>📝 Blog Management Interface</h1>
  </header>

  ${
    message
      ? `<div class="message ${message.type || ''}">
    ${message.text}
  </div>`
      : ''
  }

  <div class="card">
    <h2>Actions</h2>
    <div class="actions">
      <a href="/?action=status" class="action-btn"><span class="emoji">📊</span> Status</a>
      <a href="/?action=series" class="action-btn"><span class="emoji">📚</span> Series</a>
      <a href="/?action=upcoming" class="action-btn"><span class="emoji">📅</span> Upcoming</a>
      <a href="/?action=overdue" class="action-btn"><span class="emoji">⚠️</span> Overdue</a>
      <a href="/?action=report" class="action-btn"><span class="emoji">📋</span> Report</a>
      <a href="/?action=generate_form" class="action-btn"><span class="emoji">✏️</span> New Post</a>
      <a href="/?action=publish_form" class="action-btn"><span class="emoji">🚀</span> Publish</a>
    </div>
  </div>

  ${content}
</body>
</html>
`
}

// Generate new post form
function generatePostForm() {
  // Get series from the blog publisher
  const seriesResult = runBlogCommand('series')
  let seriesOptions = ''

  if (seriesResult.success) {
    const seriesLines = seriesResult.output.split('\n')
    const seriesList = []

    for (const line of seriesLines) {
      if (line.trim().match(/^[^\s]+.*:$/)) {
        const seriesName = line.trim().replace(/:$/, '').trim()
        seriesList.push(seriesName)
      }
    }

    seriesOptions = seriesList
      .map((series) => `<option value="${series}">${series}</option>`)
      .join('')
  }

  return `
  <div class="card">
    <h2>Create New Post</h2>
    <form action="/" method="get">
      <input type="hidden" name="action" value="generate">

      <label for="title">Post Title:</label>
      <input type="text" id="title" name="title" required placeholder="Enter post title">

      <label for="series">Series (optional):</label>
      <select id="series" name="series">
        <option value="">-- No Series --</option>
        ${seriesOptions}
        <option value="new">Create New Series...</option>
      </select>

      <div id="newSeriesField" style="display: none;">
        <label for="newSeries">New Series Name:</label>
        <input type="text" id="newSeries" name="newSeries" placeholder="Enter new series name">
      </div>

      <button type="submit">Create Post</button>
    </form>
  </div>

  <script>
    document.getElementById('series').addEventListener('change', function() {
      const newSeriesField = document.getElementById('newSeriesField');
      if (this.value === 'new') {
        newSeriesField.style.display = 'block';
      } else {
        newSeriesField.style.display = 'none';
      }
    });
  </script>
  `
}

// Generate publish form
function generatePublishForm() {
  // Find all draft posts
  const statusResult = runBlogCommand('status')
  let draftPosts = []

  try {
    // Find all .mdx files recursively
    const findMdxFiles = (dir) => {
      const files = fs.readdirSync(dir)
      for (const file of files) {
        const filePath = path.join(dir, file)
        const stats = fs.statSync(filePath)

        if (stats.isDirectory()) {
          findMdxFiles(filePath)
        } else if (file.endsWith('.mdx') || file.endsWith('.md')) {
          const content = fs.readFileSync(filePath, 'utf8')
          if (content.includes('draft: true')) {
            // Extract title
            const titleMatch = content.match(/title:\s*['"]?([^'"]+)['"]?/)
            if (titleMatch) {
              draftPosts.push({
                path: filePath,
                title: titleMatch[1],
              })
            }
          }
        }
      }
    }

    const blogDir = path.join(process.cwd(), 'src/content/blog')
    if (fs.existsSync(blogDir)) {
      findMdxFiles(blogDir)
    }
  } catch (err) {
    console.error('Error finding draft posts:', err)
  }

  let postOptions = draftPosts
    .map(
      (post) =>
        `<option value="${post.path}">${post.title} (${post.path})</option>`,
    )
    .join('')

  if (!postOptions) {
    postOptions = '<option value="">No draft posts found</option>'
  }

  return `
  <div class="card">
    <h2>Publish Draft Post</h2>
    <form action="/" method="get">
      <input type="hidden" name="action" value="publish">

      <label for="post">Select Draft Post:</label>
      <select id="post" name="post" required>
        ${postOptions}
      </select>

      <button type="submit" ${postOptions ? '' : 'disabled'}>Publish Post</button>
    </form>
  </div>
  `
}

// Handle HTTP requests
const server = http.createServer((req, res) => {
  const url = new URL(req.url, `http://${req.headers.host}`)
  const action = url.searchParams.get('action')

  let content = ''
  let message = ''

  if (action) {
    switch (action) {
      case 'status':
      case 'series':
      case 'upcoming':
      case 'overdue':
      case 'report':
        const result = runBlogCommand(action)

        if (result.success) {
          content = `
          <div class="card">
            <h2>${action.charAt(0).toUpperCase() + action.slice(1)} Results</h2>
            <pre class="content">${result.output}</pre>
          </div>
          `
        } else {
          message = {
            type: 'error',
            text: `Error: ${result.error}`,
          }

          if (result.output) {
            content = `
            <div class="card">
              <h2>Error Output</h2>
              <pre class="content">${result.output}</pre>
            </div>
            `
          }
        }
        break

      case 'generate_form':
        content = generatePostForm()
        break

      case 'generate':
        const title = url.searchParams.get('title')
        let series = url.searchParams.get('series')
        const newSeries = url.searchParams.get('newSeries')

        if (!title) {
          message = {
            type: 'error',
            text: 'Post title is required',
          }
          content = generatePostForm()
        } else {
          // If "new" is selected and newSeries is provided, use that
          if (series === 'new' && newSeries) {
            series = newSeries
          }

          const seriesArg = series ? `"${series}"` : '""'
          const generateResult = runBlogCommand(
            `generate ${seriesArg} "${title}"`,
          )

          if (generateResult.success) {
            message = {
              type: 'success',
              text: 'Post created successfully!',
            }
            content = `
            <div class="card">
              <h2>Post Created</h2>
              <pre class="content">${generateResult.output}</pre>
            </div>
            `
          } else {
            message = {
              type: 'error',
              text: `Failed to create post: ${generateResult.error}`,
            }
            content = `
            <div class="card">
              <h2>Error Output</h2>
              <pre class="content">${generateResult.output || 'No output available'}</pre>
            </div>
            `
          }
        }
        break

      case 'publish_form':
        content = generatePublishForm()
        break

      case 'publish':
        const post = url.searchParams.get('post')

        if (!post) {
          message = {
            type: 'error',
            text: 'No post selected',
          }
          content = generatePublishForm()
        } else {
          const publishResult = runBlogCommand(`publish "${post}"`)

          if (publishResult.success) {
            message = {
              type: 'success',
              text: 'Post published successfully!',
            }
            content = `
            <div class="card">
              <h2>Publication Result</h2>
              <pre class="content">${publishResult.output}</pre>
            </div>
            `
          } else {
            message = {
              type: 'error',
              text: `Failed to publish post: ${publishResult.error}`,
            }
            content = `
            <div class="card">
              <h2>Error Output</h2>
              <pre class="content">${publishResult.output || 'No output available'}</pre>
            </div>
            `
          }
        }
        break

      default:
        message = {
          type: 'error',
          text: `Unknown action: ${action}`,
        }
    }
  } else {
    // Default page with welcome message
    content = `
    <div class="card">
      <h2>Welcome to Blog Management</h2>
      <p>Select an action from the buttons above to manage your blog content.</p>
    </div>
    `
  }

  res.writeHead(200, { 'Content-Type': 'text/html' })
  res.end(generateHTML(content, message))
})

// Start server
const PORT = process.env.PORT || 3333
server.listen(PORT, () => {
  const url = `http://localhost:${PORT}`
  console.log(`Blog management interface running at ${url}`)

  // Try to open the URL in the default browser
  try {
    const command =
      process.platform === 'darwin'
        ? 'open'
        : process.platform === 'win32'
          ? 'start'
          : 'xdg-open'
    execSync(`${command} ${url}`)
  } catch (err) {
    console.log(`Please open your browser to: ${url}`)
  }
})

// Gracefully handle ctrl+c
process.on('SIGINT', () => {
  console.log('\nShutting down server...')
  server.close(() => {
    console.log('Server terminated')
    process.exit(0)
  })
})
