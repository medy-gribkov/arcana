# OpenAPI Documentation Generation

## TypeScript with tsoa

```typescript
// src/controllers/UserController.ts
import { Controller, Get, Post, Route, Body, Path } from 'tsoa';

interface User {
  id: number;
  name: string;
  email: string;
}

@Route('users')
export class UserController extends Controller {
  /**
   * Retrieves a user by ID
   * @param userId The user's ID
   */
  @Get('{userId}')
  public async getUser(@Path() userId: number): Promise<User> {
    return { id: userId, name: 'John', email: 'john@example.com' };
  }

  /**
   * Creates a new user
   */
  @Post()
  public async createUser(@Body() requestBody: User): Promise<User> {
    return requestBody;
  }
}
```

Generate spec:
```bash
npm install tsoa
npx tsoa spec
# Output: swagger.json
```

## Go with swaggo

```go
// main.go
package main

import "github.com/gin-gonic/gin"

// @Summary Get user by ID
// @Description Retrieves user information
// @Tags users
// @Produce json
// @Param id path int true "User ID"
// @Success 200 {object} User
// @Router /users/{id} [get]
func getUser(c *gin.Context) {
    // Implementation
}

type User struct {
    ID    int    `json:"id" example:"1"`
    Name  string `json:"name" example:"John Doe"`
    Email string `json:"email" example:"john@example.com"`
}

// @title User API
// @version 1.0
// @description User management API
// @host localhost:8080
// @BasePath /api/v1
func main() {
    // Setup
}
```

Generate spec:
```bash
go install github.com/swaggo/swag/cmd/swag@latest
swag init
# Output: docs/swagger.json
```

## Python with FastAPI

```python
# main.py
from fastapi import FastAPI
from pydantic import BaseModel

app = FastAPI(title="User API", version="1.0.0")

class User(BaseModel):
    id: int
    name: str
    email: str

    class Config:
        json_schema_extra = {
            "example": {
                "id": 1,
                "name": "John Doe",
                "email": "john@example.com"
            }
        }

@app.get("/users/{user_id}", response_model=User)
async def get_user(user_id: int):
    """
    Retrieve a user by ID.

    - **user_id**: The user's unique identifier
    """
    return User(id=user_id, name="John", email="john@example.com")

# OpenAPI auto-generated at /openapi.json
```

## Validate and Lint Specs

```bash
npm install -g @stoplight/spectral-cli

cat > .spectral.yaml << EOF
extends: ["spectral:oas"]
rules:
  operation-description: error
  operation-tags: error
EOF

spectral lint openapi.yaml
```

**BAD - Missing descriptions:**
```yaml
paths:
  /users/{id}:
    get:
      summary: Get user
      # No description, no examples
```

**GOOD - Complete documentation:**
```yaml
paths:
  /users/{id}:
    get:
      summary: Get user by ID
      description: |
        Retrieves detailed user information including profile data,
        preferences, and account status.
      tags: [users]
      parameters:
        - name: id
          in: path
          required: true
          schema:
            type: integer
          example: 42
      responses:
        '200':
          description: User found
          content:
            application/json:
              example:
                id: 42
                name: "John Doe"
                email: "john@example.com"
```

## Render Interactive Docs

```bash
npx swagger-ui-serve openapi.yaml
# Or embed in Express
npm install swagger-ui-express
```

```javascript
// server.js
const swaggerUi = require('swagger-ui-express');
const swaggerDocument = require('./swagger.json');

app.use('/docs', swaggerUi.serve, swaggerUi.setup(swaggerDocument));
```
