# Server Architecture

## Current Architecture (Modular)

The application uses a **modular server architecture** located in `server/app.js`.

### Key Components:

- **Main Server**: `server/app.js`
- **Routes**: `server/routes/` (auth, projects, features, scenarios, testcases)
- **Services**: `server/services/` (database, fileService)
- **Middleware**: `server/middleware/` (auth, security, errorHandler)
- **Configuration**: `server/config/`

### Development Commands:

```bash
# Start backend server (modular)
npm run server

# Start backend with nodemon (development)
npm run server:dev

# Start frontend
npm run dev

# Start both servers
./dev-servers.sh
```

### Server Features:

✅ **Complete API Coverage**: All endpoints from auth to test case generation  
✅ **Enhanced Security**: Rate limiting, authentication, error handling  
✅ **File Management**: Secure screenshot handling and serving  
✅ **Database Integration**: SQLite with migration support  
✅ **AI Integration**: Claude + GPT-4 Vision support  
✅ **Logging**: Structured logging with Winston  

### Ports:

- **Frontend**: http://localhost:3000 (Next.js)
- **Backend**: http://localhost:3001 (Express + Modular Architecture)

## Migration Complete

The legacy monolithic server has been completely replaced with the modular architecture. All functionality has been migrated and enhanced.
