# Switch Groups API Documentation

This document describes the REST API endpoints for managing switch groups in the Rust+ Bot.

## Base URL

All endpoints are prefixed with `/api/switchGroups`

---

## Endpoints

### 1. Get All Switch Groups

Returns all switch groups across all servers with their switch details.

**Endpoint:** `GET /api/switchGroups`

**Request:**
```http
GET /api/switchGroups
```

**Response:**
```json
{
  "switchGroups": [
    {
      "groupId": "123",
      "guildId": "1235012279033139251",
      "serverId": "server123",
      "name": "My Group",
      "command": "mygroup",
      "switches": [
        {
          "entityId": "switch1",
          "name": "Switch Name",
          "active": true,
          "reachable": true,
          "location": "A1"
        },
        {
          "entityId": "switch2",
          "name": "Another Switch",
          "active": false,
          "reachable": true,
          "location": "B2"
        }
      ],
      "image": "smart_switch.png",
      "messageId": "1234567890123456789"
    }
  ]
}
```

**Response Fields:**
- `switchGroups` (array) - Array of switch group objects
  - `groupId` (string) - Unique identifier for the switch group
  - `guildId` (string) - Discord guild ID
  - `serverId` (string) - Rust server ID
  - `name` (string) - Display name of the group
  - `command` (string) - Custom command for the group
  - `switches` (array) - Array of switch objects in the group
    - `entityId` (string) - Switch entity ID
    - `name` (string) - Switch display name
    - `active` (boolean) - Current on/off state
    - `reachable` (boolean) - Whether the switch is reachable
    - `location` (string|null) - Grid location (e.g., "A1")
  - `image` (string) - Image filename for the group
  - `messageId` (string|null) - Discord message ID if exists

**Status Codes:**
- `200` - Success

---

### 2. Get Specific Switch Group

Returns details for a specific switch group by groupId.

**Endpoint:** `GET /api/switchGroups/:groupId`

**Request:**
```http
GET /api/switchGroups/123
```

**Path Parameters:**
- `groupId` (required) - The switch group ID

**Response:**
```json
{
  "groupId": "123",
  "guildId": "1235012279033139251",
  "serverId": "server123",
  "name": "My Group",
  "command": "mygroup",
  "switches": [
    {
      "entityId": "switch1",
      "name": "Switch Name",
      "active": true,
      "reachable": true,
      "location": "A1"
    }
  ],
  "image": "smart_switch.png",
  "messageId": "1234567890123456789"
}
```

**Status Codes:**
- `200` - Success
- `404` - Switch group not found

**Error Response (404):**
```json
{
  "error": "Not Found",
  "message": "Switch group not found",
  "status": 404
}
```

---

### 3. Create New Switch Group

Creates a new switch group with the specified switches.

**Endpoint:** `POST /api/switchGroups`

**Request:**
```http
POST /api/switchGroups
Content-Type: application/json
```

**Request Body:**
```json
{
  "serverId": "server123",
  "name": "My New Group",
  "command": "newgroup",
  "switches": ["switch1", "switch2", "switch3"]
}
```

**Request Fields:**
- `serverId` (required, string) - The server ID where the group will be created
- `name` (optional, string) - Group name (defaults to "Group" if not provided)
- `command` (optional, string) - Custom command for the group (defaults to groupId if not provided)
- `switches` (optional, array) - Array of switch entityIds to include in the group (must exist in the server)

**Response:**
```json
{
  "groupId": "456789",
  "guildId": "1235012279033139251",
  "serverId": "server123",
  "name": "My New Group",
  "command": "newgroup",
  "switches": ["switch1", "switch2", "switch3"],
  "image": "smart_switch.png"
}
```

**Status Codes:**
- `200` - Success
- `404` - Server not found
- `500` - Could not generate unique group ID

**Error Response (404):**
```json
{
  "error": "Not Found",
  "message": "Server not found",
  "status": 404
}
```

