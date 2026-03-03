# Mermaid and C4 Architecture Diagrams

## Mermaid Sequence Diagram

```mermaid
sequenceDiagram
    participant User
    participant API
    participant Auth
    participant DB

    User->>API: POST /login
    API->>Auth: Validate credentials
    Auth->>DB: Query user
    DB-->>Auth: User data
    Auth->>Auth: Generate JWT
    Auth-->>API: Token
    API-->>User: 200 + Set-Cookie
```

Renders to interactive diagram on GitHub/GitLab.

## Mermaid Flowchart

```mermaid
flowchart TD
    A[User requests page] --> B{Authenticated?}
    B -->|Yes| C[Load dashboard]
    B -->|No| D[Redirect to login]
    C --> E{Has permissions?}
    E -->|Yes| F[Show data]
    E -->|No| G[Show error]
    D --> H[Login form]
    H --> I[Submit credentials]
    I --> B
```

## Mermaid Entity Relationship

```mermaid
erDiagram
    USER ||--o{ ORDER : places
    USER {
        int id PK
        string email UK
        string name
    }
    ORDER ||--|{ ORDER_ITEM : contains
    ORDER {
        int id PK
        int user_id FK
        datetime created_at
    }
    ORDER_ITEM {
        int id PK
        int order_id FK
        int product_id FK
        int quantity
    }
    PRODUCT ||--o{ ORDER_ITEM : "ordered in"
    PRODUCT {
        int id PK
        string name
        decimal price
    }
```

## Render to Static Image

```bash
npm install -g @mermaid-js/mermaid-cli
mmdc -i diagram.mmd -o diagram.svg
mmdc -i diagram.mmd -o diagram.png -b transparent
```

## C4 Model: System Context

```
workspace {
    model {
        user = person "User" "End user of the system"
        admin = person "Admin" "System administrator"

        system = softwareSystem "E-commerce Platform" {
            webapp = container "Web App" "Next.js" "Provides UI"
            api = container "API" "Go" "REST API"
            db = container "Database" "PostgreSQL" "Stores data"
            cache = container "Cache" "Redis" "Session storage"
        }

        email = softwareSystem "Email Service" "SendGrid" "Sends emails"
        payment = softwareSystem "Payment Gateway" "Stripe"

        user -> webapp "Uses"
        admin -> webapp "Administers"
        webapp -> api "Calls" "HTTPS/JSON"
        api -> db "Reads/Writes" "SQL"
        api -> cache "Caches" "Redis Protocol"
        api -> email "Sends via"
        api -> payment "Processes via"
    }

    views {
        systemContext system "SystemContext" {
            include *
            autolayout lr
        }

        container system "Containers" {
            include *
            autolayout lr
        }
    }
}
```

Save as `workspace.dsl`.

## Render with Structurizr

```bash
# Using Docker
docker run -it --rm -v $(pwd):/usr/local/structurizr structurizr/lite
# Open http://localhost:8080
```

## Export to PlantUML

```bash
docker run -v $(pwd):/workspace structurizr/cli export -workspace workspace.dsl -format plantuml
docker run -v $(pwd):/data plantuml/plantuml *.puml
```