**Error Response (500):**
```json
{
  "error": "Internal Server Error",
  "message": "Could not generate unique group ID",
  "status": 500
}
```

---

### 4. Update Switch Group

Updates an existing switch group. All fields are optional - only provided fields will be updated.

**Endpoint:** `PUT /api/switchGroups/:groupId`

**Request:**
```http
PUT /api/switchGroups/123
Content-Type: application/json
```

**Path Parameters:**
- `groupId` (required) - The switch group ID to update

**Request Body:** (all fields optional)
```json
{
  "name": "Updated Group Name",
  "command": "updatedcmd",
  "switches": ["switch1", "switch2", "switch4"]
}
```

**Request Fields:**
- `name` (optional, string) - New group name
- `command` (optional, string) - New custom command
- `switches` (optional, array) - Array of switch entityIds (replaces existing switches, validates they exist)

**Response:**
```json
{
  "groupId": "123",
  "guildId": "1235012279033139251",
  "serverId": "server123",
  "name": "Updated Group Name",
  "command": "updatedcmd",
  "switches": ["switch1", "switch2", "switch4"],
  "image": "smart_switch.png"
}
```

**Status Codes:**
- `200` - Success
- `404` - Switch group not found

**Error Response (404):**
```json
{
  "error": "Not Found",
  "message": "Switch group not found",
  "status": 404
}
```

---

### 5. Delete Switch Group

Deletes a switch group and its Discord message.

**Endpoint:** `DELETE /api/switchGroups/:groupId`

**Request:**
```http
DELETE /api/switchGroups/123
```

**Path Parameters:**
- `groupId` (required) - The switch group ID to delete

**Response:**
```json
{
  "success": true
}
```

**Status Codes:**
- `200` - Success
- `404` - Switch group not found

**Error Response (404):**
```json
{
  "error": "Not Found",
  "message": "Switch group not found",
  "status": 404
}
```

---

## Important Notes

### Switch Validation
When adding or updating switches in a group:
- Only existing switch entityIds are added to the group
- Invalid switch IDs are silently ignored
- The switches array will only contain valid switch IDs that exist in the server

### Auto-Generated IDs
- When creating a new switch group, a unique `groupId` is automatically generated
- The `groupId` is a random number (0-999999) that doesn't conflict with existing groups

### Discord Integration
- Changes to switch groups automatically update Discord messages if the switchGroups channel is configured
- When a group is deleted, its Discord message is also deleted

### Switch Details
Each switch in a group includes:
- `entityId` - The switch's entity ID (used for API calls)
- `name` - Human-readable switch display name
- `active` - Current on/off state (true = on, false = off)
- `reachable` - Whether the switch is currently reachable via Rust+ API
- `location` - Grid location string (e.g., "A1", "B2") or null if not set

---

## Example Usage

### Create a new switch group
```bash
curl -X POST http://localhost:3000/api/switchGroups \
  -H "Content-Type: application/json" \
  -d '{
    "serverId": "server123",
    "name": "Lights Group",
    "command": "lights",
    "switches": ["switch1", "switch2", "switch3"]
  }'
```

### Get all switch groups
```bash
curl http://localhost:3000/api/switchGroups
```

### Update a switch group
```bash
curl -X PUT http://localhost:3000/api/switchGroups/123 \
  -H "Content-Type: application/json" \
  -d '{
    "name": "Updated Lights",
    "switches": ["switch1", "switch2", "switch4", "switch5"]
  }'
```

### Delete a switch group
```bash
curl -X DELETE http://localhost:3000/api/switchGroups/123
```

---

## Error Handling

All endpoints return standard HTTP status codes:
- `200` - Success
- `400` - Bad Request (invalid parameters)
- `404` - Not Found (resource doesn't exist)
- `500` - Internal Server Error

Error responses follow this format:
```json
{
  "error": "Error Type",
  "message": "Human-readable error message",
  "status": 404
}
```

